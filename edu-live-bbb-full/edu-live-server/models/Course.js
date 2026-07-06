/**
 * 课程模型
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Course = sequelize.define('Course', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  // 课程标题
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '课程标题'
  },
  // 课程副标题
  subtitle: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '副标题/简介'
  },
  // 封面图
  cover: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '课程封面URL'
  },
  // 课程分类
  category: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '分类：math/english/programming/...'
  },
  // 价格（元）
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: '价格（元），0为免费'
  },
  // 原价
  originalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00,
    comment: '原价'
  },
  // 课时数
  lessonCount: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 1,
    comment: '课时数量'
  },
  // 课程时长（分钟）
  duration: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 60,
    comment: '单次课时长（分钟）'
  },
  // 讲师ID
  teacherId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    comment: '讲师用户ID'
  },
  // 讲师姓名
  teacherName: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '讲师姓名'
  },
  // 机构ID
  institutionId: {
    type: DataTypes.BIGINT.UNSIGNED,
    defaultValue: 0,
    comment: '所属机构ID'
  },
  // 学员数
  studentCount: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    comment: '报名学员数'
  },
  // 最大学员数
  maxStudents: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 500,
    comment: '最大学员数'
  },
  // 课程类型
  type: {
    type: DataTypes.ENUM('live', 'record', 'hybrid'),
    defaultValue: 'live',
    comment: '类型：直播/录播/混合'
  },
  // 课程状态
  status: {
    type: DataTypes.ENUM('draft', 'published', 'ongoing', 'finished', 'archived'),
    defaultValue: 'draft',
    comment: '状态：草稿/已发布/进行中/已结束/已归档'
  },
  // 课程详情
  detail: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    comment: '课程详情（富文本/HTML）'
  },
  // 课程大纲
  outline: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '课程大纲 JSON'
  },
  // 开始时间
  startTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '课程开始时间'
  },
  // 结束时间
  endTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '课程结束时间'
  },
  // 是否回放
  enableReplay: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否生成回放'
  },
  // 回放URL
  replayUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '回放视频URL'
  },
  // 回放时长（秒）
  replayDuration: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    comment: '回放时长（秒）'
  }
}, {
  tableName: 'courses',
  timestamps: true
});

module.exports = Course;
