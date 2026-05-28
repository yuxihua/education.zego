/**
 * 支付路由
 * 微信支付（JSAPI）+ 支付宝（网页/手机支付）
 * 包含：创建订单、支付回调、订单查询、退款
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Order, Course, Student } = require('../models');
const { success, fail } = require('../utils/response');
const { asyncHandler } = require('../middleware/error');
const { auth } = require('../middleware/auth');
const { payLimiter } = require('../middleware/ratelimit');
const {
  createWxOrder,
  createAlipayOrder,
  createAlipayWapOrder,
  decryptWxNotify,
  verifyAlipayNotify,
  generateOrderNo
} = require('../utils/pay');
const { notifyPurchaseSuccess } = require('../utils/push');

const BASE_URL = process.env.BASE_URL || '';

// ========== 微信支付 ==========

/**
 * @POST /api/pay/wx/create
 * 创建微信支付订单（JSAPI - 微信小程序内使用）
 */
router.post('/wx/create', auth, payLimiter, asyncHandler(async (req, res) => {
  const { courseId, openid } = req.body;
  const studentId = req.user.id;

  if (!openid) {
    return fail(res, '缺少 openid', 400);
  }

  // 查询课程
  const course = await Course.findByPk(courseId);
  if (!course) {
    return fail(res, '课程不存在', 404, 404);
  }

  // 检查是否已购买
  const existOrder = await Order.findOne({
    where: { studentId, courseId, status: 'paid' }
  });
  if (existOrder) {
    return fail(res, '已购买该课程', 409, 409);
  }

  // 生成订单号
  const orderNo = generateOrderNo('E');

  // 创建订单记录
  const order = await Order.create({
    orderNo,
    studentId,
    courseId,
    institutionId: course.institutionId,
    amount: course.price,
    payType: 'wxpay',
    status: 'pending',
    expireTime: new Date(Date.now() + 30 * 60 * 1000) // 30分钟过期
  });

  // 调起微信统一下单
  const payParams = {
    description: course.title,
    outTradeNo: orderNo,
    amount: course.price,
    openid,
    notifyUrl: `${BASE_URL}/api/pay/wx/notify`
  };

  const result = await createWxOrder(payParams);

  success(res, {
    orderNo,
    orderId: order.id,
    ...result
  });
}));

/**
 * @POST /api/pay/wx/notify
 * 微信支付回调（核心）
 * 微信要求：先返回 200，再异步处理业务
 */
router.post('/wx/notify', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  // 1. 立即返回 200（微信要求）
  res.status(200).send('success');

  try {
    // 2. 验证签名 & 解密
    const signature = req.headers['wechatpay-signature'];
    const serial = req.headers['wechatpay-serial'];
    const timestamp = req.headers['wechatpay-timestamp'];
    const nonce = req.headers['wechatpay-nonce'];

    if (!signature || !serial || !timestamp || !nonce) {
      console.error('[微信支付回调] 缺少必要头部参数');
      return;
    }

    const body = JSON.parse(req.body);
    const decrypted = decryptWxNotify(body);

    const {
      out_trade_no: outTradeNo,
      trade_state: tradeState,
      transaction_id: transactionId,
      success_time: successTime
    } = decrypted;

    console.log(`[微信支付回调] 订单:${outTradeNo} 状态:${tradeState}`);

    // 3. 处理支付成功
    if (tradeState === 'SUCCESS') {
      await handlePaySuccess(outTradeNo, transactionId, 'wxpay', successTime);
    }
  } catch (err) {
    console.error('[微信支付回调] 处理失败:', err.message);
  }
}));

// ========== 支付宝 ==========

/**
 * @POST /api/pay/alipay/create
 * 创建支付宝订单（电脑网站支付）
 */
router.post('/alipay/create', auth, payLimiter, asyncHandler(async (req, res) => {
  const { courseId } = req.body;
  const studentId = req.user.id;

  // 查询课程
  const course = await Course.findByPk(courseId);
  if (!course) {
    return fail(res, '课程不存在', 404, 404);
  }

  // 检查是否已购买
  const existOrder = await Order.findOne({
    where: { studentId, courseId, status: 'paid' }
  });
  if (existOrder) {
    return fail(res, '已购买该课程', 409, 409);
  }

  // 生成订单号
  const orderNo = generateOrderNo('A');

  // 创建订单记录
  await Order.create({
    orderNo,
    studentId,
    courseId,
    institutionId: course.institutionId,
    amount: course.price,
    payType: 'alipay',
    status: 'pending',
    expireTime: new Date(Date.now() + 30 * 60 * 1000)
  });

  // 创建支付宝订单
  const formHtml = await createAlipayOrder({
    subject: course.title,
    outTradeNo: orderNo,
    totalAmount: course.price,
    returnUrl: `${BASE_URL}/api/pay/alipay/return`,
    notifyUrl: `${BASE_URL}/api/pay/alipay/notify`
  });

  success(res, {
    orderNo,
    formHtml // 前端直接渲染此 HTML 跳转收银台
  });
}));

/**
 * @POST /api/pay/alipay/wap/create
 * 创建支付宝手机网站支付
 */
