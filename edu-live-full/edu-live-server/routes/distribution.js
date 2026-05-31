/**
 * 分销管理路由
 * 三级分销、两档提成、订单导出
 */
const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { auth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { success, fail } = require('../utils/response');
const { User, Student, Order, Course, DistributionConfig } = require('../models');

const ADMIN_ROLES = ['superadmin', 'admin'];
const VIEW_ROLES = ['superadmin', 'admin', 'sales'];

function getInstitutionId(req) {
  return req.user?.institutionId || 0;
}

function getMonthRange(month) {
  if (!month) return null;
  const [y, m] = String(month).split('-').map((v) => Number(v));
  if (!y || !m) return null;
  const start = new Date(y, m - 1, 1, 0, 0, 0);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return { start, end };
}

async function getOrInitConfig(institutionId) {
  const defaults = [
    { level: 1, tierThreshold: 30, rateTier1: 0.05, rateTier2: 0.08 },
    { level: 2, tierThreshold: 20, rateTier1: 0.03, rateTier2: 0.05 },
    { level: 3, tierThreshold: 10, rateTier1: 0.02, rateTier2: 0.03 }
  ];

  const exists = await DistributionConfig.findAll({
    where: { institutionId },
    order: [['level', 'ASC']]
  });

  if (exists.length) return exists;

  await DistributionConfig.bulkCreate(defaults.map((item) => ({ ...item, institutionId })));
  return DistributionConfig.findAll({ where: { institutionId }, order: [['level', 'ASC']] });
}

function pickCommissionRate(seq, config) {
  const threshold = Number(config.tierThreshold || 0);
  const tier1 = Number(config.rateTier1 || 0);
  const tier2 = Number(config.rateTier2 || 0);
  return seq > threshold ? tier2 : tier1;
}

async function buildCommissionRows({ institutionId, salesUserId, salesLevel, month, keyword }) {
  const where = {
    institutionId,
    status: 'paid',
    payTime: { [Op.ne]: null }
  };

  if (salesUserId) where['$student.salesUserId$'] = salesUserId;
  if (salesLevel) where['$student.salesLevel$'] = salesLevel;

  const monthRange = getMonthRange(month);
  if (monthRange) {
    where.payTime = { [Op.between]: [monthRange.start, monthRange.end] };
  }

  if (keyword) {
    where[Op.or] = [
      { orderNo: { [Op.like]: `%${keyword}%` } },
      { '$student.nickname$': { [Op.like]: `%${keyword}%` } },
      { '$student.realName$': { [Op.like]: `%${keyword}%` } },
      { '$student.phone$': { [Op.like]: `%${keyword}%` } },
      { '$course.title$': { [Op.like]: `%${keyword}%` } }
    ];
  }

  const rows = await Order.findAll({
    where,
    include: [
      {
        model: Student,
        as: 'student',
        attributes: ['id', 'nickname', 'realName', 'phone', 'salesUserId', 'salesLevel'],
        include: [{ model: User, as: 'salesUser', attributes: ['id', 'username', 'nickname'] }]
      },
      { model: Course, as: 'course', attributes: ['id', 'title'] }
    ],
    order: [['payTime', 'ASC'], ['id', 'ASC']],
    subQuery: false
  });

  const configRows = await getOrInitConfig(institutionId);
  const configMap = Object.fromEntries(configRows.map((item) => [Number(item.level), item]));

  const seqMap = {};
  const list = rows.map((item) => {
    const row = item.toJSON();
    const level = Number(row.student?.salesLevel || 0);
    const sid = Number(row.student?.salesUserId || 0);
    const payTime = row.payTime ? new Date(row.payTime) : null;
    const monthKey = payTime
      ? `${payTime.getFullYear()}-${String(payTime.getMonth() + 1).padStart(2, '0')}`
      : 'unknown';
    const key = `${sid}_${level}_${monthKey}`;
    seqMap[key] = (seqMap[key] || 0) + 1;

    const cfg = configMap[level] || { tierThreshold: 0, rateTier1: 0, rateTier2: 0 };
    const commissionRate = pickCommissionRate(seqMap[key], cfg);
    const amount = Number(row.amount || 0);
    const commissionAmount = Number((amount * commissionRate).toFixed(2));

    return {
      id: row.id,
      orderNo: row.orderNo,
      payTime: row.payTime,
      amount,
      courseName: row.course?.title || '-',
      studentName: row.student?.realName || row.student?.nickname || '-',
      salesUserId: sid || null,
      salesUserName: row.student?.salesUser?.nickname || row.student?.salesUser?.username || '-',
      salesLevel: level || null,
      monthKey,
      monthlyOrderSeq: seqMap[key],
      commissionRate,
      commissionAmount
    };
  });

  return list;
}

router.get('/config', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const institutionId = req.user.role === 'superadmin'
    ? Number(req.query.institutionId || 0)
    : getInstitutionId(req);

  const list = await getOrInitConfig(institutionId);
  success(res, list);
}));

router.post('/config', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const institutionId = req.user.role === 'superadmin'
    ? Number(req.body.institutionId || 0)
    : getInstitutionId(req);
  const { configs = [] } = req.body;

  if (!Array.isArray(configs) || !configs.length) {
    return fail(res, '缺少配置数据', 400, 400);
  }

  for (const item of configs) {
    const level = Number(item.level);
    if (![1, 2, 3].includes(level)) {
      return fail(res, '分销层级仅支持 1/2/3', 400, 400);
    }
    const tierThreshold = Number(item.tierThreshold || 0);
    const rateTier1 = Number(item.rateTier1 || 0);
    const rateTier2 = Number(item.rateTier2 || 0);

    await DistributionConfig.upsert({
      institutionId,
      level,
      tierThreshold,
      rateTier1,
      rateTier2
    });
  }

  const list = await getOrInitConfig(institutionId);
  success(res, list, '配置保存成功');
}));

