const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { body, validationResult } = require('express-validator');
const { Classroom, TeachingSchedule, User } = require('../models');
const { success, fail } = require('../utils/response');
const { asyncHandler } = require('../middleware/error');
const { auth, requireRole } = require('../middleware/auth');

const ADMIN_ROLES = ['superadmin', 'admin'];

function getInstitutionId(req) {
  return req.user.role === 'superadmin' ? Number(req.query.institutionId || req.body.institutionId || 0) : Number(req.user.institutionId || 0);
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildScheduleConflictWhere({ classroomId, teacherId, startTime, endTime, excludeId }) {
  const where = {
    status: 1,
    [Op.or]: [
      { classroomId },
      { teacherId }
    ],
    startTime: { [Op.lt]: endTime },
    endTime: { [Op.gt]: startTime }
  };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  return where;
}

router.get('/classrooms', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const institutionId = getInstitutionId(req);
  const { keyword = '', status } = req.query;
  const where = { institutionId };
  if (status !== undefined && status !== '') where.status = Number(status);
  if (keyword) {
    where[Op.or] = [
      { name: { [Op.like]: `%${keyword}%` } },
      { location: { [Op.like]: `%${keyword}%` } }
    ];
  }

  const list = await Classroom.findAll({ where, order: [['id', 'DESC']] });
  success(res, list);
}));

router.get('/classrooms/:id', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const institutionId = getInstitutionId(req);
  const classroom = await Classroom.findOne({ where: { id: req.params.id, institutionId } });
  if (!classroom) return fail(res, '教室不存在', 404, 404);
  success(res, classroom);
}));

router.post('/classrooms', auth, requireRole(ADMIN_ROLES), [
  body('name').trim().notEmpty().withMessage('教室名称不能为空')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return fail(res, errors.array()[0].msg, 400, 400);

  const institutionId = getInstitutionId(req);
  const { name, location, capacity, description, status } = req.body;
  const row = await Classroom.create({
    institutionId,
    name,
    location,
    capacity: Number(capacity || 0),
    description,
    status: status === 0 || status === '0' ? 0 : 1
  });

  success(res, row, '教室创建成功');
}));

router.put('/classrooms/:id', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const institutionId = getInstitutionId(req);
  const row = await Classroom.findOne({ where: { id: req.params.id, institutionId } });
  if (!row) return fail(res, '教室不存在', 404, 404);

  const { name, location, capacity, description, status } = req.body;
  await row.update({
    name: name ?? row.name,
    location: location ?? row.location,
    capacity: capacity !== undefined ? Number(capacity || 0) : row.capacity,
    description: description ?? row.description,
    status: status !== undefined ? Number(status) : row.status
  });

  success(res, row, '教室更新成功');
}));

router.delete('/classrooms/:id', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const institutionId = getInstitutionId(req);
  const row = await Classroom.findOne({ where: { id: req.params.id, institutionId } });
  if (!row) return fail(res, '教室不存在', 404, 404);

  await TeachingSchedule.destroy({ where: { classroomId: row.id } });
  await row.destroy();
  success(res, null, '教室删除成功');
}));

router.get('/teachers', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const institutionId = getInstitutionId(req);
  const { keyword, status } = req.query;
  const where = { role: 'teacher', institutionId };
  if (keyword) {
    where[Op.or] = [
      { username: { [Op.like]: `%${keyword}%` } },
      { nickname: { [Op.like]: `%${keyword}%` } },
      { phone: { [Op.like]: `%${keyword}%` } }
    ];
  }
  if (status !== undefined && status !== '') {
    where.status = Number(status);
  }

  const list = await User.findAll({
    where,
    attributes: ['id', 'username', 'nickname', 'phone', 'email', 'status', 'institutionId'],
    order: [['id', 'DESC']]
  });

  success(res, list.map((item) => ({
    id: item.id,
    username: item.username,
    name: item.nickname || item.username,
    nickname: item.nickname || item.username,
    phone: item.phone,
    email: item.email,
    status: item.status,
    institutionId: item.institutionId
  })));
}));

router.post('/teachers', auth, requireRole(ADMIN_ROLES), [
  body('username').trim().isLength({ min: 4, max: 20 }).withMessage('用户名4-20位字符'),
  body('password').trim().isLength({ min: 6 }).withMessage('密码至少6位'),
  body('nickname').trim().notEmpty().withMessage('讲师姓名不能为空')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return fail(res, errors.array()[0].msg, 400, 400);

  const institutionId = getInstitutionId(req);
  const existUser = await User.findOne({ where: { username: req.body.username } });
  if (existUser) return fail(res, '用户名已存在', 409, 409);

  const teacher = await User.create({
    username: req.body.username,
    password: req.body.password,
    nickname: req.body.nickname,
    phone: req.body.phone || null,
    email: req.body.email || null,
    role: 'teacher',
    institutionId,
    institutionName: req.user.institutionName || null,
    status: Number(req.body.status ?? 1)
  });

  success(res, {
    id: teacher.id,
    username: teacher.username,
    nickname: teacher.nickname,
    phone: teacher.phone,
    email: teacher.email,
    status: teacher.status,
    institutionId: teacher.institutionId
  }, '讲师创建成功');
}));

