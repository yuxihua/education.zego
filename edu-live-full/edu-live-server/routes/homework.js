/**
 * 作业路由
 * 作业布置、提交、批改
 */
const express = require('express');
const router = express.Router();
const { Homework, Course, Student } = require('../models');
const { success, fail } = require('../utils/response');
const { asyncHandler } = require('../middleware/error');
const { auth, requireRole } = require('../middleware/auth');
const { notifyHomeworkGraded } = require('../utils/push');

function isStudentIdentity(req) {
  return !req.user?.role || req.user.role === 'student';
}

function getCurrentStudentId(req) {
  return req.user?.studentId || req.user?.id;
}

function getOperatorInstitutionId(req) {
  return req.user?.institutionId || 0;
}

function canAccessByCourseInstitution(req, courseInstitutionId) {
  if (req.user?.role === 'superadmin') return true;
  return courseInstitutionId === getOperatorInstitutionId(req);
}

/**
 * @GET /api/homework/list
 * 作业列表（按课程）
 */
router.get('/list', auth, asyncHandler(async (req, res) => {
  const { courseId, studentId, status, page = 1, pageSize = 10 } = req.query;

  const where = {};
  if (courseId) where.courseId = courseId;
  if (studentId) where.studentId = studentId;
  if (status) where.status = status;

  // 学员只能看自己的
  if (isStudentIdentity(req)) {
    where.studentId = getCurrentStudentId(req);
  }

  const includeCourse = { model: Course, as: 'course', attributes: ['id', 'title', 'institutionId'] };
  if (req.user.role !== 'superadmin') {
    includeCourse.where = { institutionId: getOperatorInstitutionId(req) };
    includeCourse.required = true;
  }

  const { count, rows } = await Homework.findAndCountAll({
    where,
    include: [
      includeCourse,
      { model: Student, as: 'student', attributes: ['id', 'nickname', 'openid'] }
    ],
    order: [['createdAt', 'DESC']],
    offset: (page - 1) * pageSize,
    limit: parseInt(pageSize)
  });

  success(res, {
    list: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }
  });
}));

/**
 * @GET /api/homework/:id
 * 作业详情
 */
router.get('/:id', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const homework = await Homework.findByPk(id, {
    include: [
      { model: Course, as: 'course' },
      { model: Student, as: 'student', attributes: ['id', 'nickname', 'avatar', 'openid'] }
    ]
  });

  if (!homework) {
    return fail(res, '作业不存在', 404, 404);
  }

  if (isStudentIdentity(req) && homework.studentId !== getCurrentStudentId(req)) {
    return fail(res, '无权查看该作业', 403, 403);
  }

  if (!canAccessByCourseInstitution(req, homework.course?.institutionId || 0)) {
    return fail(res, '无权查看该机构作业', 403, 403);
  }

  success(res, homework);
}));

/**
 * @POST /api/homework
 * 布置作业（教师/管理员）
 */
router.post('/', auth, requireRole(['admin', 'superadmin', 'teacher']), asyncHandler(async (req, res) => {
  const { courseId, title, content, deadline } = req.body;

  const course = await Course.findByPk(courseId);
  if (!course) {
    return fail(res, '课程不存在', 404, 404);
  }

  if (!canAccessByCourseInstitution(req, course.institutionId || 0)) {
    return fail(res, '无权在该机构课程布置作业', 403, 403);
  }

  const homework = await Homework.create({
    courseId,
    title,
    content,
    deadline,
    status: 'pending'
  });

  success(res, homework, '作业布置成功');
}));

/**
 * @POST /api/homework/:id/submit
 * 提交作业（学员）
 */
router.post('/:id/submit', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content, attachments } = req.body;
  if (!isStudentIdentity(req)) {
    return fail(res, '仅学员可提交作业', 403, 403);
  }
  const studentId = getCurrentStudentId(req);

  const homework = await Homework.findByPk(id, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId'] }]
  });
  if (!homework) {
    return fail(res, '作业不存在', 404, 404);
  }

  if (homework.studentId && homework.studentId !== studentId) {
    return fail(res, '无权提交该作业', 403, 403);
  }

  if (!canAccessByCourseInstitution(req, homework.course?.institutionId || 0)) {
    return fail(res, '无权提交该机构作业', 403, 403);
  }

  // 检查截止日期
  if (homework.deadline && new Date() > new Date(homework.deadline)) {
    return fail(res, '已超过截止日期', 400, 400);
  }

  await homework.update({
    studentId,
    content,
    attachments: attachments || [],
    status: 'submitted',
    submitTime: new Date()
  });

  success(res, homework, '作业提交成功');
}));

/**
 * @POST /api/homework/:id/grade
 * 批改作业（教师/管理员）
 */
router.post('/:id/grade', auth, requireRole(['admin', 'superadmin', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { score, comment } = req.body;

  const homework = await Homework.findByPk(id, {
    include: [
      { model: Course, as: 'course', attributes: ['title'] },
      { model: Student, as: 'student', attributes: ['id', 'openid'] }
    ]
  });

  if (!homework) {
    return fail(res, '作业不存在', 404, 404);
  }

  if (!canAccessByCourseInstitution(req, homework.course?.institutionId || 0)) {
    return fail(res, '无权批改该机构作业', 403, 403);
  }

  if (homework.status !== 'submitted') {
    return fail(res, '作业尚未提交', 400, 400);
  }

  await homework.update({
    score,
    comment,
    status: 'graded',
    gradeTime: new Date()
  });

  // 发送批改通知
  if (homework.student?.openid) {
    notifyHomeworkGraded(
      homework.student.openid,
      homework.course.title,
      homework.title,
      score,
      `/pages/homework/detail?id=${id}`
    ).catch(err => console.error('[推送] 作业批改通知失败:', err.message));
  }

  success(res, homework, '批改完成');
}));

/**
 * @PUT /api/homework/:id
 * 更新作业信息
 */
router.put('/:id', auth, requireRole(['admin', 'superadmin', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, content, deadline } = req.body;

  const homework = await Homework.findByPk(id, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId'] }]
  });
  if (!homework) {
    return fail(res, '作业不存在', 404, 404);
  }

  if (!canAccessByCourseInstitution(req, homework.course?.institutionId || 0)) {
    return fail(res, '无权更新该机构作业', 403, 403);
  }

  await homework.update({ title, content, deadline });
  success(res, null, '更新成功');
}));

/**
 * @DELETE /api/homework/:id
 * 删除作业
 */
router.delete('/:id', auth, requireRole(['admin', 'superadmin']), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const homework = await Homework.findByPk(id, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId'] }]
  });
  if (!homework) {
    return fail(res, '作业不存在', 404, 404);
  }

  if (!canAccessByCourseInstitution(req, homework.course?.institutionId || 0)) {
    return fail(res, '无权删除该机构作业', 403, 403);
  }

  await homework.destroy();
  success(res, null, '作业已删除');
}));

module.exports = router;
