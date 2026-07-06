#!/bin/bash
# ==========================================
# 教培直播系统 - 生产部署脚本
# 
# 支持两种部署方式：
#   1. PM2 部署（推荐，直接部署在服务器上）
#   2. Docker Compose 部署（容器化）
# 
# 使用方式：
#   chmod +x deploy.sh
#   ./deploy.sh pm2     # PM2 部署
#   ./deploy.sh docker  # Docker 部署
# ==========================================

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目配置
PROJECT_NAME="edu-live-server"
DEPLOY_TYPE=${1:-pm2}

# 打印信息
info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查环境
check_env() {
    info "检查环境..."
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js 未安装，请先安装 Node.js 18+"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        error "Node.js 版本过低，需要 18+，当前版本: $(node -v)"
        exit 1
    fi
    
    # 检查 .env 文件
    if [ ! -f ".env" ]; then
        warning ".env 文件不存在，复制 .env.example"
        cp .env.example .env
        warning "请编辑 .env 文件配置实际参数后再运行"
        exit 1
    fi
    
    success "环境检查通过"
}

# PM2 部署
deploy_pm2() {
    info "========== PM2 部署 =========="
    
    # 1. 拉取最新代码
    info "拉取最新代码..."
    git pull origin main || warning "Git 拉取失败，使用本地代码"
    
    # 2. 安装依赖
    info "安装依赖..."
    npm ci --only=production
    
    # 3. 数据库迁移（可选）
    # info "执行数据库迁移..."
    # npx sequelize-cli db:migrate || warning "数据库迁移跳过"
    
    # 4. 检查 logs 目录
    mkdir -p logs uploads
    
    # 5. PM2 启动/重启
    info "启动/重启 PM2 服务..."
    if pm2 list | grep -q "$PROJECT_NAME"; then
        pm2 reload ecosystem.config.js --env production
    else
        pm2 start ecosystem.config.js --env production
    fi
    
    # 6. 保存 PM2 配置（开机自启）
    pm2 save
    
    # 7. 检查状态
    info "服务状态："
    pm2 status $PROJECT_NAME
    
    success "PM2 部署完成！"
    info "日志查看: pm2 logs $PROJECT_NAME"
    info "停止服务: pm2 stop $PROJECT_NAME"
    info "重启服务: pm2 reload $PROJECT_NAME"
}

# Docker 部署
deploy_docker() {
    info "========== Docker 部署 =========="
    
    # 1. 检查 Docker
    if ! command -v docker &> /dev/null; then
        error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    # 2. 拉取最新代码
    info "拉取最新代码..."
    git pull origin main || warning "Git 拉取失败，使用本地代码"
    
    # 3. 构建并启动
    info "构建并启动容器..."
    docker-compose down 2>/dev/null || true
    docker-compose up -d --build
    
    # 4. 等待服务启动
    info "等待服务启动..."
    sleep 10
    
    # 5. 检查状态
    info "容器状态："
    docker-compose ps
    
    # 6. 检查日志
    info "服务日志（最近 30 行）："
    docker-compose logs --tail=30 app || true
    
    success "Docker 部署完成！"
    info "查看日志: docker-compose logs -f app"
    info "停止服务: docker-compose down"
    info "重启服务: docker-compose restart app"
}

# 首次部署
first_deploy() {
    info "========== 首次部署 =========="
    
    # 创建必要的目录
    mkdir -p logs uploads ssl
    
    # 复制环境变量模板
    if [ ! -f ".env" ]; then
        cp .env.example .env
        warning "已创建 .env 文件，请先编辑配置后再部署"
        exit 1
    fi
    
    # 数据库初始化（可选）
    info "是否初始化数据库？(y/n)"
    read -r init_db
    if [ "$init_db" = "y" ]; then
        info "初始化数据库..."
        npx sequelize-cli db:create || true
        npx sequelize-cli db:migrate || true
    fi
    
    success "首次部署准备完成！"
}

# 显示帮助
show_help() {
    echo "教培直播系统部署脚本"
    echo ""
    echo "用法:"
    echo "  ./deploy.sh pm2       PM2 部署（推荐生产环境）"
    echo "  ./deploy.sh docker    Docker Compose 部署"
    echo "  ./deploy.sh init      首次部署准备"
    echo "  ./deploy.sh help      显示帮助"
    echo ""
    echo "PM2 常用命令:"
    echo "  pm2 status            查看服务状态"
    echo "  pm2 logs              查看日志"
    echo "  pm2 reload all        重启所有服务"
    echo "  pm2 save              保存当前配置"
    echo "  pm2 startup           设置开机自启"
    echo ""
    echo "Docker 常用命令:"
    echo "  docker-compose up -d          启动所有服务"
    echo "  docker-compose down           停止所有服务"
    echo "  docker-compose logs -f app    查看应用日志"
    echo "  docker-compose ps             查看容器状态"
}

# 主入口
case $DEPLOY_TYPE in
    pm2)
        check_env
        deploy_pm2
        ;;
    docker)
        deploy_docker
        ;;
    init)
        first_deploy
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        error "未知部署类型: $DEPLOY_TYPE"
        show_help
        exit 1
        ;;
esac
