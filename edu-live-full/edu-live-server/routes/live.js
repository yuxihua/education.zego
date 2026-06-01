/**
 * 直播路由
 * 直播间管理、上下课、在线状态、聊天
 */
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { LiveRoom, Course, PPTFile, User, Order } = require('../models');
const { success, fail, page } = require('../utils/response');
const { asyncHandler } = require('../middleware/error');
const { auth, requireRole } = require('../middleware/auth');
const { liveLimiter } = require('../middleware/ratelimit');
const redis = require('../config/redis');
const { writeOperationLog } = require('../utils/operationLogWriter');

function getOperatorInstitutionId(req) {
  return req.user?.institutionId || 0;
}

function getCohostRedisKey(roomId, userId) {
  return `live:cohost:${roomId}:${userId}`;
}

function getCurrentStudentId(req) {
  return req.user?.studentId || req.user?.id;
}

function isStudentIdentity(req) {
  return !req.user?.role || req.user.role === 'student';
}

function buildStudentRoomPayload(room) {
  const raw = room?.toJSON ? room.toJSON() : room;
  return {
    id: raw.id,
    courseId: raw.courseId,
    title: raw.title,
    status: raw.status,
    anchorId: raw.anchorId,
    anchorName: raw.anchorName,
    onlineCount: raw.onlineCount,
    peakCount: raw.peakCount,
    totalViewCount: raw.totalViewCount,
    zegoRoomId: raw.zegoRoomId,
    pullUrl: raw.pullUrl,
    hlsUrl: raw.hlsUrl,
    replayUrl: raw.replayUrl,
    replayDuration: raw.replayDuration,
    replaySize: raw.replaySize,
    actualStartTime: raw.actualStartTime,
    endTime: raw.endTime,
    chatEnabled: raw.chatEnabled,
    course: raw.course || null,
    pptFiles: raw.pptFiles || []
  };
}

function checkCourseInstitutionAccess(req, res, course) {
  if (req.user?.role === 'superadmin') return true;
  if (!course) {
    fail(res, '关联课程不存在', 404, 404);
    return false;
  }
  if (course.institutionId !== getOperatorInstitutionId(req)) {
    fail(res, '无权访问该机构直播数据', 403, 403);
    return false;
  }
  return true;
}

async function checkStudentCourseAccess(req, res, courseId) {
  if (!isStudentIdentity(req) && req.user?.role !== 'superadmin') {
    fail(res, '仅学员可访问直播观看页', 403, 403);
    return null;
  }

  const studentId = getCurrentStudentId(req);
  if (!studentId) {
    fail(res, '学员身份无效，请重新登录', 401, 401);
    return null;
  }

  const order = await Order.findOne({
    where: {
      studentId,
      courseId,
      status: 'paid'
    }
  });

  if (!order) {
    fail(res, '仅已购课程学员可进入直播', 403, 403);
    return null;
  }

  return order;
}

/**
 * @GET /api/live/rooms
 * 获取直播间列表
 */
router.get('/rooms', auth, asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    pageSize = 10, 
    status, 
    courseId,
    keyword,
    institutionId
  } = req.query;

  const where = {};
  if (status) where.status = status;
  if (courseId) where.courseId = courseId;
  if (keyword) {
    where.title = { [Op.like]: `%${keyword}%` };
  }

  const courseInclude = {
    model: Course,
    as: 'course',
    attributes: ['id', 'title', 'cover', 'price', 'institutionId']
  };
  if (req.user.role !== 'superadmin') {
    courseInclude.where = { institutionId: getOperatorInstitutionId(req) };
    courseInclude.required = true;
  } else if (institutionId !== undefined && institutionId !== '') {
    const institutionIdNum = Number(institutionId);
    if (!Number.isNaN(institutionIdNum)) {
      courseInclude.where = { institutionId: institutionIdNum };
      courseInclude.required = true;
    }
  }

  const { count, rows } = await LiveRoom.findAndCountAll({
    where,
    include: [courseInclude],
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
 * @GET /api/live/room/:id
 * 获取直播间详情
 */
router.get('/room/:id', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const room = await LiveRoom.findByPk(id, {
    include: [
      { model: Course, as: 'course', attributes: { exclude: ['detail'] } },
      { model: PPTFile, as: 'pptFiles' }
    ]
  });

  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }

  if (!checkCourseInstitutionAccess(req, res, room.course)) return;

  // 增加观看次数
  await LiveRoom.increment('totalViewCount', { where: { id } });

  success(res, room);
}));

/**
 * @GET /api/live/student/course/:courseId/room
 * 学员按课程获取直播间信息
 */
