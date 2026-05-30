/**
 * 学员路由
 */
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Student, Order, Course } = require('../models');
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
    where: { studentId: id },
    include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'cover'] }],
    order: [['createdAt', 'DESC']]
  });

  success(res, orders);
}));

module.exports = router;