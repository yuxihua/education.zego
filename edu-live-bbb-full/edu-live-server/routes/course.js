/**
 * 课程路由
 * 课程的 CRUD、上下架、学员管理
 */
const express = require('express');
const router = express.Router();
const { Course, Order, LiveRoom, User } = require('../models');
const { Op } = require('sequelize');
const { success, fail } = require('../utils/response');
const { asyncHandler } = require('../middleware/error');
const { auth, requireRole, optionalAuth } = require('../middleware/auth');
const { notifyLiveStart } = require('../utils/push');

const parseRecordedVideos = (course) => {
  const outline = course?.outline && typeof course.outline === 'object' ? course.outline : {};
  const list = Array.isArray(outline.recordedVideos) ? outline.recordedVideos : [];
  return list
    .map((item, index) => {
      const url = String(item?.url || '').trim();
      return {
        id: String(item?.id || `video-${Date.now()}-${index}`),
        title: String(item?.title || '').trim() || `第${index + 1}节`,
        url,
        duration: Math.max(0, Number(item?.duration || 0)),
        trialDuration: Math.max(0, Number(item?.trialDuration || 0)),
        sort: Number.isFinite(Number(item?.sort)) ? Number(item.sort) : index + 1,
        status: String(item?.status || 'published').trim() === 'draft' ? 'draft' : 'published',
        cover: String(item?.cover || '').trim(),
        updatedAt: item?.updatedAt || null
      };
    })
    .filter((item) => item.url)
    .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
};

const mergeOutlineWithRecordedVideos = (course, recordedVideos = []) => {
  const oldOutline = course?.outline && typeof course.outline === 'object' ? course.outline : {};
  return {
    ...oldOutline,
    recordedVideos
  };
};

const hasCourseManagePermission = (course, req) => {
  if (!course || !req?.user) return false;
  return req.user.role === 'superadmin' || Number(course.institutionId || 0) === Number(req.user.institutionId || 0);
};

/**
 * @GET /api/course/list
 * 课程列表（公开接口，无需登录）
 */
router.get('/list', optionalAuth, asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    size,
    pageSize = 10, 
    category, 
    status,
    institutionId,
    keyword,
    sortBy = 'createdAt',
    sortOrder = 'DESC'
  } = req.query;

  const where = {};
  const userRole = String(req.user?.role || '').trim().toLowerCase();
  
  if (status) where.status = status;
  if (category) where.category = category;
  if (req.user) {
    if (userRole === 'superadmin') {
      if (institutionId !== undefined && institutionId !== '') {
        const institutionIdNum = Number(institutionId);
        if (!Number.isNaN(institutionIdNum)) {
          where.institutionId = institutionIdNum;
        }
      }
    } else if (userRole === 'student' || userRole === 'parent') {
      const tokenInstitutionId = Number(req.user.institutionId || 0);
      if (tokenInstitutionId > 0) {
        where.institutionId = tokenInstitutionId;
      } else if (institutionId !== undefined && institutionId !== '') {
        const institutionIdNum = Number(institutionId);
        if (!Number.isNaN(institutionIdNum)) {
          where.institutionId = institutionIdNum;
        }
      }
    } else {
      where.institutionId = req.user.institutionId || 0;
    }
  } else if (institutionId !== undefined && institutionId !== '') {
      const institutionIdNum = Number(institutionId);
      if (!Number.isNaN(institutionIdNum)) {
        where.institutionId = institutionIdNum;
      }
    }
  if (keyword) {
    where.title = { [Op.like]: `%${keyword}%` };
  }

  const pageNum = parseInt(page, 10) || 1;
  const pageSizeNum = parseInt(size || pageSize, 10) || 10;

  const { count, rows } = await Course.findAndCountAll({
    where,
    attributes: { exclude: ['detail'] },
    order: [[sortBy, sortOrder]],
    offset: (pageNum - 1) * pageSizeNum,
    limit: pageSizeNum
  });

  success(res, {
    list: rows,
    total: count,
    page: pageNum,
    size: pageSizeNum,
    pagination: {
      total: count,
      page: pageNum,
      pageSize: pageSizeNum
    }
  });
}));

