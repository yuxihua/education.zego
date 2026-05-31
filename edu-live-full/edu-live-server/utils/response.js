/**
 * 统一 API 响应格式
 */

/**
 * 成功响应
 * @param {object} res - Express response 对象
 * @param {any} data - 响应数据
 * @param {string} message - 成功消息
 * @param {number} statusCode - HTTP 状态码
 */
function success(res, data = null, message = '操作成功', statusCode = 200) {
  return res.status(statusCode).json({
    code: 0,
    message,
    data,
    timestamp: Date.now()
  });
}

/**
 * 失败响应
 * @param {object} res - Express response 对象
 * @param {string} message - 错误消息
 * @param {number} statusCode - HTTP 状态码
 * @param {number} errorCode - 业务错误码
 */
function fail(res, message = '操作失败', statusCode = 400, errorCode = 400, data = null) {
  return res.status(statusCode).json({
    code: errorCode,
    message,
    data,
    timestamp: Date.now()
  });
}

/**
 * 分页响应
 * @param {object} res - Express response 对象
 * @param {Array} list - 数据列表
 * @param {number} total - 总条数
 * @param {number} page - 当前页
 * @param {number} pageSize - 每页条数
 */
function page(res, list = [], total = 0, page = 1, pageSize = 10) {
  return res.status(200).json({
    code: 0,
    message: 'success',
    data: {
      list,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    },
    timestamp: Date.now()
  });
}

module.exports = {
  success,
  fail,
  page
};
