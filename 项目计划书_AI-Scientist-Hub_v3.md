# 基于国产开源大模型的AI Scientist科研智能平台
## ——项目计划书（全内嵌架构·一键打包版 v3.0）

---

## 版本说明

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| v1.0 | 2026-07-11 | 初始项目计划书，基于百炼API外部调用架构 |
| v2.0 | 2026-07-12 | 新增龙虾复现提示词完整流程、各阶段预期效果、应用技术详解、完善方向、不足分析、一等奖评审标准深度分析 |
| **v3.0** | **2026-07-28** | **架构重构：全部能力内部内嵌 + 一键打包部署（Docker Compose）。核心变更：百炼API→本地Ollama+Qwen、EdgeOne→FastAPI内嵌服务、KV Storage→SQLite、外部数据→预打包数据集** |

---

## 一、项目概述

### 1.1 项目定位
将现有的 **Academic-Web** 全面升级为 **AI-Scientist Hub（全内嵌版）**，基于**本地部署的千问（Qwen）开源大模型**（通过 Ollama 框架），构建**零外部依赖、一键打包部署**的多智能体科研系统。所有AI推理、数据存储、知识图谱、科学数据能力均内嵌于单一容器中，开箱即用。

### 1.2 架构设计理念：「内嵌优先」

| 维度 | v2.0 外部依赖架构 | **v3.0 全内嵌架构** | 优势 |
|------|------------------|---------------------|------|
| **AI推理** | 阿里云百炼API（网络+付费） | **本地Ollama + Qwen2.5**（离线+免费） | 零网络依赖、零API成本、数据不出本地 |
| **数据存储** | EdgeOne KV Storage（云端） | **SQLite + 本地文件系统**（内嵌） | 零外部依赖、轻量便携、可移植 |
| **文献数据** | 实时检索arXiv/ADS/NADC | **预下载数据集 + 本地检索** | 离线可用、检索速度恒定、无网络抖动 |
| **天文数据** | 调用NADC在线API | **预打包CSV + 内嵌分析引擎** | 数据完整性可控、无API限流 |
| **知识图谱** | 外部图数据库 | **SQLite + 内存图引擎** | 零额外服务、启动即就绪 |
| **部署方式** | EdgeOne Pages（需账号） | **Docker Compose 一键启动** | 任何机器可运行、可复制、可携带 |

### 1.3 核心目标
构建一个**完全内嵌、无需外部网络、一键打包部署**的AI Scientist平台：
```
科学问题输入 → 本地知识图谱检索 → 本地文献证据整合 → 本地模型生成假设 → 
可验证性评估 → 研究计划设计 → 实验任务规划 → 本地数据验证 → 假设迭代优化 → 最终输出

全流程零外部API调用，所有能力内嵌于单一Docker容器或Electron包中
```

### 1.4 参赛赛道
**赛道一：科学问题 — 方向一：科学假设生成与研究计划设计**

---

## 二、全内嵌系统架构

### 2.1 内嵌架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AI-Scientist Hub（全内嵌·一键打包）                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         前端层（React 18 + Vite）                    │   │
│  │  - 问题理解界面  - 文献综述界面  - 假设生成界面  - 研究计划界面         │   │
│  │  - 迭代优化界面  - 天文数据界面  - 知识图谱界面  - 数据大屏界面         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                       │
│                                    ▼ HTTP/WS                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     后端服务层（FastAPI + Python 3.11）               │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │ 模型推理服务  │  │ 多智能体编排  │  │ 数据管理服务  │              │   │
│  │  │ (LLMEngine)  │  │ (AgentHub)   │  │ (DataManager)│              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │ 文献检索服务  │  │ 知识图谱引擎  │  │ RAG检索引擎   │              │   │
│  │  │ (DocSearch)  │  │ (GraphEngine)│  │ (RAGEngine)  │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                       │
│                                    ▼ 本地IPC/文件系统                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      内嵌能力层（本地部署·零外部依赖）                  │   │
│  │                                                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │   │
│  │  │ Ollama服务   │  │ SQLite数据库 │  │ 向量索引(FAISS│  │ 预打包数据 │ │   │
│  │  │ Qwen2.5-14B │  │ 用户/文献/  │  │ /HNSWLib)   │  │ 集(天文CSV │ │   │
│  │  │ Qwen2.5-7B  │  │ 图谱/会话   │  │             │  │ /arXiv摘要)│ │   │
│  │  │ Qwen2.5-Coder│  │ 数据/配置   │  │             │  │            │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘ │   │
│  │                                                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │   │
│  │  │ 内嵌PDF解析  │  │ 内嵌代码执行 │  │ 内嵌Markdown │                │   │
│  │  │ (PyPDF2/pdf │  │ (受限Python │  │ 渲染/公式   │                │   │
│  │  │ plumber)    │  │ 沙箱)       │  │ (KaTeX)     │                │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 内嵌AI推理引擎（核心变更）

