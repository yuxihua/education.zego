/**
 * 题库路由
 */
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Question } = require('../models');
const sequelize = require('../config/database');
const { success, fail } = require('../utils/response');
const { asyncHandler } = require('../middleware/error');
const { auth, requireRole } = require('../middleware/auth');

let tenantColumnReadyPromise = null;

function getOperatorInstitutionId(req) {
  return req.user?.institutionId || 0;
}

async function ensureTenantColumnReady() {
  if (!tenantColumnReadyPromise) {
    tenantColumnReadyPromise = sequelize.getQueryInterface().describeTable('questions')
      .then((columns) => Boolean(columns.institution_id || columns.institutionId))
      .catch(() => false);
  }
  return tenantColumnReadyPromise;
}

async function guardTenantReady(res) {
  const ready = await ensureTenantColumnReady();
  if (!ready) {
    fail(res, '题库表缺少 institution_id 字段，请先执行迁移 SQL', 500, 500);
    return false;
  }
  return true;
}

const categoryList = [
  { label: '未分类', value: '' },
  { label: '数学', value: 'math' },
  { label: '英语', value: 'english' },
  { label: '语文', value: 'chinese' },
  { label: '编程', value: 'programming' }
];

router.get('/list', auth, requireRole(['superadmin', 'admin', 'assistant', 'teacher']), asyncHandler(async (req, res) => {
  if (!await guardTenantReady(res)) return;

  const { type, keyword, institutionId, page = 1, size = 10 } = req.query;

  const where = {};
  if (req.user.role === 'superadmin') {
    if (institutionId !== undefined && institutionId !== '') {
      where.institutionId = Number(institutionId);
    }
  } else {
    where.institutionId = getOperatorInstitutionId(req);
  }
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

router.get('/categories', auth, requireRole(['superadmin', 'admin', 'assistant', 'teacher']), asyncHandler(async (req, res) => {
  success(res, categoryList);
}));

router.post('/create', auth, requireRole(['superadmin', 'admin', 'assistant', 'teacher']), asyncHandler(async (req, res) => {
  if (!await guardTenantReady(res)) return;

  const { type, content, options, answer, analysis, difficulty, categoryName } = req.body;

  if (!content) {
    return fail(res, '请输入题目内容', 400, 400);
  }

  const institutionId = req.user.role === 'superadmin'
    ? Number(req.body.institutionId || 0)
    : getOperatorInstitutionId(req);

  const question = await Question.create({
    type: type || 'single',
    content,
    options: options || [],
    answer: answer || '',
    analysis: analysis || '',
    difficulty: difficulty || 1,
    categoryName: categoryName || '',
    institutionId
  });

  success(res, question, '创建成功');
}));

router.post('/update', auth, requireRole(['superadmin', 'admin', 'assistant', 'teacher']), asyncHandler(async (req, res) => {
  if (!await guardTenantReady(res)) return;

  const { id, type, content, options, answer, analysis, difficulty, categoryName } = req.body;

  const question = await Question.findByPk(id);
  if (!question) {
    return fail(res, '题目不存在', 404, 404);
  }

  if (req.user.role !== 'superadmin' && question.institutionId !== getOperatorInstitutionId(req)) {
    return fail(res, '无权修改该机构题目', 403, 403);
  }

  const patch = {
    type,
    content,
    options,
    answer,
    analysis,
    difficulty,
    categoryName
  };
  if (req.user.role === 'superadmin' && req.body.institutionId !== undefined) {
    patch.institutionId = Number(req.body.institutionId || 0);
  }

  await question.update(patch);

  success(res, question, '更新成功');
}));

router.post('/delete', auth, requireRole(['superadmin', 'admin', 'assistant', 'teacher']), asyncHandler(async (req, res) => {
  if (!await guardTenantReady(res)) return;

  const { id } = req.body;
  const question = await Question.findByPk(id);

  if (!question) {
    return fail(res, '题目不存在', 404, 404);
  }

  if (req.user.role !== 'superadmin' && question.institutionId !== getOperatorInstitutionId(req)) {
    return fail(res, '无权删除该机构题目', 403, 403);
  }

  await question.destroy();
  success(res, null, '删除成功');
}));

module.exports = router;