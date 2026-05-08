/**
 * 直播间模型
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LiveRoom = sequelize.define('LiveRoom', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  // 关联课程ID
  courseId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    comment: '所属课程ID'
  },
  // ZEGO 房间ID
  zegoRoomId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
    comment: 'ZEGO房间ID'
  },
  // 房间标题
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '直播间标题'
  },
  // 房间状态
  status: {
    type: DataTypes.ENUM('waiting', 'living', 'paused', 'finished', 'closed'),
    defaultValue: 'waiting',
    comment: '状态：等待中/直播中/暂停/已结束/已关闭'
  },
  // 主播ID（讲师）
  anchorId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    comment: '主播（讲师）用户ID'
  },
  // 主播名
  anchorName: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '主播姓名'
  },
  // 在线人数
  onlineCount: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    comment: '当前在线人数'
  },
  // 峰值人数
  peakCount: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    comment: '历史峰值人数'
  },
  // 总观看人次
  totalViewCount: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    comment: '累计观看人次'
  },
  // 推流地址
  pushUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '推流地址（OBS用）'
  },
  // 拉流地址
  pullUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '拉流地址（播放用）'
  },
  // HLS 播放地址
  hlsUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'HLS播放地址'
  },
  // 回放地址
  replayUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '回放视频地址'
  },
  // 回放时长（秒）
  replayDuration: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    comment: '回放时长（秒）'
  },
  // 回放文件大小（字节）
  replaySize: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    comment: '回放文件大小（字节）'
  },
  // 录制文件URL（ZEGO返回）
  recordFileUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'ZEGO录制文件临时URL'
  },
  // 实际开播时间
  actualStartTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '实际开播时间'
  },
  // 结束时间
  endTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '直播结束时间'
  },
  // 聊天是否开启
  chatEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否开启聊天'
  },
  // 是否禁言全体
  allMuted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否全员禁言'
  },
  // 房间密码
  password: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '房间密码（空为公开）'
  },
  // 房间配置
  settings: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '房间配置JSON'
  }
}, {
  tableName: 'live_rooms',
  timestamps: true
});

module.exports = LiveRoom;
