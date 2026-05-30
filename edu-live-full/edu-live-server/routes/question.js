/**
 * 题库路由
 */
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Question } = require('../models');
const { success, fail } = require('../utils/response');
const { asyncHandler } = require('../middleware/error');

const categoryList = [
  { label: '未分类', value: '' },
  { label: '数学', value: 'math' },
  { label: '英语', value: 'english' },
  { label: '语文', value: 'chinese' },
  { label: '编程', value: 'programming' }
];

router.get('/list', asyncHandler(async (req, res) => {
  const { type, keyword, page = 1, size = 10 } = req.query;

  const where = {};
  if (type) where.type = type;
  if (keyword) where.content = { [Op.like]: `%${keyword}%` };

  const { count, rows } = await Question.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    offset: (page - 1) * size,
    limit: parseInt(size)
  });

  success(res, {
    list: rows,
    total: count,
    page: parseInt(page),
    size: parseInt(size)
  });
}));

router.get('/categories', asyncHandler(async (req, res) => {
  success(res, categoryList);
}));

router.post('/create', asyncHandler(async (req, res) => {
  const { type, content, options, answer, analysis, difficulty, categoryName } = req.body;

  if (!content) {
    return fail(res, '请输入题目内容', 400, 400);
  }

  const question = await Question.create({
    type: type || 'single',
    content,
    options: options || [],
    answer: answer || '',
    analysis: analysis || '',
    difficulty: difficulty || 1,
    categoryName: categoryName || ''
  });

  success(res, question, '创建成功');
}));

router.post('/update', asyncHandler(async (req, res) => {
  const { id, type, content, options, answer, analysis, difficulty, categoryName } = req.body;

  const question = await Question.findByPk(id);
  if (!question) {
    return fail(res, '题目不存在', 404, 404);
  }

  await question.update({
    type,
    content,
    options,
    answer,
    analysis,
    difficulty,
    categoryName
  });

  success(res, question, '更新成功');
}));

router.post('/delete', asyncHandler(async (req, res) => {
  const { id } = req.body;
  const question = await Question.findByPk(id);

  if (!question) {
    return fail(res, '题目不存在', 404, 404);
  }

  await question.destroy();
  success(res, null, '删除成功');
}));

module.exports = router;