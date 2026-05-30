/**
 * 学员路由
 */
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Student, Order, Course, Homework } = require('../models');
const { success, fail } = require('../utils/response');
const { asyncHandler } = require('../middleware/error');

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