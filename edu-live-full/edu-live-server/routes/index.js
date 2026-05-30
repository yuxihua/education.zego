/**
 * 路由入口
 * 统一注册所有 API 路由
 */
const express = require('express');
const router = express.Router();

// 健康检查
router.get('/health', (req, res) => {
  res.json({
    code: 0,
    message: '服务正常运行',
    data: {
      service: 'edu-live-server',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: Date.now(),
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// 注册各模块路由
router.use('/auth', require('./auth'));
router.use('/pay', require('./pay'));
router.use('/zego', require('./zego'));
router.use('/live', require('./live'));
router.use('/question', require('./question'));
router.use('/course', require('./course'));
router.use('/homework', require('./homework'));
router.use('/upload', require('./upload'));

module.exports = router;
