const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { body, validationResult } = require('express-validator');
const { Classroom, TeachingBuilding, TeachingSchedule, User } = require('../models');
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

function parseWeekStart(value) {
  const date = parseDate(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateTime(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '-';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function buildScheduleConflictWhere({ institutionId, classroomId, teacherId, startTime, endTime, excludeId }) {
  const where = {
    institutionId,
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

async function findConflictSchedule({ institutionId, classroomId, teacherId, startTime, endTime, excludeId }) {
  return TeachingSchedule.findOne({
    where: buildScheduleConflictWhere({ institutionId, classroomId, teacherId, startTime, endTime, excludeId }),
    include: [
      { model: Classroom, as: 'classroom', attributes: ['id', 'name'] },
      { model: User, as: 'teacher', attributes: ['id', 'nickname', 'username'] }
    ],
    order: [['startTime', 'ASC']]
  });
}

function buildConflictPayload(conflict) {
  return {
    scheduleId: conflict.id,
    courseName: conflict.courseName,
    classroomName: conflict.classroom?.name || '-',
    teacherName: conflict.teacher?.nickname || conflict.teacher?.username || '-',
    startTime: conflict.startTime,
    endTime: conflict.endTime,
    timeRangeText: `${formatDateTime(conflict.startTime)} ~ ${formatDateTime(conflict.endTime)}`
  };
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/\r?\n/g, ' ');
  if (/[,"\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

async function resolveBuildingName({ institutionId, buildingId }) {
  const id = Number(buildingId || 0);
  if (!id) return null;
  const building = await TeachingBuilding.findOne({ where: { id, institutionId } });
  if (!building) return null;
  return building.name;
}

router.get('/buildings', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const institutionId = getInstitutionId(req);
  const { keyword = '', status } = req.query;
  const where = { institutionId };
  if (status !== undefined && status !== '') where.status = Number(status);
  if (keyword) where.name = { [Op.like]: `%${keyword}%` };

  const list = await TeachingBuilding.findAll({ where, order: [['id', 'DESC']] });
  success(res, list);
}));

router.post('/buildings', auth, requireRole(ADMIN_ROLES), [
  body('name').trim().notEmpty().withMessage('教学楼名称不能为空')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return fail(res, errors.array()[0].msg, 400, 400);

  const institutionId = getInstitutionId(req);
  const name = String(req.body.name || '').trim();
  const exist = await TeachingBuilding.findOne({ where: { institutionId, name } });
  if (exist) return fail(res, '教学楼名称已存在', 409, 409);

  const row = await TeachingBuilding.create({
    institutionId,
    name,
    description: req.body.description || '',
    status: req.body.status === 0 || req.body.status === '0' ? 0 : 1
  });
  success(res, row, '教学楼创建成功');
}));

router.put('/buildings/:id', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const institutionId = getInstitutionId(req);
  const row = await TeachingBuilding.findOne({ where: { id: req.params.id, institutionId } });
  if (!row) return fail(res, '教学楼不存在', 404, 404);

  const nextName = req.body.name !== undefined ? String(req.body.name || '').trim() : row.name;
  if (!nextName) return fail(res, '教学楼名称不能为空', 400, 400);
  if (nextName !== row.name) {
    const exist = await TeachingBuilding.findOne({ where: { institutionId, name: nextName, id: { [Op.ne]: row.id } } });
    if (exist) return fail(res, '教学楼名称已存在', 409, 409);
  }

  const oldName = row.name;
  await row.update({
    name: nextName,
    description: req.body.description ?? row.description,
    status: req.body.status !== undefined ? Number(req.body.status) : row.status
  });

  // 教学楼改名时同步更新教室所在教学楼名称
  if (oldName !== nextName) {
    await Classroom.update(
      { location: nextName },
      { where: { institutionId, location: oldName } }
    );
  }

  success(res, row, '教学楼更新成功');
}));

router.delete('/buildings/:id', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const institutionId = getInstitutionId(req);
  const row = await TeachingBuilding.findOne({ where: { id: req.params.id, institutionId } });
  if (!row) return fail(res, '教学楼不存在', 404, 404);

  const classroomCount = await Classroom.count({ where: { institutionId, location: row.name } });
  if (classroomCount > 0) {
    return fail(res, '该教学楼下仍有教室，请先迁移或删除教室', 409, 409);
  }

  await row.destroy();
  success(res, null, '教学楼删除成功');
}));