**技术选型：Ollama + Qwen2.5 开源模型**

| 模型角色 | 模型名称 | 参数量 | 用途 | 内存需求 |
|---------|---------|--------|------|---------|
| 主推理模型 | Qwen2.5-14B-Instruct | 14B | 假设生成、文献分析、评估 | ≥16GB RAM |
| 辅助推理模型 | Qwen2.5-7B-Instruct | 7B | 快速响应、简单查询、前端交互 | ≥8GB RAM |
| 代码生成 | Qwen2.5-Coder-14B | 14B | 实验代码生成、数据分析脚本 | ≥16GB RAM |
| 多模态 | Qwen2.5-VL-7B | 7B | 图表理解、数据可视化辅助 | ≥8GB RAM |

**Ollama 配置（内嵌）**：
```yaml
# docker-compose.yml 中的 Ollama 服务
services:
  ollama:
    image: ollama/ollama:latest
    volumes:
      - ./models:/root/.ollama  # 模型权重预下载到本地
      - ./ollama-entrypoint.sh:/entrypoint.sh
    environment:
      - OLLAMA_KEEP_ALIVE=24h
      - OLLAMA_NUM_PARALLEL=2
      - OLLAMA_MAX_LOADED_MODELS=2
    # 模型预加载：启动时自动加载Qwen2.5-14B和Qwen2.5-Coder-14B
```

**本地推理API封装（FastAPI）**：
```python
# backend/llm_engine.py
from typing import AsyncGenerator
import aiohttp

class LocalLLMEngine:
    """本地Ollama推理引擎 — 零外部依赖"""
    
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url
        self.models = {
            "reasoning": "qwen2.5:14b",
            "general": "qwen2.5:7b", 
            "coding": "qwen2.5-coder:14b",
            "multimodal": "qwen2.5-vl:7b"
        }
    
    async def chat(self, model: str, messages: list, stream: bool = False) -> dict:
        """调用本地Ollama进行推理"""
        payload = {
            "model": self.models.get(model, model),
            "messages": messages,
            "stream": stream,
            "options": {
                "temperature": 0.7,
                "num_ctx": 32768,  # 32K上下文
                "num_predict": 4096
            }
        }
        # 直接与本地Ollama通信，无需网络出口
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{self.base_url}/api/chat", json=payload) as resp:
                return await resp.json()
```

### 2.3 内嵌数据层（零外部存储）