router.get('/student/course/:courseId/room', auth, asyncHandler(async (req, res) => {
  const courseId = Number(req.params.courseId || 0);
  if (!courseId) {
    return fail(res, '无效的课程ID', 400, 400);
  }

  const access = await checkStudentCourseAccess(req, res, courseId);
  if (!access) return;

  const room = await LiveRoom.findOne({
    where: { courseId },
    include: [
      { model: Course, as: 'course', attributes: ['id', 'title', 'cover', 'teacherName'] },
      { model: PPTFile, as: 'pptFiles', attributes: ['id', 'name', 'type', 'pageCount'] }
    ],
    order: [['createdAt', 'DESC']]
  });

  if (!room) {
    return success(res, null, '该课程暂未创建直播间');
  }

  success(res, buildStudentRoomPayload(room));
}));

/**
 * @GET /api/live/student/room/:id
 * 学员获取直播间详情
 */
router.get('/student/room/:id', auth, asyncHandler(async (req, res) => {
  const room = await LiveRoom.findByPk(req.params.id, {
    include: [
      { model: Course, as: 'course', attributes: ['id', 'title', 'cover', 'teacherName'] },
      { model: PPTFile, as: 'pptFiles', attributes: ['id', 'name', 'type', 'pageCount'] }
    ]
  });

  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }

  const access = await checkStudentCourseAccess(req, res, room.courseId);
  if (!access) return;

  await LiveRoom.increment('totalViewCount', { where: { id: room.id } });
  room.totalViewCount = Number(room.totalViewCount || 0) + 1;

  success(res, buildStudentRoomPayload(room));
}));

/**
 * @POST /api/live/room
 * 创建直播间
 */
router.post('/room', auth, requireRole(['admin', 'superadmin', 'teacher']), asyncHandler(async (req, res) => {
  const { courseId, title, password, settings, teacherId } = req.body;

  // 检查课程是否存在
  const course = await Course.findByPk(courseId);
  if (!course) {
    return fail(res, '课程不存在', 404, 404);
  }
  if (!checkCourseInstitutionAccess(req, res, course)) return;

  // 检查是否已创建
  const existRoom = await LiveRoom.findOne({ where: { courseId } });
  if (existRoom) {
    return fail(res, '该课程已有直播间', 409, 409);
  }

  let anchorId = req.user.id;
  let anchorName = req.user.nickname || req.user.username;

  if (teacherId) {
    const teacherWhere = { id: teacherId, role: 'teacher', status: 1 };
    if (req.user.role !== 'superadmin') {
      teacherWhere.institutionId = getOperatorInstitutionId(req);
    }
    const teacher = await User.findOne({ where: teacherWhere });
    if (!teacher) {
      return fail(res, '讲师不存在', 404, 404);
    }
    if (course.institutionId && teacher.institutionId !== course.institutionId) {
      return fail(res, '讲师与课程不属于同一机构', 400, 400);
    }
    anchorId = teacher.id;
    anchorName = teacher.nickname || teacher.username;
  }

  // 生成 ZEGO 房间ID
  const zegoRoomId = `edu_${courseId}_${Date.now()}`;

  const room = await LiveRoom.create({
    courseId,
    zegoRoomId,
    title: title || course.title,
    anchorId,
    anchorName,
    password: password || null,
    settings: settings || {},
    status: 'waiting'
  });

  success(res, room, '直播间创建成功');
}));

/**
 * @PUT /api/live/room/:id
 * 更新直播间信息
 */
router.put('/room/:id', auth, requireRole(['admin', 'superadmin', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, password, chatEnabled, settings } = req.body;

  const room = await LiveRoom.findByPk(id, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId'] }]
  });
  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }
  if (!checkCourseInstitutionAccess(req, res, room.course)) return;

  // 权限检查
  if (room.anchorId !== req.user.id && req.user.role !== 'superadmin') {
    return fail(res, '无权操作此直播间', 403, 403);
  }

  await room.update({
    title,
    password,
    chatEnabled,
    settings
  });

  success(res, null, '更新成功');
}));

/**
 * @POST /api/live/room/:id/start
 * 开始直播
 */
router.post('/room/:id/start', auth, requireRole(['admin', 'superadmin', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { pushUrl } = req.body;

  const room = await LiveRoom.findByPk(id, {
    include: [{ model: Course, as: 'course' }]
  });

  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }
  if (!checkCourseInstitutionAccess(req, res, room.course)) return;

  if (room.anchorId !== req.user.id && req.user.role !== 'superadmin') {
    return fail(res, '无权操作', 403, 403);
  }

  await room.update({
    status: 'living',
    actualStartTime: new Date(),
    pushUrl: pushUrl || room.pushUrl
  });

  // TODO: 发送直播开始通知给预约的学员
  // await notifyLiveStartToSubscribers(room);

  success(res, {
    roomId: room.zegoRoomId,
    pushUrl: room.pushUrl,
    status: 'living'
  }, '直播已开始');
}));

/**
 * @POST /api/live/room/:id/stop
 * 结束直播
 */
