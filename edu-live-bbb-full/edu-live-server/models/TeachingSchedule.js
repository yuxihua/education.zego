/**
 * 教室/讲师排课模型
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TeachingSchedule = sequelize.define('TeachingSchedule', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  institutionId: {
    type: DataTypes.BIGINT.UNSIGNED,
    defaultValue: 0,
    comment: '所属机构ID'
  },
  classroomId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    comment: '教室ID'
  },
  teacherId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    comment: '讲师ID'
  },
  courseName: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '排课课程名称'
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '开始时间'
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '结束时间'
  },
  remarks: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '备注'
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '状态：0取消 1启用'
  }
}, {
  tableName: 'teaching_schedules',
  timestamps: true
});

module.exports = TeachingSchedule;