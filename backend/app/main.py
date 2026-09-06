"""
Academic Joan of Arc — FastAPI 主应用
双引擎架构入口：本地 Ollama 推理 / 阿里云百炼(DashScope) 千问推理 + SQLite 存储 + 多智能体编排
（LLM_PROVIDER=ollama|bailian 切换；比赛要求通过阿里云百炼平台调用千问）
"""

import os
import json
import sqlite3
from contextlib import asynccontextmanager
from typing import Optional

# ─── 加载项目根目录 .env（必须在读取环境变量的模块导入之前）───
try:
    from dotenv import load_dotenv
    _ENV_CANDIDATES = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"),      # 本地开发: backend/.env
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env"),  # 项目根/.env
        ".env",
    ]
    for _cand in _ENV_CANDIDATES:
        if os.path.exists(_cand):
            load_dotenv(_cand, override=False)
            break
except ImportError:
    pass  # python-dotenv 未安装时依赖外部环境变量

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from loguru import logger

from llm_engine import get_llm_engine, LLMResponse
from auth import router as auth_router, init_default_users, require_auth
from agents import get_orchestrator
from settings import router as settings_router
from pipeline.router import router as pipeline_v2_router
from pipeline import db as pipeline_db
from pipeline.questions_bank import seed_questions


# ═══════════════════════════════════════════════════════════════
# Pydantic 模型定义
# ═══════════════════════════════════════════════════════════════

class ChatRequest(BaseModel):
    model: str = Field(default="general", description="模型类型: reasoning/general/coding")
    messages: list[dict] = Field(..., description="消息列表")
    stream: bool = Field(default=False)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)


class HypothesisRequest(BaseModel):
    question: str = Field(..., description="研究问题")
    literature_summary: str = Field(default="", description="文献综述")
    knowledge_gaps: list[str] = Field(default=[], description="知识缺口列表")
    model: str = Field(default="reasoning")


class ResearchSessionCreate(BaseModel):
    title: str
    question: str
    domain: str = "astronomy"
    depth: str = "standard"


class RunAgentRequest(BaseModel):
    sessionId: str = ""
    stage: str = Field(..., description="阶段: question/literature/hypothesis/experiment/evaluation")
    input: str = Field(..., description="输入文本")
    context: Optional[dict] = Field(default=None, description="前序阶段结果")


class FeedbackRequest(BaseModel):
    hypothesis_id: int
    feedback: str
    action: str = Field(default="refine", description="refine/accept/reject")


class ResearchPlanRequest(BaseModel):
    question: str = Field(..., description="研究问题")
    literature: str = Field(default="", description="文献综述")
    hypothesis: str = Field(default="", description="科学假设")
    experiment: str = Field(default="", description="实验方案")
    model: str = Field(default="reasoning")


# ═══════════════════════════════════════════════════════════════
# 数据库连接（使用集中配置模块的路径解析）
# ═══════════════════════════════════════════════════════════════

from config import DB_PATH


