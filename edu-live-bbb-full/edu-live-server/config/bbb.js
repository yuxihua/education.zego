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
    allowStartStopRecording: (process.env.BBB_ALLOW_START_STOP_RECORDING || 'true') === 'true'
  }
};
