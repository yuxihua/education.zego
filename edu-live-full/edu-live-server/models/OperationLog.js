/**
 * 系统操作日志模型
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OperationLog = sequelize.define('OperationLog', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  institutionId: {
    type: DataTypes.BIGINT.UNSIGNED,
    defaultValue: 0,
    comment: '机构ID'
  },
  userId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    comment: '操作人ID'
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '操作人账号'
  },
  role: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '操作人角色'
  },
  method: {
    type: DataTypes.STRING(10),
    allowNull: false,
    comment: 'HTTP方法'
  },
  path: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '请求路径'
  },
  ip: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: '请求IP'
  },
  userAgent: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '用户代理'
  },
  requestBody: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '请求参数（脱敏）'
  },
  statusCode: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    comment: '响应状态码'
  },
  success: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否成功'
  },
  message: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '响应消息'
  }
}, {
  tableName: 'operation_logs',
  timestamps: true,
  indexes: [
    { fields: ['institution_id'] },
    { fields: ['user_id'] },
    { fields: ['path'] },
    { fields: ['method'] },
    { fields: ['created_at'] }
  ]
});

module.exports = OperationLog;