**SQLite 数据库设计**：
```sql
-- database/schema.sql
-- 单一SQLite文件存储全部数据，随容器一起打包

-- 用户表
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 研究会话表
CREATE TABLE research_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    title TEXT NOT NULL,
    question TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending','running','paused','completed','archived')),
    progress INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 文献表（预填充公开数据集）
CREATE TABLE literature (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    arxiv_id TEXT,
    title TEXT NOT NULL,
    authors TEXT,
    abstract TEXT,
    published_date DATE,
    doi TEXT,
    pdf_path TEXT,  -- 本地存储路径
    embedding BLOB, -- 向量嵌入（128维float32序列化）
    category TEXT,  -- astro-ph.SR / astro-ph.EP 等
    citations INTEGER DEFAULT 0,
    is_preloaded INTEGER DEFAULT 0  -- 1=预打包数据，0=用户上传
);

-- 知识图谱节点表
CREATE TABLE kg_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    type TEXT CHECK(type IN ('天体对象','物理概念','观测设备','科学方法','数据产品','研究机构')),
    properties TEXT,  -- JSON
    embedding BLOB
);

-- 知识图谱关系表
CREATE TABLE kg_edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER REFERENCES kg_nodes(id),
    target_id INTEGER REFERENCES kg_nodes(id),
    relation_type TEXT CHECK(relation_type IN ('观测关系','因果关系','分类关系','方法关系','数据关系','演化关系')),
    confidence REAL DEFAULT 1.0,
    evidence TEXT
);

-- 天文数据表（预填充公开数据集）
CREATE TABLE astro_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_source TEXT CHECK(data_source IN ('JW-SSD','JW-FD','TESS','SIMULATED')),
    obs_time TIMESTAMP,
    noaa_number TEXT,
    magnetic_type TEXT,
    shear_angle REAL,
    twist_degree REAL,
    magnetic_gradient REAL,
    flare_class TEXT,
    raw_data_path TEXT,
    metadata TEXT  -- JSON
);

-- 假设表
CREATE TABLE hypotheses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER REFERENCES research_sessions(id),
    version INTEGER DEFAULT 1,
    statement TEXT NOT NULL,
    novelty_score REAL,
    verifiability_score REAL,
    evidence_score REAL,
    logic_consistency REAL,
    overall_score REAL,
    status TEXT DEFAULT 'draft',
    generated_by TEXT,  -- Agent名称
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent执行日志表
CREATE TABLE agent_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    agent_name TEXT,
    action TEXT,
    input_summary TEXT,
    output_summary TEXT,
    latency_ms INTEGER,
    model_used TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.4 内嵌RAG检索引擎

**技术选型：FAISS + Sentence-Transformers（本地向量检索）**

```python
# backend/rag_engine.py
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

class LocalRAGEngine:
    """本地RAG检索引擎 — 零外部依赖"""
    
    def __init__(self, db_path: str = "./data/ai_scientist.db"):
        # 本地Embedding模型（bge-small-zh-v1.5，约130MB）
        self.embedder = SentenceTransformer(
            'BAAI/bge-small-zh-v1.5',
            cache_folder='./models/embeddings'
        )
        self.index = self._build_faiss_index()
    
    def _build_faiss_index(self) -> faiss.Index:
        """从SQLite构建FAISS向量索引"""
        # 加载所有预嵌入文献
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute("SELECT id, embedding FROM literature WHERE embedding IS NOT NULL")
        
        ids = []
        embeddings = []
        for row in cursor:
            ids.append(row[0])
            embeddings.append(np.frombuffer(row[1], dtype=np.float32))
        
        # 构建FAISS索引（IVF-FLAT，检索速度<100ms@10K文档）
        dim = len(embeddings[0])
        index = faiss.IndexFlatIP(dim)  # 内积相似度
        index.add(np.array(embeddings))
        
        self.id_map = {i: doc_id for i, doc_id in enumerate(ids)}
        return index
    
    def search(self, query: str, top_k: int = 10) -> list[dict]:
        """本地向量检索，零网络延迟"""
        query_vec = self.embedder.encode([query], convert_to_numpy=True)
        distances, indices = self.index.search(query_vec, top_k)
        
        results = []
        for idx, dist in zip(indices[0], distances[0]):
            doc_id = self.id_map.get(idx)
            if doc_id:
                results.append({"id": doc_id, "score": float(dist)})
        return results
