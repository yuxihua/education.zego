const { OperationLog } = require('../models');

function sanitizeValue(input) {
  if (input === null || input === undefined) return input;
  if (typeof input !== 'object') return input;

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeValue(item));
  }

  const out = {};
  Object.keys(input).forEach((key) => {
    if (['password', 'oldPassword', 'newPassword', 'token', 'accessToken', 'refreshToken'].includes(key)) {
      out[key] = '***';
      return;
    }
    out[key] = sanitizeValue(input[key]);
  });
  return out;
}

async function writeOperationLog(req, options = {}) {
  try {
    const payload = options.payload !== undefined ? options.payload : req.body;
    const decoded = req.user || null;

    await OperationLog.create({
      institutionId: options.institutionId ?? decoded?.institutionId ?? 0,
      userId: options.userId ?? decoded?.id ?? null,
      username: options.username ?? decoded?.username ?? null,
      role: options.role ?? decoded?.role ?? null,
      method: options.method ?? req.method,
      path: options.path ?? req.originalUrl.split('?')[0],
      ip: req.ip,
      userAgent: (req.headers['user-agent'] || '').slice(0, 255),
      requestBody: {
        action: options.action || null,
        payload: sanitizeValue(payload),
        extra: sanitizeValue(options.extra || {}),
        durationMs: options.durationMs ?? null
      },
      statusCode: options.statusCode ?? 200,
      success: options.success ?? true,
      message: options.message || 'OK'
    });
  } catch (err) {
    if (global.logger) {
      global.logger.error(`[OperationLogWriter] 写入失败: ${err.message}`);
    }
  }
}

module.exports = {
  writeOperationLog
};