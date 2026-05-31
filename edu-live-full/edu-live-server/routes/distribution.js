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
const { User, Student, Order, Course, DistributionConfig, DistributionSettlement } = require('../models');

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

function normalizeMonth(month) {
  if (!month) return '';
  const m = String(month).trim();
  return /^\d{4}-\d{2}$/.test(m) ? m : '';
}

function buildSummary(rows) {
  return {
    totalOrders: rows.length,
    totalAmount: Number(rows.reduce((s, i) => s + Number(i.amount || 0), 0).toFixed(2)),
    totalCommission: Number(rows.reduce((s, i) => s + Number(i.commissionAmount || 0), 0).toFixed(2))
  };
}

function applyLocalFilters(rows, { salesUserId, salesLevel, keyword }) {
  const sid = salesUserId ? Number(salesUserId) : null;
  const level = salesLevel ? Number(salesLevel) : null;
  const kw = String(keyword || '').trim().toLowerCase();

  return rows.filter((row) => {
    if (sid && Number(row.salesUserId || 0) !== sid) return false;
    if (level && Number(row.salesLevel || 0) !== level) return false;

    if (!kw) return true;
    const fields = [
      row.orderNo,
      row.courseName,
      row.studentName,
      row.salesUserName,
      row.salesUserId,
      row.salesLevel
    ].map((v) => String(v || '').toLowerCase());
    return fields.some((v) => v.includes(kw));
  });
}

