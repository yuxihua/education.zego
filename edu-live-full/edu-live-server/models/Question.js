/**
 * 题库模型
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Question = sequelize.define('Question', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  type: {
    type: DataTypes.ENUM('single', 'multiple', 'judge', 'essay'),
    allowNull: false,
    defaultValue: 'single',
    comment: '题型'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '题目内容'
  },
  options: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '选项JSON'
  },
  answer: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '答案'
  },
  analysis: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '解析'
  },
  difficulty: {
    type: DataTypes.TINYINT.UNSIGNED,
    defaultValue: 1,
    comment: '难度：1-3'
  },
  categoryName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '分类名称'
  }
}, {
  tableName: 'questions',
  timestamps: true,
  indexes: [
    { fields: ['type'] },
    { fields: ['categoryName'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = Question;