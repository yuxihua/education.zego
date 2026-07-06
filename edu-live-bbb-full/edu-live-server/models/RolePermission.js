/**
 * 角色权限配置模型
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RolePermission = sequelize.define('RolePermission', {
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
  role: {
    type: DataTypes.STRING(30),
    allowNull: false,
    comment: '角色'
  },
  permissions: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    comment: '权限点集合'
  }
}, {
  tableName: 'role_permissions',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['institution_id', 'role'] }
  ]
});

module.exports = RolePermission;
