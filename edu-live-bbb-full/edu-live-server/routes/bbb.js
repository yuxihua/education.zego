/**
 * BigBlueButton 直播路由
 * 功能：创建会议、生成入会链接、结束会议、查询回放
 */
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { LiveRoom, Course, Order } = require('../models');
const { success, fail } = require('../utils/response');
const { asyncHandler } = require('../middleware/error');
const { auth } = require('../middleware/auth');
const config = require('../config/bbb');
const { callBbb, toBool, listRecordings, buildJoinUrl } = require('../utils/bbbApi');

const normalizeMeetingId = (room) => String(room?.zegoRoomId || room?.id || '').trim();
const getCurrentStudentId = (req) => req.user?.studentId || req.user?.id || 0;
const normalizeJoinRole = (value) => {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'moderator' || role === 'teacher' || role === 'host') return 'moderator';
  return 'attendee';
};

const canJoinAsModerator = (req, room) => {
  const role = String(req.user?.role || '').trim().toLowerCase();
  if (role === 'superadmin' || role === 'admin') return true;
  return Number(room?.anchorId) === Number(req.user?.id || 0);
};

const isStudentIdentity = (req) => {
  const role = String(req.user?.role || '').trim().toLowerCase();
  return !role || role === 'student' || role === 'parent';
};

const hasInstitutionAccess = (req, room) => {
  if (req.user?.role === 'superadmin') return true;
  const roomInstitutionId = Number(room?.course?.institutionId || 0);
  const operatorInstitutionId = Number(req.user?.institutionId || 0);
  return roomInstitutionId > 0 && roomInstitutionId === operatorInstitutionId;
};

const canSkipPurchaseCheck = (room) => {
  const settings = room?.settings || {};
  const price = Number(room?.course?.price);
  const hasCoursePrice = room?.course?.price !== null && room?.course?.price !== undefined;

  if (hasCoursePrice && !Number.isNaN(price) && price <= 0) {
    return true;
  }

  return Boolean(
    settings.allowNoPurchase ||
    settings.publicAccess ||
    settings.openAccess
  );
};

const ensureRoomAccess = async (req, res, room) => {
  if (isStudentIdentity(req)) {
    const studentId = Number(getCurrentStudentId(req) || 0);
    if (!studentId) {
      fail(res, '学员身份无效，请重新登录', 401, 401);
      return false;
    }

    if (!canSkipPurchaseCheck(room)) {
      const order = await Order.findOne({
        where: {
          studentId,
          courseId: room.courseId,
          status: 'paid'
        }
      });

      if (!order) {
        fail(res, '仅已购课程的学员或家长可进入课堂', 403, 403);
        return false;
      }
    }

    return true;
  }

  if (!hasInstitutionAccess(req, room)) {
    fail(res, '无权访问该机构直播数据', 403, 403);
    return false;
  }

  return true;
};

const fetchReplay = async (meetingID) => {
  const payload = await callBbb('getRecordings', { meetingID });
  const recordings = listRecordings(payload.recordings);
  const published = recordings.find(item => toBool(item.published));

  if (!published) {
    return null;
  }

  const playback = published.playback?.format;
  const playbackItem = Array.isArray(playback) ? playback[0] : playback;
  const url = playbackItem?.url || '';
  if (!url) return null;

  return {
    url,
    recordingID: published.recordID || '',
    size: Number(published.size || 0),
    duration: Number(published.playback?.duration || 0)
  };
};

router.post('/meeting/:roomId/create', auth, asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const room = await LiveRoom.findByPk(roomId, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId', 'price'] }]
  });

  if (!room) return fail(res, '直播间不存在', 404, 404);
  if (!await ensureRoomAccess(req, res, room)) return;

  const meetingID = normalizeMeetingId(room);
  if (!meetingID) return fail(res, '缺少会议标识', 400, 400);

  const isTeacher = req.user.role === 'superadmin' || Number(room.anchorId) === Number(req.user.id);
  if (!isTeacher) return fail(res, '无权限创建会议', 403, 403);

  const payload = await callBbb('create', {
    meetingID,
    name: room.title || `直播间-${room.id}`,
    attendeePW: room.studentPassword || `attendee-${room.id}`,
    moderatorPW: room.anchorPassword || `moderator-${room.id}`,
    welcome: config.meeting.welcome,
    duration: config.meeting.defaultDuration,
    maxParticipants: config.meeting.maxParticipants,
    record: config.meeting.record,
    autoStartRecording: config.meeting.autoStartRecording,
    allowStartStopRecording: config.meeting.allowStartStopRecording
  });

  return success(res, {
    roomId: room.id,
    meetingID,
    created: true,
    internalMeetingID: payload.internalMeetingID || '',
    createTime: payload.createTime || Date.now()
  }, '会议创建成功');
}));

