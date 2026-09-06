# Academic Joan of Arc — 全内嵌科研智能平台

> **基于国产开源大模型（Qwen2.5）的AI Scientist科研智能平台**
> **参赛赛道**：挑战杯"揭榜挂帅" XH-202619 | 赛道一：科学假设生成与研究计划设计

---

## 项目简介

Academic Joan of Arc 是一个基于国产开源大模型（千问 Qwen）的 AI Scientist 科研智能平台，通过多智能体协作实现从科学问题输入到可验证假设输出的完整科研闭环。

**双推理引擎（满足比赛硬性要求「通过阿里云百炼平台调用千问」）：**
- **阿里云百炼（DashScope）引擎** —— 正式提交/评审模式：`LLM_PROVIDER=bailian`，通过百炼平台 OpenAI 兼容接口调用 **Qwen-Max / Qwen-Plus / Qwen-Turbo**，调用凭证由 `DASHSCOPE_API_KEY`（或 `BAILIAN_API_KEY`）提供，须附调用截图。
- **本地 Ollama 引擎** —— 离线演示模式：`LLM_PROVIDER=ollama`，使用本地 Qwen2.5 开源模型，零 API 费用、数据不出本地，支持断网运行。

```
科学问题输入 → 知识图谱/文献检索 → 文献证据整合 → 千问生成假设
    → 可验证性评估 → 《科学假设与研究计划》生成 → 实验任务规划 → 假设迭代优化 → 最终输出
```

核心差异化：双引擎热切换——百炼在线模式满足比赛合规与最强推理能力，Ollama 离线模式保障断网可演示；任一引擎不可用时自动降级为 Mock 模式，前端全流程不受影响。

---

## 六环节自迭代流水线（赛道一·方向1A 核心）

对应《赛道一-方向1A-科学假设生成与研究计划设计》提交模板，实现**问题理解→知识整合→候选假设生成→证据梳理→研究计划输出→反馈修正**六环节闭环，假设说明"从何而来、依据哪些事实/文献/数据、可能如何验证"，并通过多轮补料、评分、版本比较与人工反馈展示自迭代提升过程。

| 环节 | 模块 | 核心机制 | 对应模板 |
|------|------|---------|---------|
| M1 问题理解 | `pipeline/m1_question.py` | 四步结构化拆解；C级宏大题强制降维为可检验子问题 | P8 |
| M2 知识整合 | `pipeline/m2_evidence.py` | OpenAlex+Semantic Scholar 在线检索、本地KG/数据集、证据卡片三分类（fact/文献解释/模型推断）、冲突对标记、DOI 引用核验 | P9 |
| M3 假设生成 | `pipeline/m3_hypothesis.py` | 七要素统一表达 + 假设树搜索（移植 AI Scientist-v2 BFTS：父版本→修订子节点，version/depth 留痕） | P10 |
| M4 核验筛选 | `pipeline/m4_verify.py` | 六维核验（相关性/证据一致/引用核验/可检验性/区分度/新颖性）加权评分，shortlist/revise/reject 处置 | P11-12 |
| M5 研究计划 | `pipeline/m5_plan.py` | 五环节计划（预测/资源/步骤/结果判定表/停止条件）+ 可执行性自检 | P13-14 |
| M6 反馈编排 | `pipeline/m6_orchestrator.py` | 决策门（pass/revise/supplement/stop）+ 每轮版本快照 + 反馈路由 + 两轮迭代编排 | P15-17 |

**API（`/api/v2`）**：`questions`（125题题库）· `run`（创建并自迭代）· `iterate`（注入人工反馈续跑）· `runs/{id}`（完整状态）· `runs/{id}/versions`（版本对比）· `batch`+`batch/status`+`batch/report`（125题批量运行/进度/逐题报告导出，满足 C2 全量输出含失败题）。

**前端**：侧边栏「赛道一·方向1A」分组 → 125题总控台（分级筛选/单题运行/批量运行/进度条/逐题报告导出）· 迭代工作台（证据卡片三分类展示、假设树七要素卡片、六维评分、计划五环节、版本对比时间线、人工反馈注入）。

