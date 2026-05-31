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
const { generateOrderNo } = require('../utils/pay');

const ADMIN_ROLES = ['superadmin', 'admin', 'assistant', 'teacher'];
const ORDER_CREATE_ROLES = ['superadmin', 'admin', 'assistant'];

/**
 * @POST /api/order/create
 * 后台手工创建学员订单
 */
router.post('/create', auth, requireRole(ORDER_CREATE_ROLES), asyncHandler(async (req, res) => {
  const {
    studentId,
    courseId,
    amount,
    payType = 'free',
    status = 'paid',
    remark,
    institutionId
  } = req.body;

  const studentIdNum = Number(studentId || 0);
  const courseIdNum = Number(courseId || 0);
  if (!studentIdNum || !courseIdNum) {
    return fail(res, 'studentId 和 courseId 必填', 400, 400);
  }

  if (!['wxpay', 'alipay', 'free'].includes(payType)) {
    return fail(res, 'payType 仅支持 wxpay/alipay/free', 400, 400);
  }

  if (!['pending', 'paid'].includes(status)) {
    return fail(res, 'status 仅支持 pending/paid', 400, 400);
  }

  const student = await Student.findByPk(studentIdNum);
  if (!student) return fail(res, '学员不存在', 404, 404);

  const course = await Course.findByPk(courseIdNum);
  if (!course) return fail(res, '课程不存在', 404, 404);

  const operatorInstitutionId = req.user.role === 'superadmin'
    ? Number(institutionId || course.institutionId || student.institutionId || 0)
    : Number(req.user.institutionId || 0);

  if (req.user.role !== 'superadmin') {
    if (student.institutionId && student.institutionId !== operatorInstitutionId) {
      return fail(res, '学员不属于当前机构', 403, 403);
    }
    if (course.institutionId && course.institutionId !== operatorInstitutionId) {
      return fail(res, '课程不属于当前机构', 403, 403);
    }
  }

  const finalInstitutionId = Number(course.institutionId || student.institutionId || operatorInstitutionId || 0);

  const paidExist = await Order.findOne({
    where: {
      studentId: studentIdNum,
      courseId: courseIdNum,
      status: 'paid'
    }
  });
  if (paidExist) {
    return fail(res, '该学员已存在本课程已支付订单', 409, 409);
  }

  const amountNum = Number(amount);
  const finalAmount = Number.isFinite(amountNum) && amountNum >= 0 ? amountNum : Number(course.price || 0);
  const orderNo = generateOrderNo('M');
  const now = new Date();

  const order = await Order.create({
    orderNo,
    studentId: studentIdNum,
    courseId: courseIdNum,
    institutionId: finalInstitutionId,
    amount: finalAmount,
    payType,
    status,
    payTime: status === 'paid' ? now : null,
    remark: remark || null
  });

  if (!student.institutionId && finalInstitutionId) {
    await student.update({ institutionId: finalInstitutionId });
  }

  if (status === 'paid') {
    await Course.increment('studentCount', { where: { id: courseIdNum } });
  }

  success(res, order, '订单创建成功');
}));

/**
 * @GET /api/order/list
 * 订单列表
 */
router.get('/list', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const { page = 1, size, pageSize, status, payType, keyword, institutionId } = req.query;

  const where = {};
  if (status) where.status = status;
  if (payType) where.payType = payType;

  if (req.user.role !== 'superadmin') {
    where.institutionId = req.user.institutionId || 0;
  } else if (institutionId !== undefined && institutionId !== '') {
    const institutionIdNum = Number(institutionId);
    if (!Number.isNaN(institutionIdNum)) {
      where.institutionId = institutionIdNum;
    }
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
  const { institutionId } = req.query;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const baseWhere = {};
  if (req.user.role !== 'superadmin') {
    baseWhere.institutionId = req.user.institutionId || 0;
  } else if (institutionId !== undefined && institutionId !== '') {
    const institutionIdNum = Number(institutionId);
    if (!Number.isNaN(institutionIdNum)) {
      baseWhere.institutionId = institutionIdNum;
    }
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