router.get('/sales/list', auth, requireRole(VIEW_ROLES), asyncHandler(async (req, res) => {
  const institutionId = req.user.role === 'superadmin'
    ? Number(req.query.institutionId || 0)
    : getInstitutionId(req);

  const list = await User.findAll({
    where: {
      role: 'sales',
      status: 1,
      institutionId
    },
    attributes: ['id', 'username', 'nickname', 'phone', 'institutionId'],
    order: [['id', 'DESC']]
  });

  success(res, list.map((item) => ({
    id: item.id,
    name: item.nickname || item.username,
    username: item.username,
    phone: item.phone,
    institutionId: item.institutionId
  })));
}));

router.post('/sales/create', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const { username, password, nickname, phone, email } = req.body;
  if (!username || !password) {
    return fail(res, '账号和密码不能为空', 400, 400);
  }

  const institutionId = req.user.role === 'superadmin'
    ? Number(req.body.institutionId || 0)
    : getInstitutionId(req);

  const exist = await User.findOne({ where: { username } });
  if (exist) {
    return fail(res, '账号已存在', 409, 409);
  }

  const user = await User.create({
    username,
    password,
    nickname,
    phone,
    email,
    role: 'sales',
    status: 1,
    institutionId,
    institutionName: req.user.institutionName || null
  });

  success(res, {
    id: user.id,
    name: user.nickname || user.username,
    username: user.username,
    phone: user.phone,
    institutionId: user.institutionId
  }, '销售账号创建成功');
}));

router.post('/student/assign', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const { studentId, salesUserId, salesLevel } = req.body;
  if (!studentId || !salesUserId || !salesLevel) {
    return fail(res, 'studentId、salesUserId、salesLevel 必填', 400, 400);
  }

  const level = Number(salesLevel);
  if (![1, 2, 3].includes(level)) {
    return fail(res, 'salesLevel 仅支持 1/2/3', 400, 400);
  }

  const student = await Student.findByPk(studentId);
  if (!student) return fail(res, '学员不存在', 404, 404);

  const institutionId = req.user.role === 'superadmin'
    ? Number(req.body.institutionId || student.institutionId || 0)
    : getInstitutionId(req);

  const sales = await User.findOne({
    where: {
      id: salesUserId,
      role: 'sales',
      status: 1,
      institutionId
    }
  });
  if (!sales) return fail(res, '销售人员不存在', 404, 404);

  if (req.user.role !== 'superadmin' && student.institutionId !== institutionId) {
    return fail(res, '无权分配该学员', 403, 403);
  }

  if (student.institutionId && sales.institutionId && student.institutionId !== sales.institutionId) {
    return fail(res, '学员与销售不在同一机构', 400, 400);
  }

  await student.update({
    salesUserId: sales.id,
    salesLevel: level,
    institutionId: student.institutionId || sales.institutionId || 0
  });

  success(res, {
    studentId: student.id,
    salesUserId: sales.id,
    salesLevel: level
  }, '学员分销关系设置成功');
}));

router.get('/orders', auth, requireRole(VIEW_ROLES), asyncHandler(async (req, res) => {
  const { page = 1, size = 20, month, salesUserId, salesLevel, keyword } = req.query;

  const institutionId = req.user.role === 'superadmin'
    ? Number(req.query.institutionId || 0)
    : getInstitutionId(req);

  const finalSalesUserId = req.user.role === 'sales'
    ? req.user.id
    : (salesUserId ? Number(salesUserId) : null);

  const rows = await buildCommissionRows({
    institutionId,
    salesUserId: finalSalesUserId,
    salesLevel: salesLevel ? Number(salesLevel) : null,
    month,
    keyword
  });

  const pageNum = parseInt(page, 10) || 1;
  const pageSizeNum = parseInt(size, 10) || 20;
  const total = rows.length;
  const start = (pageNum - 1) * pageSizeNum;
  const list = rows.slice(start, start + pageSizeNum);

  const summary = {
    totalOrders: total,
    totalAmount: Number(rows.reduce((s, i) => s + Number(i.amount || 0), 0).toFixed(2)),
    totalCommission: Number(rows.reduce((s, i) => s + Number(i.commissionAmount || 0), 0).toFixed(2))
  };

  success(res, {
    list,
    summary,
    pagination: {
      total,
      page: pageNum,
      size: pageSizeNum
    }
  });
}));

router.get('/orders/export', auth, requireRole(VIEW_ROLES), asyncHandler(async (req, res) => {
  const { month, salesUserId, salesLevel, keyword } = req.query;

  const institutionId = req.user.role === 'superadmin'
    ? Number(req.query.institutionId || 0)
    : getInstitutionId(req);

  const finalSalesUserId = req.user.role === 'sales'
    ? req.user.id
    : (salesUserId ? Number(salesUserId) : null);

  const rows = await buildCommissionRows({
    institutionId,
    salesUserId: finalSalesUserId,
    salesLevel: salesLevel ? Number(salesLevel) : null,
    month,
    keyword
  });

  const escapeCell = (value) => {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const header = ['订单号', '支付时间', '课程', '学员', '销售', '层级', '金额', '月序号', '提成比例', '提成金额'];
  const lines = rows.map((row) => [
    row.orderNo,
    row.payTime || '-',
    row.courseName,
    row.studentName,
    row.salesUserName,
    row.salesLevel || '-',
    row.amount,
    row.monthlyOrderSeq,
    row.commissionRate,
    row.commissionAmount
  ].map(escapeCell).join(','));

  const csv = [header.map(escapeCell).join(','), ...lines].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="distribution_orders.csv"');
  res.send(`\uFEFF${csv}`);
}));

module.exports = router;
