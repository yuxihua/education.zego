/**
 * 分销月度结算锁定快照
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DistributionSettlement = sequelize.define('DistributionSettlement', {
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
  monthKey: {
    type: DataTypes.STRING(7),
    allowNull: false,
    comment: '结算月份，格式 YYYY-MM'
  },
  isLocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否锁定'
  },
  lockByUserId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    comment: '锁定操作人ID'
  },
  lockAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '锁定时间'
  },
  snapshotData: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '锁定时的明细快照'
  },
  summaryData: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '锁定时的汇总快照'
  }
}, {
  tableName: 'distribution_settlements',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['institution_id', 'month_key'] }
  ]
});

module.exports = DistributionSettlement;
