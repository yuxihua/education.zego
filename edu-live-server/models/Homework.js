/**
 * 作业模型
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Homework = sequelize.define('Homework', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  // 关联课程ID
  courseId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    comment: '课程ID'
  },
  // 学员ID
  studentId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    comment: '提交学员ID'
  },
  // 作业标题
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '作业标题'
  },
  // 作业内容
  content: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    comment: '作业内容/答案'
  },
  // 附件URL列表
  attachments: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '附件URL数组'
  },
  // 分数
  score: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: '得分（百分制）'
  },
  // 评语
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '教师评语'
  },
  // 状态
  status: {
    type: DataTypes.ENUM('submitted', 'graded', 'returned', 'pending'),
    defaultValue: 'pending',
    comment: '状态：已提交/已批改/已退回/待提交'
  },
  // 提交时间
  submitTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '学员提交时间'
  },
  // 批改时间
  gradeTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '教师批改时间'
  },
  // 截止日期
  deadline: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '作业截止日期'
  }
}, {
  tableName: 'homeworks',
  timestamps: true
});

module.exports = Homework;
