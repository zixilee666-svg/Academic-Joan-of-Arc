# ═══════════════════════════════════════════════════════════════
# AI-Scientist Hub Backend — FastAPI 服务
# Python 3.11 + FastAPI + SQLite + FAISS
# ═══════════════════════════════════════════════════════════════

FROM python:3.11-slim-bookworm

LABEL maintainer="AI-Scientist Hub Team"
LABEL description="AI-Scientist Hub Backend — 全内嵌科研智能平台后端服务"

# ─── 系统依赖 ───
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libgomp1 \
    curl \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# ─── 工作目录 ───
WORKDIR /app

# ─── Python依赖 ───
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ─── 应用代码 ───
COPY ./backend/app /app

# ─── 数据库Schema（首次启动初始化用）───
COPY ./database /database

# ─── 数据目录（运行时挂载卷）───
RUN mkdir -p /app/data /app/datasets /app/models

# ─── 健康检查 ───
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# ─── 暴露端口 ───
EXPOSE 8000

# ─── 启动命令 ───
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