```

### 2.5 预打包数据集

**数据集清单（随容器一起分发）**：

| 数据集 | 来源 | 大小 | 格式 | 用途 |
|--------|------|------|------|------|
| arXiv天文摘要 | arXiv astro-ph.* (2020-2025) | ~200MB | SQLite | 文献检索、RAG语料 |
| JW-SSD太阳黑子 | 国家天文台公开数据 | ~50MB | CSV/SQLite | 太阳物理数据分析 |
| TESS光变曲线样本 | MAST公开档案 | ~100MB | CSV/FITS | 恒星/系外行星分析 |
| 天文知识图谱种子 | 手工构建+DBpedia抽取 | ~10MB | SQLite | 知识推理、证据链 |
| Qwen2.5-14B权重 | 魔搭社区/ModelScope | ~9GB | GGUF | 本地推理 |
| Qwen2.5-Coder-14B | 魔搭社区/ModelScope | ~9GB | GGUF | 代码生成 |
| Embedding模型 | BAAI/bge-small-zh-v1.5 | ~130MB | ONNX/PyTorch | 向量编码 |

**数据集打包策略**：
```dockerfile
# Dockerfile.data — 数据集层（单独构建以加速迭代）
FROM alpine:3.19 AS data-builder

WORKDIR /data

# 预下载的数据集文件
COPY datasets/arxiv_astroph_2020_2025.db ./
COPY datasets/jw_ssd_sunspot.csv ./
COPY datasets/tess_lightcurves_sample/ ./
COPY datasets/astronomy_kg_seed.json ./

# 数据验证
RUN echo "数据集完整性校验..." && \
    ls -lh . && \
    echo "总大小:" && du -sh .

FROM scratch AS data-layer
COPY --from=data-builder /data /
```

---

## 三、打包方案设计

### 3.1 Docker Compose 一键部署（推荐方案）

**设计目标**：单条命令启动完整系统，无需任何外部配置。

```yaml
# docker-compose.yml
version: "3.9"

services:
  # ── 前端服务 ──
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - backend
    networks:
      - ai-scientist-net

  # ── 后端API服务 ──
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - sqlite-data:/app/data
      - ./models:/app/models:ro
    environment:
      - DATABASE_URL=sqlite:///data/ai_scientist.db
      - OLLAMA_HOST=http://ollama:11434
      - MODEL_REASONING=qwen2.5:14b
      - MODEL_CODING=qwen2.5-coder:14b
      - MODEL_GENERAL=qwen2.5:7b
    depends_on:
      - ollama
    networks:
      - ai-scientist-net

  # ── Ollama模型服务 ──
  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama-models:/root/.ollama
      - ./scripts/ollama-pull-models.sh:/entrypoint.d/pull-models.sh:ro
    environment:
      - OLLAMA_KEEP_ALIVE=24h
      - OLLAMA_NUM_PARALLEL=2
      - OLLAMA_MAX_LOADED_MODELS=2
      - OLLAMA_FLASH_ATTENTION=1
    deploy:
      resources:
        limits:
          memory: 24G
        reservations:
          memory: 16G
    networks:
      - ai-scientist-net

  # ── 可选：Web界面管理Ollama ──
  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    ports:
      - "8080:8080"
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434
    depends_on:
      - ollama
    networks:
      - ai-scientist-net

volumes:
  sqlite-data:
  ollama-models:

networks:
  ai-scientist-net:
    driver: bridge
```

**启动命令**：
```bash
# 克隆仓库
git clone https://github.com/zixilee666-svg/Academic-Web.git
cd Academic-Web

# 一键启动（首次运行会自动拉取模型、初始化数据库）
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f backend

# 访问系统
open http://localhost:3000      # 主应用
open http://localhost:8000/docs # API文档（Swagger UI）
open http://localhost:8080      # Ollama管理界面
```

### 3.2 Electron桌面应用打包（备选方案）

**设计目标**：双击`.exe`或`.app`即可运行，无需Docker。

```
ai-scientist-hub-desktop/
├── package.json              # Electron + Vite
├── electron/
│   ├── main.ts               # 主进程
│   └── preload.ts            # 预加载脚本
├── src/                      # React前端代码
├── backend/                  # Python后端（PyInstaller打包）
│   └── dist/
│       └── ai_scientist_backend.exe  # 独立可执行文件
├── models/                   # 模型权重（按需下载）
│   └── qwen2.5-7b/           # 默认使用7B以减小体积
├── data/
│   └── ai_scientist.db       # SQLite数据库
└── scripts/
    └── first-run-setup.js    # 首次运行：下载模型、初始化数据
