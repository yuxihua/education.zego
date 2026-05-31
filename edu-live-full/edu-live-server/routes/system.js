/**
 * 系统管理路由
 * - 系统账号管理
 * - 系统操作日志
 */
const express = require('express');
const { Op } = require('sequelize');
const { body, validationResult } = require('express-validator');
const { auth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { success, fail } = require('../utils/response');
const { User, OperationLog } = require('../models');

const ACCOUNT_ROLES = ['superadmin', 'admin'];
const ALLOWED_CREATE_ROLES = ['admin', 'teacher', 'assistant', 'sales'];

const router = express.Router();

function getScopeInstitutionId(req) {
  return req.user?.institutionId || 0;
}

function canManageTargetUser(operator, target) {
  if (operator.role === 'superadmin') return true;
  if (operator.role !== 'admin') return false;
  return target.institutionId === operator.institutionId && target.role !== 'superadmin';
}

router.get('/accounts', auth, requireRole(ACCOUNT_ROLES), asyncHandler(async (req, res) => {
  const { keyword, role, status, institutionId, page = 1, size = 10 } = req.query;

  const where = {};
  if (req.user.role !== 'superadmin') {
    where.institutionId = getScopeInstitutionId(req);
    where.role = { [Op.ne]: 'superadmin' };
  } else if (institutionId !== undefined && institutionId !== '') {
    const institutionIdNum = Number(institutionId);
    if (!Number.isNaN(institutionIdNum)) where.institutionId = institutionIdNum;
  }

  if (role) where.role = role;
  if (status !== undefined && status !== '') where.status = Number(status);
  if (keyword) {
    where[Op.or] = [
      { username: { [Op.like]: `%${keyword}%` } },
      { nickname: { [Op.like]: `%${keyword}%` } },
      { phone: { [Op.like]: `%${keyword}%` } },
      { email: { [Op.like]: `%${keyword}%` } },
      { institutionName: { [Op.like]: `%${keyword}%` } }
    ];
  }

  const pageNum = Number(page) || 1;
  const sizeNum = Number(size) || 10;
  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: { exclude: ['password'] },
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

router.post('/accounts', auth, requireRole(ACCOUNT_ROLES), [
  body('username').trim().isLength({ min: 4, max: 20 }).withMessage('用户名4-20位字符'),
  body('password').trim().isLength({ min: 6 }).withMessage('密码至少6位'),
  body('role').isIn(ALLOWED_CREATE_ROLES).withMessage('角色不支持'),
  body('nickname').optional().trim().isLength({ min: 1 }).withMessage('昵称不能为空')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(res, errors.array()[0].msg, 400, 400);
  }

  const { username, password, role, nickname, phone, email, institutionId, institutionName } = req.body;

  const exist = await User.findOne({ where: { username } });
  if (exist) return fail(res, '用户名已存在', 409, 409);

  const targetInstitutionId = req.user.role === 'superadmin'
    ? Number(institutionId || 0)
    : getScopeInstitutionId(req);

  const user = await User.create({
    username,
    password,
    role,
    nickname: nickname || username,
    phone,
    email,
    institutionId: targetInstitutionId,
    institutionName: institutionName || req.user.institutionName || null,
    status: 1
  });

  success(res, {
    id: user.id,
    username: user.username,
    role: user.role,
    nickname: user.nickname,
    institutionId: user.institutionId
  }, '账号创建成功');
}));

router.put('/accounts/:id/status', auth, requireRole(ACCOUNT_ROLES), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const status = Number(req.body.status);
  if (![0, 1].includes(status)) {
    return fail(res, '状态仅支持 0/1', 400, 400);
  }

  const user = await User.findByPk(id);
  if (!user) return fail(res, '账号不存在', 404, 404);

  if (!canManageTargetUser(req.user, user)) {
    return fail(res, '无权限操作该账号', 403, 403);
  }

  if (user.id === req.user.id && status === 0) {
    return fail(res, '不能禁用当前登录账号', 400, 400);
  }

  await user.update({ status });
  success(res, null, status === 1 ? '账号已启用' : '账号已禁用');
}));

router.post('/accounts/:id/reset-password', auth, requireRole(ACCOUNT_ROLES), [
  body('newPassword').trim().isLength({ min: 6 }).withMessage('新密码至少6位')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(res, errors.array()[0].msg, 400, 400);
  }

  const id = Number(req.params.id);
  const user = await User.findByPk(id);
  if (!user) return fail(res, '账号不存在', 404, 404);

  if (!canManageTargetUser(req.user, user)) {
    return fail(res, '无权限操作该账号', 403, 403);
  }

  await user.update({ password: req.body.newPassword });
  success(res, null, '密码重置成功');
}));

router.get('/operation-logs', auth, requireRole(ACCOUNT_ROLES), asyncHandler(async (req, res) => {
  const { keyword, method, path, success: successFlag, page = 1, size = 20, institutionId } = req.query;
  const where = {};

  if (req.user.role !== 'superadmin') {
    where.institutionId = getScopeInstitutionId(req);
  } else if (institutionId !== undefined && institutionId !== '') {
    const institutionIdNum = Number(institutionId);
    if (!Number.isNaN(institutionIdNum)) where.institutionId = institutionIdNum;
  }

  if (method) where.method = method;
  if (path) where.path = { [Op.like]: `%${path}%` };
  if (successFlag !== undefined && successFlag !== '') where.success = Number(successFlag) === 1;

  if (keyword) {
    where[Op.or] = [
      { username: { [Op.like]: `%${keyword}%` } },
      { role: { [Op.like]: `%${keyword}%` } },
      { path: { [Op.like]: `%${keyword}%` } },
      { ip: { [Op.like]: `%${keyword}%` } }
    ];
  }

  const pageNum = Number(page) || 1;
  const sizeNum = Number(size) || 20;
  const { count, rows } = await OperationLog.findAndCountAll({
    where,
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

module.exports = router;
