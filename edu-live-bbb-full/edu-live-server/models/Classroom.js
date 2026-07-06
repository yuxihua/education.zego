/**
 * 固定教室模型
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Classroom = sequelize.define('Classroom', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '教室名称'
  },
  location: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: '所在位置'
  },
  capacity: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    comment: '容纳人数'
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '教室说明'
  },
  institutionId: {
    type: DataTypes.BIGINT.UNSIGNED,
    defaultValue: 0,
    comment: '所属机构ID'
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '状态：0禁用 1启用'
  }
}, {
  tableName: 'classrooms',
  timestamps: true
});

module.exports = Classroom;