```

**Electron主进程（模型管理）**：
```typescript
// electron/main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn } from 'child_process';

class DesktopApp {
  private backendProcess: any;
  private ollamaProcess: any;

  async start() {
    // 1. 启动Ollama本地服务
    this.ollamaProcess = spawn('ollama', ['serve'], {
      env: { ...process.env, OLLAMA_MODELS: app.getPath('userData') + '/models' }
    });

    // 2. 启动Python后端（PyInstaller打包的可执行文件）
    const backendPath = app.isPackaged 
      ? path.join(process.resourcesPath, 'backend', 'ai_scientist_backend.exe')
      : path.join(__dirname, '../backend/dist/ai_scientist_backend.exe');
    
    this.backendProcess = spawn(backendPath, [], {
      env: { 
        DATABASE_URL: `sqlite:///${app.getPath('userData')}/ai_scientist.db`,
        OLLAMA_HOST: 'http://localhost:11434'
      }
    });

    // 3. 创建窗口
    const win = new BrowserWindow({
      width: 1440,
      height: 900,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js')
      }
    });

    // 4. 加载前端（生产环境加载打包后的静态文件）
    if (app.isPackaged) {
      win.loadFile(path.join(__dirname, '../dist/index.html'));
    } else {
      win.loadURL('http://localhost:5173');
    }

    // 5. 首次运行检查模型
    ipcMain.handle('check-models', async () => {
      const required = ['qwen2.5:7b', 'qwen2.5-coder:7b'];
      const missing = [];
      for (const model of required) {
        const exists = await this.checkModelExists(model);
        if (!exists) missing.push(model);
      }
      return { missing, allReady: missing.length === 0 };
    });

    // 6. 模型下载进度
    ipcMain.handle('download-model', async (_, model: string) => {
      return new Promise((resolve) => {
        const pull = spawn('ollama', ['pull', model]);
        pull.stdout.on('data', (data) => {
          win.webContents.send('model-download-progress', { model, log: data.toString() });
        });
        pull.on('close', (code) => resolve({ success: code === 0 }));
      });
    });
  }
}
```

### 3.3 模型预下载与缓存策略

**首次启动流程**：
```bash
# scripts/setup.sh — 首次启动初始化脚本
#!/bin/bash
set -e

echo "🧠 AI-Scientist Hub 初始化中..."

# 1. 检查Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker Desktop"
    exit 1
fi

# 2. 创建数据目录
mkdir -p ./data ./models

# 3. 检查模型权重是否存在
if [ ! -d "./models/qwen2.5-14b" ]; then
    echo "📥 下载Qwen2.5-14B模型（约9GB，首次下载需要时间）..."
    docker run --rm -v ./models:/models ollama/ollama \
        sh -c "ollama pull qwen2.5:14b && cp -r /root/.ollama/models/* /models/"
fi

# 4. 初始化SQLite数据库
if [ ! -f "./data/ai_scientist.db" ]; then
    echo "🗄️ 初始化数据库..."
    sqlite3 ./data/ai_scientist.db < ./database/schema.sql
    echo "📚 导入预打包数据集..."
    python ./scripts/import_datasets.py
fi

# 5. 启动服务
echo "🚀 启动服务..."
docker-compose up -d

echo "✅ 初始化完成！"
echo "   主应用: http://localhost:3000"
echo "   API文档: http://localhost:8000/docs"
```

### 3.4 离线运行模式

**核心设计：100%离线可用**

```python
# backend/config.py
from enum import Enum

class RunMode(Enum):
    OFFLINE = "offline"      # 完全离线，所有能力内嵌
    ONLINE = "online"        # 可选联网增强（文献检索、数据更新）