def get_db():
    """获取数据库连接"""
    os.makedirs(os.path.dirname(DB_PATH) if os.path.dirname(DB_PATH) else ".", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ═══════════════════════════════════════════════════════════════
# 生命周期管理
# ═══════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    logger.info("🚀 Academic Joan of Arc Backend 启动中...")

    # 确保数据库存在
    os.makedirs(os.path.dirname(DB_PATH) if os.path.dirname(DB_PATH) else ".", exist_ok=True)
    if not os.path.exists(DB_PATH):
        logger.info("🗄️  初始化数据库...")
        # 尝试多个可能的schema路径（Docker环境 vs 本地开发）
        schema_candidates = [
            "/database/schema.sql",
            os.path.join(os.path.dirname(__file__), "..", "database", "schema.sql"),
            "database/schema.sql",
        ]
        schema_path = None
        for candidate in schema_candidates:
            if os.path.exists(candidate):
                schema_path = candidate
                break

        if schema_path:
            with open(schema_path, "r", encoding="utf-8") as f:
                conn = sqlite3.connect(DB_PATH)
                conn.executescript(f.read())
                conn.close()
            logger.info("✅ 数据库初始化完成")
        else:
            logger.warning("⚠️  schema.sql未找到，跳过数据库初始化")

    # 初始化默认用户
    try:
        init_default_users()
    except Exception as e:
        logger.warning(f"⚠️  默认用户初始化跳过: {e}")

    # 六环节流水线：幂等迁移 schema_v2 + 播种125题题库
    try:
        pipeline_db.migrate()
        seed_questions()
    except Exception as e:
        logger.warning(f"⚠️  六环节流水线初始化跳过: {e}")

    # 检查推理引擎健康状态（Ollama 或 阿里云百炼，取决于 LLM_PROVIDER）
    engine = get_llm_engine()
    llm_provider = os.getenv("LLM_PROVIDER", "ollama").lower()
    health = await engine.health_check()

    if health.get("status") == "healthy":
        logger.info(f"✅ 推理引擎({llm_provider})正常: {health}")
    else:
        logger.warning(f"⚠️  推理引擎({llm_provider})未就绪，将降级为 Mock 演示模式: {health}")

    yield

    # 关闭时
    await engine.close()
    logger.info("👋 Academic Joan of Arc Backend 已关闭")


# ═══════════════════════════════════════════════════════════════
# FastAPI 应用实例
# ═══════════════════════════════════════════════════════════════

app = FastAPI(
    title="Academic Joan of Arc API",
    description="全内嵌AI科研智能平台 — 本地Ollama推理·零外部依赖",
    version="3.0.0",
    lifespan=lifespan,
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册认证路由
app.include_router(auth_router)
# 注册系统设置路由（推理引擎配置 / API Key / 连接测试 / 用户偏好）
app.include_router(settings_router)
# 注册六环节流水线路由（赛道一·方向1A：问题理解→知识整合→假设生成→核验筛选→研究计划→反馈迭代）
app.include_router(pipeline_v2_router)


# ═══════════════════════════════════════════════════════════════
# 健康检查
# ═══════════════════════════════════════════════════════════════

@app.get("/health")
async def health_check():
    """健康检查端点"""
    engine = get_llm_engine()
    ollama_health = await engine.health_check()

    db_ok = False
    try:
        conn = get_db()
        conn.execute("SELECT 1").fetchone()
        conn.close()
        db_ok = True
    except Exception:
        pass

    # 六环节流水线就绪状态（题库 + schema_v2 表）
    pipeline_ready = False
    questions_count = 0
    try:
        conn = get_db()
        row = conn.execute("SELECT COUNT(*) FROM questions_125").fetchone()
        questions_count = row[0] if row else 0
        v2_tables = conn.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN "
            "('questions_125','pipeline_runs','evidence_cards','knowledge_gaps',"
            "'hypotheses_v2','plans_v2','iteration_rounds','feedback_entries')"
        ).fetchone()[0]
        conn.close()
        pipeline_ready = questions_count > 0 and v2_tables >= 8
    except Exception:
        pass

    # 真实引擎判定（前端 LIVE/MOCK 标识的唯一权威源）：
    # provider 明确配置 + 引擎健康探测通过 = 真实环境；否则视为 Mock 降级风险
    provider = os.getenv("LLM_PROVIDER", "ollama")
    llm_ok = bool(
        isinstance(ollama_health, dict)
        and ollama_health.get("status") == "healthy"
        and ollama_health.get("ready", True) is not False
    )
    is_mock = not llm_ok

    return {
        "status": "healthy" if db_ok else "degraded",
        "version": "3.2.0",
        "mode": "live" if llm_ok else "mock",   # 语义修正：mode 表达引擎真实/降级，而非 RUN_MODE 环境变量
        "run_mode": os.getenv("RUN_MODE", "offline"),
        "provider": provider,
        "is_mock": is_mock,
        "llm": ollama_health,
        "models": {
            "reasoning": os.getenv("BAILIAN_MODEL_REASONING") or os.getenv("MODEL_REASONING", ""),
            "general": os.getenv("BAILIAN_MODEL_GENERAL") or os.getenv("MODEL_GENERAL", ""),
            "coding": os.getenv("BAILIAN_MODEL_CODING") or os.getenv("MODEL_CODING", ""),
            "multimodal": os.getenv("BAILIAN_MODEL_MULTIMODAL", ""),
        },
        "database": "connected" if db_ok else "disconnected",
        "pipeline": {
            "ready": pipeline_ready,
            "questions_bank": questions_count,
        },
    }


# ═══════════════════════════════════════════════════════════════
# LLM 对话接口（兼容OpenAI格式）
# ═══════════════════════════════════════════════════════════════

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """通用对话接口（兼容OpenAI格式，支持流式）"""
    engine = get_llm_engine()

    try:
        if request.stream:
            stream = await engine.chat(
                model=request.model,
                messages=request.messages,
                stream=True,
                temperature=request.temperature,
            )

            async def stream_generator():
                async for chunk in stream:
                    yield f"data: {json.dumps({'choices': [{'delta': {'content': chunk}}]}, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"

            return StreamingResponse(stream_generator(), media_type="text/event-stream")

        response = await engine.chat(
            model=request.model,
            messages=request.messages,
            stream=False,
            temperature=request.temperature,
        )

        return {
            "choices": [{
                "message": {"role": "assistant", "content": response.content},
                "finish_reason": response.finish_reason,
            }],
            "usage": {
                "prompt_tokens": response.prompt_tokens,
                "completion_tokens": response.completion_tokens,
                "total_tokens": response.total_tokens,
            },
            "model": response.model,
        }

    except Exception as e:
        logger.error(f"对话失败: {e}")
        # 降级：返回Mock响应（离线演示用）
        mock_content = _get_mock_response(request.messages)
        return {
            "choices": [{
                "message": {"role": "assistant", "content": mock_content},
                "finish_reason": "stop",
            }],
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            "model": "mock (Ollama离线)",
        }


# ═══════════════════════════════════════════════════════════════
# 多智能体编排接口
# ═══════════════════════════════════════════════════════════════

@app.post("/api/research/run-agent")
async def run_agent(request: RunAgentRequest):
    """运行单个研究Agent"""
    orchestrator = get_orchestrator()

    try:
        response = await orchestrator.run_agent(
            stage=request.stage,
            input_text=request.input,
            context=request.context,
        )
        return {
            "success": True,
            "stage": request.stage,
            "content": response.content,
            "model": response.model,
            "tokens": {
                "prompt": response.prompt_tokens,
                "completion": response.completion_tokens,
            },
        }
    except Exception as e:
        logger.error(f"Agent执行失败: {e}")
        # 降级Mock
        return {
            "success": True,
            "stage": request.stage,
            "content": _get_mock_agent_response(request.stage, request.input),
            "model": "mock",
            "tokens": {"prompt": 0, "completion": 0},
        }


@app.post("/api/research/run-agent-stream")
async def run_agent_stream(request: RunAgentRequest):
    """流式运行研究Agent（SSE）"""
    orchestrator = get_orchestrator()

    async def event_generator():
        try:
            async for chunk in orchestrator.run_agent_stream(
                stage=request.stage,
                input_text=request.input,
                context=request.context,
            ):
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ═══════════════════════════════════════════════════════════════
# 假设生成接口
# ═══════════════════════════════════════════════════════════════

@app.post("/api/research/hypothesis")
async def generate_hypothesis(request: HypothesisRequest):
    """生成科学假设"""
    engine = get_llm_engine()

    try:
        response = await engine.generate_hypothesis(
            question=request.question,
            literature_summary=request.literature_summary,
            knowledge_gaps=request.knowledge_gaps,
            model=request.model,
        )

        return {
            "success": True,
            "hypotheses_text": response.content,
            "model": response.model,
            "tokens": {
                "prompt": response.prompt_tokens,
                "completion": response.completion_tokens,
            },
        }

    except Exception as e:
        logger.error(f"假设生成失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# 研究计划（对齐比赛《科学假设与研究计划》十大标准字段）
# ═══════════════════════════════════════════════════════════════

@app.post("/api/research/plan")
async def generate_research_plan(request: ResearchPlanRequest):
    """生成结构化《科学假设与研究计划》（十大标准字段，对齐比赛生成结果规范）"""
    orchestrator = get_orchestrator()
    try:
        response = await orchestrator.generate_research_plan(
            question=request.question,
            literature=request.literature,
            hypothesis=request.hypothesis,
            experiment=request.experiment,
            model=request.model,
        )
        return {"success": True, "plan": response.content, "model": response.model}
    except Exception as e:
        logger.error(f"研究计划生成失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# 研究会话管理
# ═══════════════════════════════════════════════════════════════

@app.post("/api/research/session")
async def create_session(request: ResearchSessionCreate):
    """创建研究会话"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "INSERT INTO research_sessions (title, question, domain, status) VALUES (?, ?, ?, ?)",
        (request.title, request.question, request.domain, "pending"),
    )
    session_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {"success": True, "session_id": session_id, "id": str(session_id)}


@app.get("/api/research/sessions")
async def list_sessions():
    """获取所有研究会话"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM research_sessions ORDER BY created_at DESC LIMIT 50")
    rows = cursor.fetchall()
    conn.close()

    sessions = []
    for row in rows:
        sessions.append({
            "id": str(row["id"]),
            "title": row["title"],
            "question": row["question"],
            "domain": row["domain"],
            "status": row["status"],
            "progress": row["progress"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        })

    return sessions


@app.get("/api/research/session/{session_id}")
async def get_session(session_id: int):
    """获取研究会话详情"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM research_sessions WHERE id = ?", (session_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="会话不存在")

    return dict(row)


@app.delete("/api/research/session/{session_id}")
async def delete_session(session_id: int):
    """删除研究会话"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM research_sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()
    return {"success": True}


# ═══════════════════════════════════════════════════════════════
# 文献检索
# ═══════════════════════════════════════════════════════════════

@app.get("/api/literature/search")
async def search_literature(q: str, top_k: int = 10):
    """本地文献检索（SQLite FTS5全文检索）"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT l.* FROM literature l
            WHERE l.id IN (
                SELECT rowid FROM literature_fts WHERE literature_fts MATCH ?
            )
            LIMIT ?
            """,
            (q, top_k),
        )
        results = [dict(row) for row in cursor.fetchall()]
    except Exception:
        # FTS表可能为空，降级为LIKE搜索
        cursor.execute(
            "SELECT * FROM literature WHERE title LIKE ? OR abstract LIKE ? LIMIT ?",
            (f"%{q}%", f"%{q}%", top_k),
        )
        results = [dict(row) for row in cursor.fetchall()]

    conn.close()
    return {"success": True, "results": results, "count": len(results)}


# ═══════════════════════════════════════════════════════════════
# 天文数据
# ═══════════════════════════════════════════════════════════════

@app.get("/api/astro/data")
async def get_astro_data(
    source: Optional[str] = None,
    flare_class: Optional[str] = None,
    limit: int = 100,
):
    """获取天文数据（本地SQLite）"""
    conn = get_db()
    cursor = conn.cursor()

    query = "SELECT * FROM astro_data WHERE 1=1"
    params: list = []

    if source:
        query += " AND data_source = ?"
        params.append(source)
    if flare_class:
        query += " AND flare_class = ?"
        params.append(flare_class)

    query += " ORDER BY obs_time DESC LIMIT ?"
    params.append(limit)

    try:
        cursor.execute(query, params)
        results = [dict(row) for row in cursor.fetchall()]
    except Exception:
        results = []

    conn.close()
    return {"success": True, "data": results, "count": len(results)}


# ═══════════════════════════════════════════════════════════════
# 知识图谱
# ═══════════════════════════════════════════════════════════════

@app.get("/api/knowledge/graph")
async def get_knowledge_graph(node_type: Optional[str] = None, limit: int = 100):
    """获取知识图谱节点和关系"""
    conn = get_db()
    cursor = conn.cursor()

    # 获取节点
    if node_type:
        cursor.execute("SELECT * FROM kg_nodes WHERE type = ? LIMIT ?", (node_type, limit))
    else:
        cursor.execute("SELECT * FROM kg_nodes LIMIT ?", (limit,))
    nodes = [dict(row) for row in cursor.fetchall()]

    # 获取关系
    node_ids = [n["id"] for n in nodes]
    edges = []
    if node_ids:
        placeholders = ",".join("?" * len(node_ids))
        cursor.execute(
            f"SELECT * FROM kg_edges WHERE source_id IN ({placeholders}) OR target_id IN ({placeholders})",
            node_ids + node_ids,
        )
        edges = [dict(row) for row in cursor.fetchall()]

    conn.close()
    return {"success": True, "nodes": nodes, "edges": edges}


@app.get("/api/knowledge/paths")
async def get_knowledge_paths(source_id: int, target_id: int):
    """查询两个节点间的路径"""
    conn = get_db()
    cursor = conn.cursor()

    # 简单BFS路径查找
    cursor.execute("SELECT * FROM kg_edges")
    all_edges = cursor.fetchall()
    conn.close()

    # 构建邻接表
    from collections import defaultdict, deque
    graph = defaultdict(list)
    for edge in all_edges:
        graph[edge["source_id"]].append((edge["target_id"], edge["relation_type"]))
        graph[edge["target_id"]].append((edge["source_id"], edge["relation_type"]))

    # BFS
    visited = set()
    queue = deque([(source_id, [])])
    paths = []

    while queue and len(paths) < 5:
        node, path = queue.popleft()
        if node == target_id and path:
            paths.append(path)
            continue
        if node in visited:
            continue
        visited.add(node)
        for neighbor, relation in graph[node]:
            if neighbor not in visited:
                queue.append((neighbor, path + [{"from": node, "to": neighbor, "relation": relation}]))

    return {"success": True, "paths": paths, "count": len(paths)}


# ═══════════════════════════════════════════════════════════════
# 数据大屏统计
# ═══════════════════════════════════════════════════════════════

@app.get("/api/stats/dashboard")
async def get_dashboard_stats():
    """数据大屏统计"""
    conn = get_db()
    cursor = conn.cursor()

    stats = {}

    try:
        cursor.execute("SELECT COUNT(*) FROM research_sessions WHERE DATE(created_at) = DATE('now')")
        stats["today_sessions"] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM research_sessions")
        stats["total_sessions"] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM hypotheses")
        stats["total_hypotheses"] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM literature")
        stats["total_literature"] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM kg_nodes")
        stats["kg_nodes"] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM kg_edges")
        stats["kg_edges"] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM astro_data")
        stats["astro_records"] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM agent_logs")
        stats["agent_calls"] = cursor.fetchone()[0]
    except Exception:
        stats = {
            "today_sessions": 0, "total_sessions": 0, "total_hypotheses": 0,
            "total_literature": 0, "kg_nodes": 0, "kg_edges": 0,
            "astro_records": 0, "agent_calls": 0,
        }

    conn.close()
    return {"success": True, "stats": stats}


# ═══════════════════════════════════════════════════════════════
# Agent执行日志
# ═══════════════════════════════════════════════════════════════

@app.get("/api/agent/logs")
async def get_agent_logs(limit: int = 50):
    """获取Agent执行日志"""
    orchestrator = get_orchestrator()
    logs = orchestrator.get_logs()[-limit:]
    return {"success": True, "logs": logs}


# ═══════════════════════════════════════════════════════════════
# Mock响应（Ollama离线时降级）
# ═══════════════════════════════════════════════════════════════

def _get_mock_response(messages: list[dict]) -> str:
    """当Ollama不可用时返回Mock响应"""
    last_msg = messages[-1]["content"] if messages else ""
    return f"""[Mock模式 — Ollama服务未连接]

收到您的问题："{last_msg[:100]}..."

当前系统处于离线演示模式。要获得完整AI推理能力，请确保：
1. Ollama服务已启动：`ollama serve`
2. 模型已下载：`ollama pull qwen2.5:7b`
3. 服务地址配置正确：OLLAMA_HOST=http://localhost:11434

系统架构已就绪，连接Ollama后即可正常使用全部功能。"""


def _get_mock_agent_response(stage: str, input_text: str) -> str:
    """Agent离线Mock响应"""
    stage_labels = {
        "question": "问题理解",
        "literature": "文献综述",
        "hypothesis": "假设生成",
        "experiment": "实验设计",
        "evaluation": "评估验证",
    }
    label = stage_labels.get(stage, stage)
    return f"""[Mock模式 — {label}Agent]

已接收输入（{len(input_text)}字符）。

当前Ollama推理引擎未连接，系统以演示模式运行。
连接本地模型后，此Agent将执行完整的{label}分析流程。

---
系统状态：架构就绪，等待模型连接。"""


# ═══════════════════════════════════════════════════════════════
# 前端静态资源内嵌（单端口一体化部署：后端同源托管 React 构建产物）
# ═══════════════════════════════════════════════════════════════
# 将 frontend/dist 内嵌至 FastAPI，使前后端在同一源(默认 :8000)运行，
# 前端 axios baseURL='/api' 直接命中同源后端，无需 Vite 代理，
# 实现「真实前后端本地部署内嵌至软件、可视化本地操作」。

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from config import PROJECT_ROOT
_DIST_DIR = os.path.join(PROJECT_ROOT, "frontend", "dist")
_INDEX_HTML = os.path.join(_DIST_DIR, "index.html")
# 不被 SPA 兜底路由拦截的路径前缀（后端自有端点）
_RESERVED_PREFIXES = ("api", "health", "docs", "redoc", "openapi.json")

if os.path.isdir(_DIST_DIR) and os.path.isfile(_INDEX_HTML):
    # 挂载构建产物的静态资源目录（JS/CSS/图片等，带哈希指纹）
    _assets_dir = os.path.join(_DIST_DIR, "assets")
    if os.path.isdir(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    @app.get("/", include_in_schema=False)
    async def _serve_spa_root():
        """根路径返回单页应用入口。"""
        return FileResponse(_INDEX_HTML)

    @app.get("/{full_path:path}", include_in_schema=False)
    async def _serve_spa(full_path: str):
        """SPA 兜底：命中真实静态文件则返回文件，否则回退 index.html。

        支持 BrowserRouter 深链接（如 /dashboard、/research/question）刷新不 404；
        同时不拦截 /api、/health、/docs 等后端端点（由前缀白名单排除）。
        """
        if full_path.startswith(_RESERVED_PREFIXES):
            # 交回 FastAPI 既有路由处理（理论上不会到达此处，防御性放行）
            return FileResponse(_INDEX_HTML)
        # 若请求的是 dist 下真实存在的文件（如 favicon.ico、vite.svg），直接返回
        candidate = os.path.normpath(os.path.join(_DIST_DIR, full_path))
        if (candidate.startswith(_DIST_DIR) and os.path.isfile(candidate)):
            return FileResponse(candidate)
        # 其余一律回退到 index.html，由前端路由接管
        return FileResponse(_INDEX_HTML)

    logger.info(f"🎨 前端已内嵌托管: {_DIST_DIR} → http://localhost:8000")
else:
    logger.warning(
        "⚠️ 未检测到前端构建产物 frontend/dist，单端口内嵌模式不可用。"
        "请先执行: cd frontend && npm install && npm run build"
    )


# ═══════════════════════════════════════════════════════════════
# 主入口
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