**模板硬约束映射**：C1 百炼调用凭证（双引擎 `LLM_PROVIDER=bailian`）· C2 125题逐题输出（批量运行器+报告）· C5 两轮真实迭代留存（`iteration_rounds` 快照）· C6 假设不表述为已验证结论（M3/M5 提示词铁律）· C7 同条件对照（批量运行器支持 `levels/q_numbers/force` 对照参数）。

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│  前端层 — React 18 + TypeScript + Vite 6 + Tailwind CSS         │
│  11个功能页面 · 深色太空主题 · SSE流式渲染 · 力导向图可视化       │
├─────────────────────────────────────────────────────────────────┤
│  后端层 — FastAPI + Python 3.11                                  │
│  JWT认证 · 多智能体编排 · SSE流式 · Mock降级 · 双推理引擎       │
├─────────────────────────────────────────────────────────────────┤
│  推理引擎层（可切换）                                           │
│  阿里云百炼 DashScope(Qwen-Max/Plus/Turbo) │ 本地Ollama(Qwen2.5) │
│  存储/数据层                                                     │
│  SQLite(11表+FTS5) · 预打包天文数据集 · 知识图谱种子           │
└─────────────────────────────────────────────────────────────────┘
```

### 多智能体系统

| Agent | 模型 | 职责 |
|-------|------|------|
| 文献整合者 | Qwen2.5-7B | 文献检索、证据提取、知识缺口识别 |
| 假设生成器 | Qwen2.5-14B | 生成可证伪假设、多维度评估 |
| 实验规划师 | Qwen2.5-Coder-7B | 实验方案设计、Python代码生成 |
| 评估验证官 | Qwen2.5-14B | 质量评分、偏差检测、反例搜索 |

### 比赛合规要点（XH-202619）

| 比赛要求 | 本项目实现 |
|----------|-----------|
| 基座模型必须基于千问（Qwen） | ✅ 双引擎均使用千问系列（百炼：Qwen-Max/Plus/Turbo；本地：Qwen2.5） |
| 须通过阿里云百炼平台调用模型 API | ✅ `BailianEngine` 经 DashScope OpenAI 兼容接口调用，凭证 `DASHSCOPE_API_KEY` |
| 提供调用凭证/截图 | ⚠️ 需人工配置 Key 后在百炼控制台截图（见 `交付-人工事项清单.md`） |
| 多智能体 / 超级智能体架构 | ✅ 4-Agent 流水线（文献/假设/实验/评估）+ 研究计划编排 |
| 《科学假设与研究计划》十大标准字段 | ✅ `/api/research/plan` 结构化输出（问题/思路/技术/数据集/标题/摘要/方法/实验/结果/参考文献） |
| 人在回路（智能体思辨） | ✅ 评估验证官多轮迭代 + 前端 IteratePage 反馈闭环 |

---

## 快速开始

### 环境要求

| 资源 | 最低（7B模式） | 推荐（14B模式） |
|------|---------------|----------------|
| 内存 | 8GB | 16GB+ |
| 磁盘 | 30GB | 50GB |
| 系统 | Windows 10+ / macOS 12+ / Linux | 同左 |
| Docker | Docker Desktop 4.0+ | 同左 |

### 方式零：一键启动（推荐 · 本地可视化操作）

前后端已一体化内嵌：后端 FastAPI 同源托管 React 构建产物（`frontend/dist`），**单端口 `:8000` 即可可视化操作全流程**，无需分别手动启动前后端、无需 Vite 代理。

**Windows 桌面一键启动**：双击桌面快捷方式「**AI科研平台**」（指向 `C:\jibang-aihub\start.bat`，图标 `app_icon.ico`）。启动器会自动：检查前端构建产物 → 检测 `:8000` 是否已有健康服务（有则复用）→ 启动后端 → 轮询 `/health` 就绪 → 自动打开浏览器 `http://localhost:8000`。关闭控制台窗口即停止服务。

```bash
# 等价命令行启动（任意平台）
python launcher.py
# 访问 http://localhost:8000 （前端 UI + /api 同源）
```

> 说明：项目位于中文路径 `揭榜`，为规避 Windows 下 `.bat/.lnk` 中文路径编码问题，已创建 ASCII 目录联接 `C:\jibang-aihub → D:\Users\Lenovo\Desktop\揭榜`，快捷方式经该联接启动。首次使用需已构建前端（`cd frontend && npm install && npm run build`），启动器会在 `dist` 缺失时自动构建。

> **图形化配置 API Key**：登录后进入侧边栏「系统设置」（`/settings`）即可切换引擎（阿里云百炼 / 本地 Ollama）、填写或更新 DashScope API Key、调整四类模型映射（推理/通用/代码/多模态）、发起「连接测试」实时查看延迟与示例回复，并设置个人主题与偏好模型。保存后配置**立即热生效**（重置推理引擎单例）并**自动写回项目根 `.env`**（原子写入 + 备份），无需手动编辑配置文件，重启后依然保留。

### 方式一：Docker Compose（推荐）

```bash
git clone https://github.com/zixilee666-svg/Academic-Web.git
cd Academic-Web
cp .env.example .env
docker-compose up -d
```

