/**
 * 平台路由
 * 平台超管用于机构管理与审核
 */
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { body, validationResult } = require('express-validator');
const { User } = require('../models');
const { success, fail } = require('../utils/response');
const { asyncHandler } = require('../middleware/error');
const { auth, requireRole } = require('../middleware/auth');

function buildInstitutionWhere(query = {}) {
  const { keyword, status, institutionId } = query;
  const where = { role: 'admin' };

  if (status !== undefined && status !== '') {
    where.status = Number(status);
  }

  if (institutionId !== undefined && institutionId !== '') {
    where.id = Number(institutionId);
  }

  if (keyword) {
    where[Op.or] = [
      { institutionName: { [Op.like]: `%${keyword}%` } },
      { nickname: { [Op.like]: `%${keyword}%` } },
      { username: { [Op.like]: `%${keyword}%` } },
      { phone: { [Op.like]: `%${keyword}%` } }
    ];
  }

  return where;
}

/**
 * @POST /api/platform/institution/create
 * 平台创建机构管理员
 */
router.post('/institution/create', auth, requireRole(['superadmin']), [
  body('username').trim().isLength({ min: 4, max: 20 }).withMessage('用户名4-20位字符'),
  body('password').trim().isLength({ min: 6 }).withMessage('密码至少6位'),
  body('institutionName').trim().notEmpty().withMessage('机构名称不能为空'),
  body('phone').optional().isMobilePhone('zh-CN').withMessage('手机号格式错误'),
  body('email').optional().isEmail().withMessage('邮箱格式错误')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(res, errors.array()[0].msg, 400, 400);
  }

  const { username, password, institutionName, phone, email, nickname } = req.body;

  const existUser = await User.findOne({ where: { username } });
  if (existUser) {
    return fail(res, '用户名已存在', 409, 409);
  }

  const institutionAdmin = await User.create({
    username,
    password,
    nickname: nickname || institutionName,
    role: 'admin',
    institutionName,
    institutionId: 0,
    phone,
    email,
    status: 1
  });

  await institutionAdmin.update({ institutionId: institutionAdmin.id });

  success(res, {
    id: institutionAdmin.id,
    username: institutionAdmin.username,
    nickname: institutionAdmin.nickname,
    institutionName: institutionAdmin.institutionName,
    institutionId: institutionAdmin.id,
    phone: institutionAdmin.phone,
    email: institutionAdmin.email,
    status: institutionAdmin.status
  }, '机构创建成功');
}));

/**
 * @GET /api/platform/institution/list
 * 机构列表
 */
router.get('/institution/list', auth, requireRole(['superadmin']), asyncHandler(async (req, res) => {
  const { page = 1, size = 10 } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const sizeNum = parseInt(size, 10) || 10;

  const where = buildInstitutionWhere(req.query);

  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: [
      'id',
      'username',
      'nickname',
      'institutionName',
      'phone',
      'email',
      'status',
      'lastLoginAt',
      'createdAt'
    ],
    order: [['id', 'DESC']],
    offset: (pageNum - 1) * sizeNum,
    limit: sizeNum
  });

  success(res, {
    list: rows,
    total: count,
    page: pageNum,
    size: sizeNum
  });
}));

/**
 * @POST /api/platform/institution/audit
 * 机构审核（启用/禁用）
 */
router.post('/institution/audit', auth, requireRole(['superadmin']), asyncHandler(async (req, res) => {
  const { institutionId, status } = req.body;
  if (!institutionId) {
    return fail(res, '机构ID不能为空', 400, 400);
  }

  const institution = await User.findOne({
    where: { id: institutionId, role: 'admin' }
  });

  if (!institution) {
    return fail(res, '机构不存在', 404, 404);
  }

  const finalStatus = Number(status);
  if (![0, 1].includes(finalStatus)) {
    return fail(res, '审核状态无效', 400, 400);
  }

  await institution.update({ status: finalStatus });

  success(res, {
    id: institution.id,
    institutionName: institution.institutionName,
    status: institution.status
  }, finalStatus === 1 ? '机构已启用' : '机构已禁用');
}));

/**
 * @GET /api/platform/audit/list
 * 审核列表（当前为机构账号列表的审核视图）
 */
router.get('/audit/list', auth, requireRole(['superadmin']), asyncHandler(async (req, res) => {
  const { page = 1, size = 10 } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const sizeNum = parseInt(size, 10) || 10;

  const where = buildInstitutionWhere(req.query);

  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: [
      'id',
      'username',
      'institutionName',
      'phone',
      'status',
      'createdAt',
      'lastLoginAt'
    ],
    order: [['createdAt', 'DESC']],
    offset: (pageNum - 1) * sizeNum,
    limit: sizeNum
  });

  success(res, {
    list: rows,
    total: count,
    page: pageNum,
    size: sizeNum
  });
}));

module.exports = router;