class AppConfig:
    """应用配置 — 默认离线模式"""
    
    MODE: RunMode = RunMode.OFFLINE
    
    # 模型配置
    MODELS = {
        "reasoning": "qwen2.5:14b",
        "general": "qwen2.5:7b",
        "coding": "qwen2.5-coder:14b"
    }
    
    # 数据路径（全部本地）
    DATABASE_PATH = "./data/ai_scientist.db"
    DATASETS_PATH = "./datasets"
    MODELS_PATH = "./models"
    
    # RAG配置
    RAG_TOP_K = 10
    RAG_SCORE_THRESHOLD = 0.75
    
    # 离线模式检查
    @classmethod
    def is_offline(cls) -> bool:
        return cls.MODE == RunMode.OFFLINE
    
    @classmethod
    def validate_offline_readiness(cls) -> dict:
        """验证离线运行条件"""
        checks = {
            "ollama_running": check_ollama_health(),
            "models_downloaded": check_models_exist(),
            "database_initialized": check_database_exists(),
            "datasets_loaded": check_datasets_loaded(),
            "rag_index_built": check_faiss_index_exists()
        }
        checks["all_ready"] = all(checks.values())
        return checks
```

---

## 四、技术实现路线图（内嵌版）

### Phase 1：内嵌基础架构（第1-2周）

| 子任务ID | 名称 | 核心变更点 | 验收标准 |
|---------|------|-----------|---------|
| P1-T1 | 项目初始化与Docker环境 | 创建docker-compose.yml、Dockerfile、.dockerignore | `docker-compose build` 成功 |
| P1-T2 | Ollama本地模型服务 | 配置Ollama容器、编写模型拉取脚本、测试本地推理 | `ollama run qwen2.5:7b "你好"` 返回中文 |
| P1-T3 | FastAPI后端骨架 | 创建backend/目录、配置SQLite、设计API路由 | `http://localhost:8000/health` 返回200 |
| P1-T4 | 本地LLM引擎封装 | 封装Ollama调用、实现chat/completion/stream接口 | 本地推理延迟<5s（7B模型） |
| P1-T5 | SQLite数据库初始化 | 执行schema.sql、创建所有表、验证外键约束 | 所有表存在且结构正确 |
| P1-T6 | 前端对接本地API | 将axios baseURL改为localhost:8000、移除百炼相关代码 | 前端可调用本地后端接口 |

### Phase 2：内嵌核心智能体（第3-4周）

| 子任务ID | 名称 | 核心变更点 | 验收标准 |
|---------|------|-----------|---------|
| P2-T1 | 本地文献整合Agent | 使用本地SQLite+预打包arXiv数据、本地RAG检索 | 检索1000篇文献<1s |
| P2-T2 | 本地假设生成Agent | 调用本地qwen2.5:14b、结构化输出、自一致性投票 | 单次假设生成<30s |
| P2-T3 | 本地实验规划Agent | 调用本地qwen2.5-coder:14b、代码沙箱执行 | 生成Python代码可运行 |
| P2-T4 | 本地评估验证Agent | 多维度评分、反思迭代、版本管理 | 支持v1→v2→v3迭代 |
| P2-T5 | 多智能体编排器 | 本地FSM状态机、Agent间消息传递（SQLite队列） | 完整闭环<3分钟 |
| P2-T6 | 数据预打包脚本 | 编写import_datasets.py、导入arXiv/TESS/图谱数据 | 数据库有>1000条文献记录 |

### Phase 3：内嵌前端界面（第5-6周）

与v2.0保持一致，但API端点改为本地。

### Phase 4：内嵌数据与图谱（第7-8周）

| 子任务ID | 名称 | 核心变更点 |
|---------|------|-----------|
| P4-T1 | 天文数据浏览器 | 从本地SQLite读取、不再调用NADC API |
| P4-T2 | 本地知识图谱引擎 | SQLite + NetworkX内存图、支持路径发现 |
| P4-T3 | FAISS向量索引构建 | 从SQLite文献embedding构建本地索引 |
| P4-T4 | 数据大屏（本地统计） | 从本地数据库聚合、无外部计数器 |