访问：主应用 http://localhost:3000 · API文档 http://localhost:8000/docs

### 方式二：本地开发

```bash
# 1. 初始化数据库（创建表结构 + 填充种子数据）
python scripts/init_database.py

# 2. 配置环境变量（后端启动时自动加载项目根目录 .env）
cp .env.example .env
# 编辑 .env：
#   比赛提交模式 → LLM_PROVIDER=bailian + DASHSCOPE_API_KEY=你的百炼API-KEY
#   离线演示模式 → LLM_PROVIDER=ollama

# 3. 启动后端
cd backend/app
pip install -r ../requirements.txt
uvicorn main:app --port 8000 --reload

# 4. 启动前端
cd frontend
npm install
npm run dev
# 访问 http://localhost:5173
```

> 注1：后端启动时自动加载项目根目录 `.env`（python-dotenv），无需手动 export 环境变量；`LLM_PROVIDER` 决定推理引擎，引擎不可用时自动降级 Mock。
> 注2：数据库路径智能解析——本地开发自动指向项目根 `data/ai_scientist.db`，Docker 内指向容器卷 `/app/data`，支持从任意工作目录启动。

### 演示账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |
| researcher | researcher123 | 研究员 |

---

## 项目结构

```
├── backend/                    # FastAPI后端
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # 主应用（API路由 + 生命周期管理）
│       ├── auth.py             # JWT认证模块（SHA-256哈希）
│       ├── agents.py           # 多智能体编排引擎（4 Agent + 研究计划生成）
│       ├── llm_engine.py       # 推理引擎工厂（Ollama / 百炼 切换）
│       └── bailian_engine.py   # 阿里云百炼(DashScope) 千问引擎（比赛合规）
│
├── frontend/                   # React前端
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── src/
│       ├── pages/              # 12个功能页面
│       ├── components/         # Layout, Sidebar, Navbar
│       ├── services/api.ts     # API调用层（Axios + SSE流式）
│       ├── stores/index.ts     # Zustand状态管理（auth/research/ui）
│       ├── types/index.ts      # TypeScript类型定义
│       └── utils/constants.ts  # Agent配置、模型映射、阶段定义
│
├── database/
│   └── schema.sql              # SQLite表结构（11张表 + FTS5全文索引）
│
├── data/
│   └── ai_scientist.db         # 运行时数据库（初始化后生成）
│
├── datasets/
│   └── astronomy_kg_seed.json  # 天文知识图谱种子（24节点/25关系）
│
├── scripts/
│   ├── init_database.py        # 数据库初始化 + 种子数据填充
│   ├── verify-offline.py       # 离线环境验证
│   ├── install.sh              # 一键安装（Linux/macOS）
│   └── ollama-pull-models.sh   # 模型自动下载
│
├── docker-compose.yml          # 一键部署（Ollama + FastAPI + Nginx）
├── .env.example                # 环境变量模板
└── .dockerignore
```

---

## 功能页面

| 页面 | 路由 | 功能 |
|------|------|------|
| 登录 | /login | JWT认证、注册、演示账号提示 |
| 工作台 | /dashboard | 指标总览、快捷入口、系统状态 |
| AI科研中心 | /ai-hub | 多Agent对话、全流程流水线、SSE流式 |
| 问题理解 | /research/question | 问题解析、实体抽取、可行性评估 |
| 文献综述 | /research/literature | 文献检索、证据图谱、知识缺口 |
| 假设生成 | /research/hypothesis | 候选假设卡片、雷达图评分、对比 |
| 研究计划 | /research/plan | 实验方案、甘特图、代码生成 |
| 迭代优化 | /research/iterate | 版本对比、偏差检测、反馈循环 |
| 天文数据 | /data/astronomy | JW-SSD数据表、筛选、统计、CSV导出 |
| 知识图谱 | /knowledge/graph | SVG力导向图、节点详情、关系类型 |
| 数据大屏 | /visualization/dashboard | 系统监控、架构图、Agent流水线 |
| 系统设置 | /settings | 引擎切换(百炼/Ollama)、API Key配置、模型映射、连接测试、实时状态、个人偏好 |

---