router.post('/room/:id/stop', auth, requireRole(['admin', 'superadmin', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const room = await LiveRoom.findByPk(id, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId'] }]
  });
  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }
  if (!checkCourseInstitutionAccess(req, res, room.course)) return;

  if (room.anchorId !== req.user.id && req.user.role !== 'superadmin') {
    return fail(res, '无权操作', 403, 403);
  }

  await room.update({
    status: 'finished',
    endTime: new Date()
  });

  await writeOperationLog(req, {
    action: '结束直播',
    path: `/api/live/room/${id}/stop`,
    payload: { roomId: id, zegoRoomId: room.zegoRoomId, title: room.title },
    message: '直播已结束'
  });

  success(res, null, '直播已结束');
}));

/**
 * @POST /api/live/room/:id/pause
 * 暂停直播
 */
router.post('/room/:id/pause', auth, requireRole(['admin', 'superadmin', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const room = await LiveRoom.findByPk(id, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId'] }]
  });
  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }
  if (!checkCourseInstitutionAccess(req, res, room.course)) return;

  if (room.anchorId !== req.user.id && req.user.role !== 'superadmin') {
    return fail(res, '无权操作', 403, 403);
  }

  await room.update({ status: 'paused' });
  success(res, null, '直播已暂停');
}));

/**
 * @POST /api/live/room/:id/resume
 * 恢复直播
 */
router.post('/room/:id/resume', auth, requireRole(['admin', 'superadmin', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const room = await LiveRoom.findByPk(id, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId'] }]
  });
  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }
  if (!checkCourseInstitutionAccess(req, res, room.course)) return;

  if (room.anchorId !== req.user.id && req.user.role !== 'superadmin') {
    return fail(res, '无权操作', 403, 403);
  }

  await room.update({ status: 'living' });
  success(res, null, '直播已恢复');
}));

// ========== 连麦审批 ==========

router.post('/room/:id/cohost/approve', auth, requireRole(['admin', 'superadmin', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return fail(res, '缺少 userId', 400, 400);
  }

  const room = await LiveRoom.findByPk(id, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId'] }]
  });
  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }
  if (!checkCourseInstitutionAccess(req, res, room.course)) return;

  if (room.anchorId !== req.user.id && req.user.role !== 'superadmin') {
    return fail(res, '无权操作', 403, 403);
  }

  await redis.set(getCohostRedisKey(room.id, userId), '1', 'EX', 2 * 60 * 60);

  await writeOperationLog(req, {
    action: '连麦审批-同意',
    path: `/api/live/room/${id}/cohost/approve`,
    payload: { roomId: id, userId },
    message: '已允许学生连麦'
  });

  success(res, null, '已允许学生连麦');
}));

router.post('/room/:id/cohost/reject', auth, requireRole(['admin', 'superadmin', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return fail(res, '缺少 userId', 400, 400);
  }

  const room = await LiveRoom.findByPk(id, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId'] }]
  });
  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }
  if (!checkCourseInstitutionAccess(req, res, room.course)) return;

  if (room.anchorId !== req.user.id && req.user.role !== 'superadmin') {
    return fail(res, '无权操作', 403, 403);
  }

  await redis.del(getCohostRedisKey(room.id, userId));

  await writeOperationLog(req, {
    action: '连麦审批-拒绝',
    path: `/api/live/room/${id}/cohost/reject`,
    payload: { roomId: id, userId },
    message: '已拒绝学生连麦'
  });

  success(res, null, '已拒绝连麦');
}));

router.post('/room/:id/cohost/kick', auth, requireRole(['admin', 'superadmin', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return fail(res, '缺少 userId', 400, 400);
  }

  const room = await LiveRoom.findByPk(id, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId'] }]
  });
  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }
  if (!checkCourseInstitutionAccess(req, res, room.course)) return;

  if (room.anchorId !== req.user.id && req.user.role !== 'superadmin') {
    return fail(res, '无权操作', 403, 403);
  }

  await redis.del(getCohostRedisKey(room.id, userId));

  await writeOperationLog(req, {
    action: '连麦挂断',
    path: `/api/live/room/${id}/cohost/kick`,
    payload: { roomId: id, userId },
    message: '已结束学生连麦'
  });

  success(res, null, '已结束学生连麦');
}));

// ========== 聊天管理 ==========

/**
 * @POST /api/live/room/:id/chat/mute-all
 * 全员禁言
 */
router.post('/room/:id/chat/mute-all', auth, requireRole(['admin', 'superadmin', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { mute } = req.body;

  const room = await LiveRoom.findByPk(id, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId'] }]
  });
  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }
  if (!checkCourseInstitutionAccess(req, res, room.course)) return;

  if (room.anchorId !== req.user.id && req.user.role !== 'superadmin') {
    return fail(res, '无权操作', 403, 403);
  }

  await LiveRoom.update(
    { allMuted: mute },
    { where: { id } }
  );

  success(res, null, mute ? '已开启全员禁言' : '已关闭全员禁言');
}));

