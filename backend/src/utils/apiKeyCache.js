const { db } = require('../config/database');
const logger = require('./logger');

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const getApiKeys = async () => {
  const now = Date.now();
  if (cache.has('apiKeys') && cache.get('apiKeys').expiry > now) {
    return cache.get('apiKeys').value;
  }

  // 환경 변수에서 API 키를 먼저 확인 (우선순위 1)
  const envApiKeys = {
    openai_api_key: process.env.OPENAI_API_KEY || null,
    google_api_key: process.env.GOOGLE_API_KEY || null,
    anthropic_api_key: process.env.ANTHROPIC_API_KEY || null,
  };

  // 환경 변수에 모든 키가 있으면 바로 반환
  if (
    envApiKeys.openai_api_key &&
    envApiKeys.google_api_key &&
    envApiKeys.anthropic_api_key
  ) {
    logger.info('API keys loaded from environment variables.');
    cache.set('apiKeys', {
      value: envApiKeys,
      expiry: now + CACHE_TTL_MS,
    });
    return envApiKeys;
  }

  // 데이터베이스에서 API 키 가져오기 (우선순위 2)
  try {
    const result = await db.query('SELECT key, value FROM settings');
    const dbApiKeys = result.rows.reduce(
      (acc, row) => ({ ...acc, [row.key]: row.value }),
      {}
    );

    // 환경 변수와 데이터베이스 키 병합 (환경 변수가 우선)
    const mergedApiKeys = {
      openai_api_key:
        envApiKeys.openai_api_key || dbApiKeys.openai_api_key || null,
      google_api_key:
        envApiKeys.google_api_key || dbApiKeys.google_api_key || null,
      anthropic_api_key:
        envApiKeys.anthropic_api_key || dbApiKeys.anthropic_api_key || null,
    };

    cache.set('apiKeys', {
      value: mergedApiKeys,
      expiry: now + CACHE_TTL_MS,
    });
    logger.info('API keys loaded from DB and cached.');
    return mergedApiKeys;
  } catch (err) {
    logger.error('Failed to retrieve API keys from DB.', {
      error: err.message,
    });
    // 데이터베이스 조회 실패 시 환경 변수만 반환
    logger.info('Using environment variables only.');
    return envApiKeys;
  }
};

const invalidateCache = () => {
  cache.delete('apiKeys');
  logger.info('API key cache invalidated.');
};

module.exports = { getApiKeys, invalidateCache };