## API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| /health | GET | 健康检查（推理引擎百炼/Ollama + SQLite状态） |
| /api/auth/login | POST | 用户登录（返回JWT） |
| /api/auth/register | POST | 用户注册 |
| /api/auth/me | GET | 当前用户信息 |
| /api/chat | POST | LLM对话（OpenAI兼容格式，支持流式） |
| /api/research/run-agent | POST | 运行单个研究Agent |
| /api/research/run-agent-stream | POST | 流式运行Agent（SSE） |
| /api/research/hypothesis | POST | 生成科学假设 |
| /api/research/plan | POST | 生成《科学假设与研究计划》十大标准字段 |
| /api/research/session | POST | 创建研究会话 |
| /api/research/sessions | GET | 会话列表 |
| /api/research/session/{id} | GET/DELETE | 会话详情/删除 |
| /api/literature/search | GET | 文献FTS5全文检索 |
| /api/astro/data | GET | 天文数据查询（支持分页筛选） |
| /api/knowledge/graph | GET | 知识图谱节点和关系 |
| /api/knowledge/paths | GET | 节点间路径查询 |
| /api/stats/dashboard | GET | 数据大屏统计 |
| /api/agent/logs | GET | Agent执行日志 |
| /api/settings/config | GET | 读取推理引擎配置（API Key脱敏、模型映射、实时健康） |
| /api/settings/config | PUT | 更新引擎/Key/模型映射（热生效并写回.env） |
| /api/settings/test-connection | POST | 连接测试（发起极简真实调用并计时） |
| /api/settings/preferences | GET | 读取用户偏好（主题/偏好模型/研究兴趣） |
| /api/settings/preferences | PUT | 保存用户偏好（upsert user_settings表） |

完整交互式API文档：启动后端后访问 http://localhost:8000/docs（Swagger UI）

---

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React + TypeScript | 18.3 / 5.6 |
| 构建工具 | Vite | 6.x |
| UI样式 | Tailwind CSS | 3.4 |
| 状态管理 | Zustand | 5.x |
| 后端框架 | FastAPI + Uvicorn | 0.111 |
| 数据库 | SQLite + FTS5 | 3.x |
| AI推理 | 阿里云百炼 DashScope(Qwen-Max/Plus/Turbo) / 本地 Ollama(Qwen2.5) | latest |
| 认证 | python-jose (JWT) + hashlib (SHA-256) | — |
| HTTP客户端 | aiohttp + httpx | — |
| 容器化 | Docker Compose | 3.9 |
| 日志 | loguru | 0.7 |

---

## 离线能力与降级策略

断开网络后以下功能完整可用：AI对话与假设生成（本地Qwen2.5推理）、文献检索（FTS5本地索引）、知识图谱查询（SQLite）、天文数据浏览（预打包500条JW-SSD数据）、Agent协作流水线（本地编排）。

Ollama未启动时，后端自动降级为Mock模式：所有LLM调用返回结构化模拟响应，前端全流程可正常演示，不阻塞任何功能。仅"在线文献更新"和"模型在线更新"需要网络，不影响核心功能。

---

## 数据库设计

11张业务表 + FTS5全文索引：

users（用户）、research_sessions（研究会话）、literature（文献）、literature_fts（全文索引）、kg_nodes（知识图谱节点）、kg_edges（知识图谱关系）、astro_data（天文观测数据）、hypotheses（假设）、research_plans（研究计划）、agent_logs（Agent执行日志）、user_settings（用户设置）、system_stats（系统统计）

初始化命令：`python scripts/init_database.py`（自动创建表结构、填充24节点知识图谱、500条天文数据、8篇文献、FTS索引）

---

## 比赛交付物

| 文件 | 用途 |
|------|------|
| 项目计划书_Academic-Joan-of-Arc_v3.docx | 项目计划书（双引擎架构，≤20页） |
| 技术方案说明书.pdf | 技术方案（架构/案例/代码，≤20页） |
| Academic-Joan-of-Arc_预期效果.html | 交互式效果演示 |
| 用户操作手册.pdf / 部署运维手册.pdf | 面向用户与运维的操作指南 |
| backend/API文档.md | API接口文档 |
| 测试报告/（单元/集成/性能/安全） | 测试报告集（单元测试6例全通过） |
| 项目进度与交付清单.xlsx | 进度与交付物总清单 |
| docker-compose.yml | 完整部署方案（env_file注入百炼凭证） |
| launcher.py + start.bat + app_icon.ico | 一键本地内嵌启动器（单端口:8000，桌面快捷方式「AI科研平台」） |
| backend/app/settings.py + frontend SettingsPage | 图形化系统设置（引擎/API Key/模型映射/连接测试/偏好，热生效+写回.env） |
| backend/ + frontend/ | 核心源代码（4 Agent + 双引擎 + Mock降级） |
| database/schema.sql + scripts/init_database.py | 数据库设计与初始化脚本 |

---

## 许可证

MIT License。模型权重（Qwen2.5）遵循阿里通义千问许可协议。预打包数据集遵循原始来源许可（国家天文台、NASA/MAST、arXiv）。

---

> **让AI科学家，解中国科学题。**
