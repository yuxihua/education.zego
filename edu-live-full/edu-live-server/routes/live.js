/**
 * 直播路由
 * 直播间管理、上下课、在线状态、聊天
 */
const express = require('express');
const router = express.Router();
const { LiveRoom, Course, PPTFile, User } = require('../models');
const { success, fail, page } = require('../utils/response');
const { asyncHandler } = require('../middleware/error');
const { auth, requireRole } = require('../middleware/auth');
const { liveLimiter } = require('../middleware/ratelimit');
const redis = require('../config/redis');

/**
 * @GET /api/live/rooms
 * 获取直播间列表
 */
router.get('/rooms', asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    pageSize = 10, 
    status, 
    courseId,
    keyword 
  } = req.query;

  const where = {};
  if (status) where.status = status;
  if (courseId) where.courseId = courseId;
  if (keyword) {
    where.title = { [require('sequelize').Op.like]: `%${keyword}%` };
  }

  const { count, rows } = await LiveRoom.findAndCountAll({
    where,
    include: [
      { model: Course, as: 'course', attributes: ['id', 'title', 'cover', 'price'] }
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
 * @GET /api/live/room/:id
 * 获取直播间详情
 */
router.get('/room/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const room = await LiveRoom.findByPk(id, {
    include: [
      { model: Course, as: 'course' },
      { model: PPTFile, as: 'pptFiles' }
    ]
  });

  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }

  // 增加观看次数
  await LiveRoom.increment('totalViewCount', { where: { id } });

  success(res, room);
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

  // 检查是否已创建
  const existRoom = await LiveRoom.findOne({ where: { courseId } });
  if (existRoom) {
    return fail(res, '该课程已有直播间', 409, 409);
  }

  let anchorId = req.user.id;
  let anchorName = req.user.nickname || req.user.username;

  if (teacherId) {
    const teacher = await User.findOne({ where: { id: teacherId, role: 'teacher', status: 1 } });
    if (!teacher) {
      return fail(res, '讲师不存在', 404, 404);
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

  const room = await LiveRoom.findByPk(id);
  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }

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

  const room = await LiveRoom.findByPk(id);
  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }

  if (room.anchorId !== req.user.id && req.user.role !== 'superadmin') {
    return fail(res, '无权操作', 403, 403);
  }

  await room.update({
    status: 'finished',
    endTime: new Date()
  });

  success(res, null, '直播已结束');
}));

/**
 * @POST /api/live/room/:id/pause
 * 暂停直播
 */
router.post('/room/:id/pause', auth, requireRole(['admin', 'superadmin', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const room = await LiveRoom.findByPk(id);
  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
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

  const room = await LiveRoom.findByPk(id);
  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }

  await room.update({ status: 'living' });
  success(res, null, '直播已恢复');
}));

// ========== 聊天管理 ==========

/**
 * @POST /api/live/room/:id/chat/mute-all
 * 全员禁言
 */
router.post('/room/:id/chat/mute-all', auth, requireRole(['admin', 'superadmin', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { mute } = req.body;

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
router.post('/room/:id/chat/send', liveLimiter, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content, userId, nickname, avatar } = req.body;

  const room = await LiveRoom.findByPk(id);
  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }

  if (room.allMuted) {
    return fail(res, '当前全员禁言中', 403, 403);
  }

  // 消息存入 Redis（用于历史记录和敏感词过滤）
  const message = {
    id: Date.now().toString(),
    roomId: id,
    userId: userId || 'anonymous',
    nickname: nickname || '匿名用户',
    avatar: avatar || '',
    content,
    createdAt: new Date().toISOString()
  };

  // 保存最近 500 条消息
  await redis.lpush(`chat:${id}`, JSON.stringify(message));
  await redis.ltrim(`chat:${id}`, 0, 499);
  await redis.expire(`chat:${id}`, 7 * 24 * 3600); // 保留7天

  success(res, message, '发送成功');
}));

/**
 * @GET /api/live/room/:id/chat/history
 * 获取聊天历史
 */
router.get('/room/:id/chat/history', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 50 } = req.query;

  const messages = await redis.lrange(`chat:${id}`, 0, parseInt(limit) - 1);
  const list = messages.map(msg => JSON.parse(msg)).reverse();

  success(res, list);
}));

// ========== 在线人数 ==========

/**
 * @POST /api/live/room/:id/online
 * 用户进入直播间（上报在线）
 */
router.post('/room/:id/online', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  const room = await LiveRoom.findByPk(id);
  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }

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
router.post('/room/:id/offline', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (userId) {
    await redis.srem(`room:${id}:online`, userId);
  }

  const onlineCount = await redis.scard(`room:${id}:online`);
  await LiveRoom.update({ onlineCount }, { where: { id } });

  success(res, { onlineCount });
}));

module.exports = router;
