/**
 * 学员路由
 */
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const axios = require('axios');
const crypto = require('crypto');
const { Student, Order, Course, Homework, User, LiveRoom } = require('../models');
const { success, fail } = require('../utils/response');
const { asyncHandler } = require('../middleware/error');
const { auth, generateToken, requireRole } = require('../middleware/auth');
const redis = require('../config/redis');
const { callBbb, listRecordings, toBool } = require('../utils/bbbApi');

const WX_WEB_APP_ID = process.env.WX_WEB_APP_ID || '';
const WX_WEB_APP_SECRET = process.env.WX_WEB_APP_SECRET || '';
const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');
const STUDENT_WX_CALLBACK_URL = process.env.STUDENT_WX_CALLBACK_URL || `${BASE_URL}/api/student/wx/callback`;

function getCurrentStudentId(req) {
  return req.user?.studentId || req.user?.id;
}

function isStudentIdentity(req) {
  const role = String(req.user?.role || '').trim();
  return !role || role === 'student' || role === 'parent';
}

function getOperatorInstitutionId(req) {
  return req.user?.institutionId || 0;
}

function getRecordingProgressKey(studentId, courseId, videoId) {
  return `student:recording:progress:${studentId}:${courseId}:${videoId}`;
}

function safeParseJson(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
}

