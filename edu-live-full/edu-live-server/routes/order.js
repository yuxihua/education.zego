/**
 * 订单管理路由（后台）
 */
const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { Order, Student, Course } = require('../models');
const { success, fail } = require('../utils/response');
const { asyncHandler } = require('../middleware/error');
const { auth, requireRole } = require('../middleware/auth');

const ADMIN_ROLES = ['superadmin', 'admin', 'assistant', 'teacher'];

/**
 * @GET /api/order/list
 * 订单列表
 */
router.get('/list', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const { page = 1, size, pageSize, status, payType, keyword } = req.query;

  const where = {};
  if (status) where.status = status;
  if (payType) where.payType = payType;

  if (req.user.role !== 'superadmin') {
    where.institutionId = req.user.institutionId || 0;
  }

  const include = [
    { model: Student, as: 'student', attributes: ['id', 'nickname', 'realName', 'phone'] },
    { model: Course, as: 'course', attributes: ['id', 'title'] }
  ];

  if (keyword) {
    where[Op.or] = [
      { orderNo: { [Op.like]: `%${keyword}%` } },
      { '$student.nickname$': { [Op.like]: `%${keyword}%` } },
      { '$student.realName$': { [Op.like]: `%${keyword}%` } },
      { '$student.phone$': { [Op.like]: `%${keyword}%` } },
      { '$course.title$': { [Op.like]: `%${keyword}%` } }
    ];
  }

  const pageNum = parseInt(page, 10) || 1;
  const pageSizeNum = parseInt(size || pageSize, 10) || 20;

  const { count, rows } = await Order.findAndCountAll({
    where,
    include,
    distinct: true,
    subQuery: false,
    order: [['createdAt', 'DESC']],
    offset: (pageNum - 1) * pageSizeNum,
    limit: pageSizeNum
  });

  const list = rows.map((item) => {
    const row = item.toJSON();
    return {
      ...row,
      studentName: row.student?.realName || row.student?.nickname || '-',
      courseName: row.course?.title || '-',
      createTime: row.createdAt
    };
  });

  success(res, {
    list,
    total: count,
    page: pageNum,
    size: pageSizeNum
  });
}));

/**
 * @GET /api/order/stats
 * 订单统计（今日、本月）
 */
router.get('/stats', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const baseWhere = {};
  if (req.user.role !== 'superadmin') {
    baseWhere.institutionId = req.user.institutionId || 0;
  }

  const paidWhere = { ...baseWhere, status: 'paid' };

  const [todayCount, monthCount, todayAmount, monthAmount] = await Promise.all([
    Order.count({ where: { ...paidWhere, createdAt: { [Op.gte]: startOfToday } } }),
    Order.count({ where: { ...paidWhere, createdAt: { [Op.gte]: startOfMonth } } }),
    Order.sum('amount', { where: { ...paidWhere, createdAt: { [Op.gte]: startOfToday } } }),
    Order.sum('amount', { where: { ...paidWhere, createdAt: { [Op.gte]: startOfMonth } } })
  ]);

  success(res, {
    todayCount,
    todayAmount: Number(todayAmount || 0),
    monthCount,
    monthAmount: Number(monthAmount || 0)
  });
}));

/**
 * @POST /api/order/refund
 * 后台发起退款（当前实现为标记退款）
 */
router.post('/refund', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const { orderId, reason } = req.body;
  if (!orderId) {
    return fail(res, '缺少 orderId', 400, 400);
  }

  const where = { id: orderId };
  if (req.user.role !== 'superadmin') {
    where.institutionId = req.user.institutionId || 0;
  }

  const order = await Order.findOne({ where });
  if (!order) {
    return fail(res, '订单不存在', 404, 404);
  }

  if (order.status !== 'paid') {
    return fail(res, '仅已支付订单可退款', 400, 400);
  }

  await order.update({
    status: 'refunded',
    refundAmount: order.amount,
    refundReason: reason || '后台手动退款',
    refundTime: new Date()
  });

  success(res, order, '退款成功');
}));

module.exports = router;