#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Ollama 模型预下载脚本
# 在容器启动时自动执行，确保所需模型已就绪
# ═══════════════════════════════════════════════════════════════

set -e

echo "🧠 AI-Scientist Hub — 模型预下载"
echo "================================"

# 等待Ollama服务就绪
echo "⏳ 等待Ollama服务启动..."
for i in {1..60}; do
    if curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "✅ Ollama服务就绪"
        break
    fi
    echo "   等待中... ($i/60)"
    sleep 2
done

# 检查模型是否已存在
check_model() {
    local model=$1
    curl -sf http://localhost:11434/api/tags | grep -q "\"name\":\"$model\""
}

# ─── 必需模型列表 ───
MODELS=(
    "qwen2.5:7b"          # 通用推理（默认，速度快）
    "qwen2.5-coder:7b"    # 代码生成
)

# ─── 推荐模型（有条件时下载）───
OPTIONAL_MODELS=(
    "qwen2.5:14b"         # 复杂推理（需要16GB+内存）
    "qwen2.5-coder:14b"   # 复杂代码生成
)

# 下载必需模型
for model in "${MODELS[@]}"; do
    if check_model "$model"; then
        echo "✅ 模型已存在: $model"
    else
        echo "📥 下载模型: $model"
        ollama pull "$model"
        echo "✅ 下载完成: $model"
    fi
done

# 检查内存，有条件时下载14B模型
TOTAL_MEM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_MEM_GB=$((TOTAL_MEM_KB / 1024 / 1024))

if [ "$TOTAL_MEM_GB" -ge 16 ]; then
    echo "🎯 检测到${TOTAL_MEM_GB}GB内存，下载14B模型..."
    for model in "${OPTIONAL_MODELS[@]}"; do
        if check_model "$model"; then
            echo "✅ 模型已存在: $model"
        else
            echo "📥 下载模型: $model"
            ollama pull "$model"
            echo "✅ 下载完成: $model"
        fi
    done
else
    echo "⚠️  内存${TOTAL_MEM_GB}GB，跳过14B模型（推荐16GB+内存）"
fi

# 验证所有模型
echo ""
echo "🔍 验证模型列表："
curl -sf http://localhost:11434/api/tags | grep '"name"'

echo ""
echo "🎉 模型预下载完成！"