/**
 * @GET /api/course/:id
 * 课程详情
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const course = await Course.findByPk(id, {
    include: [
      {
        model: LiveRoom,
        as: 'liveRooms',
        separate: true,
        order: [['createdAt', 'DESC']]
      }
    ]
  });

  if (!course) {
    return fail(res, '课程不存在', 404, 404);
  }

  const rawCourse = course.toJSON();
  rawCourse.liveRoom = rawCourse.liveRooms?.[0] || null;
  rawCourse.liveRoomCount = rawCourse.liveRooms?.length || 0;

  success(res, rawCourse);
}));

/**
 * @POST /api/course
 * 创建课程
 */
router.post('/', auth, requireRole(['admin', 'superadmin', 'teacher']), asyncHandler(async (req, res) => {
  const {
    title,
    subtitle,
    cover,
    category,
    price,
    originalPrice,
    lessonCount,
    duration,
    teacherId,
    teacherName,
    description,
    detail,
    outline,
    startTime,
    endTime,
    type,
    maxStudents,
    enableReplay
  } = req.body;

  let assignedTeacherId = req.user.id;
  let assignedTeacherName = teacherName || req.user.nickname;

  if (teacherId) {
    const teacher = await User.findOne({ where: { id: teacherId, role: 'teacher', status: 1 } });
    if (!teacher) {
      return fail(res, '讲师不存在', 404, 404);
    }
    assignedTeacherId = teacher.id;
    assignedTeacherName = teacher.nickname || teacher.username;
  }

  const course = await Course.create({
    title,
    subtitle: subtitle || description,
    cover,
    category,
    price: price || 0,
    originalPrice,
    lessonCount: lessonCount || 1,
    duration: duration || 60,
    teacherId: assignedTeacherId,
    teacherName: assignedTeacherName,
    institutionId: req.user.institutionId || req.user.id,
    detail: detail || description,
    outline,
    startTime,
    endTime,
    type: type || 'live',
    maxStudents: maxStudents || 500,
    enableReplay: enableReplay !== false,
    status: 'draft'
  });

  success(res, course, '课程创建成功');
}));

/**
 * @PUT /api/course/:id
 * 更新课程
 */
router.put('/:id', auth, requireRole(['admin', 'superadmin', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const course = await Course.findByPk(id);
  if (!course) {
    return fail(res, '课程不存在', 404, 404);
  }

  // 权限检查
  if (course.institutionId !== req.user.institutionId && req.user.role !== 'superadmin') {
    return fail(res, '无权修改此课程', 403, 403);
  }

  // 不允许直接修改某些字段
  delete updateData.id;
  delete updateData.studentCount;
  delete updateData.createdAt;

  if (updateData.description && !updateData.detail) {
    updateData.detail = updateData.description;
  }

  if (updateData.teacherId) {
    const teacher = await User.findOne({ where: { id: updateData.teacherId, role: 'teacher', status: 1 } });
    if (!teacher) {
      return fail(res, '讲师不存在', 404, 404);
    }
    updateData.teacherName = teacher.nickname || teacher.username;
  }

  await course.update(updateData);
  success(res, course, '课程更新成功');
}));

/**
 * @GET /api/course/:id/recordings
 * 获取课程录播视频（人工上传）
 */
router.get('/:id/recordings', auth, requireRole(['admin', 'superadmin', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const course = await Course.findByPk(id);
  if (!course) {
    return fail(res, '课程不存在', 404, 404);
  }
  if (!hasCourseManagePermission(course, req)) {
    return fail(res, '无权访问此课程', 403, 403);
  }

  const list = parseRecordedVideos(course);
  success(res, {
    courseId: course.id,
    courseTitle: course.title,
    type: course.type,
    list
  });
}));

/**
 * @PUT /api/course/:id/recordings
 * 更新课程录播视频（人工上传）
 */
