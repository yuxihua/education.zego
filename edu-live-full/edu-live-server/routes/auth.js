/**
 * 认证路由
 * 登录、注册、Token 刷新等
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { success, fail } = require('../utils/response');
const { asyncHandler } = require('../middleware/error');
const { generateToken, auth, requireRole } = require('../middleware/auth');
const { strictLimiter } = require('../middleware/ratelimit');
const { User } = require('../models');
const redis = require('../config/redis');
const { getUserPermissions } = require('../utils/permission');

/**
 * @POST /api/auth/login
 * 用户登录
 */
router.post('/login', 
  strictLimiter,
  [
    body('username').trim().notEmpty().withMessage('用户名不能为空'),
    body('password').trim().notEmpty().withMessage('密码不能为空')
  ],
  asyncHandler(async (req, res) => {
    // 参数验证
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return fail(res, errors.array()[0].msg, 400);
    }

    const { username, password } = req.body;

    // 查找用户
    const user = await User.findOne({
      where: { username, status: 1 }
    });

    if (!user) {
      return fail(res, '用户名或密码错误', 401, 401);
    }

    // 验证密码
    const isValid = await user.validatePassword(password);
    if (!isValid) {
      return fail(res, '用户名或密码错误', 401, 401);
    }

    // 更新登录信息
    await user.update({
      lastLoginAt: new Date(),
      lastLoginIp: req.ip
    });

    // 生成 Token
    const token = generateToken({
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      role: user.role,
      institutionId: user.institutionId
    });

    const permissions = await getUserPermissions(user);

    success(res, {
      token,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        role: user.role,
        avatar: user.avatar,
        institutionId: user.institutionId,
        institutionName: user.institutionName
      },
      permissions
    }, '登录成功');
  })
);

/**
 * @POST /api/auth/register
 * 机构注册
 */
router.post('/register',
  strictLimiter,
  [
    body('username').trim().isLength({ min: 4, max: 20 }).withMessage('用户名4-20位字符'),
    body('password').trim().isLength({ min: 6 }).withMessage('密码至少6位'),
    body('institutionName').trim().notEmpty().withMessage('机构名称不能为空'),
    body('phone').optional().isMobilePhone('zh-CN').withMessage('手机号格式错误')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return fail(res, errors.array()[0].msg, 400);
    }

    const { username, password, institutionName, phone, email } = req.body;

    // 检查用户名是否存在
    const existUser = await User.findOne({ where: { username } });
    if (existUser) {
      return fail(res, '用户名已被注册', 409, 409);
    }

    // 创建机构管理员
    const user = await User.create({
      username,
      password,
      nickname: institutionName,
      role: 'admin',
      institutionName,
      phone,
      email
    });

    // 更新 institutionId 为自身ID
    await user.update({ institutionId: user.id });

    // 生成 Token
    const token = generateToken({
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      role: user.role,
      institutionId: user.id
    });

    success(res, {
      token,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        role: user.role,
        institutionId: user.id,
        institutionName: user.institutionName
      }
    }, '注册成功');
  })
);

/**
 * @GET /api/auth/profile
 * 获取当前用户信息
 */
router.get('/profile', auth, asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: { exclude: ['password'] }
  });

  if (!user) {
    return fail(res, '用户不存在', 404, 404);
  }

  const permissions = await getUserPermissions(user);
  success(res, {
    ...user.toJSON(),
    permissions
  });
}));

/**
 * @PUT /api/auth/profile
 * 更新个人信息
 */
router.put('/profile', auth, asyncHandler(async (req, res) => {
  const { nickname, avatar, phone, email } = req.body;
  
  await User.update(
    { nickname, avatar, phone, email },
    { where: { id: req.user.id } }
  );

  success(res, null, '更新成功');
}));

/**
 * @POST /api/auth/password
 * 修改密码
 */