async function getLockedSettlement(institutionId, monthKey) {
  if (!monthKey) return null;
  return DistributionSettlement.findOne({
    where: {
      institutionId,
      monthKey,
      isLocked: true
    }
  });
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

  const studentWhere = {};
  if (salesUserId) studentWhere.salesUserId = salesUserId;
  if (salesLevel) studentWhere.salesLevel = salesLevel;

  const monthRange = getMonthRange(month);
  if (monthRange) {
    where.payTime = { [Op.between]: [monthRange.start, monthRange.end] };
  }

  if (keyword) {
    const orFilters = [
      { orderNo: { [Op.like]: `%${keyword}%` } },
      { '$student.nickname$': { [Op.like]: `%${keyword}%` } },
      { '$student.realName$': { [Op.like]: `%${keyword}%` } },
      { '$student.phone$': { [Op.like]: `%${keyword}%` } },
      { '$course.title$': { [Op.like]: `%${keyword}%` } }
    ];
    if (/^\d+$/.test(String(keyword).trim())) {
      orFilters.push({ '$student.id$': Number(keyword) });
    }
    where[Op.or] = orFilters;
  }

  const rows = await Order.findAll({
    where,
    include: [
      {
        model: Student,
        as: 'student',
        attributes: ['id', 'nickname', 'realName', 'phone', 'salesUserId', 'salesLevel'],
        ...(Object.keys(studentWhere).length ? { where: studentWhere, required: true } : {}),
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

router.get('/students/search', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const { keyword = '', limit = 50 } = req.query;

  const institutionId = req.user.role === 'superadmin'
    ? Number(req.query.institutionId || 0)
    : getInstitutionId(req);

  const where = { institutionId };
  if (keyword) {
    where[Op.or] = [
      { realName: { [Op.like]: `%${keyword}%` } },
      { nickname: { [Op.like]: `%${keyword}%` } },
      { phone: { [Op.like]: `%${keyword}%` } }
    ];
  }

  const list = await Student.findAll({
    where,
    attributes: ['id', 'realName', 'nickname', 'phone', 'salesUserId', 'salesLevel'],
    order: [['id', 'DESC']],
    limit: Math.min(Number(limit) || 50, 200)
  });

  success(res, list.map((item) => {
    const name = item.realName || item.nickname || '未命名学员';
    return {
      id: item.id,
      name,
      phone: item.phone,
      salesUserId: item.salesUserId,
      salesLevel: item.salesLevel,
      label: `${name}${item.phone ? `（${item.phone}）` : ''} #${item.id}`
    };
  }));
}));

router.get('/tree', auth, requireRole(VIEW_ROLES), asyncHandler(async (req, res) => {
  const institutionId = req.user.role === 'superadmin'
    ? Number(req.query.institutionId || 0)
    : getInstitutionId(req);
  const { month } = req.query;

  const salesWhere = {
    role: 'sales',
    status: 1,
    institutionId
  };
  if (req.user.role === 'sales') {
    salesWhere.id = req.user.id;
  }

  const salesList = await User.findAll({
    where: salesWhere,
    attributes: ['id', 'username', 'nickname']
  });

  const saleIds = salesList.map((i) => i.id);
  const studentWhere = {
    institutionId,
    salesUserId: { [Op.ne]: null },
    salesLevel: { [Op.in]: [1, 2, 3] }
  };
  if (saleIds.length) {
    studentWhere.salesUserId = { [Op.in]: saleIds };
  }

  const students = saleIds.length
    ? await Student.findAll({
      where: studentWhere,
      attributes: ['id', 'realName', 'nickname', 'phone', 'salesUserId', 'salesLevel'],
      order: [['id', 'DESC']]
    })
    : [];

  const salesNameMap = Object.fromEntries(salesList.map((s) => [s.id, s.nickname || s.username]));
  const levelMap = {
    1: { id: 'level-1', nodeType: 'level', salesLevel: 1, label: '一级分销', children: [], orderCount: 0, commissionAmount: 0 },
    2: { id: 'level-2', nodeType: 'level', salesLevel: 2, label: '二级分销', children: [], orderCount: 0, commissionAmount: 0 },
    3: { id: 'level-3', nodeType: 'level', salesLevel: 3, label: '三级分销', children: [], orderCount: 0, commissionAmount: 0 }
  };

  const monthKey = normalizeMonth(month);
  const lockedSettlement = await getLockedSettlement(institutionId, monthKey);
  const rows = lockedSettlement
    ? applyLocalFilters(
      Array.isArray(lockedSettlement.snapshotData?.rows) ? lockedSettlement.snapshotData.rows : [],
      {
        salesUserId: req.user.role === 'sales' ? req.user.id : null,
        salesLevel: null,
        keyword: ''
      }
    )
    : await buildCommissionRows({
      institutionId,
      salesUserId: req.user.role === 'sales' ? req.user.id : null,
      salesLevel: null,
      month,
      keyword: ''
    });
  const salesMetricsMap = {};
  rows.forEach((row) => {
    const sid = Number(row.salesUserId || 0);
    const level = Number(row.salesLevel || 0);
    if (!sid || ![1, 2, 3].includes(level)) return;
    const key = `${level}_${sid}`;
    if (!salesMetricsMap[key]) {
      salesMetricsMap[key] = { orderCount: 0, commissionAmount: 0 };
    }
    salesMetricsMap[key].orderCount += 1;
    salesMetricsMap[key].commissionAmount += Number(row.commissionAmount || 0);

    levelMap[level].orderCount += 1;
    levelMap[level].commissionAmount += Number(row.commissionAmount || 0);
  });

  const salesNodeMap = {};
  for (const stu of students) {
    const level = Number(stu.salesLevel || 0);
    const sid = Number(stu.salesUserId || 0);
    if (![1, 2, 3].includes(level) || !sid) continue;

    const key = `${level}_${sid}`;
    if (!salesNodeMap[key]) {
      const metrics = salesMetricsMap[key] || { orderCount: 0, commissionAmount: 0 };
      salesNodeMap[key] = {
        id: `sales-${level}-${sid}`,
        nodeType: 'sales',
        salesLevel: level,
        salesUserId: sid,
        orderCount: metrics.orderCount,
        commissionAmount: Number(metrics.commissionAmount.toFixed(2)),
        label: `${salesNameMap[sid] || `销售${sid}`}`,
        children: []
      };
      levelMap[level].children.push(salesNodeMap[key]);
    }

    const name = stu.realName || stu.nickname || '未命名学员';
    salesNodeMap[key].children.push({
      id: `student-${stu.id}`,
      nodeType: 'student',
      salesLevel: level,
      salesUserId: sid,
      studentId: stu.id,
      label: `${name}${stu.phone ? `（${stu.phone}）` : ''}`
    });
  }

  for (const level of [1, 2, 3]) {
    levelMap[level].children.forEach((node) => {
      node.label = `${node.label}（学员${node.children.length}人，月订单${node.orderCount || 0}单，月提成¥${Number(node.commissionAmount || 0).toFixed(2)}）`;
    });
    const salesCount = levelMap[level].children.length;
    const studentCount = levelMap[level].children.reduce((sum, node) => sum + node.children.length, 0);
    levelMap[level].label = `${levelMap[level].label}（销售${salesCount}人，学员${studentCount}人，月订单${levelMap[level].orderCount}单，月提成¥${Number(levelMap[level].commissionAmount || 0).toFixed(2)}）`;
    levelMap[level].commissionAmount = Number(levelMap[level].commissionAmount.toFixed(2));
  }

  const tree = [levelMap[1], levelMap[2], levelMap[3]];
  success(res, {
    tree,
    stats: {
      salesCount: salesList.length,
      studentCount: students.length,
      orderCount: rows.length,
      commissionAmount: Number(rows.reduce((sum, row) => sum + Number(row.commissionAmount || 0), 0).toFixed(2))
    }
  });
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

router.get('/settlement/status', auth, requireRole(VIEW_ROLES), asyncHandler(async (req, res) => {
  const monthKey = normalizeMonth(req.query.month);
  if (!monthKey) {
    return fail(res, '请传入 month，格式 YYYY-MM', 400, 400);
  }

  const institutionId = req.user.role === 'superadmin'
    ? Number(req.query.institutionId || 0)
    : getInstitutionId(req);

  const settlement = await DistributionSettlement.findOne({
    where: { institutionId, monthKey }
  });

  success(res, {
    month: monthKey,
    locked: Boolean(settlement?.isLocked),
    lockedAt: settlement?.lockAt || null,
    lockByUserId: settlement?.lockByUserId || null,
    summary: settlement?.summaryData || null
  });
}));

router.post('/settlement/lock', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const monthKey = normalizeMonth(req.body.month);
  if (!monthKey) {
    return fail(res, '请传入 month，格式 YYYY-MM', 400, 400);
  }

  const institutionId = req.user.role === 'superadmin'
    ? Number(req.body.institutionId || 0)
    : getInstitutionId(req);

  const locked = await getLockedSettlement(institutionId, monthKey);
  if (locked) {
    return fail(res, '该月份已锁定，无需重复操作', 400, 400);
  }

  const rows = await buildCommissionRows({
    institutionId,
    salesUserId: null,
    salesLevel: null,
    month: monthKey,
    keyword: ''
  });
  const summary = buildSummary(rows);

  const existing = await DistributionSettlement.findOne({ where: { institutionId, monthKey } });
  if (existing) {
    await existing.update({
      isLocked: true,
      lockByUserId: req.user.id,
      lockAt: new Date(),
      snapshotData: { rows },
      summaryData: summary
    });
  } else {
    await DistributionSettlement.create({
      institutionId,
      monthKey,
      isLocked: true,
      lockByUserId: req.user.id,
      lockAt: new Date(),
      snapshotData: { rows },
      summaryData: summary
    });
  }

  success(res, {
    month: monthKey,
    locked: true,
    summary
  }, '月度分销结算已锁定');
}));

router.post('/settlement/unlock', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const monthKey = normalizeMonth(req.body.month);
  if (!monthKey) {
    return fail(res, '请传入 month，格式 YYYY-MM', 400, 400);
  }

  const institutionId = req.user.role === 'superadmin'
    ? Number(req.body.institutionId || 0)
    : getInstitutionId(req);

  const existing = await DistributionSettlement.findOne({ where: { institutionId, monthKey } });
  if (!existing) {
    return fail(res, '该月份暂无结算记录', 404, 404);
  }

  await existing.update({ isLocked: false });
  success(res, { month: monthKey, locked: false }, '月度分销结算已解锁');
}));

router.get('/orders', auth, requireRole(VIEW_ROLES), asyncHandler(async (req, res) => {
  const { page = 1, size = 20, month, salesUserId, salesLevel, keyword } = req.query;

  const institutionId = req.user.role === 'superadmin'
    ? Number(req.query.institutionId || 0)
    : getInstitutionId(req);

  const finalSalesUserId = req.user.role === 'sales'
    ? req.user.id
    : (salesUserId ? Number(salesUserId) : null);

  const monthKey = normalizeMonth(month);
  const lockedSettlement = await getLockedSettlement(institutionId, monthKey);

  let rows = [];
  if (lockedSettlement) {
    const snapshotRows = Array.isArray(lockedSettlement.snapshotData?.rows)
      ? lockedSettlement.snapshotData.rows
      : [];
    rows = applyLocalFilters(snapshotRows, {
      salesUserId: finalSalesUserId,
      salesLevel: salesLevel ? Number(salesLevel) : null,
      keyword
    });
  } else {
    rows = await buildCommissionRows({
      institutionId,
      salesUserId: finalSalesUserId,
      salesLevel: salesLevel ? Number(salesLevel) : null,
      month,
      keyword
    });
  }

  const pageNum = parseInt(page, 10) || 1;
  const pageSizeNum = parseInt(size, 10) || 20;
  const total = rows.length;
  const start = (pageNum - 1) * pageSizeNum;
  const list = rows.slice(start, start + pageSizeNum);

  const summary = buildSummary(rows);

  success(res, {
    list,
    summary,
    settlement: {
      month: monthKey || null,
      locked: Boolean(lockedSettlement),
      lockedAt: lockedSettlement?.lockAt || null
    },
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

  const monthKey = normalizeMonth(month);
  const lockedSettlement = await getLockedSettlement(institutionId, monthKey);

  const rows = lockedSettlement
    ? applyLocalFilters(
      Array.isArray(lockedSettlement.snapshotData?.rows) ? lockedSettlement.snapshotData.rows : [],
      { salesUserId: finalSalesUserId, salesLevel: salesLevel ? Number(salesLevel) : null, keyword }
    )
    : await buildCommissionRows({
      institutionId,
      salesUserId: finalSalesUserId,
      salesLevel: salesLevel ? Number(salesLevel) : null,
      month,
      keyword
    });

  const finalMonthKey = monthKey || (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();
  const sourceTag = lockedSettlement ? 'locked' : 'realtime';
  const filename = `distribution_orders_${finalMonthKey}_${sourceTag}.csv`;

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
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`\uFEFF${csv}`);
}));

module.exports = router;