router.put('/:id/recordings', auth, requireRole(['admin', 'superadmin', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { list } = req.body || {};
  const course = await Course.findByPk(id);

  if (!course) {
    return fail(res, '课程不存在', 404, 404);
  }
  if (!hasCourseManagePermission(course, req)) {
    return fail(res, '无权修改此课程', 403, 403);
  }
  if (!Array.isArray(list)) {
    return fail(res, 'list 必须为数组', 400, 400);
  }

  const normalized = list
    .map((item, index) => {
      const url = String(item?.url || '').trim();
      if (!url) return null;
      return {
        id: String(item?.id || `video-${Date.now()}-${index}`),
        title: String(item?.title || '').trim() || `第${index + 1}节`,
        url,
        duration: Math.max(0, Number(item?.duration || 0)),
        trialDuration: Math.max(0, Number(item?.trialDuration || 0)),
        sort: Number.isFinite(Number(item?.sort)) ? Number(item.sort) : index + 1,
        status: String(item?.status || 'published').trim() === 'draft' ? 'draft' : 'published',
        cover: String(item?.cover || '').trim(),
        updatedAt: new Date().toISOString()
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));

  await course.update({
    outline: mergeOutlineWithRecordedVideos(course, normalized)
  });

  success(res, {
    courseId: course.id,
    list: normalized
  }, '录播视频已保存');
}));

/**
 * @POST /api/course/:id/publish
 * 发布课程
 */
router.post('/:id/publish', auth, requireRole(['admin', 'superadmin']), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const course = await Course.findByPk(id);
  if (!course) {
    return fail(res, '课程不存在', 404, 404);
  }

  await course.update({ status: 'published' });
  success(res, null, '课程已发布');
}));

/**
 * @POST /api/course/:id/archive
 * 归档课程
 */
router.post('/:id/archive', auth, requireRole(['admin', 'superadmin']), asyncHandler(async (req, res) => {
  const { id } = req.params;

  await Course.update({ status: 'archived' }, { where: { id } });
  success(res, null, '课程已归档');
}));

/**
 * @DELETE /api/course/:id
 * 删除课程
 */
router.delete('/:id', auth, requireRole(['admin', 'superadmin']), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const course = await Course.findByPk(id);
  if (!course) {
    return fail(res, '课程不存在', 404, 404);
  }

  // 检查是否有已支付订单
  const orderCount = await Order.count({
    where: { courseId: id, status: 'paid' }
  });

  if (orderCount > 0) {
    return fail(res, '该课程已有学员购买，无法删除', 400, 400);
  }

  await course.destroy();
  success(res, null, '课程已删除');
}));

/**
 * @GET /api/course/:id/students
 * 获取课程学员列表
 */
router.get('/:id/students', auth, requireRole(['admin', 'superadmin', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, pageSize = 20 } = req.query;

  const { count, rows } = await Order.findAndCountAll({
    where: { courseId: id, status: 'paid' },
    include: [
      { 
        model: require('../models').Student, 
        as: 'student',
        attributes: ['id', 'nickname', 'realName', 'avatar', 'phone']
      }
    ],
    order: [['payTime', 'DESC']],
    offset: (page - 1) * pageSize,
    limit: parseInt(pageSize)
  });

  success(res, {
    list: rows.map(r => ({
      ...r.student?.toJSON(),
      orderNo: r.orderNo,
      payTime: r.payTime,
      amount: r.amount
    })),
    pagination: {
      total: count,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }
  });
}));

/**
 * @POST /api/course/:id/notify
 * 发送开播提醒（给所有报名学员）
 */
router.post('/:id/notify', auth, requireRole(['admin', 'superadmin', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const course = await Course.findByPk(id);
  if (!course) {
    return fail(res, '课程不存在', 404, 404);
  }

  // 获取所有已支付学员的 openid
  const orders = await Order.findAll({
    where: { courseId: id, status: 'paid' },
    include: [
      { model: require('../models').Student, as: 'student', attributes: ['openid'] }
    ]
  });

  const openids = orders
    .map(o => o.student?.openid)
    .filter(Boolean);

  if (openids.length === 0) {
    return fail(res, '没有可通知的学员', 400, 400);
  }

  // 批量发送
  const { batchNotifyLiveStart } = require('../utils/push');
  const startTime = course.startTime 
    ? new Date(course.startTime).toLocaleString('zh-CN')
    : '即将开始';

  const result = await batchNotifyLiveStart(
    openids,
    course.title,
    startTime,
    `/pages/live/room?id=${id}`
  );

  success(res, result, `已发送开播提醒`);
}));

module.exports = router;