router.post('/alipay/wap/create', auth, payLimiter, asyncHandler(async (req, res) => {
  const { courseId } = req.body;
  const studentId = req.user.id;

  const course = await Course.findByPk(courseId);
  if (!course) {
    return fail(res, '课程不存在', 404, 404);
  }

  const orderNo = generateOrderNo('A');

  await Order.create({
    orderNo,
    studentId,
    courseId,
    institutionId: course.institutionId,
    amount: course.price,
    payType: 'alipay',
    status: 'pending',
    expireTime: new Date(Date.now() + 30 * 60 * 1000)
  });

  const formHtml = await createAlipayWapOrder({
    subject: course.title,
    outTradeNo: orderNo,
    totalAmount: course.price,
    returnUrl: `${BASE_URL}/api/pay/alipay/return`,
    notifyUrl: `${BASE_URL}/api/pay/alipay/notify`
  });

  success(res, { orderNo, formHtml });
}));

/**
 * @POST /api/pay/alipay/notify
 * 支付宝异步回调
 */
router.post('/alipay/notify', asyncHandler(async (req, res) => {
  // 1. 立即返回 success
  res.status(200).send('success');

  try {
    const params = req.body;
    
    // 2. 验证签名
    const isValid = verifyAlipayNotify(params);
    if (!isValid) {
      console.error('[支付宝回调] 签名验证失败');
      return;
    }

    const {
      out_trade_no: outTradeNo,
      trade_status: tradeStatus,
      trade_no: transactionId,
      gmt_payment: payTime
    } = params;

    console.log(`[支付宝回调] 订单:${outTradeNo} 状态:${tradeStatus}`);

    // 3. 处理支付成功
    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      await handlePaySuccess(outTradeNo, transactionId, 'alipay', payTime);
    }
  } catch (err) {
    console.error('[支付宝回调] 处理失败:', err.message);
  }
}));

/**
 * @GET /api/pay/alipay/return
 * 支付宝同步回调（支付完成跳转）
 */
router.get('/alipay/return', asyncHandler(async (req, res) => {
  // 可在此做页面跳转，通知前端支付结果
  const { out_trade_no } = req.query;
  
  // 跳转到前端结果页
  const redirectUrl = `${BASE_URL}/pay/result?orderNo=${out_trade_no}&type=alipay`;
  res.redirect(redirectUrl);
}));

// ========== 通用接口 ==========

/**
 * @GET /api/pay/order/query
 * 查询订单状态
 */
router.get('/order/query', auth, asyncHandler(async (req, res) => {
  const { orderNo } = req.query;

  const order = await Order.findOne({
    where: { orderNo },
    include: [
      { model: Course, as: 'course', attributes: ['id', 'title', 'cover'] },
      { model: Student, as: 'student', attributes: ['id', 'nickname', 'openid'] }
    ]
  });

  if (!order) {
    return fail(res, '订单不存在', 404, 404);
  }

  // 检查权限（只能查自己的订单）
  if (order.studentId !== req.user.id && req.user.role !== 'superadmin') {
    return fail(res, '无权查看此订单', 403, 403);
  }

  success(res, order);
}));

/**
 * @GET /api/pay/orders
 * 获取订单列表
 */
router.get('/orders', auth, asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 10, status, payType } = req.query;
  const where = { studentId: req.user.id };
  
  if (status) where.status = status;
  if (payType) where.payType = payType;

  const { count, rows } = await Order.findAndCountAll({
    where,
    include: [
      { model: Course, as: 'course', attributes: ['id', 'title', 'cover'] }
    ],
    order: [['createdAt', 'DESC']],
    offset: (page - 1) * pageSize,
    limit: parseInt(pageSize)
  });

  success(res, {
    list: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }
  });
}));

// ========== 内部方法 ==========

/**
 * 处理支付成功（通用）
 * @param {string} orderNo - 商户订单号
 * @param {string} transactionId - 第三方支付流水号
 * @param {string} payType - 支付类型
 * @param {string} payTime - 支付时间
 */
async function handlePaySuccess(orderNo, transactionId, payType, payTime) {
  const order = await Order.findOne({
    where: { orderNo },
    include: [
      { model: Course, as: 'course' },
      { model: Student, as: 'student' }
    ]
  });

  if (!order) {
    console.error(`[支付回调] 订单不存在: ${orderNo}`);
    return;
  }

  // 幂等检查：已处理过则跳过
  if (order.status === 'paid') {
    console.log(`[支付回调] 订单已处理: ${orderNo}`);
    return;
  }

  // 更新订单状态
  await order.update({
    status: 'paid',
    payTime: payTime || new Date(),
    transactionId
  });

  // 更新课程学员数
  await Course.increment('studentCount', {
    where: { id: order.courseId }
  });

  // 发送购买成功通知（异步，不阻塞）
  if (order.student?.openid) {
    notifyPurchaseSuccess(
      order.student.openid,
      order.course.title,
      orderNo,
      new Date().toLocaleString('zh-CN'),
      `/pages/course/detail?id=${order.courseId}`
    ).catch(err => console.error('[推送] 购买通知失败:', err.message));
  }

  console.log(`[支付成功] 订单:${orderNo} 金额:${order.amount} 类型:${payType}`);
}

module.exports = router;
