/**
 * PM2 生产环境配置
 * 
 * 使用方式：
 *   pm2 start ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js --env production
 *   pm2 stop edu-live-server
 *   pm2 delete edu-live-server
 * 
 * 监控：
 *   pm2 monit
 *   pm2 logs edu-live-server
 *   pm2 status
 */
module.exports = {
  apps: [
    {
      name: 'edu-live-server',
      script: './app.js',
      
      // 集群模式：根据 CPU 核心数自动 fork 进程
      instances: 'max',
      exec_mode: 'cluster',
      
      // 内存限制：超过 1G 自动重启
      max_memory_restart: '1G',
      
      // 环境变量
      env: {
        NODE_ENV: 'development',
        PORT: 8080
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8080
      },
      
      // 日志配置
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      merge_logs: true,
      
      // 自动重启
      autorestart: true,
      // 崩溃后延迟重启（毫秒）
      restart_delay: 3000,
      // 异常退出次数限制（超过则不再重启）
      max_restarts: 10,
      
      // 文件监听（生产环境建议关闭，使用 CI/CD 部署）
      watch: false,
      // 忽略监听的文件夹
      ignore_watch: [
        'node_modules',
        'logs',
        'uploads',
        '.git'
      ],
      
      // 进程异常退出时的处理
      kill_timeout: 5000,
      listen_timeout: 10000,
      
      // 健康检查
      // pm2 会定期向此地址发送请求检查服务健康
      // health_check_grace_period: 30000,
    }
  ]
};