router.post('/password', auth, [
  body('oldPassword').notEmpty().withMessage('请输入原密码'),
  body('newPassword').isLength({ min: 6 }).withMessage('新密码至少6位')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(res, errors.array()[0].msg, 400);
  }

  const { oldPassword, newPassword } = req.body;
  const user = await User.findByPk(req.user.id);

  const isValid = await user.validatePassword(oldPassword);
  if (!isValid) {
    return fail(res, '原密码错误', 400, 400);
  }

  await user.update({ password: newPassword });
  success(res, null, '密码修改成功');
}));

/**
 * @POST /api/auth/logout
 * 退出登录（Token 加入黑名单）
 */
router.post('/logout', auth, asyncHandler(async (req, res) => {
  // Token 加入黑名单，设置过期时间与 Token 一致
  const decoded = req.user;
  const ttl = decoded.exp - Math.floor(Date.now() / 1000);
  
  if (ttl > 0) {
    await redis.setex(`token:blacklist:${req.token}`, ttl, '1');
  }

  success(res, null, '退出成功');
}));

/**
 * @POST /api/auth/refresh
 * 刷新 Token
 */
router.post('/refresh', auth, asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id);
  
  if (!user || user.status === 0) {
    return fail(res, '用户不存在或已被禁用', 401, 401);
  }

  const token = generateToken({
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    role: user.role,
    institutionId: user.institutionId
  });

  success(res, { token }, '刷新成功');
}));

/**
 * @GET /api/auth/teachers
 * 获取讲师列表
 */
router.get('/teachers', auth, requireRole(['superadmin', 'admin', 'assistant', 'teacher']), asyncHandler(async (req, res) => {
  const { institutionId } = req.query;
  const where = { role: 'teacher', status: 1 };

  if (req.user.role !== 'superadmin') {
    where.institutionId = req.user.institutionId || req.user.id;
  } else if (institutionId !== undefined && institutionId !== '') {
    const institutionIdNum = Number(institutionId);
    if (!Number.isNaN(institutionIdNum)) {
      where.institutionId = institutionIdNum;
    }
  }

  const list = await User.findAll({
    where,
    attributes: ['id', 'username', 'nickname', 'phone', 'institutionId'],
    order: [['id', 'DESC']]
  });

  success(res, list.map((item) => ({
    id: item.id,
    username: item.username,
    name: item.nickname || item.username,
    nickname: item.nickname || item.username,
    phone: item.phone,
    institutionId: item.institutionId
  })));
}));

/**
 * @POST /api/auth/teacher
 * 创建讲师账号
 */
router.post('/teacher', auth, requireRole(['superadmin', 'admin']), [
  body('username').trim().isLength({ min: 4, max: 20 }).withMessage('用户名4-20位字符'),
  body('password').trim().isLength({ min: 6 }).withMessage('密码至少6位'),
  body('nickname').trim().notEmpty().withMessage('讲师姓名不能为空'),
  body('phone').optional().isMobilePhone('zh-CN').withMessage('手机号格式错误')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(res, errors.array()[0].msg, 400);
  }

  const { username, password, nickname, phone, email, institutionId } = req.body;

  const existUser = await User.findOne({ where: { username } });
  if (existUser) {
    return fail(res, '用户名已存在', 409, 409);
  }

  const teacherInstitutionId = req.user.role === 'superadmin'
    ? (institutionId || 0)
    : (req.user.institutionId || req.user.id);

  const teacher = await User.create({
    username,
    password,
    nickname,
    phone,
    email,
    role: 'teacher',
    institutionId: teacherInstitutionId,
    institutionName: req.user.institutionName || null,
    status: 1
  });

  success(res, {
    id: teacher.id,
    username: teacher.username,
    name: teacher.nickname || teacher.username,
    nickname: teacher.nickname || teacher.username,
    phone: teacher.phone,
    institutionId: teacher.institutionId
  }, '讲师创建成功');
}));

module.exports = router;