### Phase 5：内嵌拓展功能（第9-10周）

| 子任务ID | 名称 | 核心变更点 |
|---------|------|-----------|
| P5-T1 | AI数字分身（本地） | 用户画像存储在SQLite、本地模型个性化 |
| P5-T2 | 科学传播可视化 | html-to-image导出PNG（纯前端，无需外部服务） |
| P5-T3 | 跨学科融合（本地） | 本地知识图谱桥接、本地模型迁移 |

### Phase 6：打包与优化（第11-12周）

| 子任务ID | 名称 | 核心产出 |
|---------|------|---------|
| P6-T1 | Docker镜像优化 | 多阶段构建、层缓存、最终镜像<5GB |
| P6-T2 | 离线运行验证 | 断网环境下完整测试所有功能 |
| P6-T3 | 一键安装包 | 制作install.sh（Linux/Mac）和install.ps1（Windows） |
| P6-T4 | 演示视频 | 展示"无网络→一键启动→完整科研闭环"的震撼流程 |
| P6-T5 | 技术方案文档 | 强调内嵌架构优势：可控、安全、便携、零依赖 |
| P6-T6 | 开源发布 | GitHub发布release、提供预构建镜像 |

---

## 五、内嵌架构优势与比赛加分点

### 5.1 相比v2.0（外部API架构）的核心优势

| 优势维度 | 具体体现 | 比赛加分 |
|---------|---------|---------|
| **国产可控** | 模型权重本地存储、推理过程完全本地、无数据出境 | 直接响应"科技自立自强"政策导向 |
| **离线可用** | 无需网络即可运行全部功能，适合涉密/偏远场景 | 展示真实应用场景广度 |
| **零运营成本** | 无API调用费用、无云服务费用、无流量费用 | 可持续运行，易于推广 |
| **数据隐私** | 科研数据不上传云端、假设内容不经过第三方 | 解决科研敏感数据痛点 |
| **确定性演示** | 答辩现场无需担心API限流/网络抖动/模型降级 | 现场演示100%成功保障 |
| **可携带** | 单Docker镜像可复制到任意机器、U盘携带 | 展示工程化成熟度 |

### 5.2 比赛现场演示优势

**痛点场景**：往年比赛现场，依赖外部API的团队常遇到：
- 会场WiFi不稳定 → API调用失败 → 演示卡顿
- 百炼API临时限流 → 模型无响应 → 冷场
- 网络延迟高 → 每次推理10秒+ → 评委耐心耗尽

**v3.0解决方案**：
```
演示前：docker-compose up -d（30秒启动）
演示中：所有推理本地完成，延迟<3秒，零网络波动
答辩时：可强调"即使在无网络环境下，系统依然完整可用"
```

### 5.3 技术文档加分表述

**在20页技术方案中，用1整页阐述内嵌架构优势**：

> **「全内嵌架构设计」** — 区别于大多数依赖云端API的AI应用，本项目采用**全内嵌架构**：Qwen2.5开源模型通过Ollama本地部署，SQLite替代云端数据库，FAISS实现本地向量检索，预打包公开数据集确保离线可用。这一设计不仅实现了**零外部依赖、零运营成本、100%数据隐私保护**，更使得系统在**无网络环境下仍可完整运行**，适用于涉密科研、野外观测、偏远地区等场景。系统通过Docker Compose一键部署，单条命令即可启动完整服务，体现了高度的工程化成熟度。

---

## 六、风险与应对（内嵌版）

| 风险 | 影响 | 应对方案 |
|------|------|---------|
| 本地模型推理速度慢 | 高 | 默认使用7B模型保证速度、14B用于关键任务、支持GPU加速（CUDA/ROCm） |
| 模型权重体积大（~18GB） | 中 | 提供7B轻量版镜像、模型按需下载、支持增量更新 |
| 本地embedding质量 | 中 | 使用bge-small-zh-v1.5（SOTA中文embedding）、支持切换更大型号 |
| 预打包数据集过时 | 低 | 提供在线更新脚本（可选）、核心数据集覆盖2020-2025已足够 |
| Docker环境不兼容 | 中 | 提供纯Python启动方式（无Docker）、提供Windows/Mac原生安装包 |
| 内存不足（<16GB） | 高 | 7B模型仅需8GB、提供内存优化指南、支持模型量化（INT4/INT8） |

