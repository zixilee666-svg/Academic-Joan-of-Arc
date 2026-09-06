#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# AI-Scientist Hub — 一键安装脚本（Linux / macOS）
# 用法：curl -fsSL https://raw.githubusercontent.com/.../install.sh | bash
# ═══════════════════════════════════════════════════════════════

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目配置
REPO_URL="https://github.com/zixilee666-svg/Academic-Web.git"
PROJECT_NAME="AI-Scientist-Hub"
INSTALL_DIR="${HOME}/${PROJECT_NAME}"

print_banner() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                                                              ║${NC}"
    echo -e "${BLUE}║     🧠 AI-Scientist Hub — 全内嵌科研智能平台                  ║${NC}"
    echo -e "${BLUE}║                                                              ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

check_requirements() {
    echo -e "${YELLOW}🔍 检查系统要求...${NC}"
    
    # 检查Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker未安装${NC}"
        echo "   请访问 https://docs.docker.com/get-docker/ 安装Docker Desktop"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker已安装: $(docker --version)${NC}"
    
    # 检查Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo -e "${RED}❌ Docker Compose未安装${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker Compose已安装${NC}"
    
    # 检查内存
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        TOTAL_MEM=$(free -g | awk '/^Mem:/{print $2}')
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        TOTAL_MEM=$(($(sysctl -n hw.memsize) / 1024 / 1024 / 1024))
    fi
    
    echo -e "${GREEN}✅ 系统内存: ${TOTAL_MEM}GB${NC}"
    
    if [ "$TOTAL_MEM" -lt 8 ]; then
        echo -e "${YELLOW}⚠️  警告: 内存不足8GB，建议使用7B模型（已自动配置）${NC}"
    elif [ "$TOTAL_MEM" -lt 16 ]; then
        echo -e "${YELLOW}⚠️  建议: 内存16GB+可运行14B模型获得更好效果${NC}"
    else
        echo -e "${GREEN}✅ 内存充足，支持14B模型${NC}"
    fi
    
    # 检查磁盘空间
    AVAILABLE_GB=$(df -BG . | awk 'NR==2{print $4}' | sed 's/G//')
    if [ "$AVAILABLE_GB" -lt 30 ]; then
        echo -e "${RED}❌ 磁盘空间不足: ${AVAILABLE_GB}GB可用，需要至少30GB${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ 磁盘空间: ${AVAILABLE_GB}GB可用${NC}"
}

clone_repo() {
    echo ""
    echo -e "${YELLOW}📥 下载项目代码...${NC}"
    
    if [ -d "$INSTALL_DIR" ]; then
        echo -e "${YELLOW}⚠️  目录已存在，更新代码...${NC}"
        cd "$INSTALL_DIR"
        git pull origin main
    else
        git clone "$REPO_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi
    
    echo -e "${GREEN}✅ 代码下载完成${NC}"
}

setup_environment() {
    echo ""
    echo -e "${YELLOW}⚙️  配置环境...${NC}"
    
    # 创建必要目录
    mkdir -p data models datasets
    
    # 根据内存调整模型配置
    if [ "$TOTAL_MEM" -lt 16 ]; then
        echo -e "${YELLOW}📝 配置7B模型模式...${NC}"
        cat > .env <<EOF
OLLAMA_HOST=http://ollama:11434
MODEL_REASONING=qwen2.5:7b
MODEL_GENERAL=qwen2.5:7b
MODEL_CODING=qwen2.5-coder:7b
RUN_MODE=offline
EOF
    else
        echo -e "${YELLOW}📝 配置14B模型模式...${NC}"
        cat > .env <<EOF
OLLAMA_HOST=http://ollama:11434
MODEL_REASONING=qwen2.5:14b
MODEL_GENERAL=qwen2.5:7b
MODEL_CODING=qwen2.5-coder:14b
RUN_MODE=offline
EOF
    fi
    
    echo -e "${GREEN}✅ 环境配置完成${NC}"
}

start_services() {
    echo ""
    echo -e "${YELLOW}🚀 启动服务...${NC}"
    echo "   首次启动需要下载模型权重（约9-18GB），请耐心等待..."
    echo ""
    
    docker-compose up -d
    
    # 等待服务就绪
    echo ""
    echo -e "${YELLOW}⏳ 等待服务就绪...${NC}"
    for i in {1..60}; do
        if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ 后端服务就绪${NC}"
            break
        fi
        echo -n "."
        sleep 3
    done
    
    echo ""
}

print_success() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                   🎉 安装完成！                              ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "📱 ${BLUE}访问地址:${NC}"
    echo -e "   主应用:     ${GREEN}http://localhost:3000${NC}"
    echo -e "   API文档:    ${GREEN}http://localhost:8000/docs${NC}"
    echo -e "   Ollama管理: ${GREEN}http://localhost:8080${NC} (debug模式)"
    echo ""
    echo -e "🛠️  ${BLUE}常用命令:${NC}"
    echo -e "   查看日志:   ${YELLOW}docker-compose logs -f${NC}"
    echo -e "   停止服务:   ${YELLOW}docker-compose down${NC}"
    echo -e "   重启服务:   ${YELLOW}docker-compose restart${NC}"
    echo -e "   更新代码:   ${YELLOW}git pull && docker-compose up -d --build${NC}"
    echo ""
    echo -e "📖 ${BLUE}离线使用:${NC}"
    echo -e "   系统已配置为离线模式，断开网络后仍可完整运行所有功能"
    echo ""
    echo -e "🆘 ${BLUE}遇到问题?${NC}"
    echo -e "   查看日志: docker-compose logs -f [backend|frontend|ollama]"
    echo -e "   GitHub Issues: https://github.com/zixilee666-svg/Academic-Web/issues"
    echo ""
}

# ═══════════════════════════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════════════════════════

main() {
    print_banner
    check_requirements
    clone_repo
    setup_environment
    start_services
    print_success
}

main "$@"