router.get('/classrooms', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const institutionId = getInstitutionId(req);
  const { keyword = '', status, buildingId } = req.query;
  const where = { institutionId };
  if (status !== undefined && status !== '') where.status = Number(status);

  if (buildingId) {
    const buildingName = await resolveBuildingName({ institutionId, buildingId });
    if (!buildingName) return success(res, []);
    where.location = buildingName;
  }

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
  body('name').trim().notEmpty().withMessage('教室名称不能为空'),
  body('buildingId').notEmpty().withMessage('教学楼不能为空')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return fail(res, errors.array()[0].msg, 400, 400);

  const institutionId = getInstitutionId(req);
  const { name, capacity, description, status } = req.body;
  const buildingName = await resolveBuildingName({ institutionId, buildingId: req.body.buildingId });
  if (!buildingName) return fail(res, '教学楼不存在', 404, 404);

  const row = await Classroom.create({
    institutionId,
    name,
    location: buildingName,
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

  const { name, capacity, description, status } = req.body;
  let buildingName = row.location;
  if (req.body.buildingId !== undefined) {
    buildingName = await resolveBuildingName({ institutionId, buildingId: req.body.buildingId });
    if (!buildingName) return fail(res, '教学楼不存在', 404, 404);
  }

  await row.update({
    name: name ?? row.name,
    location: buildingName,
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

router.post('/schedules/check-conflict', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const institutionId = getInstitutionId(req);
  const scheduleId = Number(req.body.scheduleId || 0);

  let classroomId = Number(req.body.classroomId || 0);
  let teacherId = Number(req.body.teacherId || 0);
  let startTime = parseDate(req.body.startTime);
  let endTime = parseDate(req.body.endTime);

  let currentSchedule = null;
  if (scheduleId) {
    currentSchedule = await TeachingSchedule.findOne({ where: { id: scheduleId, institutionId } });
    if (!currentSchedule) return fail(res, '排课不存在', 404, 404);
    if (!classroomId) classroomId = Number(currentSchedule.classroomId || 0);
    if (!teacherId) teacherId = Number(currentSchedule.teacherId || 0);
    if (!startTime) startTime = parseDate(currentSchedule.startTime);
    if (!endTime) endTime = parseDate(currentSchedule.endTime);
  }

  if (!classroomId || !teacherId || !startTime || !endTime || startTime >= endTime) {
    return fail(res, '缺少有效的冲突检测参数', 400, 400);
  }

  const conflict = await findConflictSchedule({
    institutionId,
    classroomId,
    teacherId,
    startTime,
    endTime,
    excludeId: scheduleId || undefined
  });

  if (!conflict) {
    return success(res, {
      hasConflict: false,
      conflict: null
    });
  }

  success(res, {
    hasConflict: true,
    conflict: buildConflictPayload(conflict)
  });
}));

router.get('/schedules/export', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
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
      { model: Classroom, as: 'classroom', attributes: ['name', 'location'] },
      { model: User, as: 'teacher', attributes: ['nickname', 'username', 'phone'] }
    ],
    order: [['startTime', 'ASC'], ['id', 'ASC']]
  });

  const header = ['ID', '课程名称', '开始时间', '结束时间', '教室', '教室位置', '讲师', '讲师账号', '讲师手机号', '状态', '备注'];
  const rows = list.map((item) => [
    item.id,
    item.courseName,
    formatDateTime(item.startTime),
    formatDateTime(item.endTime),
    item.classroom?.name || '-',
    item.classroom?.location || '-',
    item.teacher?.nickname || item.teacher?.username || '-',
    item.teacher?.username || '-',
    item.teacher?.phone || '-',
    Number(item.status) === 1 ? '启用' : '取消',
    item.remarks || ''
  ]);

  const csv = [header, ...rows].map((line) => line.map(escapeCsvCell).join(',')).join('\n');
  const filename = `schedules_${Date.now()}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`\uFEFF${csv}`);
}));

router.post('/schedules/copy-week', auth, requireRole(ADMIN_ROLES), asyncHandler(async (req, res) => {
  const institutionId = getInstitutionId(req);
  const sourceWeekStart = parseWeekStart(req.body.sourceWeekStart);
  const targetWeekStart = parseWeekStart(req.body.targetWeekStart);
  const overwrite = Boolean(req.body.overwrite);

  if (!sourceWeekStart || !targetWeekStart) {
    return fail(res, 'sourceWeekStart 和 targetWeekStart 必填，格式为日期时间', 400, 400);
  }

  const sourceWeekEnd = new Date(sourceWeekStart);
  sourceWeekEnd.setDate(sourceWeekEnd.getDate() + 7);

  const targetWeekEnd = new Date(targetWeekStart);
  targetWeekEnd.setDate(targetWeekEnd.getDate() + 7);

  const dayOffset = Math.round((targetWeekStart.getTime() - sourceWeekStart.getTime()) / (24 * 3600 * 1000));

  const sourceSchedules = await TeachingSchedule.findAll({
    where: {
      institutionId,
      status: 1,
      startTime: { [Op.gte]: sourceWeekStart, [Op.lt]: sourceWeekEnd }
    },
    order: [['startTime', 'ASC'], ['id', 'ASC']]
  });

  if (!sourceSchedules.length) {
    return success(res, { copiedCount: 0, skippedCount: 0, skipped: [] }, '源周没有可复制排课');
  }

  if (overwrite) {
    await TeachingSchedule.destroy({
      where: {
        institutionId,
        startTime: { [Op.gte]: targetWeekStart, [Op.lt]: targetWeekEnd }
      }
    });
  }

  let copiedCount = 0;
  const skipped = [];
  for (const source of sourceSchedules) {
    const targetStart = new Date(source.startTime);
    targetStart.setDate(targetStart.getDate() + dayOffset);
    const targetEnd = new Date(source.endTime);
    targetEnd.setDate(targetEnd.getDate() + dayOffset);

    const conflict = await findConflictSchedule({
      institutionId,
      classroomId: source.classroomId,
      teacherId: source.teacherId,
      startTime: targetStart,
      endTime: targetEnd
    });

    if (conflict) {
      skipped.push({
        sourceScheduleId: source.id,
        courseName: source.courseName,
        targetTimeRange: `${formatDateTime(targetStart)} ~ ${formatDateTime(targetEnd)}`,
        reason: '教室或讲师时间冲突',
        conflictScheduleId: conflict.id,
        conflictCourseName: conflict.courseName,
        conflictTimeRange: `${formatDateTime(conflict.startTime)} ~ ${formatDateTime(conflict.endTime)}`
      });
      continue;
    }

    await TeachingSchedule.create({
      institutionId,
      classroomId: source.classroomId,
      teacherId: source.teacherId,
      courseName: source.courseName,
      startTime: targetStart,
      endTime: targetEnd,
      remarks: source.remarks || '',
      status: source.status
    });
    copiedCount += 1;
  }

  success(res, {
    copiedCount,
    skippedCount: skipped.length,
    skipped
  }, `复制完成：成功${copiedCount}条，跳过${skipped.length}条`);
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

  const conflict = await findConflictSchedule({ institutionId, classroomId, teacherId, startTime, endTime });
  if (conflict) {
    return fail(res, '教室或讲师在该时间段已有排课', 409, 409, buildConflictPayload(conflict));
  }

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

  const conflict = await findConflictSchedule({ institutionId, classroomId, teacherId, startTime, endTime, excludeId: row.id });
  if (conflict) {
    return fail(res, '教室或讲师在该时间段已有排课', 409, 409, buildConflictPayload(conflict));
  }

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