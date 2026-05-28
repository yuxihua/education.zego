/**
 * 全局错误处理中间件
 * 统一捕获和处理 API 错误
 */
const { fail } = require('../utils/response');

/**
 * 404 路由不存在
 */
function notFound(req, res, next) {
  fail(res, `接口不存在: ${req.method} ${req.originalUrl}`, 404, 404);
}

/**
 * 全局错误处理
 */
function errorHandler(err, req, res, next) {
  // 默认错误信息
  let statusCode = err.statusCode || 500;
  let message = err.message || '服务器内部错误';
  let errorCode = err.errorCode || statusCode;

  // Sequelize 数据库错误
  if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    errorCode = 400;
    message = err.errors.map(e => e.message).join(', ');
  }
  
  if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    errorCode = 409;
    message = '数据已存在，请勿重复提交';
  }
  
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
    errorCode = 400;
    message = '关联数据不存在';
  }

  // JWT 错误
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 401;
    message = '无效的认证信息';
  }
  
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 401;
    message = '登录已过期，请重新登录';
  }

  // 参数验证错误
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 400;
  }

  // 文件上传错误
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    errorCode = 413;
    message = '文件大小超出限制';
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    errorCode = 400;
    message = '不支持的文件字段';
  }

  // 开发环境打印详细错误
  if (process.env.NODE_ENV === 'development') {
    console.error('[Error]', {
      message: err.message,
      stack: err.stack,
      statusCode,
      errorCode,
      path: req.originalUrl,
      method: req.method
    });
  } else {
    // 生产环境记录关键错误
    console.error(`[Error] ${req.method} ${req.originalUrl} - ${message}`);
  }

  fail(res, message, statusCode, errorCode);
}

/**
 * 异步错误包装器
 * 自动捕获 async 函数中的错误
 * @param {Function} fn
 * @returns {Function}
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  notFound,
  errorHandler,
  asyncHandler
};
