/**
 * 学员路由
 */
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Student, Order, Course, Homework } = require('../models');
const { success, fail } = require('../utils/response');
const { asyncHandler } = require('../middleware/error');
const { auth, generateToken } = require('../middleware/auth');
const redis = require('../config/redis');

function getCurrentStudentId(req) {
  return req.user?.studentId || req.user?.id;
}

function isStudentIdentity(req) {
  return !req.user?.role || req.user.role === 'student';
}

/**
 * 学员登录（手机号/微信标识）
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { phone, nickname, openid, unionid, avatar, source = 'web' } = req.body;

  if (!phone && !openid) {
    return fail(res, '手机号或openid至少填写一个', 400, 400);
  }

  let student = null;

  if (openid) {
    student = await Student.findOne({ where: { openid } });
  }

  if (!student && phone) {
    student = await Student.findOne({ where: { phone } });
  }

  if (!student) {
    const randomSuffix = Date.now().toString().slice(-4);
    student = await Student.create({
      phone: phone || null,
      openid: openid || null,
      unionid: unionid || null,
      nickname: nickname || `学员${randomSuffix}`,
      avatar: avatar || null,
      source,
      status: 1
    });
  } else {
    const patch = {};
    if (phone && !student.phone) patch.phone = phone;
    if (openid && !student.openid) patch.openid = openid;
    if (unionid && !student.unionid) patch.unionid = unionid;
    if (nickname) patch.nickname = nickname;
    if (avatar) patch.avatar = avatar;
    if (Object.keys(patch).length) {
      await student.update(patch);
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

router.get('/list', asyncHandler(async (req, res) => {
  const { phone, nickname, page = 1, size = 10 } = req.query;

  const where = {};
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

router.get('/detail', asyncHandler(async (req, res) => {
  const { id } = req.query;
  const student = await Student.findByPk(id);

  if (!student) {
    return fail(res, '学员不存在', 404, 404);
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

router.get('/learning-record', asyncHandler(async (req, res) => {
  const { id } = req.query;
  const student = await Student.findByPk(id);

  if (!student) {
    return fail(res, '学员不存在', 404, 404);
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