/**
 * 订单路由
 * 订单列表、详情、统计
 */
const express = require('express');
const router = express.Router();
const { Order, Course, Student } = require('../models');
const { success, fail } = require('../utils/response');
const { asyncHandler } = require('../middleware/error');
const { auth } = require('../middleware/auth');

/**
 * @GET /api/order/list
 * 获取订单列表
 */
router.get('/list', auth, asyncHandler(async (req, res) => {
  const { page = 1, size = 10, status } = req.query;
  const where = {};
  if (status) where.status = status;

  const { count, rows } = await Order.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    offset: (page - 1) * size,
    limit: parseInt(size)
  });

  success(res, { list: rows, total: count, page: parseInt(page), size: parseInt(size) });
}));

/**
 * @GET /api/order/stats
 * 订单统计
 */
router.get('/stats', auth, asyncHandler(async (req, res) => {
  const total = await Order.count();
  const paid = await Order.count({ where: { status: 'paid' } });
  const pending = await Order.count({ where: { status: 'pending' } });
  
  success(res, { total, paid, pending, todayCount: 0, todayAmount: 0, monthCount: total, monthAmount: 0 });
}));

module.exports = router;
