/**
 * 教培直播系统 - 主入口
 * 
 * 技术栈：
 *   - Node.js 18+ / Express 4
 *   - MySQL 8 + Sequelize ORM
 *   - Redis 6（缓存 + 会话 + 在线状态）
 *   - ZEGO 即构（直播推拉流）
 *   - 微信支付（JSAPI）+ 支付宝
 *   - 阿里云 OSS（文件存储）
 * 
 * 模块：
 *   - 认证模块（JWT）
 *   - 课程管理
 *   - 直播间管理（ZEGO集成）
 *   - 支付系统（微信+支付宝）
 *   - 作业系统
 *   - 消息推送
 *   - 文件上传（OSS）
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

// 配置
const sequelize = require('./config/database');
const redis = require('./config/redis');

// 中间件
const { notFound, errorHandler } = require('./middleware/error');
const { commonLimiter } = require('./middleware/ratelimit');

// 路由
const routes = require('./routes');

// 日志
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

// 创建日志目录
const fs = require('fs');
const logDir = process.env.LOG_DIR || './logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Winston 日志配置
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join(logDir, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    }),
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// 全局日志对象
 global.logger = logger;

// ========== Express 应用 ==========
const app = express();
const PORT = process.env.PORT || 8080;

// 安全中间件
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// 压缩响应
app.use(compression());

// 静态文件（上传目录）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Body 解析（普通 JSON）
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 限流
app.use(commonLimiter);

// 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms - ${req.ip}`);
  });
  next();
});

// ========== 数据库连接检测 ==========
async function checkDatabase() {
  try {
    await sequelize.authenticate();
    logger.info('[Database] MySQL 连接成功');
    
    // 同步模型（开发环境自动同步，生产环境需手动执行 npm run db:sync）
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('[Database] 模型已同步');
    }
  } catch (err) {
    logger.error('[Database] MySQL 连接失败:', err.message);
    process.exit(1);
  }
}

async function checkRedis() {
  try {
    await redis.ping();
    logger.info('[Redis] 连接成功');
  } catch (err) {
    logger.error('[Redis] 连接失败:', err.message);
    // Redis 非致命，不退出
  }
}

// ========== API 路由 ==========
app.use('/api', routes);

// 根路径
app.get('/', (req, res) => {
  res.json({
    name: '教培直播系统 API',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    docs: '/api/health'
  });
});

// 404 处理
app.use(notFound);

// 全局错误处理
app.use(errorHandler);

// ========== 启动服务 ==========
async function start() {
  await checkDatabase();
  await checkRedis();

  app.listen(PORT, () => {
    logger.info(`=================================`);
    logger.info(`🚀 教培直播系统已启动`);
    logger.info(`📡 环境: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🌐 端口: ${PORT}`);
    logger.info(`🔗 地址: http://localhost:${PORT}`);
    logger.info(`=================================`);
  });
}

// 优雅关闭
process.on('SIGTERM', async () => {
  logger.info('收到 SIGTERM 信号，正在关闭服务...');
  await sequelize.close();
  await redis.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('收到 SIGINT 信号，正在关闭服务...');
  await sequelize.close();
  await redis.quit();
  process.exit(0);
});

// 未捕获异常
process.on('uncaughtException', (err) => {
  logger.error('未捕获异常:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的 Promise 拒绝:', reason);
});

// 启动
start();

module.exports = app;