function parsePublishedRecordedVideos(course) {
  const raw = course?.toJSON ? course.toJSON() : course;
  const outline = raw?.outline && typeof raw.outline === 'object' ? raw.outline : {};
  const recordedVideos = Array.isArray(outline.recordedVideos) ? outline.recordedVideos : [];
  return recordedVideos
    .map((video, index) => {
      const url = String(video?.url || '').trim();
      if (!url) return null;
      const status = String(video?.status || 'published').trim();
      if (status !== 'published') return null;
      return {
        videoId: String(video?.id || `${raw.id}-${index + 1}`),
        title: String(video?.title || '').trim() || `第${index + 1}节`,
        replayUrl: url,
        replayDuration: Math.max(0, Number(video?.duration || 0)),
        trialDuration: Math.max(0, Number(video?.trialDuration || 0)),
        videoCover: String(video?.cover || '').trim() || raw.cover || '',
        sourceType: 'manual-upload',
        sort: Number.isFinite(Number(video?.sort)) ? Number(video.sort) : index + 1,
        updatedAt: video?.updatedAt || raw.updatedAt || null
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function toTimestamp(value) {
  if (!value && value !== 0) return 0;
  const text = String(value).trim();
  if (!text) return 0;

  if (/^\d+$/.test(text)) {
    const numeric = Number(text);
    if (!Number.isFinite(numeric)) return 0;
    return numeric > 1e12 ? numeric : numeric * 1000;
  }

  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getMeetingCandidates(recording = {}) {
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
}

function isRecordingMatchMeeting(recording, meetingID) {
  const target = normalizeKey(meetingID);
  if (!target) return false;
  return getMeetingCandidates(recording).includes(target);
}

const PLAYBACK_TYPE_PRIORITY = ['presentation', 'video', 'screenshare', 'podcast'];

function getPreferredPlaybackFormat(recording) {
  const playback = recording?.playback?.format;
  const playbackItems = (Array.isArray(playback) ? playback : [playback]).filter((item) => item?.url);
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
}

function getRecordingPlaybackUrl(recording) {
  const format = getPreferredPlaybackFormat(recording);
  return format?.url || '';
}

function buildReplayPayload(recording = {}) {
  const format = getPreferredPlaybackFormat(recording);
  return {
    url: format?.url || '',
    recordingID: String(recording.recordID || '').trim(),
    size: Number(recording.size || 0),
    duration: Number(format?.length || recording.playback?.duration || 0),
    startTime: recording.startTime || null,
    endTime: recording.endTime || null,
    publishedAt: recording.publishedDate || null
  };
}

function listSessionReplays(recordings = [], meetingID = '') {
  return recordings
    .filter((item) => item && toBool(item.published))
    .filter((item) => Boolean(getRecordingPlaybackUrl(item)))
    .filter((item) => isRecordingMatchMeeting(item, meetingID))
    .sort((a, b) => {
      const aEnd = toTimestamp(a.endTime) || toTimestamp(a.publishedDate) || toTimestamp(a.startTime);
      const bEnd = toTimestamp(b.endTime) || toTimestamp(b.publishedDate) || toTimestamp(b.startTime);
      return bEnd - aEnd;
    })
    .map(buildReplayPayload);
}

function normalizeMeetingId(room) {
  return String(room?.zegoRoomId || room?.id || '').trim();
}

function padTimePart(value) {
  return String(value).padStart(2, '0');
}

function formatReplayTimeLabel(value) {
  const timestamp = toTimestamp(value);
  if (!timestamp) return '';

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  return `${date.getFullYear()}-${padTimePart(date.getMonth() + 1)}-${padTimePart(date.getDate())} ${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}`;
}

function buildLiveReplayRows(room, replayList = []) {
  const raw = room?.toJSON ? room.toJSON() : room;
  const normalizedList = Array.isArray(replayList) ? replayList.filter((item) => item?.url) : [];
  const fallbackList = normalizedList.length ? normalizedList : (raw?.replayUrl ? [{
    url: raw.replayUrl,
    recordingID: '',
    size: Number(raw.replaySize || 0),
    duration: Number(raw.replayDuration || 0),
    startTime: raw.actualStartTime || null,
    endTime: raw.endTime || null,
    publishedAt: raw.updatedAt || raw.createdAt || null
  }] : []);

  return fallbackList.map((item, index) => {
    const timeLabel = formatReplayTimeLabel(item.endTime || item.publishedAt || item.startTime || raw.endTime || raw.createdAt);
    const segmentSuffix = fallbackList.length > 1 ? ` · 第${index + 1}段回放` : ' · 直播回放';
    const recordingID = String(item.recordingID || '').trim();
    return {
      videoId: recordingID ? `live-room-${raw.id}-${recordingID}` : `live-room-${raw.id}-${index + 1}`,
      roomId: raw.id,
      roomTitle: `${raw.title || '直播回放'}${timeLabel ? ` · ${timeLabel}` : ''}${segmentSuffix}`,
      courseId: raw.courseId,
      courseTitle: raw.course?.title || '',
      courseCover: raw.course?.cover || '',
      videoCover: raw.course?.cover || '',
      teacherName: raw.course?.teacherName || '',
      replayUrl: item.url,
      replayDuration: Number(item.duration || 0),
      trialDuration: 0,
      replaySize: Number(item.size || 0),
      endTime: item.endTime || raw.endTime || null,
      createdAt: item.publishedAt || item.startTime || raw.createdAt || null,
      recordingID,
      sourceType: 'live-replay'
    };
  });
}

async function fetchLiveReplayRows(room) {
  const meetingID = normalizeMeetingId(room);
  if (!meetingID) return buildLiveReplayRows(room, []);

  try {
    const payload = await callBbb('getRecordings', { meetingID });
    const replayList = listSessionReplays(listRecordings(payload.recordings), meetingID);
    return buildLiveReplayRows(room, replayList);
  } catch (err) {
    return buildLiveReplayRows(room, []);
  }
}

/**
 * 生成微信扫码登录二维码
 */
router.get('/wx/qr/create', asyncHandler(async (req, res) => {
  const { institutionId } = req.query;
  if (!WX_WEB_APP_ID || !WX_WEB_APP_SECRET || !STUDENT_WX_CALLBACK_URL) {
    return fail(res, '微信扫码登录未配置，请联系管理员', 500, 500);
  }

  const state = crypto.randomBytes(16).toString('hex');
  const cacheKey = `student:wx:login:${state}`;

  await redis.setex(cacheKey, 300, JSON.stringify({
    status: 'pending',
    createdAt: Date.now(),
    institutionId: institutionId ? Number(institutionId) : 0
  }));

  const wxAuthUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${encodeURIComponent(WX_WEB_APP_ID)}&redirect_uri=${encodeURIComponent(STUDENT_WX_CALLBACK_URL)}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(wxAuthUrl)}`;

  success(res, {
    state,
    qrUrl,
    expireIn: 300
  });
}));

/**
 * 轮询微信扫码登录状态
 */
router.get('/wx/qr/status', asyncHandler(async (req, res) => {
  const { state } = req.query;
  if (!state) {
    return fail(res, '缺少 state 参数', 400, 400);
  }

  const cacheKey = `student:wx:login:${state}`;
  const raw = await redis.get(cacheKey);
  if (!raw) {
    return success(res, { status: 'expired' });
  }

  let payload = {};
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    return success(res, { status: 'pending' });
  }

  if (payload.status === 'success') {
    await redis.del(cacheKey);
  }

  success(res, payload);
}));

/**
 * 微信扫码登录回调
 */
router.get('/wx/callback', asyncHandler(async (req, res) => {
  const { code, state } = req.query;

  if (!state) {
    return res.status(400).send('缺少 state 参数');
  }

  const cacheKey = `student:wx:login:${state}`;
  const rawSession = await redis.get(cacheKey);
  if (!rawSession) {
    return res.status(400).send('二维码已过期，请重新获取');
  }

  let sessionData = {};
  try {
    sessionData = JSON.parse(rawSession);
  } catch (err) {
    sessionData = {};
  }

  if (!code) {
    await redis.setex(cacheKey, 300, JSON.stringify({ status: 'failed', message: '微信授权失败，缺少 code' }));
    return res.status(400).send('微信授权失败，请返回重试');
  }

  try {
    const tokenResp = await axios.get('https://api.weixin.qq.com/sns/oauth2/access_token', {
      params: {
        appid: WX_WEB_APP_ID,
        secret: WX_WEB_APP_SECRET,
        code,
        grant_type: 'authorization_code'
      }
    });

    const tokenData = tokenResp.data || {};
    if (tokenData.errcode) {
      await redis.setex(cacheKey, 300, JSON.stringify({ status: 'failed', message: tokenData.errmsg || '微信换取token失败' }));
      return res.status(500).send('微信登录失败，请返回重试');
    }

    const openid = tokenData.openid;
    const accessToken = tokenData.access_token;

    const userResp = await axios.get('https://api.weixin.qq.com/sns/userinfo', {
      params: {
        access_token: accessToken,
        openid,
        lang: 'zh_CN'
      }
    });

    const userInfo = userResp.data || {};
    if (userInfo.errcode) {
      await redis.setex(cacheKey, 300, JSON.stringify({ status: 'failed', message: userInfo.errmsg || '获取微信用户信息失败' }));
      return res.status(500).send('微信登录失败，请返回重试');
    }

    let student = await Student.findOne({ where: { openid } });
    if (!student && userInfo.unionid) {
      student = await Student.findOne({ where: { unionid: userInfo.unionid } });
    }

    if (!student) {
      student = await Student.create({
        openid,
        unionid: userInfo.unionid || null,
        nickname: userInfo.nickname || null,
        avatar: userInfo.headimgurl || null,
        institutionId: Number(sessionData.institutionId || 0),
        source: 'wechat-web',
        status: 1
      });
    } else {
      const patch = {
        openid,
        unionid: userInfo.unionid || student.unionid,
        nickname: userInfo.nickname || student.nickname,
        avatar: userInfo.headimgurl || student.avatar
      };
      if (!student.institutionId && sessionData.institutionId) {
        patch.institutionId = Number(sessionData.institutionId);
      }
      await student.update(patch);
    }

    const token = generateToken({
      id: student.id,
      studentId: student.id,
      role: 'student',
      nickname: student.nickname,
      phone: student.phone,
      institutionId: student.institutionId || 0
    });

    await redis.setex(cacheKey, 300, JSON.stringify({
      status: 'success',
      token,
      student: {
        id: student.id,
        nickname: student.nickname,
        phone: student.phone,
        avatar: student.avatar,
        openid: student.openid
      }
    }));

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send('<!doctype html><html><body style="font-family: sans-serif; padding: 24px;"><h3>登录成功</h3><p>请返回电脑端继续操作。</p></body></html>');
  } catch (err) {
    await redis.setex(cacheKey, 300, JSON.stringify({ status: 'failed', message: '微信登录异常，请重试' }));
    res.status(500).send('微信登录异常，请返回重试');
  }
}));

/**
 * 学员登录（手机号/账号名/微信标识）
 */
router.post('/login', asyncHandler(async (req, res) => {
  const {
    phone,
    loginAccount,
    password,
    nickname,
    openid,
    unionid,
    avatar,
    source = 'web',
    institutionId
  } = req.body;
  const normalizedPhone = String(phone || '').trim();
  const normalizedLoginAccount = String(loginAccount || '').trim();
  const account = normalizedPhone || normalizedLoginAccount;
  const institutionIdNum = institutionId ? Number(institutionId) : 0;

  if (!account && !openid) {
    return fail(res, '手机号或登录账号名或openid至少填写一个', 400, 400);
  }

  let student = null;

  if (account) {
    if (!password) {
      return fail(res, '请输入密码', 400, 400);
    }

    student = await Student.findOne({
      where: {
        [Op.or]: [
          { phone: account },
          { nickname: account }
        ]
      }
    });
    if (!student) {
      return fail(res, '学员账号不存在，请联系机构创建', 404, 404);
    }

    if (!student.password) {
      return fail(res, '该学员账号未设置密码，请联系机构管理员重置密码', 400, 400);
    }

    if (institutionIdNum && student.institutionId && student.institutionId !== institutionIdNum) {
      return fail(res, '该账号不属于当前机构', 403, 403);
    }

    const isValid = await student.validatePassword(password);
    if (!isValid) {
      return fail(res, '手机号/账号名或密码错误', 401, 401);
    }

    const patch = {};
    if (nickname) patch.nickname = nickname;
    if (avatar) patch.avatar = avatar;
    if (openid && !student.openid) patch.openid = openid;
    if (unionid && !student.unionid) patch.unionid = unionid;
    if (!student.institutionId && institutionIdNum) patch.institutionId = institutionIdNum;
    if (Object.keys(patch).length) await student.update(patch);
  } else {
    student = await Student.findOne({ where: { openid } });
    if (!student && unionid) {
      student = await Student.findOne({ where: { unionid } });
    }

    if (!student) {
      const randomSuffix = Date.now().toString().slice(-4);
      student = await Student.create({
        phone: null,
        openid: openid || null,
        unionid: unionid || null,
        nickname: nickname || `学员${randomSuffix}`,
        avatar: avatar || null,
        institutionId: institutionIdNum,
        source,
        status: 1
      });
    }
  }

  if (student.status === 0) {
    return fail(res, '账号已被禁用', 403, 403);
  }

  const token = generateToken({
    id: student.id,
    studentId: student.id,
    role: 'student',
    nickname: student.nickname,
    phone: student.phone,
    institutionId: student.institutionId || 0
  });

  success(res, {
    token,
    student: {
      id: student.id,
      nickname: student.nickname,
      phone: student.phone,
      avatar: student.avatar,
      openid: student.openid
    }
  }, '登录成功');
}));

/**
 * 学员个人信息
 */
router.get('/profile', auth, asyncHandler(async (req, res) => {
  if (!isStudentIdentity(req) && req.user.role !== 'superadmin') {
    return fail(res, '仅学员或家长可访问', 403, 403);
  }

  const studentId = getCurrentStudentId(req);
  const student = await Student.findByPk(studentId);
  if (!student) {
    return fail(res, '学员不存在', 404, 404);
  }

  const courseCount = await Order.count({ where: { studentId: student.id, status: 'paid' } });
  success(res, {
    ...student.toJSON(),
    courseCount
  });
}));

/**
 * 学员退出登录
 */
router.post('/logout', auth, asyncHandler(async (req, res) => {
  const ttl = req.user?.exp ? (req.user.exp - Math.floor(Date.now() / 1000)) : 0;
  if (ttl > 0 && req.token) {
    await redis.setex(`token:blacklist:${req.token}`, ttl, '1');
  }
  success(res, null, '退出成功');
}));

/**
 * 我的已购课程
 */
router.get('/my-courses', auth, asyncHandler(async (req, res) => {
  if (!isStudentIdentity(req) && req.user.role !== 'superadmin') {
    return fail(res, '仅学员或家长可访问', 403, 403);
  }

  const studentId = getCurrentStudentId(req);
  const { page = 1, size = 10 } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const pageSizeNum = parseInt(size, 10) || 10;

  const { count, rows } = await Order.findAndCountAll({
    where: { studentId, status: 'paid' },
    include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'cover', 'teacherName', 'price', 'status'] }],
    order: [['payTime', 'DESC']],
    offset: (pageNum - 1) * pageSizeNum,
    limit: pageSizeNum
  });

  const list = rows.map((item) => {
    const row = item.toJSON();
    return {
      orderId: row.id,
      orderNo: row.orderNo,
      payTime: row.payTime,
      amount: row.amount,
      course: row.course || null
    };
  });

  success(res, {
    list,
    total: count,
    page: pageNum,
    size: pageSizeNum
  });
}));

/**
 * 获取课程录播试听列表（含是否已购）
 */
router.get('/course/:courseId/recordings', auth, asyncHandler(async (req, res) => {
  if (!isStudentIdentity(req) && req.user.role !== 'superadmin') {
    return fail(res, '仅学员或家长可访问', 403, 403);
  }

  const studentId = getCurrentStudentId(req);
  const courseId = Number(req.params.courseId || 0);
  if (!courseId) {
    return fail(res, '无效的课程ID', 400, 400);
  }

  const course = await Course.findByPk(courseId, {
    attributes: ['id', 'title', 'cover', 'teacherName', 'price', 'status', 'enableReplay', 'outline', 'updatedAt']
  });
  if (!course) {
    return fail(res, '课程不存在', 404, 404);
  }
  if (String(course.status || '') !== 'published') {
    return fail(res, '课程未上架，暂不可试听', 400, 400);
  }
  if (course.enableReplay === false) {
    return fail(res, '该课程未开启录播', 400, 400);
  }

  const paidOrder = await Order.findOne({ where: { studentId, courseId, status: 'paid' }, attributes: ['id'] });
  const isPurchased = Boolean(paidOrder);

  const manualList = parsePublishedRecordedVideos(course).map((item) => ({
    ...item,
    courseId: course.id,
    courseTitle: course.title || '',
    courseCover: course.cover || '',
    teacherName: course.teacherName || '',
    isPurchased,
    trialDuration: isPurchased ? 0 : item.trialDuration
  }));

  const liveRooms = await LiveRoom.findAll({
    where: {
      courseId: course.id,
      endTime: { [Op.ne]: null }
    },
    include: [{
      model: Course,
      as: 'course',
      attributes: ['id', 'title', 'cover', 'teacherName'],
      required: true
    }],
    order: [['endTime', 'DESC'], ['createdAt', 'DESC']]
  });

  const liveReplayGroups = await Promise.all(liveRooms.map((room) => fetchLiveReplayRows(room)));
  const liveList = liveReplayGroups.flat().map((item) => ({
    ...item,
    isPurchased,
    trialDuration: isPurchased ? 0 : item.trialDuration
  }));

  const list = [...manualList, ...liveList]
    .sort((a, b) => new Date(b.endTime || b.createdAt || 0).getTime() - new Date(a.endTime || a.createdAt || 0).getTime());

  success(res, {
    courseId: course.id,
    isPurchased,
    list
  });
}));

/**
 * 我的录播课程（已购课程下有回放的场次）
 */
router.get('/my-recordings', auth, asyncHandler(async (req, res) => {
  if (!isStudentIdentity(req) && req.user.role !== 'superadmin') {
    return fail(res, '仅学员或家长可访问', 403, 403);
  }

  const studentId = getCurrentStudentId(req);
  const { page = 1, size = 20, courseId, keyword } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const pageSizeNum = parseInt(size, 10) || 20;

  const paidOrders = await Order.findAll({
    where: { studentId, status: 'paid' },
    attributes: ['courseId']
  });

  let courseIds = [...new Set(paidOrders.map((item) => Number(item.courseId || 0)).filter(Boolean))];

  if (courseId) {
    const targetCourseId = Number(courseId);
    if (!Number.isNaN(targetCourseId)) {
      courseIds = courseIds.filter((id) => id === targetCourseId);
    }
  }

  if (!courseIds.length) {
    return success(res, {
      list: [],
      total: 0,
      page: pageNum,
      size: pageSizeNum
    });
  }

  const where = {
    courseId: { [Op.in]: courseIds },
    endTime: { [Op.ne]: null }
  };

  const rows = await LiveRoom.findAll({
    where,
    include: [{
      model: Course,
      as: 'course',
      attributes: ['id', 'title', 'cover', 'teacherName'],
      where: { enableReplay: true },
      required: true
    }],
    order: [['endTime', 'DESC'], ['createdAt', 'DESC']]
  });

  const liveReplayGroups = await Promise.all(rows.map((room) => fetchLiveReplayRows(room)));
  const liveReplayList = liveReplayGroups
    .flat()
    .filter((item) => {
      if (!keyword) return true;
      const searchText = `${item.courseTitle || ''} ${item.roomTitle || ''}`;
      return searchText.includes(String(keyword));
    });

  const purchasedCourses = await Course.findAll({
    where: { id: { [Op.in]: courseIds }, enableReplay: true },
    attributes: ['id', 'title', 'cover', 'teacherName', 'outline', 'updatedAt']
  });

  const manualReplayList = purchasedCourses.flatMap((course) => {
    const raw = course.toJSON();
    const outline = raw.outline && typeof raw.outline === 'object' ? raw.outline : {};
    const recordedVideos = Array.isArray(outline.recordedVideos) ? outline.recordedVideos : [];
    return recordedVideos
      .map((video, index) => {
        const url = String(video?.url || '').trim();
        if (!url) return null;
        const title = String(video?.title || '').trim() || `第${index + 1}节`;
        const rowText = `${raw.title || ''} ${title}`;
        if (keyword && !rowText.includes(String(keyword))) return null;
        return {
          roomId: null,
          roomTitle: title,
          videoId: String(video?.id || `${raw.id}-${index + 1}`),
          courseId: raw.id,
          courseTitle: raw.title || '',
          courseCover: raw.cover || '',
          videoCover: String(video?.cover || '').trim() || raw.cover || '',
          teacherName: raw.teacherName || '',
          replayUrl: url,
          replayDuration: Math.max(0, Number(video?.duration || 0)),
          trialDuration: Math.max(0, Number(video?.trialDuration || 0)),
          replaySize: Math.max(0, Number(video?.size || 0)),
          endTime: video?.updatedAt || raw.updatedAt || null,
          createdAt: video?.updatedAt || raw.updatedAt || null,
          sourceType: 'manual-upload'
        };
      })
      .filter(Boolean);
  });

  const merged = [...manualReplayList, ...liveReplayList]
    .sort((a, b) => new Date(b.endTime || b.createdAt || 0).getTime() - new Date(a.endTime || a.createdAt || 0).getTime());

  const total = merged.length;
  const start = (pageNum - 1) * pageSizeNum;
  const list = merged.slice(start, start + pageSizeNum);

  const listWithProgress = await Promise.all(list.map(async (item) => {
    const progressKey = getRecordingProgressKey(studentId, item.courseId, item.videoId);
    const rawProgress = await redis.get(progressKey);
    const progress = safeParseJson(rawProgress, null);
    return {
      ...item,
      progressSeconds: Math.max(0, Number(progress?.progressSeconds || 0)),
      progressPercent: Math.max(0, Number(progress?.progressPercent || 0)),
      lastLearnAt: progress?.updatedAt || null
    };
  }));

  success(res, {
    list: listWithProgress,
    total,
    page: pageNum,
    size: pageSizeNum
  });
}));

/**
 * 获取单个录播学习进度
 */
router.get('/recording-progress', auth, asyncHandler(async (req, res) => {
  if (!isStudentIdentity(req) && req.user.role !== 'superadmin') {
    return fail(res, '仅学员或家长可访问', 403, 403);
  }

  const studentId = getCurrentStudentId(req);
  const courseId = Number(req.query.courseId || 0);
  const videoId = String(req.query.videoId || '').trim();
  if (!courseId || !videoId) {
    return fail(res, '缺少 courseId 或 videoId', 400, 400);
  }

  const key = getRecordingProgressKey(studentId, courseId, videoId);
  const raw = await redis.get(key);
  const progress = safeParseJson(raw, {});
  success(res, {
    courseId,
    videoId,
    progressSeconds: Math.max(0, Number(progress?.progressSeconds || 0)),
    durationSeconds: Math.max(0, Number(progress?.durationSeconds || 0)),
    progressPercent: Math.max(0, Number(progress?.progressPercent || 0)),
    updatedAt: progress?.updatedAt || null
  });
}));

/**
 * 保存录播学习进度
 */
router.post('/recording-progress', auth, asyncHandler(async (req, res) => {
  if (!isStudentIdentity(req) && req.user.role !== 'superadmin') {
    return fail(res, '仅学员或家长可访问', 403, 403);
  }

  const studentId = getCurrentStudentId(req);
  const courseId = Number(req.body?.courseId || 0);
  const videoId = String(req.body?.videoId || '').trim();
  const progressSeconds = Math.max(0, Number(req.body?.progressSeconds || 0));
  const durationSeconds = Math.max(0, Number(req.body?.durationSeconds || 0));
  if (!courseId || !videoId) {
    return fail(res, '缺少 courseId 或 videoId', 400, 400);
  }

  const progressPercent = durationSeconds > 0
    ? Math.min(100, Math.round((progressSeconds / durationSeconds) * 100))
    : 0;

  const payload = {
    courseId,
    videoId,
    progressSeconds,
    durationSeconds,
    progressPercent,
    updatedAt: new Date().toISOString()
  };

  const key = getRecordingProgressKey(studentId, courseId, videoId);
  await redis.setex(key, 3600 * 24 * 365, JSON.stringify(payload));

  success(res, payload, '学习进度已保存');
}));

/**
 * 后台新增学员（支持创建时绑定销售层级）
 */
router.post('/create', auth, requireRole(['superadmin', 'admin', 'assistant']), asyncHandler(async (req, res) => {
  const {
    nickname,
    realName,
    phone,
    password,
    email,
    region,
    source = 'admin',
    institutionId,
    salesUserId,
    salesLevel
  } = req.body;

  if (!phone) {
    return fail(res, '学员手机号必填（用于密码登录）', 400, 400);
  }

  if (!password || String(password).trim().length < 6) {
    return fail(res, '学员登录密码至少6位', 400, 400);
  }

  if (phone) {
    const phoneExist = await Student.findOne({ where: { phone } });
    if (phoneExist) {
      return fail(res, '手机号已存在', 409, 409);
    }
  }

  let institutionIdNum = req.user.role === 'superadmin'
    ? Number(institutionId || 0)
    : getOperatorInstitutionId(req);

  let salesUserIdNum = salesUserId ? Number(salesUserId) : null;
  let salesLevelNum = salesLevel ? Number(salesLevel) : null;

  if (salesUserIdNum || salesLevelNum) {
    if (!salesUserIdNum || !salesLevelNum) {
      return fail(res, '设置分销时 salesUserId 与 salesLevel 需同时填写', 400, 400);
    }

    if (![1, 2, 3].includes(salesLevelNum)) {
      return fail(res, 'salesLevel 仅支持 1/2/3', 400, 400);
    }

    const sales = await User.findOne({
      where: {
        id: salesUserIdNum,
        role: 'sales',
        status: 1
      }
    });

    if (!sales) {
      return fail(res, '销售人员不存在', 404, 404);
    }

    if (req.user.role !== 'superadmin' && sales.institutionId !== institutionIdNum) {
      return fail(res, '销售人员不属于当前机构', 400, 400);
    }

    if (!institutionIdNum) {
      institutionIdNum = sales.institutionId || 0;
    }
  }

  const student = await Student.create({
    nickname: nickname || realName || '新学员',
    realName: realName || null,
    phone: phone || null,
    password: String(password).trim(),
    email: email || null,
    region: region || null,
    source,
    status: 1,
    institutionId: institutionIdNum,
    salesUserId: salesUserIdNum,
    salesLevel: salesLevelNum
  });

  success(res, student, '学员创建成功');
}));

/**
 * 后台修改学员信息
 */
router.post('/update', auth, requireRole(['superadmin', 'admin', 'assistant']), asyncHandler(async (req, res) => {
  const {
    id,
    nickname,
    realName,
    phone,
    password,
    email,
    region,
    avatar,
    remark,
    status,
    salesUserId,
    salesLevel
  } = req.body;

  if (!id) {
    return fail(res, '缺少学员ID', 400, 400);
  }

  const student = await Student.findByPk(id);
  if (!student) {
    return fail(res, '学员不存在', 404, 404);
  }

  if (req.user.role !== 'superadmin' && student.institutionId !== getOperatorInstitutionId(req)) {
    return fail(res, '无权修改该学员', 403, 403);
  }

  const updateData = {};

  if (nickname !== undefined) updateData.nickname = nickname || null;
  if (realName !== undefined) updateData.realName = realName || null;
  if (email !== undefined) updateData.email = email || null;
  if (region !== undefined) updateData.region = region || null;
  if (avatar !== undefined) updateData.avatar = avatar || null;
  if (remark !== undefined) updateData.remark = remark || null;

  if (status !== undefined) {
    const statusNum = Number(status);
    if (![0, 1].includes(statusNum)) {
      return fail(res, '状态仅支持 0/1', 400, 400);
    }
    updateData.status = statusNum;
  }

  if (phone !== undefined) {
    const nextPhone = String(phone || '').trim();
    if (nextPhone) {
      const phoneExist = await Student.findOne({
        where: {
          phone: nextPhone,
          id: { [Op.ne]: student.id }
        }
      });
      if (phoneExist) {
        return fail(res, '手机号已存在', 409, 409);
      }
      updateData.phone = nextPhone;
    } else {
      updateData.phone = null;
    }
  }

  if (password !== undefined && password !== null && String(password).trim() !== '') {
    if (String(password).trim().length < 6) {
      return fail(res, '学员登录密码至少6位', 400, 400);
    }
    updateData.password = String(password).trim();
  }

  const salesUserIdProvided = salesUserId !== undefined && salesUserId !== null && salesUserId !== '';
  const salesLevelProvided = salesLevel !== undefined && salesLevel !== null && salesLevel !== '';

  if (salesUserIdProvided || salesLevelProvided) {
    if (!salesUserIdProvided || !salesLevelProvided) {
      return fail(res, '设置分销时 salesUserId 与 salesLevel 需同时填写', 400, 400);
    }

    const salesUserIdNum = Number(salesUserId);
    const salesLevelNum = Number(salesLevel);
    if (![1, 2, 3].includes(salesLevelNum)) {
      return fail(res, 'salesLevel 仅支持 1/2/3', 400, 400);
    }

    const sales = await User.findOne({
      where: {
        id: salesUserIdNum,
        role: 'sales',
        status: 1
      }
    });

    if (!sales) {
      return fail(res, '销售人员不存在', 404, 404);
    }

    if (req.user.role !== 'superadmin' && sales.institutionId !== student.institutionId) {
      return fail(res, '销售人员不属于当前机构', 400, 400);
    }

    updateData.salesUserId = salesUserIdNum;
    updateData.salesLevel = salesLevelNum;
  } else if (salesUserId !== undefined || salesLevel !== undefined) {
    updateData.salesUserId = null;
    updateData.salesLevel = null;
  }

  await student.update(updateData);
  success(res, student, '学员更新成功');
}));

router.get('/list', auth, requireRole(['superadmin', 'admin', 'assistant', 'teacher']), asyncHandler(async (req, res) => {
  const { phone, nickname, institutionId, page = 1, size = 10 } = req.query;

  const where = {};
  if (req.user.role !== 'superadmin') {
    where.institutionId = getOperatorInstitutionId(req);
  } else if (institutionId !== undefined && institutionId !== '') {
    const institutionIdNum = Number(institutionId);
    if (!Number.isNaN(institutionIdNum)) {
      where.institutionId = institutionIdNum;
    }
  }
  if (phone) where.phone = { [Op.like]: `%${phone}%` };
  if (nickname) where.nickname = { [Op.like]: `%${nickname}%` };

  const { count, rows } = await Student.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    offset: (page - 1) * size,
    limit: parseInt(size)
  });

  const list = await Promise.all(rows.map(async (student) => {
    const courseCount = await Order.count({ where: { studentId: student.id, status: 'paid' } });
    return {
      ...student.toJSON(),
      courseCount,
      studyDuration: 0,
      lastStudyTime: null,
      createTime: student.createdAt
    };
  }));

  success(res, {
    list,
    total: count,
    page: parseInt(page),
    size: parseInt(size)
  });
}));

router.get('/detail', auth, requireRole(['superadmin', 'admin', 'assistant', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.query;
  const student = await Student.findByPk(id);

  if (!student) {
    return fail(res, '学员不存在', 404, 404);
  }

  if (req.user.role !== 'superadmin' && student.institutionId !== getOperatorInstitutionId(req)) {
    return fail(res, '无权查看该学员', 403, 403);
  }

  const courseCount = await Order.count({ where: { studentId: student.id, status: 'paid' } });
  success(res, {
    ...student.toJSON(),
    courseCount,
    studyDuration: 0,
    lastStudyTime: null,
    createTime: student.createdAt
  });
}));

router.get('/learning-record', auth, requireRole(['superadmin', 'admin', 'assistant', 'teacher']), asyncHandler(async (req, res) => {
  const { id } = req.query;
  const student = await Student.findByPk(id);

  if (!student) {
    return fail(res, '学员不存在', 404, 404);
  }

  if (req.user.role !== 'superadmin' && student.institutionId !== getOperatorInstitutionId(req)) {
    return fail(res, '无权查看该学员学习记录', 403, 403);
  }

  const orders = await Order.findAll({
    where: {
      studentId: id,
      status: { [Op.in]: ['paid', 'refunding', 'refunded'] }
    },
    include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'cover'] }],
    order: [['createdAt', 'DESC']]
  });

  const courseIds = orders.map((order) => order.courseId).filter(Boolean);
  const homeworkRows = courseIds.length
    ? await Homework.findAll({
        where: {
          studentId: id,
          courseId: { [Op.in]: courseIds }
        },
        attributes: ['courseId', 'status', 'submitTime', 'gradeTime']
      })
    : [];

  const homeworkByCourse = {};
  let totalHomeworkSubmitted = 0;
  let totalHomeworkGraded = 0;
  let lastHomeworkTime = null;

  homeworkRows.forEach((item) => {
    const key = String(item.courseId);
    if (!homeworkByCourse[key]) {
      homeworkByCourse[key] = {
        submittedCount: 0,
        gradedCount: 0,
        lastLearningTime: null
      };
    }

    if (['submitted', 'graded', 'returned'].includes(item.status)) {
      homeworkByCourse[key].submittedCount += 1;
      totalHomeworkSubmitted += 1;
    }

    if (item.status === 'graded') {
      homeworkByCourse[key].gradedCount += 1;
      totalHomeworkGraded += 1;
    }

    const candidateTime = item.gradeTime || item.submitTime;
    if (candidateTime) {
      const current = homeworkByCourse[key].lastLearningTime;
      if (!current || new Date(candidateTime) > new Date(current)) {
        homeworkByCourse[key].lastLearningTime = candidateTime;
      }
      if (!lastHomeworkTime || new Date(candidateTime) > new Date(lastHomeworkTime)) {
        lastHomeworkTime = candidateTime;
      }
    }
  });

  const list = orders.map((order) => {
    const row = order.toJSON();
    const stats = homeworkByCourse[String(order.courseId)] || {
      submittedCount: 0,
      gradedCount: 0,
      lastLearningTime: null
    };
    return {
      ...row,
      courseName: row.course?.title || '-',
      paidAt: row.payTime || row.createdAt,
      homeworkSubmitted: stats.submittedCount,
      homeworkGraded: stats.gradedCount,
      lastLearningTime: stats.lastLearningTime || row.payTime || row.createdAt
    };
  });

  const totalAmount = list.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const latestOrderTime = list.length ? list[0].payTime || list[0].createdAt : null;
  const lastStudyTime = [latestOrderTime, lastHomeworkTime]
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0] || null;

  success(res, {
    summary: {
      paidCourseCount: list.length,
      totalAmount,
      homeworkSubmitted: totalHomeworkSubmitted,
      homeworkGraded: totalHomeworkGraded,
      lastStudyTime
    },
    list
  });
}));

module.exports = router;