/**
 * @POST /api/live/room/:id/chat/send
 * 发送聊天消息
 */
router.post('/room/:id/chat/send', auth, liveLimiter, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content, userId, nickname, avatar } = req.body;

  const room = await LiveRoom.findByPk(id, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId'] }]
  });
  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }
  if (isStudentIdentity(req)) {
    const access = await checkStudentCourseAccess(req, res, room.courseId);
    if (!access) return;
  } else if (!checkCourseInstitutionAccess(req, res, room.course)) return;

  if (room.allMuted) {
    return fail(res, '当前全员禁言中', 403, 403);
  }

  const messageContent = String(content || '').trim();
  if (!messageContent) {
    return fail(res, '消息内容不能为空', 400, 400);
  }

  // 消息存入 Redis（用于历史记录和敏感词过滤）
  const message = {
    id: Date.now().toString(),
    roomId: id,
    userId: userId || req.user.id || 'anonymous',
    nickname: nickname || req.user.nickname || req.user.username || '匿名用户',
    avatar: avatar || '',
    content: messageContent,
    createdAt: new Date().toISOString()
  };

  // 保存最近 500 条消息
  await redis.lpush(`chat:${id}`, JSON.stringify(message));
  await redis.ltrim(`chat:${id}`, 0, 499);
  await redis.expire(`chat:${id}`, 7 * 24 * 3600); // 保留7天

  await writeOperationLog(req, {
    action: '直播发送消息',
    path: `/api/live/room/${id}/chat/send`,
    payload: { roomId: id, content: messageContent },
    message: '聊天消息已发送'
  });

  success(res, message, '发送成功');
}));

/**
 * @GET /api/live/room/:id/chat/history
 * 获取聊天历史
 */
router.get('/room/:id/chat/history', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 50 } = req.query;

  const room = await LiveRoom.findByPk(id, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId'] }]
  });
  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }
  if (isStudentIdentity(req)) {
    const access = await checkStudentCourseAccess(req, res, room.courseId);
    if (!access) return;
  } else if (!checkCourseInstitutionAccess(req, res, room.course)) return;

  const messages = await redis.lrange(`chat:${id}`, 0, parseInt(limit) - 1);
  const list = messages.map(msg => JSON.parse(msg)).reverse();

  success(res, list);
}));

// ========== 在线人数 ==========

/**
 * @POST /api/live/room/:id/online
 * 用户进入直播间（上报在线）
 */
router.post('/room/:id/online', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  const room = await LiveRoom.findByPk(id, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId'] }]
  });
  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }
  if (isStudentIdentity(req)) {
    const access = await checkStudentCourseAccess(req, res, room.courseId);
    if (!access) return;
  } else if (!checkCourseInstitutionAccess(req, res, room.course)) return;

  // 使用 Redis 统计在线人数（Set 去重）
  await redis.sadd(`room:${id}:online`, userId || `guest_${Date.now()}`);
  await redis.expire(`room:${id}:online`, 3600);

  // 更新在线人数
  const onlineCount = await redis.scard(`room:${id}:online`);
  await room.update({ onlineCount });

  // 更新峰值
  if (onlineCount > room.peakCount) {
    await room.update({ peakCount: onlineCount });
  }

  success(res, { onlineCount });
}));

/**
 * @POST /api/live/room/:id/offline
 * 用户离开直播间
 */
router.post('/room/:id/offline', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  const room = await LiveRoom.findByPk(id, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId'] }]
  });
  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }
  if (isStudentIdentity(req)) {
    const access = await checkStudentCourseAccess(req, res, room.courseId);
    if (!access) return;
  } else if (!checkCourseInstitutionAccess(req, res, room.course)) return;

  if (userId) {
    await redis.srem(`room:${id}:online`, userId);
  }

  const onlineCount = await redis.scard(`room:${id}:online`);
  await LiveRoom.update({ onlineCount }, { where: { id } });

  success(res, { onlineCount });
}));

/**
 * @POST /api/live/room/:id/cohost/request
 * 学员申请连麦
 */
router.post('/room/:id/cohost/request', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId, userName } = req.body;

  const room = await LiveRoom.findByPk(id, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId'] }]
  });
  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }

  const access = await checkStudentCourseAccess(req, res, room.courseId);
  if (!access) return;

  await writeOperationLog(req, {
    action: '申请连麦',
    path: `/api/live/room/${id}/cohost/request`,
    payload: { roomId: id, userId: userId || getCurrentStudentId(req), userName: userName || req.user?.nickname || '学员' },
    message: '学员已提交连麦申请'
  });

  success(res, null, '连麦申请已记录');
}));

module.exports = router;
