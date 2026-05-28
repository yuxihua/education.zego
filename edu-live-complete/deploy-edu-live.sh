#!/bin/bash
# ============================================================
# 教培直播系统 - 一键部署脚本
# 用法: chmod +x deploy-edu-live.sh && ./deploy-edu-live.sh
# ============================================================

set -e

echo "=========================================="
echo "  教培直播系统 - 一键部署"
echo "=========================================="

# 配置变量（按需修改）
DOMAIN="education.zego"
WEB_ROOT="/var/www/education.zego"
API_PORT=3001
DB_NAME="edu_live"
DB_USER="root"
DB_PASS="your_db_password"  # 修改为你的数据库密码
DB_HOST="localhost"
REDIS_HOST="localhost"
REDIS_PORT=6379

# ZEGO 配置（必须修改）
ZEGO_APP_ID="你的ZEGO_APP_ID"
ZEGO_SERVER_SECRET="你的ZEGO_SERVER_SECRET"
ZEGO_APP_SIGN="你的ZEGO_APP_SIGN"

# 微信支付配置（按需修改）
WX_APPID=""
WX_MCHID=""
WX_PRIVATE_KEY=""
WX_APIV3_KEY=""

# 支付宝配置（按需修改）
ALIPAY_APPID=""
ALIPAY_PRIVATE_KEY=""
ALIPAY_PUBLIC_KEY=""

# ---------- 步骤1：系统环境检查 ----------
echo "[1/8] 检查系统环境..."
command -v node >/dev/null 2>&1 || { echo "错误: 未安装 Node.js"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "错误: 未安装 npm"; exit 1; }
command -v mysql >/dev/null 2>&1 || { echo "错误: 未安装 MySQL"; exit 1; }
command -v redis-cli >/dev/null 2>&1 || { echo "警告: 未安装 Redis，建议安装"; }

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "错误: Node.js 版本需 >= 18，当前 $(node -v)"
  exit 1
fi
echo "  Node.js: $(node -v) ✓"

# ---------- 步骤2：创建目录 ----------
echo "[2/8] 创建部署目录..."
sudo mkdir -p $WEB_ROOT
sudo mkdir -p $WEB_ROOT/server
sudo chown -R $(whoami):$(whoami) $WEB_ROOT

# ---------- 步骤3：解压代码 ----------
echo "[3/8] 解压代码..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/edu-live-complete.zip" ]; then
  unzip -o "$SCRIPT_DIR/edu-live-complete.zip" -d /tmp/edu-live-temp >/dev/null 2>&1
  cp -r /tmp/edu-live-temp/edu-live-admin $WEB_ROOT/
  cp -r /tmp/edu-live-temp/edu-live-server/* $WEB_ROOT/server/
  rm -rf /tmp/edu-live-temp
  echo "  代码解压完成 ✓"
else
  echo "  未找到 edu-live-complete.zip，请确保与脚本同目录"
  exit 1
fi

# ---------- 步骤4：安装后端依赖 ----------
echo "[4/8] 安装后端依赖..."
cd $WEB_ROOT/server
npm install --production 2>&1 | tail -3
echo "  后端依赖安装完成 ✓"

# ---------- 步骤5：配置环境变量 ----------
echo "[5/8] 配置环境变量..."
cat > $WEB_ROOT/server/.env << EOF
NODE_ENV=production
PORT=$API_PORT

# 数据库
DB_HOST=$DB_HOST
DB_PORT=3306
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASS=$DB_PASS

# Redis
REDIS_HOST=$REDIS_HOST
REDIS_PORT=$REDIS_PORT

# JWT
JWT_SECRET=edu_live_jwt_$(date +%s)_random
JWT_EXPIRES=7d

# ZEGO
ZEGO_APP_ID=$ZEGO_APP_ID
ZEGO_SERVER_SECRET=$ZEGO_SERVER_SECRET
ZEGO_APP_SIGN=$ZEGO_APP_SIGN

# 微信支付
WX_APPID=$WX_APPID
WX_MCHID=$WX_MCHID
WX_PRIVATE_KEY=$WX_PRIVATE_KEY
WX_APIV3_KEY=$WX_APIV3_KEY

# 支付宝
ALIPAY_APPID=$ALIPAY_APPID
ALIPAY_PRIVATE_KEY=$ALIPAY_PRIVATE_KEY
ALIPAY_PUBLIC_KEY=$ALIPAY_PUBLIC_KEY
EOF
echo "  环境变量配置完成 ✓"

# ---------- 步骤6：初始化数据库 ----------
echo "[6/8] 初始化数据库..."
mysql -u$DB_USER -p$DB_PASS -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || {
  echo "  警告: 数据库创建失败，请手动检查"
}

# 同步数据库表
cd $WEB_ROOT/server
node -e "
const sequelize = require('./config/database');
require('./models');
sequelize.sync({ alter: true }).then(() => {
  console.log('数据库同步完成');
  process.exit(0);
}).catch(err => {
  console.error('同步失败:', err.message);
  process.exit(1);
});
" 2>&1
echo "  数据库初始化完成 ✓"

# ---------- 步骤7：安装并构建前端 ----------
echo "[7/8] 安装并构建前端..."
cd $WEB_ROOT/edu-live-admin
npm install 2>&1 | tail -3
npm run build 2>&1
echo "  前端构建完成 ✓"

# ---------- 步骤8：配置 Nginx ----------
echo "[8/8] 配置 Nginx..."
sudo tee /etc/nginx/conf.d/edu-live.conf >/dev/null << 'EOF'
server {
    listen 80;
    server_name education.zego;

    # 前端静态文件
    location / {
        root /var/www/education.zego/edu-live-admin/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket 支持（ZEGO信令透传）
    location /ws/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
EOF

sudo nginx -t 2>&1 && sudo systemctl reload nginx
echo "  Nginx 配置完成 ✓"

# ---------- 启动服务 ----------
echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo ""
echo "启动后端服务:"
echo "  cd $WEB_ROOT/server && npm start"
echo ""
echo "或使用 PM2 启动:"
echo "  cd $WEB_ROOT/server && npm run pm2:start"
echo ""
echo "访问地址:"
echo "  后台管理: http://$DOMAIN"
echo "  学生观看: http://$DOMAIN/watch/1"
echo "  API文档:  http://$DOMAIN/api/health"
echo ""
echo "默认账号:"
echo "  平台超管: admin / admin123"
echo "  讲师:     teacher / teacher123"
echo ""
echo "请确保已在 ZEGO 控制台配置:"
echo "  1. APP ID 和 Server Secret"
echo "  2. 录制回调地址: http://$DOMAIN/api/zego/callback"
echo "=========================================="
