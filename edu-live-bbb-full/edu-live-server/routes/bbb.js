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
const { writeOperationLog } = require('../utils/operationLogWriter');
const config = require('../config/bbb');
const { callBbb, toBool, listRecordings, buildJoinUrl } = require('../utils/bbbApi');

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

const toTimestamp = (value) => {
  if (!value && value !== 0) return 0;
  const text = String(value).trim();
  if (!text) return 0;

  if (/^\d+$/.test(text)) {
    const numeric = Number(text);
    if (!Number.isFinite(numeric)) return 0;
    // BBB 有的字段为毫秒时间戳。
    return numeric > 1e12 ? numeric : numeric * 1000;
  }

  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getMeetingCandidates = (recording = {}) => {
  const values = [];

  const pushValue = (input) => {
    const normalized = normalizeKey(input);
    if (!normalized) return;
    values.push(normalized);
  };

  pushValue(recording.meetingID);
  pushValue(recording.meetingId);
  pushValue(recording.internalMeetingID);
  pushValue(recording.internalMeetingId);

  const metadata = recording.metadata || {};
  Object.entries(metadata).forEach(([key, value]) => {
    const keyText = normalizeKey(key);
    if (!keyText.includes('meeting') || !keyText.includes('id')) return;
    pushValue(value);
  });

  return values;
};

const isRecordingMatchMeeting = (recording, meetingID) => {
  const target = normalizeKey(meetingID);
  if (!target) return false;
  return getMeetingCandidates(recording).includes(target);
};

const PLAYBACK_TYPE_PRIORITY = ['presentation', 'video', 'screenshare', 'podcast'];

const getPreferredPlaybackFormat = (recording) => {
  const playback = recording?.playback?.format;
  const playbackItems = (Array.isArray(playback) ? playback : [playback]).filter(item => item?.url);
  if (!playbackItems.length) return null;

  const sorted = [...playbackItems].sort((left, right) => {
    const leftType = normalizeKey(left?.type);
    const rightType = normalizeKey(right?.type);
    const leftPriority = PLAYBACK_TYPE_PRIORITY.indexOf(leftType);
    const rightPriority = PLAYBACK_TYPE_PRIORITY.indexOf(rightType);
    const normalizedLeft = leftPriority === -1 ? PLAYBACK_TYPE_PRIORITY.length : leftPriority;
    const normalizedRight = rightPriority === -1 ? PLAYBACK_TYPE_PRIORITY.length : rightPriority;
    return normalizedLeft - normalizedRight;
  });

  return sorted[0] || null;
};

const getRecordingPlaybackUrl = (recording) => {
  const format = getPreferredPlaybackFormat(recording);
  return format?.url || '';
};

const buildReplayPayload = (recording = {}) => {
  const format = getPreferredPlaybackFormat(recording);
  return {
    url: format?.url || '',
    recordingID: recording.recordID || '',
    size: Number(recording.size || 0),
    duration: Number(format?.length || recording.playback?.duration || 0),
    startTime: recording.startTime || null,
    endTime: recording.endTime || null,
    publishedAt: recording.publishedDate || null
  };
};

const listSessionReplays = (recordings = [], meetingID = '') => recordings
  .filter(item => item && toBool(item.published))
  .filter(item => Boolean(getRecordingPlaybackUrl(item)))
  .filter(item => isRecordingMatchMeeting(item, meetingID))
  .sort((a, b) => {
    const aEnd = toTimestamp(a.endTime) || toTimestamp(a.publishedDate) || toTimestamp(a.startTime);
    const bEnd = toTimestamp(b.endTime) || toTimestamp(b.publishedDate) || toTimestamp(b.startTime);
    return bEnd - aEnd;
  })
  .map(buildReplayPayload);

const pickBestRecording = (recordings = [], meetingID = '') => {
  const published = recordings
    .filter(item => item && toBool(item.published))
    .filter(item => Boolean(getRecordingPlaybackUrl(item)));

  if (!published.length) return null;

  const matched = published.filter(item => isRecordingMatchMeeting(item, meetingID));
  const candidates = matched.length ? matched : (published.length === 1 ? published : []);
  if (!candidates.length) return null;

  return candidates.sort((a, b) => {
    const aEnd = toTimestamp(a.endTime) || toTimestamp(a.publishedDate) || toTimestamp(a.startTime);
    const bEnd = toTimestamp(b.endTime) || toTimestamp(b.publishedDate) || toTimestamp(b.startTime);
    return bEnd - aEnd;
  })[0];
};

const normalizeMeetingId = (room) => String(room?.zegoRoomId || room?.id || '').trim();
const normalizeLayout = (value) => {
  const validLayouts = new Set([
    'CUSTOM_LAYOUT',
    'SMART_LAYOUT',
    'PRESENTATION_FOCUS',
    'VIDEO_FOCUS',
    'CAMERAS_ONLY',
    'PARTICIPANTS_AND_CHAT_ONLY',
    'PRESENTATION_ONLY',
    'MEDIA_ONLY'
  ]);
  const layout = String(value || '').trim().toUpperCase();
  return validLayouts.has(layout) ? layout : 'SMART_LAYOUT';
};
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

const canManageReplay = (req) => {
  const role = String(req.user?.role || '').trim().toLowerCase();
  return role === 'superadmin' || role === 'admin';
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
  const published = pickBestRecording(recordings, meetingID);

  if (!published) {
    return null;
  }

  const replay = buildReplayPayload(published);
  if (!replay.url) return null;
  return replay;
};

const buildCreateMeetingParams = (room) => {
  const params = {
    meetingID: normalizeMeetingId(room),
    name: room.title || `直播间-${room.id}`,
    attendeePW: room.studentPassword || `attendee-${room.id}`,
    moderatorPW: room.anchorPassword || `moderator-${room.id}`,
    welcome: config.meeting.welcome,
    duration: config.meeting.defaultDuration,
    maxParticipants: config.meeting.maxParticipants,
    record: config.meeting.record,
    autoStartRecording: config.meeting.autoStartRecording,
    allowStartStopRecording: config.meeting.allowStartStopRecording,
    endWhenNoModerator: config.meeting.endWhenNoModerator
  };

  if (Number.isInteger(config.meeting.meetingExpireWhenLastUserLeftInMinutes)) {
    params.meetingExpireWhenLastUserLeftInMinutes = config.meeting.meetingExpireWhenLastUserLeftInMinutes;
  }

  if (Number.isInteger(config.meeting.endWhenNoModeratorDelayInMinutes)) {
    params.endWhenNoModeratorDelayInMinutes = config.meeting.endWhenNoModeratorDelayInMinutes;
  }

  return params;
};

const deleteReplayByMeeting = async (meetingID, targetRecordID = '') => {
  const payload = await callBbb('getRecordings', { meetingID });
  const recordings = listRecordings(payload.recordings);
  const normalizedTargetRecordID = String(targetRecordID || '').trim();

  const matched = recordings
    .filter(item => item?.recordID)
    .filter(item => isRecordingMatchMeeting(item, meetingID));

  const candidates = matched.length ? matched : (recordings.length === 1 ? recordings : []);
  const finalCandidates = normalizedTargetRecordID
    ? candidates.filter(item => String(item.recordID || '').trim() === normalizedTargetRecordID)
    : candidates;

  const recordIDs = candidates
    .map(item => String(item.recordID || '').trim())
    .filter(Boolean);

  const targetRecordIDs = finalCandidates
    .map(item => String(item.recordID || '').trim())
    .filter(Boolean);

  if (!targetRecordIDs.length) {
    return { deletedCount: 0, recordIDs: [] };
  }

  await callBbb('deleteRecordings', { recordID: targetRecordIDs.join(',') });
  return { deletedCount: targetRecordIDs.length, recordIDs: targetRecordIDs, allRecordIDs: recordIDs };
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

  if (!canJoinAsModerator(req, room)) return fail(res, '无权限创建会议', 403, 403);

  const payload = await callBbb('create', buildCreateMeetingParams(room));

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

  // create 接口是幂等的，入会前主动调用可避免 meetingForciblyEnded 导致无法进入。
  await callBbb('create', buildCreateMeetingParams(room));

  const fullName = req.user.nickname || req.user.username || '用户';
  const userId = req.user.studentId ? `student_${req.user.studentId}` : `user_${req.user.id}`;
  const preferredLayout = isStudentIdentity(req)
    ? 'SMART_LAYOUT'
    : normalizeLayout(config.join?.defaultLayout);

  const joinParams = {
    meetingID,
    fullName,
    password: joinAsModerator ? (room.anchorPassword || `moderator-${room.id}`) : (room.studentPassword || `attendee-${room.id}`),
    userID: userId,
    redirect: true
  };

  if (config.join?.useDefaultLayoutOnJoin) {
    joinParams['userdata-bbb_default_layout'] = preferredLayout;
  }

  if (config.join?.enforceLayout) {
    joinParams.enforceLayout = preferredLayout;
  }

  const joinUrl = buildJoinUrl(joinParams);

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

  if (!canJoinAsModerator(req, room)) return fail(res, '无权限结束会议', 403, 403);

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

router.get('/replay-room/:roomId/all', auth, asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const room = await LiveRoom.findByPk(roomId, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId', 'price'] }]
  });
  if (!room) return fail(res, '直播间不存在', 404, 404);
  if (!await ensureRoomAccess(req, res, room)) return;

  const meetingID = normalizeMeetingId(room);
  if (!meetingID) return fail(res, '缺少会议标识', 400, 400);

  const payload = await callBbb('getRecordings', { meetingID });
  const recordings = listRecordings(payload.recordings);
  const list = listSessionReplays(recordings, meetingID);
  if (!list.length) {
    return fail(res, '回放尚未生成', 404, 404);
  }

  const latest = list[0];
  await room.update({
    replayUrl: latest.url,
    replayDuration: latest.duration,
    replaySize: latest.size
  });

  return success(res, {
    roomId: room.id,
    meetingID,
    list
  }, '获取回放列表成功');
}));

