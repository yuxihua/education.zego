/**
 * PPT 课件模型
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PPTFile = sequelize.define('PPTFile', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  // 关联直播间ID
  roomId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    comment: '直播间ID'
  },
  // 文件名
  filename: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '原始文件名'
  },
  // 文件URL
  fileUrl: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: '文件访问URL'
  },
  // 文件大小（字节）
  fileSize: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    comment: '文件大小（字节）'
  },
  // 文件类型
  fileType: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'MIME类型'
  },
  // 页数
  pageCount: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    comment: 'PPT页数'
  },
  // 当前页码
  currentPage: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 1,
    comment: '当前展示页码'
  },
  // 状态
  status: {
    type: DataTypes.ENUM('uploading', 'ready', 'converting', 'error'),
    defaultValue: 'uploading',
    comment: '状态：上传中/就绪/转换中/错误'
  },
  // 排序
  sortOrder: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    comment: '排序序号'
  }
}, {
  tableName: 'ppt_files',
  timestamps: true
});

module.exports = PPTFile;
