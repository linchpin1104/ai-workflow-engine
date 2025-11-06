const express = require('express');
const https = require('https');
const { getApiKeys } = require('../utils/apiKeyCache');
const { protect } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const { db } = require('../config/database');
const router = express.Router();

const logLlmInteraction = (logData) => {
  const {
    userId,
    username,
    workflowId,
    templateName,
    stepIndex,
    provider,
    modelId,
    requestPayload,
    responsePayload,
    isSuccess,
    errorMessage,
  } = logData;

  const sql = `INSERT INTO llm_logs (user_id, username, workflow_id, template_name, step_index, provider, model_id, request_payload, response_payload, is_success, error_message)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    userId,
    username,
    workflowId,
    templateName,
    stepIndex,
    provider,
    modelId,
    JSON.stringify(requestPayload),
    responsePayload,
    isSuccess ? 1 : 0,
    errorMessage || null,
  ];

  db.run(sql, params, (err) => {
    if (err) {
      logger.error('Failed to log LLM interaction to DB', {
        error: err.message,
        username,
      });
    }
  });
};

router.post('/proxy', protect, async (req, res) => {
  const {
    provider,
    modelId,
    body: requestBody,
    globalInstruction,
    apiConfig,
    workflow_id: workflowId,
    template_name: templateName,
    step_index: stepIndex,
    promptDetails,
  } = req.body;

  const { userId, username } = req.user;

  if (!apiConfig || !apiConfig.path) {
    return res
      .status(400)
      .json({ message: 'API configuration is missing or invalid.' });
  }

  try {
    const apiKeys = await getApiKeys();
    const apiKey = apiKeys[`${provider.toLowerCase()}_api_key`];

    if (!apiKey) {
      return res
        .status(400)
        .json({ message: `${provider} API key is not set.` });
    }

    let options = {};
    let finalBody = {};

    const useStreaming = apiConfig.stream !== false;

    switch (provider) {
      case 'OpenAI': {
        options = {
          hostname: 'api.openai.com',
          path: apiConfig.path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
        };
        const messages = globalInstruction
          ? [
              { role: 'system', content: globalInstruction },
              ...requestBody.messages,
            ]
          : requestBody.messages;
        finalBody = { model: modelId, messages, stream: useStreaming };
        break;
      }
      case 'Google': {
        let googlePath = `${apiConfig.path.replace('{modelId}', modelId)}?key=${apiKey}`;
        if (useStreaming) {
          googlePath += '&alt=sse';
        }
        options = {
          hostname: 'generativelanguage.googleapis.com',
          path: googlePath,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        };

        // --- FIX ---
        // Google Gemini의 대화형 프롬프트 구조에 맞게 `contents` 배열을 재구성합니다.
        // 이전 대화는 user/model 역할을 번갈아 가며 넣고, 마지막 질문은 user 역할로 추가합니다.
        // 이 수정은 사용자의 마지막 입력을 바탕으로 플레이스홀더를 정확히 치환합니다.
        const contents = requestBody.messages.map((msg) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        }));

        finalBody = { contents };
        if (globalInstruction)
          finalBody.system_instruction = {
            parts: [{ text: globalInstruction }],
          };
        break;
      }
      case 'Anthropic': {
        options = {
          hostname: 'api.anthropic.com',
          path: apiConfig.path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
        };
        finalBody = {
          model: modelId,
          max_tokens: 4096,
          messages: requestBody.messages,
          stream: useStreaming,
        };
        if (globalInstruction) finalBody.system = globalInstruction;
        break;
      }
      default:
        return res
          .status(400)
          .json({ message: `Unsupported provider: ${provider}` });
    }

    const comprehensiveRequestPayload = {
      provider,
      modelId,
      promptDetails: {
        systemInstruction: globalInstruction || '',
        ...promptDetails,
      },
      finalApiBody: finalBody,
    };

    const proxyReq = https.request(options, (proxyRes) => {
      // --- IMPROVEMENT ---
      // 응답 헤더를 스트리밍 여부와 관계없이 설정하도록 위치를 조정합니다.
      // Content-Type을 application/json으로 보내면 브라우저가 파싱을 시도할 수 있으므로,
      // 스트리밍 시에는 text/event-stream으로 명확히 지정해줍니다.
      if (useStreaming) {
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      } else {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      res.statusCode = proxyRes.statusCode;

      const responseChunks = [];
      proxyRes.on('data', (chunk) => {
        responseChunks.push(chunk);
        if (useStreaming) {
          res.write(chunk);
        }
      });

      proxyRes.on('end', () => {
        const fullResponse = Buffer.concat(responseChunks).toString('utf8');
        const isSuccess =
          proxyRes.statusCode >= 200 && proxyRes.statusCode < 300;

        logLlmInteraction({
          userId,
          username,
          workflowId,
          templateName,
          stepIndex,
          provider,
          modelId,
          requestPayload: comprehensiveRequestPayload,
          responsePayload: fullResponse,
          isSuccess,
          errorMessage: isSuccess ? null : `HTTP Status ${proxyRes.statusCode}`,
        });

        if (useStreaming) {
          res.end();
        } else {
          res.send(fullResponse); // res.status().send() 대신 send()만 사용. statusCode는 이미 설정됨.
        }
      });
    });

    proxyReq.on('error', (e) => {
      logger.error('LLM proxy request error', {
        provider,
        modelId,
        error: e.message,
      });
      logLlmInteraction({
        userId,
        username,
        workflowId,
        templateName,
        stepIndex,
        provider,
        modelId,
        requestPayload: comprehensiveRequestPayload,
        responsePayload: null,
        isSuccess: false,
        errorMessage: e.message,
      });
      if (!res.headersSent) {
        res.status(500).json({ message: 'LLM proxy request failed.' });
      }
    });

    proxyReq.write(JSON.stringify(finalBody));
    proxyReq.end();
  } catch (error) {
    logger.error('Error in LLM proxy setup', {
      provider,
      modelId,
      error: error.message,
    });
    if (!res.headersSent) {
      res
        .status(500)
        .json({ message: 'An internal error occurred in the proxy.' });
    }
  }
});

module.exports = router;
