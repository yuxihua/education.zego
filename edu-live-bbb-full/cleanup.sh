#!/bin/bash
# ==========================================
# 教培直播系统 - 清理脚本
# 停止所有服务并删除部署文件
# ==========================================

set -e

echo "========== 开始清理 =========="

# 1. 停止 PM2 服务
echo "[1/6] 停止 PM2 服务..."
pm2 stop edu-live-server 2>/dev/null || true
pm2 delete edu-live-server 2>/dev/null || true
pm2 save 2>/dev/null || true

# 2. 停止 Docker 容器
echo "[2/6] 停止 Docker 容器..."
cd /mnt/agents/output/edu-live-server 2>/dev/null && docker-compose down -v 2>/dev/null || true
cd /mnt/agents/output

# 3. 删除 Docker 镜像
echo "[3/6] 删除 Docker 镜像..."
docker rmi edu-live-server 2>/dev/null || true

# 4. 清理后端
echo "[4/6] 清理后端项目..."
cd /mnt/agents/output/edu-live-server

# 删除 node_modules
rm -rf node_modules 2>/dev/null || true
rm -f package-lock.json 2>/dev/null || true

# 删除日志和上传文件
rm -rf logs/* 2>/dev/null || true
rm -rf uploads/* 2>/dev/null || true

# 删除 .env（保留 .env.example）
rm -f .env 2>/dev/null || true

echo "后端清理完成"

# 5. 清理前端
echo "[5/6] 清理前端项目..."
cd /mnt/agents/output/edu-live-admin

# 删除 node_modules
rm -rf node_modules 2>/dev/null || true
rm -f package-lock.json 2>/dev/null || true

# 删除构建产物
rm -rf dist 2>/dev/null || true

echo "前端清理完成"

# 6. 清理 Nginx 配置
echo "[6/6] 清理 Nginx 配置..."
rm -f /etc/nginx/conf.d/edu-live.conf 2>/dev/null || true

echo ""
echo "========== 清理完成 =========="
echo "后端: /mnt/agents/output/edu-live-server/（已清理依赖和日志）"
echo "前端: /mnt/agents/output/edu-live-admin/（已清理依赖和构建产物）"
echo ""
echo "现在可以重新部署了："
echo "  后端: cd /mnt/agents/output/edu-live-server && npm install && cp .env.example .env && npm run dev"
echo "  前端: cd /mnt/agents/output/edu-live-admin && npm install && npm run dev"
