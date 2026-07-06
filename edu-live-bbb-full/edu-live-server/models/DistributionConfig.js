/**
 * 分销提成配置模型
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DistributionConfig = sequelize.define('DistributionConfig', {
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
  level: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    comment: '分销层级：1/2/3'
  },
  tierThreshold: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 30,
    comment: '月新增订单阈值（两档分界）'
  },
  rateTier1: {
    type: DataTypes.DECIMAL(5, 4),
    defaultValue: 0.05,
    comment: '第一档提成比例（0-1）'
  },
  rateTier2: {
    type: DataTypes.DECIMAL(5, 4),
    defaultValue: 0.08,
    comment: '第二档提成比例（0-1）'
  }
}, {
  tableName: 'distribution_configs',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['institution_id', 'level'] }
  ]
});

module.exports = DistributionConfig;
