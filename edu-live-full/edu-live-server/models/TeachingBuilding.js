/**
 * 教学楼模型
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TeachingBuilding = sequelize.define('TeachingBuilding', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(120),
    allowNull: false,
    comment: '教学楼名称'
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '说明'
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
  tableName: 'teaching_buildings',
  timestamps: true,
  indexes: [
    {
      name: 'idx_building_institution_name',
      fields: ['institution_id', 'name']
    }
  ]
});

module.exports = TeachingBuilding;