router.put('/teachers/:id', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const institutionId = getInstitutionId(req);
  const teacher = await User.findOne({ where: { id: req.params.id, role: 'teacher', institutionId } });
  if (!teacher) return fail(res, '讲师不存在', 404, 404);

  if (req.body.username && req.body.username !== teacher.username) {
    const existUser = await User.findOne({ where: { username: req.body.username } });
    if (existUser) return fail(res, '用户名已存在', 409, 409);
  }

  await teacher.update({
    username: req.body.username ?? teacher.username,
    nickname: req.body.nickname ?? teacher.nickname,
    phone: req.body.phone ?? teacher.phone,
    email: req.body.email ?? teacher.email,
    status: req.body.status !== undefined ? Number(req.body.status) : teacher.status
  });

  success(res, teacher, '讲师更新成功');
}));

router.delete('/teachers/:id', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const institutionId = getInstitutionId(req);
  const teacher = await User.findOne({ where: { id: req.params.id, role: 'teacher', institutionId } });
  if (!teacher) return fail(res, '讲师不存在', 404, 404);

  const scheduleCount = await TeachingSchedule.count({ where: { teacherId: teacher.id, status: 1 } });
  if (scheduleCount > 0) {
    await teacher.update({ status: 0 });
    return success(res, null, '讲师存在排课，已停用');
  }

  await teacher.destroy();
  success(res, null, '讲师删除成功');
}));

router.get('/schedules', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const institutionId = getInstitutionId(req);
  const { classroomId, teacherId, startDate, endDate } = req.query;
  const where = { institutionId };
  if (classroomId) where.classroomId = Number(classroomId);
  if (teacherId) where.teacherId = Number(teacherId);
  if (startDate && endDate) {
    where.startTime = { [Op.lt]: new Date(endDate) };
    where.endTime = { [Op.gt]: new Date(startDate) };
  }

  const list = await TeachingSchedule.findAll({
    where,
    include: [
      { model: Classroom, as: 'classroom', attributes: ['id', 'name', 'location'] },
      { model: User, as: 'teacher', attributes: ['id', 'nickname', 'username'] }
    ],
    order: [['startTime', 'ASC'], ['id', 'ASC']]
  });

  success(res, list);
}));

router.post('/schedules', auth, requireRole(ADMIN_ROLES), [
  body('classroomId').notEmpty().withMessage('教室不能为空'),
  body('teacherId').notEmpty().withMessage('讲师不能为空'),
  body('courseName').trim().notEmpty().withMessage('课程名称不能为空'),
  body('startTime').notEmpty().withMessage('开始时间不能为空'),
  body('endTime').notEmpty().withMessage('结束时间不能为空')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return fail(res, errors.array()[0].msg, 400, 400);

  const institutionId = getInstitutionId(req);
  const classroomId = Number(req.body.classroomId);
  const teacherId = Number(req.body.teacherId);
  const startTime = parseDate(req.body.startTime);
  const endTime = parseDate(req.body.endTime);

  if (!startTime || !endTime || startTime >= endTime) {
    return fail(res, '排课时间范围无效', 400, 400);
  }

  const classroom = await Classroom.findOne({ where: { id: classroomId, institutionId, status: 1 } });
  if (!classroom) return fail(res, '教室不存在或已停用', 404, 404);

  const teacher = await User.findOne({ where: { id: teacherId, role: 'teacher', institutionId, status: 1 } });
  if (!teacher) return fail(res, '讲师不存在或已停用', 404, 404);

  const conflict = await TeachingSchedule.findOne({ where: buildScheduleConflictWhere({ classroomId, teacherId, startTime, endTime }) });
  if (conflict) return fail(res, '教室或讲师在该时间段已有排课', 409, 409);

  const row = await TeachingSchedule.create({
    institutionId,
    classroomId,
    teacherId,
    courseName: req.body.courseName,
    startTime,
    endTime,
    remarks: req.body.remarks || '',
    status: req.body.status === 0 || req.body.status === '0' ? 0 : 1
  });

  success(res, row, '排课创建成功');
}));

router.put('/schedules/:id', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const institutionId = getInstitutionId(req);
  const row = await TeachingSchedule.findOne({ where: { id: req.params.id, institutionId } });
  if (!row) return fail(res, '排课不存在', 404, 404);

  const classroomId = Number(req.body.classroomId ?? row.classroomId);
  const teacherId = Number(req.body.teacherId ?? row.teacherId);
  const startTime = parseDate(req.body.startTime ?? row.startTime);
  const endTime = parseDate(req.body.endTime ?? row.endTime);

  if (!startTime || !endTime || startTime >= endTime) {
    return fail(res, '排课时间范围无效', 400, 400);
  }

  const conflict = await TeachingSchedule.findOne({ where: buildScheduleConflictWhere({ classroomId, teacherId, startTime, endTime, excludeId: row.id }) });
  if (conflict) return fail(res, '教室或讲师在该时间段已有排课', 409, 409);

  await row.update({
    classroomId,
    teacherId,
    courseName: req.body.courseName ?? row.courseName,
    startTime,
    endTime,
    remarks: req.body.remarks ?? row.remarks,
    status: req.body.status !== undefined ? Number(req.body.status) : row.status
  });

  success(res, row, '排课更新成功');
}));

router.delete('/schedules/:id', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const institutionId = getInstitutionId(req);
  const row = await TeachingSchedule.findOne({ where: { id: req.params.id, institutionId } });
  if (!row) return fail(res, '排课不存在', 404, 404);

  await row.destroy();
  success(res, null, '排课删除成功');
}));

module.exports = router;