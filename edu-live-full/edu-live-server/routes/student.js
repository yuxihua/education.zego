/**
 * 学员路由
 */
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const axios = require('axios');
const crypto = require('crypto');
const { Student, Order, Course, Homework, User } = require('../models');
const { success, fail } = require('../utils/response');
const { asyncHandler } = require('../middleware/error');
const { auth, generateToken, requireRole } = require('../middleware/auth');
const redis = require('../config/redis');

const WX_WEB_APP_ID = process.env.WX_WEB_APP_ID || '';
const WX_WEB_APP_SECRET = process.env.WX_WEB_APP_SECRET || '';
const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');
const STUDENT_WX_CALLBACK_URL = process.env.STUDENT_WX_CALLBACK_URL || `${BASE_URL}/api/student/wx/callback`;

function getCurrentStudentId(req) {
  return req.user?.studentId || req.user?.id;
}

function isStudentIdentity(req) {
  return !req.user?.role || req.user.role === 'student';
}

function getOperatorInstitutionId(req) {
  return req.user?.institutionId || 0;
}

/**
 * 生成微信扫码登录二维码
 */
router.get('/wx/qr/create', asyncHandler(async (req, res) => {
  const { institutionId } = req.query;
  if (!WX_WEB_APP_ID || !WX_WEB_APP_SECRET || !STUDENT_WX_CALLBACK_URL) {
    return fail(res, '微信扫码登录未配置，请联系管理员', 500, 500);
  }

  const state = crypto.randomBytes(16).toString('hex');
  const cacheKey = `student:wx:login:${state}`;

  await redis.setex(cacheKey, 300, JSON.stringify({
    status: 'pending',
    createdAt: Date.now(),
    institutionId: institutionId ? Number(institutionId) : 0
  }));

  const wxAuthUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${encodeURIComponent(WX_WEB_APP_ID)}&redirect_uri=${encodeURIComponent(STUDENT_WX_CALLBACK_URL)}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(wxAuthUrl)}`;

  success(res, {
    state,
    qrUrl,
    expireIn: 300
  });
}));

/**
 * 轮询微信扫码登录状态
 */
router.get('/wx/qr/status', asyncHandler(async (req, res) => {
  const { state } = req.query;
  if (!state) {
    return fail(res, '缺少 state 参数', 400, 400);
  }

  const cacheKey = `student:wx:login:${state}`;
  const raw = await redis.get(cacheKey);
  if (!raw) {
    return success(res, { status: 'expired' });
  }

  let payload = {};
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    return success(res, { status: 'pending' });
  }

  if (payload.status === 'success') {
    await redis.del(cacheKey);
  }

  success(res, payload);
}));

/**
 * 微信扫码登录回调
 */
router.get('/wx/callback', asyncHandler(async (req, res) => {
  const { code, state } = req.query;

  if (!state) {
    return res.status(400).send('缺少 state 参数');
  }

  const cacheKey = `student:wx:login:${state}`;
  const rawSession = await redis.get(cacheKey);
  if (!rawSession) {
    return res.status(400).send('二维码已过期，请重新获取');
  }

  let sessionData = {};
  try {
    sessionData = JSON.parse(rawSession);
  } catch (err) {
    sessionData = {};
  }

  if (!code) {
    await redis.setex(cacheKey, 300, JSON.stringify({ status: 'failed', message: '微信授权失败，缺少 code' }));
    return res.status(400).send('微信授权失败，请返回重试');
  }

  try {
    const tokenResp = await axios.get('https://api.weixin.qq.com/sns/oauth2/access_token', {
      params: {
        appid: WX_WEB_APP_ID,
        secret: WX_WEB_APP_SECRET,
        code,
        grant_type: 'authorization_code'
      }
    });

    const tokenData = tokenResp.data || {};
    if (tokenData.errcode) {
      await redis.setex(cacheKey, 300, JSON.stringify({ status: 'failed', message: tokenData.errmsg || '微信换取token失败' }));
      return res.status(500).send('微信登录失败，请返回重试');
    }

    const openid = tokenData.openid;
    const accessToken = tokenData.access_token;

    const userResp = await axios.get('https://api.weixin.qq.com/sns/userinfo', {
      params: {
        access_token: accessToken,
        openid,
        lang: 'zh_CN'
      }
    });

    const userInfo = userResp.data || {};
    if (userInfo.errcode) {
      await redis.setex(cacheKey, 300, JSON.stringify({ status: 'failed', message: userInfo.errmsg || '获取微信用户信息失败' }));
      return res.status(500).send('微信登录失败，请返回重试');
    }

    let student = await Student.findOne({ where: { openid } });
    if (!student && userInfo.unionid) {
      student = await Student.findOne({ where: { unionid: userInfo.unionid } });
    }

    if (!student) {
      student = await Student.create({
        openid,
        unionid: userInfo.unionid || null,
        nickname: userInfo.nickname || null,
        avatar: userInfo.headimgurl || null,
        institutionId: Number(sessionData.institutionId || 0),
        source: 'wechat-web',
        status: 1
      });
    } else {
      const patch = {
        openid,
        unionid: userInfo.unionid || student.unionid,
        nickname: userInfo.nickname || student.nickname,
        avatar: userInfo.headimgurl || student.avatar
      };
      if (!student.institutionId && sessionData.institutionId) {
        patch.institutionId = Number(sessionData.institutionId);
      }
      await student.update(patch);
    }

    const token = generateToken({
      id: student.id,
      studentId: student.id,
      role: 'student',
      nickname: student.nickname,
      phone: student.phone
    });

    await redis.setex(cacheKey, 300, JSON.stringify({
      status: 'success',
      token,
      student: {
        id: student.id,
        nickname: student.nickname,
        phone: student.phone,
        avatar: student.avatar,
        openid: student.openid
      }
    }));

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send('<!doctype html><html><body style="font-family: sans-serif; padding: 24px;"><h3>登录成功</h3><p>请返回电脑端继续操作。</p></body></html>');
  } catch (err) {
    await redis.setex(cacheKey, 300, JSON.stringify({ status: 'failed', message: '微信登录异常，请重试' }));
    res.status(500).send('微信登录异常，请返回重试');
  }
}));

/**
 * 学员登录（手机号/微信标识）
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { phone, password, nickname, openid, unionid, avatar, source = 'web', institutionId } = req.body;
  const institutionIdNum = institutionId ? Number(institutionId) : 0;

  if (!phone && !openid) {
    return fail(res, '手机号或openid至少填写一个', 400, 400);
  }

  let student = null;

  if (phone) {
    if (!password) {
      return fail(res, '请输入密码', 400, 400);
    }

    student = await Student.findOne({ where: { phone } });
    if (!student) {
      return fail(res, '学员账号不存在，请联系机构创建', 404, 404);
    }

    if (!student.password) {
      return fail(res, '该学员账号未设置密码，请联系机构管理员重置密码', 400, 400);
    }

    if (institutionIdNum && student.institutionId && student.institutionId !== institutionIdNum) {
      return fail(res, '该账号不属于当前机构', 403, 403);
    }

    const isValid = await student.validatePassword(password);
    if (!isValid) {
      return fail(res, '手机号或密码错误', 401, 401);
    }

    const patch = {};
    if (nickname) patch.nickname = nickname;
    if (avatar) patch.avatar = avatar;
    if (openid && !student.openid) patch.openid = openid;
    if (unionid && !student.unionid) patch.unionid = unionid;
    if (!student.institutionId && institutionIdNum) patch.institutionId = institutionIdNum;
    if (Object.keys(patch).length) await student.update(patch);
  } else {
    student = await Student.findOne({ where: { openid } });
    if (!student && unionid) {
      student = await Student.findOne({ where: { unionid } });
    }

    if (!student) {
      const randomSuffix = Date.now().toString().slice(-4);
      student = await Student.create({
        phone: null,
        openid: openid || null,
        unionid: unionid || null,
        nickname: nickname || `学员${randomSuffix}`,
        avatar: avatar || null,
        institutionId: institutionIdNum,
        source,
        status: 1
      });
    }
  }

  if (student.status === 0) {
    return fail(res, '账号已被禁用', 403, 403);
  }

  const token = generateToken({
    id: student.id,
    studentId: student.id,
    role: 'student',
    nickname: student.nickname,
    phone: student.phone
  });

  success(res, {
    token,
    student: {
      id: student.id,
      nickname: student.nickname,
      phone: student.phone,
      avatar: student.avatar,
      openid: student.openid
    }
  }, '登录成功');
}));

/**
 * 学员个人信息
 */
router.get('/profile', auth, asyncHandler(async (req, res) => {
  if (!isStudentIdentity(req) && req.user.role !== 'superadmin') {
    return fail(res, '仅学员可访问', 403, 403);
  }

  const studentId = getCurrentStudentId(req);
  const student = await Student.findByPk(studentId);
  if (!student) {
    return fail(res, '学员不存在', 404, 404);
  }

  const courseCount = await Order.count({ where: { studentId: student.id, status: 'paid' } });
  success(res, {
    ...student.toJSON(),
    courseCount
  });
}));

/**
 * 学员退出登录
 */
router.post('/logout', auth, asyncHandler(async (req, res) => {
  const ttl = req.user?.exp ? (req.user.exp - Math.floor(Date.now() / 1000)) : 0;
  if (ttl > 0 && req.token) {
    await redis.setex(`token:blacklist:${req.token}`, ttl, '1');
  }
  success(res, null, '退出成功');
}));

/**
 * 我的已购课程
 */
router.get('/my-courses', auth, asyncHandler(async (req, res) => {
  if (!isStudentIdentity(req) && req.user.role !== 'superadmin') {
    return fail(res, '仅学员可访问', 403, 403);
  }

  const studentId = getCurrentStudentId(req);
  const { page = 1, size = 10 } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const pageSizeNum = parseInt(size, 10) || 10;

  const { count, rows } = await Order.findAndCountAll({
    where: { studentId, status: 'paid' },
    include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'cover', 'teacherName', 'price', 'status'] }],
    order: [['payTime', 'DESC']],
    offset: (pageNum - 1) * pageSizeNum,
    limit: pageSizeNum
  });

  const list = rows.map((item) => {
    const row = item.toJSON();
    return {
      orderId: row.id,
      orderNo: row.orderNo,
      payTime: row.payTime,
      amount: row.amount,
      course: row.course || null
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
 * 后台新增学员（支持创建时绑定销售层级）
 */
router.post('/create', auth, requireRole(['superadmin', 'admin', 'assistant']), asyncHandler(async (req, res) => {
  const {
    nickname,
    realName,
    phone,
    password,
    email,
    region,
    source = 'admin',
    institutionId,
    salesUserId,
    salesLevel
  } = req.body;

  if (!phone) {
    return fail(res, '学员手机号必填（用于密码登录）', 400, 400);
  }

  if (!password || String(password).trim().length < 6) {
    return fail(res, '学员登录密码至少6位', 400, 400);
  }

  if (phone) {
    const phoneExist = await Student.findOne({ where: { phone } });
    if (phoneExist) {
      return fail(res, '手机号已存在', 409, 409);
    }
  }

  let institutionIdNum = req.user.role === 'superadmin'
    ? Number(institutionId || 0)
    : getOperatorInstitutionId(req);

  let salesUserIdNum = salesUserId ? Number(salesUserId) : null;
  let salesLevelNum = salesLevel ? Number(salesLevel) : null;

  if (salesUserIdNum || salesLevelNum) {
    if (!salesUserIdNum || !salesLevelNum) {
      return fail(res, '设置分销时 salesUserId 与 salesLevel 需同时填写', 400, 400);
    }

    if (![1, 2, 3].includes(salesLevelNum)) {
      return fail(res, 'salesLevel 仅支持 1/2/3', 400, 400);
    }

    const sales = await User.findOne({
      where: {
        id: salesUserIdNum,
        role: 'sales',
        status: 1
      }
    });

    if (!sales) {
      return fail(res, '销售人员不存在', 404, 404);
    }

    if (req.user.role !== 'superadmin' && sales.institutionId !== institutionIdNum) {
      return fail(res, '销售人员不属于当前机构', 400, 400);
    }

    if (!institutionIdNum) {
      institutionIdNum = sales.institutionId || 0;
    }
  }

  const student = await Student.create({
    nickname: nickname || realName || '新学员',
    realName: realName || null,
    phone: phone || null,
    password: String(password).trim(),
    email: email || null,
    region: region || null,
    source,
    status: 1,
    institutionId: institutionIdNum,
    salesUserId: salesUserIdNum,
    salesLevel: salesLevelNum
  });

  success(res, student, '学员创建成功');
}));

/**
 * 后台修改学员信息
 */
router.post('/update', auth, requireRole(['superadmin', 'admin', 'assistant']), asyncHandler(async (req, res) => {
  const {
    id,
    nickname,
    realName,
    phone,
    password,
    email,
    region,
    avatar,
    remark,
    status,
    salesUserId,
    salesLevel
  } = req.body;

  if (!id) {
    return fail(res, '缺少学员ID', 400, 400);
  }

  const student = await Student.findByPk(id);
  if (!student) {
    return fail(res, '学员不存在', 404, 404);
  }

  if (req.user.role !== 'superadmin' && student.institutionId !== getOperatorInstitutionId(req)) {
    return fail(res, '无权修改该学员', 403, 403);
  }

  const updateData = {};

  if (nickname !== undefined) updateData.nickname = nickname || null;
  if (realName !== undefined) updateData.realName = realName || null;
  if (email !== undefined) updateData.email = email || null;
  if (region !== undefined) updateData.region = region || null;
  if (avatar !== undefined) updateData.avatar = avatar || null;
  if (remark !== undefined) updateData.remark = remark || null;

  if (status !== undefined) {
    const statusNum = Number(status);
    if (![0, 1].includes(statusNum)) {
      return fail(res, '状态仅支持 0/1', 400, 400);
    }
    updateData.status = statusNum;
  }

  if (phone !== undefined) {
    const nextPhone = String(phone || '').trim();
    if (nextPhone) {
      const phoneExist = await Student.findOne({
        where: {
          phone: nextPhone,
          id: { [Op.ne]: student.id }
        }
      });
      if (phoneExist) {
        return fail(res, '手机号已存在', 409, 409);
      }
      updateData.phone = nextPhone;
    } else {
      updateData.phone = null;
    }
  }

  if (password !== undefined && password !== null && String(password).trim() !== '') {
    if (String(password).trim().length < 6) {
      return fail(res, '学员登录密码至少6位', 400, 400);
    }
    updateData.password = String(password).trim();
  }

  const salesUserIdProvided = salesUserId !== undefined && salesUserId !== null && salesUserId !== '';
  const salesLevelProvided = salesLevel !== undefined && salesLevel !== null && salesLevel !== '';

  if (salesUserIdProvided || salesLevelProvided) {
    if (!salesUserIdProvided || !salesLevelProvided) {
      return fail(res, '设置分销时 salesUserId 与 salesLevel 需同时填写', 400, 400);
    }

    const salesUserIdNum = Number(salesUserId);
    const salesLevelNum = Number(salesLevel);
    if (![1, 2, 3].includes(salesLevelNum)) {
      return fail(res, 'salesLevel 仅支持 1/2/3', 400, 400);
    }

    const sales = await User.findOne({
      where: {
        id: salesUserIdNum,
        role: 'sales',
        status: 1
      }
    });

    if (!sales) {
      return fail(res, '销售人员不存在', 404, 404);
    }

    if (req.user.role !== 'superadmin' && sales.institutionId !== student.institutionId) {
      return fail(res, '销售人员不属于当前机构', 400, 400);
    }

    updateData.salesUserId = salesUserIdNum;
    updateData.salesLevel = salesLevelNum;
  } else if (salesUserId !== undefined || salesLevel !== undefined) {
    updateData.salesUserId = null;
    updateData.salesLevel = null;
  }

  await student.update(updateData);
  success(res, student, '学员更新成功');
}));

router.get('/list', auth, requireRole(['superadmin', 'admin', 'assistant', 'teacher']), asyncHandler(async (req, res) => {
  const { phone, nickname, institutionId, page = 1, size = 10 } = req.query;

  const where = {};
  if (req.user.role !== 'superadmin') {
    where.institutionId = getOperatorInstitutionId(req);
  } else if (institutionId !== undefined && institutionId !== '') {
    const institutionIdNum = Number(institutionId);
    if (!Number.isNaN(institutionIdNum)) {
      where.institutionId = institutionIdNum;
    }
  }
  if (phone) where.phone = { [Op.like]: `%${phone}%` };
  if (nickname) where.nickname = { [Op.like]: `%${nickname}%` };

  const { count, rows } = await Student.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    offset: (page - 1) * size,
    limit: parseInt(size)
  });

  const list = await Promise.all(rows.map(async (student) => {
    const courseCount = await Order.count({ where: { studentId: student.id, status: 'paid' } });
    return {
      ...student.toJSON(),
      courseCount,
      studyDuration: 0,
      lastStudyTime: null,
      createTime: student.createdAt
    };
  }));

  success(res, {
    list,
    total: count,
    page: parseInt(page),
    size: parseInt(size)
  });
}));

router.get('/detail', auth, requireRole(['superadmin', 'admin', 'assistant', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.query;
  const student = await Student.findByPk(id);

  if (!student) {
    return fail(res, '学员不存在', 404, 404);
  }

  if (req.user.role !== 'superadmin' && student.institutionId !== getOperatorInstitutionId(req)) {
    return fail(res, '无权查看该学员', 403, 403);
  }

  const courseCount = await Order.count({ where: { studentId: student.id, status: 'paid' } });
  success(res, {
    ...student.toJSON(),
    courseCount,
    studyDuration: 0,
    lastStudyTime: null,
    createTime: student.createdAt
  });
}));

router.get('/learning-record', auth, requireRole(['superadmin', 'admin', 'assistant', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.query;
  const student = await Student.findByPk(id);

  if (!student) {
    return fail(res, '学员不存在', 404, 404);
  }

  if (req.user.role !== 'superadmin' && student.institutionId !== getOperatorInstitutionId(req)) {
    return fail(res, '无权查看该学员学习记录', 403, 403);
  }

  const orders = await Order.findAll({
    where: {
      studentId: id,
      status: { [Op.in]: ['paid', 'refunding', 'refunded'] }
    },
    include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'cover'] }],
    order: [['createdAt', 'DESC']]
  });

  const courseIds = orders.map((order) => order.courseId).filter(Boolean);
  const homeworkRows = courseIds.length
    ? await Homework.findAll({
        where: {
          studentId: id,
          courseId: { [Op.in]: courseIds }
        },
        attributes: ['courseId', 'status', 'submitTime', 'gradeTime']
      })
    : [];

  const homeworkByCourse = {};
  let totalHomeworkSubmitted = 0;
  let totalHomeworkGraded = 0;
  let lastHomeworkTime = null;

  homeworkRows.forEach((item) => {
    const key = String(item.courseId);
    if (!homeworkByCourse[key]) {
      homeworkByCourse[key] = {
        submittedCount: 0,
        gradedCount: 0,
        lastLearningTime: null
      };
    }

    if (['submitted', 'graded', 'returned'].includes(item.status)) {
      homeworkByCourse[key].submittedCount += 1;
      totalHomeworkSubmitted += 1;
    }

    if (item.status === 'graded') {
      homeworkByCourse[key].gradedCount += 1;
      totalHomeworkGraded += 1;
    }

    const candidateTime = item.gradeTime || item.submitTime;
    if (candidateTime) {
      const current = homeworkByCourse[key].lastLearningTime;
      if (!current || new Date(candidateTime) > new Date(current)) {
        homeworkByCourse[key].lastLearningTime = candidateTime;
      }
      if (!lastHomeworkTime || new Date(candidateTime) > new Date(lastHomeworkTime)) {
        lastHomeworkTime = candidateTime;
      }
    }
  });

  const list = orders.map((order) => {
    const row = order.toJSON();
    const stats = homeworkByCourse[String(order.courseId)] || {
      submittedCount: 0,
      gradedCount: 0,
      lastLearningTime: null
    };
    return {
      ...row,
      courseName: row.course?.title || '-',
      paidAt: row.payTime || row.createdAt,
      homeworkSubmitted: stats.submittedCount,
      homeworkGraded: stats.gradedCount,
      lastLearningTime: stats.lastLearningTime || row.payTime || row.createdAt
    };
  });

  const totalAmount = list.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const latestOrderTime = list.length ? list[0].payTime || list[0].createdAt : null;
  const lastStudyTime = [latestOrderTime, lastHomeworkTime]
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0] || null;

  success(res, {
    summary: {
      paidCourseCount: list.length,
      totalAmount,
      homeworkSubmitted: totalHomeworkSubmitted,
      homeworkGraded: totalHomeworkGraded,
      lastStudyTime
    },
    list
  });
}));

module.exports = router;