router.get('/join/:roomId', auth, asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const room = await LiveRoom.findByPk(roomId, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId', 'price'] }]
  });
  if (!room) return fail(res, '直播间不存在', 404, 404);
  if (!await ensureRoomAccess(req, res, room)) return;

  const meetingID = normalizeMeetingId(room);
  if (!meetingID) return fail(res, '缺少会议标识', 400, 400);

  const requestedRole = normalizeJoinRole(req.query.role || req.query.mode);
  const joinAsModerator = requestedRole === 'moderator';
  if (joinAsModerator && !canJoinAsModerator(req, room)) {
    return fail(res, '无权限以主持人身份入会', 403, 403);
  }

  const fullName = req.user.nickname || req.user.username || '用户';
  const userId = req.user.studentId ? `student_${req.user.studentId}` : `user_${req.user.id}`;

  const joinUrl = buildJoinUrl({
    meetingID,
    fullName,
    password: joinAsModerator ? (room.anchorPassword || `moderator-${room.id}`) : (room.studentPassword || `attendee-${room.id}`),
    userID: userId,
    redirect: true
  });

  return success(res, {
    joinUrl,
    meetingID,
    role: joinAsModerator ? 'moderator' : 'attendee'
  }, '获取入会链接成功');
}));

router.post('/meeting/:roomId/end', auth, asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const room = await LiveRoom.findByPk(roomId, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId', 'price'] }]
  });
  if (!room) return fail(res, '直播间不存在', 404, 404);
  if (!await ensureRoomAccess(req, res, room)) return;

  const isTeacher = req.user.role === 'superadmin' || Number(room.anchorId) === Number(req.user.id);
  if (!isTeacher) return fail(res, '无权限结束会议', 403, 403);

  const meetingID = normalizeMeetingId(room);
  if (!meetingID) return fail(res, '缺少会议标识', 400, 400);

  await callBbb('end', {
    meetingID,
    password: room.anchorPassword || `moderator-${room.id}`
  });

  return success(res, { meetingID, ended: true }, '会议已结束');
}));

router.get('/replay/:meetingID', auth, asyncHandler(async (req, res) => {
  const { meetingID } = req.params;
  if (!meetingID) return fail(res, '缺少 meetingID', 400, 400);

  const roomWhere = [{ zegoRoomId: meetingID }];
  const roomId = Number(meetingID);
  if (!Number.isNaN(roomId) && roomId > 0) {
    roomWhere.push({ id: roomId });
  }

  const room = await LiveRoom.findOne({
    where: { [Op.or]: roomWhere },
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId', 'price'] }]
  });
  if (!room) return fail(res, '直播间不存在', 404, 404);
  if (!await ensureRoomAccess(req, res, room)) return;

  const replay = await fetchReplay(meetingID);
  if (!replay) {
    return fail(res, '回放尚未生成', 404, 404);
  }

  return success(res, replay, '获取回放成功');
}));

router.get('/replay-room/:roomId', auth, asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const room = await LiveRoom.findByPk(roomId, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId', 'price'] }]
  });
  if (!room) return fail(res, '直播间不存在', 404, 404);
  if (!await ensureRoomAccess(req, res, room)) return;

  const meetingID = normalizeMeetingId(room);
  if (!meetingID) return fail(res, '缺少会议标识', 400, 400);

  const replay = await fetchReplay(meetingID);
  if (!replay) {
    return fail(res, '回放尚未生成', 404, 404);
  }

  await room.update({
    replayUrl: replay.url,
    replayDuration: replay.duration,
    replaySize: replay.size
  });

  return success(res, {
    ...replay,
    meetingID,
    roomId: room.id
  }, '获取回放成功');
}));

module.exports = router;
