/**
 * BigBlueButton 配置
 * @see https://docs.bigbluebutton.org/development/api/
 */
module.exports = {
  endpoint: process.env.BBB_API_BASE_URL || '',
  secret: process.env.BBB_SHARED_SECRET || '',

  meeting: {
    welcome: process.env.BBB_WELCOME || '欢迎进入直播课堂',
    defaultDuration: parseInt(process.env.BBB_DEFAULT_DURATION || '120', 10),
    maxParticipants: parseInt(process.env.BBB_MAX_PARTICIPANTS || '500', 10),
    record: (process.env.BBB_RECORD || 'true') === 'true',
    autoStartRecording: (process.env.BBB_AUTO_START_RECORDING || 'true') === 'true',
    allowStartStopRecording: (process.env.BBB_ALLOW_START_STOP_RECORDING || 'true') === 'true',
    // 无人后自动结束延迟（分钟），留空使用 BBB 服务端默认值。
    meetingExpireWhenLastUserLeftInMinutes: process.env.BBB_MEETING_EXPIRE_WHEN_LAST_USER_LEFT_IN_MINUTES
      ? parseInt(process.env.BBB_MEETING_EXPIRE_WHEN_LAST_USER_LEFT_IN_MINUTES, 10)
      : null,
    // 是否在无主持人时结束会议。
    endWhenNoModerator: (process.env.BBB_END_WHEN_NO_MODERATOR || 'false') === 'true',
    // 无主持人自动结束延迟（分钟），留空使用 BBB 服务端默认值。
    endWhenNoModeratorDelayInMinutes: process.env.BBB_END_WHEN_NO_MODERATOR_DELAY_IN_MINUTES
      ? parseInt(process.env.BBB_END_WHEN_NO_MODERATOR_DELAY_IN_MINUTES, 10)
      : null
  },

  join: {
    defaultLayout: process.env.BBB_DEFAULT_LAYOUT || 'VIDEO_FOCUS',
    enforceLayout: (process.env.BBB_ENFORCE_LAYOUT || 'false') === 'true',
    useDefaultLayoutOnJoin: (process.env.BBB_USE_DEFAULT_LAYOUT_ON_JOIN || 'true') === 'true'
  }
};