router.delete('/replay-room/:roomId', auth, asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const targetRecordID = String(req.query.recordingID || '').trim();
  const room = await LiveRoom.findByPk(roomId, {
    include: [{ model: Course, as: 'course', attributes: ['id', 'institutionId', 'price'] }]
  });
  if (!room) return fail(res, '直播间不存在', 404, 404);
  if (!await ensureRoomAccess(req, res, room)) return;
  if (!canManageReplay(req)) return fail(res, '仅管理员可删除回放', 403, 403);

  const meetingID = normalizeMeetingId(room);
  if (!meetingID) return fail(res, '缺少会议标识', 400, 400);

  const deleted = await deleteReplayByMeeting(meetingID, targetRecordID);
  if (!deleted.deletedCount) {
    return fail(res, targetRecordID ? '未找到指定回放' : '未找到可删除的回放', 404, 404);
  }

  const payload = await callBbb('getRecordings', { meetingID });
  const recordings = listRecordings(payload.recordings);
  const latestList = listSessionReplays(recordings, meetingID);
  const latest = latestList[0] || null;

  await room.update({
    replayUrl: latest?.url || null,
    replayDuration: latest?.duration || null,
    replaySize: latest?.size || null
  });

  await writeOperationLog(req, {
    action: targetRecordID ? '删除单条回放' : '删除全部回放',
    path: `/api/bbb/replay-room/${room.id}`,
    payload: {
      roomId: room.id,
      meetingID,
      recordingID: targetRecordID || null,
      deletedCount: deleted.deletedCount,
      recordIDs: deleted.recordIDs,
      remainingCount: latestList.length
    },
    message: targetRecordID ? '单条回放已删除' : '回放已全部删除'
  });

  return success(res, {
    roomId: room.id,
    meetingID,
    deletedCount: deleted.deletedCount,
    recordIDs: deleted.recordIDs,
    remainingCount: latestList.length
  }, '回放删除成功');
}));

module.exports = router;