---

## 七、立即行动清单（内嵌版·未来2周）

### P0级行动（本周必须完成）

| 序号 | 行动项 | 负责人 | 截止日期 | 验收标准 |
|------|--------|--------|---------|---------|
| 1 | 安装Docker Desktop，验证docker-compose可用 | 全员 | 立即 | `docker --version` 和 `docker-compose --version` 有输出 |
| 2 | 本地测试Ollama运行Qwen2.5-7B | 技术负责人 | 第3天 | `ollama run qwen2.5:7b` 成功对话 |
| 3 | 创建backend/目录，搭建FastAPI骨架 | 后端开发 | 第5天 | `uvicorn main:app --reload` 启动成功，/health返回200 |
| 4 | 设计SQLite数据库schema | 后端开发 | 第5天 | schema.sql通过验证，所有表结构正确 |
| 5 | 编写docker-compose.yml（frontend+backend+ollama） | 技术负责人 | 第7天 | `docker-compose up -d` 三个服务全部Running |
| 6 | 下载公开arXiv天文摘要数据集 | 数据负责人 | 第7天 | 本地存有>1000条带摘要的文献记录（CSV或JSON） |
| 7 | 编写模型预下载脚本（ollama-pull-models.sh） | 技术负责人 | 第7天 | 脚本可自动拉取qwen2.5:7b和qwen2.5-coder:7b |

### P1级行动（第2周）

| 序号 | 行动项 | 负责人 | 截止日期 | 验收标准 |
|------|--------|--------|---------|---------|
| 8 | 实现本地LLMEngine（封装Ollama调用） | 后端开发 | 第10天 | Python脚本可调用本地模型生成假设 |
| 9 | 实现SQLite数据导入脚本 | 后端开发 | 第10天 | 文献数据导入成功，SELECT COUNT(*)>1000 |
| 10 | 构建FAISS向量索引 | 后端开发 | 第12天 | 向量检索Top-10<500ms |
| 11 | 前端移除百炼API代码，对接本地FastAPI | 前端开发 | 第12天 | 前端页面可显示本地模型返回的假设 |
| 12 | 编写install.sh和README（内嵌架构版） | 技术负责人 | 第14天 | 新成员可按README完成从零到运行 |
| 13 | 断网环境下完整测试 | 全员 | 第14天 | 关闭WiFi后所有核心功能正常运行 |

---

## 八、v3.0 配套文件清单

| 文件 | 路径 | 说明 |
|------|------|------|
| 项目计划书v3.0 | `项目计划书_AI-Scientist-Hub_v3.md` | 本文件 |
| Docker Compose配置 | `docker-compose.yml` | 一键部署 |
| 后端Dockerfile | `backend/Dockerfile` | FastAPI服务镜像 |
| 前端Dockerfile | `frontend/Dockerfile` | Nginx静态服务镜像 |
| 数据库Schema | `database/schema.sql` | SQLite表结构 |
| 数据导入脚本 | `scripts/import_datasets.py` | 预打包数据导入 |
| 模型拉取脚本 | `scripts/ollama-pull-models.sh` | Ollama模型预下载 |
| 安装脚本 | `scripts/install.sh` / `install.ps1` | 一键安装 |
| 离线验证脚本 | `scripts/verify-offline.py` | 断网环境自检 |

---

*本计划书 v3.0（全内嵌·一键打包版）由AI-Scientist Hub项目团队编制*
*版本：v3.0 | 日期：2026年7月28日*
*核心变更：百炼API→本地Ollama / EdgeOne→Docker Compose / KV Storage→SQLite*
