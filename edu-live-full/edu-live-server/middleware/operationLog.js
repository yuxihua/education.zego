/**
 * 系统操作日志中间件
 */
const { verifyToken } = require('./auth');
const { OperationLog } = require('../models');

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const REDACT_KEYS = new Set(['password', 'oldPassword', 'newPassword', 'token', 'accessToken', 'refreshToken']);

function sanitizeBody(input) {
  if (!input || typeof input !== 'object') return input;

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeBody(item));
  }

  const out = {};
  Object.keys(input).forEach((key) => {
    if (REDACT_KEYS.has(key)) {
      out[key] = '***';
      return;
    }
    out[key] = sanitizeBody(input[key]);
  });
  return out;
}

function parseUserFromAuthHeader(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return verifyToken(token);
}

async function operationLog(req, res, next) {
  if (!WRITE_METHODS.has(req.method)) return next();
  if (!req.originalUrl.startsWith('/api/')) return next();

  const start = Date.now();
  const decoded = req.user || parseUserFromAuthHeader(req);
  const requestBody = sanitizeBody(req.body || {});

  res.on('finish', async () => {
    try {
      const code = res.statusCode;
      const success = code < 400;
      const duration = Date.now() - start;
      const safeMessage = success ? 'OK' : `HTTP_${code}`;

      await OperationLog.create({
        institutionId: decoded?.institutionId || 0,
        userId: decoded?.id || null,
        username: decoded?.username || null,
        role: decoded?.role || null,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        ip: req.ip,
        userAgent: (req.headers['user-agent'] || '').slice(0, 255),
        requestBody: {
          payload: requestBody,
          durationMs: duration
        },
        statusCode: code,
        success,
        message: safeMessage
      });
    } catch (err) {
      if (global.logger) {
        global.logger.error(`[OperationLog] 写入失败: ${err.message}`);
      }
    }
  });

  next();
}

module.exports = {
  operationLog
};
