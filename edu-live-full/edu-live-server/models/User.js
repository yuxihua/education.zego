/**
 * 用户模型（机构/管理员）
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  // 用户名
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '登录用户名'
  },
  // 密码
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '加密后的密码'
  },
  // 昵称
  nickname: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '显示昵称'
  },
  // 角色
  role: {
    type: DataTypes.ENUM('superadmin', 'admin', 'teacher', 'assistant', 'sales'),
    defaultValue: 'admin',
    comment: '角色：超管/机构管理员/讲师/助教/销售'
  },
  // 手机号
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '手机号'
  },
  // 邮箱
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '邮箱'
  },
  // 头像
  avatar: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '头像URL'
  },
  // 机构ID（超管为0）
  institutionId: {
    type: DataTypes.BIGINT.UNSIGNED,
    defaultValue: 0,
    comment: '所属机构ID'
  },
  // 机构名称
  institutionName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '机构名称'
  },
  // 状态
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '状态：0禁用 1启用'
  },
  // 最后登录时间
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最后登录时间'
  },
  // 最后登录IP
  lastLoginIp: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '最后登录IP'
  }
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    // 创建前加密密码
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
    // 更新前加密密码
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    }
  }
});

// 实例方法：验证密码
User.prototype.validatePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = User;
