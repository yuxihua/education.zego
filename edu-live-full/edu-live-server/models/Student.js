/**
 * 学生模型（学员）
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Student = sequelize.define('Student', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  // 微信 OpenID
  openid: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '微信openid'
  },
  // 微信 UnionID
  unionid: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '微信unionid'
  },
  // 昵称
  nickname: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '微信昵称'
  },
  // 头像
  avatar: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '微信头像'
  },
  // 真实姓名
  realName: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '真实姓名'
  },
  // 手机号
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true,
    comment: '手机号'
  },
  // 邮箱
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '邮箱'
  },
  // 性别
  gender: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    comment: '性别：0未知 1男 2女'
  },
  // 年龄
  age: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: true,
    comment: '年龄'
  },
  // 所在地区
  region: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '所在地区'
  },
  // 机构ID
  institutionId: {
    type: DataTypes.BIGINT.UNSIGNED,
    defaultValue: 0,
    comment: '所属机构ID'
  },
  // 所属销售
  salesUserId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    comment: '所属销售人员ID'
  },
  // 销售层级
  salesLevel: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: true,
    comment: '销售层级：1/2/3'
  },
  // 来源
  source: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '注册来源：wechat/app/web'
  },
  // 状态
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '状态：0禁用 1正常'
  },
  // 备注
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  tableName: 'students',
  timestamps: true
});

module.exports = Student;
