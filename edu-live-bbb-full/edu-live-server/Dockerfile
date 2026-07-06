# ==========================================
# Dockerfile - 教培直播系统后端
# 
# 构建：
#   docker build -t edu-live-server .
# 
# 运行：
#   docker run -d -p 8080:8080 --env-file .env edu-live-server
# 
# 或者使用 docker-compose：
#   docker-compose up -d
# ==========================================

# 基础镜像：Node.js 18 Alpine（轻量级）
FROM node:18-alpine

# 维护者信息
LABEL maintainer="your-team@example.com"
LABEL description="教培直播系统后端服务"

# 安装必要依赖（Alpine 需要）
RUN apk add --no-cache \
    tzdata \
    curl \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone

# 工作目录
WORKDIR /app

# 先复制 package 文件（利用 Docker 缓存层）
COPY package*.json ./

# 安装生产依赖
RUN npm ci --only=production \
    && npm cache clean --force

# 复制应用代码
COPY . .

# 创建日志和上传目录
RUN mkdir -p logs uploads \
    && chown -R node:node /app

# 切换到非 root 用户（安全）
USER node

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# 启动命令
CMD ["node", "app.js"]
