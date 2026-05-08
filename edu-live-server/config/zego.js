/**
 * ZEGO 即构直播配置
 * @see https://doc-zh.zego.im/
 */
module.exports = {
  appId: parseInt(process.env.ZEGO_APP_ID) || 0,
  serverSecret: process.env.ZEGO_SERVER_SECRET || '',

  // 直播配置
  live: {
    // 房间最大人数
    maxMembers: 500,
    // 推流分辨率
    resolution: '1280x720',
    // 视频码率 (kbps)
    videoBitrate: 1500,
    // 音频码率 (kbps)
    audioBitrate: 128,
    // 录制配置
    record: {
      enable: true,
      // 录制格式：mp4 / flv / aac
      format: 'mp4',
      // 录制存储时长（天）
      storageDays: 30
    }
  },

  // CDN 配置
  cdn: {
    enable: true,
    // CDN 加速域名
    domain: process.env.BASE_URL || ''
  },

  // 回调配置（在 ZEGO 控制台设置）
  callback: {
    // 录制完成回调地址
    recordUrl: `${process.env.BASE_URL || ''}/api/zego/callback`,
    // 鉴权密钥（用于验证回调请求）
    secret: process.env.ZEGO_SERVER_SECRET || ''
  },

  // OSS 配置（用于录制文件转存）
  oss: {
    region: process.env.OSS_REGION || 'oss-cn-hangzhou',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
    bucket: process.env.OSS_BUCKET || 'edu-live-bucket',
    // 录制文件存储路径前缀
    recordPrefix: 'records/'
  }
};
