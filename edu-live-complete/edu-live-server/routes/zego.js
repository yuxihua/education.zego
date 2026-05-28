/**
 * ZEGO 即构直播回调路由
 * 处理：录制完成、流状态变化、房间事件
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { LiveRoom, PPTFile } = require('../models');
const { success, fail } = require('../utils/response');
const { asyncHandler } = require('../middleware/error');
const { auth } = require('../middleware/auth');
const OSS = require('ali-oss');
const config = require('../config/zego');

// OSS 客户端（用于录制文件转存）
const ossClient = new OSS({
  region: config.oss.region,
  accessKeyId: config.oss.accessKeyId,
  accessKeySecret: config.oss.accessKeySecret,
  bucket: config.oss.bucket
});

// ========== ZEGO 服务器回调入口 ==========

/**
 * @POST /api/zego/callback
 * ZEGO 服务器回调（在 ZEGO 控制台配置此地址）
 * 
 * 支持的事件类型：
 * - RecordFinish: 录制完成
 * - StreamStatus: 流状态变化
 * - RoomClose: 房间关闭
 */
router.post('/callback', asyncHandler(async (req, res) => {
  // ZEGO 要求立即返回 200
  res.status(200).send('OK');

  try {
    const { EventType, Payload } = req.body;

    console.log(`[ZEGO回调] 事件类型: ${EventType}`, JSON.stringify(Payload, null, 2));

    switch (EventType) {
      case 'RecordFinish':
        await handleRecordFinish(Payload);
        break;
      case 'StreamStatus':
        await handleStreamStatus(Payload);
        break;
      case 'RoomClose':
        await handleRoomClose(Payload);
        break;
      default:
        console.log(`[ZEGO回调] 未知事件类型: ${EventType}`);
    }
  } catch (err) {
    console.error('[ZEGO回调] 处理失败:', err.message);
  }
}));

// ========== 录制完成处理 ==========

/**
 * 处理录制完成事件
 * @param {object} payload
 */
async function handleRecordFinish(payload) {
  const { RoomId, FileList, BeginTime, EndTime } = payload;

  // 根据 zegoRoomId 找到对应直播间
  const room = await LiveRoom.findOne({
    where: { zegoRoomId: RoomId }
  });

  if (!room) {
    console.error(`[ZEGO录制] 未找到对应直播间: ${RoomId}`);
    return;
  }

  // 查找 MP4 视频文件
  const videoFile = FileList?.find(f => f.FileName?.endsWith('.mp4'));
  if (!videoFile) {
    console.error(`[ZEGO录制] 未找到MP4文件: ${RoomId}`);
    return;
  }

  console.log(`[ZEGO录制完成] 房间:${RoomId} 文件:${videoFile.FileUrl} 大小:${videoFile.FileSize}`);

  try {
    // 下载视频并转存到 OSS（ZEGO 文件有有效期，必须转存）
    const response = await axios.get(videoFile.FileUrl, {
      responseType: 'stream',
      timeout: 10 * 60 * 1000 // 10分钟超时
    });

    // 生成 OSS 路径
    const date = new Date();
    const ossPath = `${config.oss.recordPrefix}${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}/${RoomId}_${Date.now()}.mp4`;

    // 上传到 OSS
    await ossClient.putStream(ossPath, response.data);
    const ossUrl = `https://${config.oss.bucket}.${config.oss.region}.aliyuncs.com/${ossPath}`;

    // 计算录制时长（秒）
    const beginTimestamp = new Date(BeginTime).getTime();
    const endTimestamp = new Date(EndTime).getTime();
    const duration = Math.floor((endTimestamp - beginTimestamp) / 1000);

    // 更新直播间回放信息
    await room.update({
      status: 'finished',
      replayUrl: ossUrl,
      replayDuration: duration,
      replaySize: videoFile.FileSize || 0,
      recordFileUrl: videoFile.FileUrl,
      endTime: new Date()
    });

    console.log(`[ZEGO录制] 回放已生成: ${ossUrl} 时长:${duration}秒`);

    // TODO: 通知所有学员回放已生成（可接入推送服务）
    // await notifyReplayReady(room.courseId, ossUrl);

  } catch (err) {
    console.error(`[ZEGO录制] 文件转存失败: ${err.message}`);
    // 记录失败，后续可通过定时任务重试
    await room.update({
      status: 'finished',
      recordFileUrl: videoFile.FileUrl,
      endTime: new Date()
    });
  }
}

// ========== 流状态变化 ==========

/**
 * 处理流状态变化
 * @param {object} payload
 */
async function handleStreamStatus(payload) {
  const { RoomId, StreamId, Status, UserId } = payload;

  console.log(`[ZEGO流状态] 房间:${RoomId} 流:${StreamId} 状态:${Status} 用户:${UserId}`);

  // 流开始推流
  if (Status === 'Start') {
    await LiveRoom.update(
      { 
        status: 'living',
        actualStartTime: new Date()
      },
      { where: { zegoRoomId: RoomId } }
    );
  }

  // 流停止
  if (Status === 'Stop') {
    // 可在此做一些清理工作
    console.log(`[ZEGO流停止] 房间:${RoomId}`);
  }
}

// ========== 房间关闭 ==========

/**
 * 处理房间关闭事件
 * @param {object} payload
 */
async function handleRoomClose(payload) {
  const { RoomId, Reason } = payload;

  console.log(`[ZEGO房间关闭] 房间:${RoomId} 原因:${Reason}`);

  await LiveRoom.update(
    { status: 'closed' },
    { where: { zegoRoomId: RoomId } }
  );
}

// ========== 主动查询接口 ==========

/**
 * @GET /api/zego/replay/:roomId
 * 获取回放信息
 */
router.get('/replay/:roomId', asyncHandler(async (req, res) => {
  const { roomId } = req.params;

  const room = await LiveRoom.findOne({
    where: { zegoRoomId: roomId },
    attributes: ['id', 'zegoRoomId', 'title', 'replayUrl', 'replayDuration', 'replaySize', 'status']
  });

  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }

  if (!room.replayUrl) {
    return fail(res, '回放尚未生成', 404, 404);
  }

  success(res, {
    url: room.replayUrl,
    duration: room.replayDuration,
    size: room.replaySize,
    status: room.status
  });
}));

/**
 * @POST /api/zego/webhook/test
 * 测试回调接口（调试用）
 */
router.post('/webhook/test', asyncHandler(async (req, res) => {
  const { EventType, Payload } = req.body;
  
  console.log('[ZEGO测试回调]', { EventType, Payload });
  
  // 模拟处理
  if (EventType === 'RecordFinish') {
    await handleRecordFinish(Payload);
  }

  success(res, null, '测试回调已处理');
}));

module.exports = router;
