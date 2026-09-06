# 基于国产开源大模型的AI Scientist科研智能平台
## ——项目计划书与修改方向（XH-202619）

---

## 一、项目概述

### 1.1 项目定位
将现有的 **Academic-Web**（学术空间管理平台）全面升级为 **AI-Scientist Hub**（AI科学家科研智能平台），基于**阿里云百炼平台**调用**千问（Qwen）系列模型**，构建面向"可验证科学研究假设自动生成"的多智能体科研系统。

### 1.2 参赛赛道选择
**赛道一：科学问题 — 方向一：科学假设生成与研究计划设计**

> 面向《Science》125个前沿科学问题，搭建能够完成"问题理解—知识整合—候选假设生成—证据梳理—研究计划输出—反馈修正"的AI应用。

### 1.3 核心目标
构建一个具备以下闭环能力的AI Scientist平台：
```
科学问题输入 → 知识图谱检索 → 文献证据整合 → 候选假设生成 → 可验证性评估 → 
研究计划设计 → 实验任务规划 → 模拟验证/反馈 → 假设迭代优化 → 最终输出
```

---

## 二、现有仓库分析

### 2.1 现有技术栈（Academic-Web）
| 层级 | 现有技术 | 评估 |
|------|---------|------|
| 前端框架 | React 18 + TypeScript + Vite | ✅ 满足要求，无需替换 |
| UI框架 | Tailwind CSS | ✅ 满足要求，需扩展主题 |
| 后端 | EdgeOne Edge Functions | ⚠️ 需扩展AI接口代理 |
| 数据存储 | EdgeOne KV Storage | ⚠️ 需扩展向量/图谱存储 |
| 部署 | EdgeOne Pages | ✅ 满足要求 |
| AI能力 | ❌ 无 | ❌ 核心缺失 |
| 多智能体 | ❌ 无 | ❌ 核心缺失 |
| 知识图谱 | ❌ 无 | ❌ 核心缺失 |

### 2.2 现有功能模块
| 模块 | 现有状态 | 比赛要求 | 差距分析 |
|------|---------|---------|---------|
| 用户系统 | ✅ 注册/登录/资料管理 | ✅ 基础需求 | 无差距 |
| 论文管理 | ✅ 增删改查/标签 | ⚠️ 需升级为AI文献分析 | 中等差距 |
| 项目管理 | ✅ 看板/进度 | ⚠️ 需升级为实验任务规划 | 中等差距 |
| 文献库 | ✅ 收藏/分类 | ⚠️ 需升级为知识图谱 | 较大差距 |
| 学术空间 | ✅ 个人主页展示 | ✅ 需升级为AI Scientist画像 | 中等差距 |
| 假设生成 | ❌ 无 | ✅ 核心要求 | 核心缺失 |
| 多智能体 | ❌ 无 | ✅ 核心要求 | 核心缺失 |
| AI模型调用 | ❌ 无 | ✅ 必须使用Qwen | 核心缺失 |
| 科学数据整合 | ❌ 无 | ✅ 赛道要求 | 核心缺失 |
| 可验证性评估 | ❌ 无 | ✅ 核心要求 | 核心缺失 |

---

## 三、完全修改方向（六大升级维度）

### 3.1 维度一：架构升级 — 多智能体系统（MAS）架构

**目标**：从单体应用升级为多智能体协作系统

**新增架构层**：

```
┌─────────────────────────────────────────────────────────────┐
│                    AI-Scientist Hub 前端                      │
│  (React 18 + TypeScript + Vite + Tailwind + 新增Ant Design)  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                EdgeOne Edge Functions (API网关)               │
│  - 路由分发  - 认证鉴权  - 速率限制  - 请求聚合                  │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐           ┌────▼────┐           ┌────▼────┐
   │ 百炼平台 │           │ 百炼平台 │           │ 百炼平台 │
   │ 智能体A  │           │ 智能体B  │           │ 智能体C  │
   │文献Agent │           │假设Agent │           │实验Agent │
   └────┬────┘           └────┬────┘           └────┬────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
   ┌────────────────────────────────────────────────────────┐
   │              阿里云百炼平台 (Qwen系列模型)                 │
   │  - Qwen-Max (复杂推理)  - Qwen-Plus (通用任务)             │
   │  - Qwen-VL (多模态)     - Qwen-Coder (代码生成)            │
   │  - RAG检索增强  - 工具调用(MCP)  - 多轮对话                  │
   └────────────────────────────────────────────────────────┘
                              │
   ┌────────────────────────────────────────────────────────┐
   │              数据层 (EdgeOne KV + 扩展存储)                │
   │  - KV Storage (用户数据/缓存)                              │
   │  - 向量数据库 (知识嵌入/语义检索)  【新增】                   │
   │  - 知识图谱存储 (实体关系/证据链) 【新增】                   │
   └────────────────────────────────────────────────────────┘
```

**四大核心智能体设计**：

| 智能体 | 名称 | 职责 | 调用模型 | 功能描述 |
|-------|------|------|---------|---------|
| Agent-1 | 文献整合者 (Literature Integrator) | 知识整合 | Qwen-Plus + RAG | 检索、解析、整合多源文献，构建证据链 |
| Agent-2 | 假设生成器 (Hypothesis Generator) | 假设生成 | Qwen-Max + 思维链 | 基于知识缺口生成候选假设，评估可验证性 |
| Agent-3 | 实验规划师 (Experiment Planner) | 实验设计 | Qwen-Coder + 工具调用 | 设计实验方案、生成代码、规划任务流程 |
| Agent-4 | 评估验证官 (Evaluation Validator) | 评估迭代 | Qwen-Max + 反思 | 评估假设质量、检测偏差、提出修正建议 |

**智能体协作流程**：
```
用户输入科学问题
      ↓
┌─────────────────┐
│ 文献整合者 Agent │ → 检索相关文献 → 提取关键证据 → 识别知识缺口 → 输出文献综述
└────────┬────────┘
         ↓
┌─────────────────┐
│ 假设生成器 Agent │ → 基于知识缺口生成候选假设 → 评估创新性/可验证性 → 输出假设列表
└────────┬────────┘
         ↓
┌─────────────────┐
│ 实验规划师 Agent │ → 设计验证实验 → 生成模拟代码 → 规划数据收集 → 输出实验方案
└────────┬────────┘
         ↓
┌─────────────────┐
│ 评估验证官 Agent │ → 评估实验结果 → 检测逻辑偏差 → 提出修正建议 → 输出评估报告
└────────┬────────┘
         ↓
    迭代优化（支持人工反馈）
         ↓
    最终输出：可验证假设 + 研究计划 + 实验方案
```

### 3.2 维度二：AI能力集成 — 阿里云百炼平台 + Qwen系列模型

**目标**：全面接入国产开源大模型，实现AI for Science核心能力

**技术实现路径**：

**A. 百炼平台配置**
```javascript
// services/bailian-api.ts
const BAILIAN_CONFIG = {
  baseURL: 'https://dashscope.aliyuncs.com/api/v1',
  apiKey: process.env.BAILIAN_API_KEY,  // 环境变量配置
  modelMapping: {
    // 复杂推理任务（假设生成、评估）
    reasoning: 'qwen-max-latest',
    // 通用对话/文献处理
    general: 'qwen-plus-latest',
    // 代码生成（实验模拟）
    coding: 'qwen-coder-latest',
    // 多模态（天文图像分析）
    multimodal: 'qwen-vl-max-latest',
    // 长文本处理（论文解析）
    longcontext: 'qwen-long-latest'
  }
};
```

**B. 智能体API封装**
```javascript
// 文献整合者 Agent
class LiteratureAgent {
  async integrate(query: string, domain: string) {
    // 1. 使用百炼RAG检索相关文献
    const papers = await this.searchPapers(query, domain);
    // 2. 使用Qwen-Plus提取关键证据
    const evidence = await this.extractEvidence(papers);
    // 3. 识别知识缺口
    const gaps = await this.identifyGaps(evidence);
    return { papers, evidence, gaps };
  }
}

// 假设生成器 Agent
class HypothesisAgent {
  async generate(evidence: Evidence[], gaps: KnowledgeGap[]) {
    // 使用Qwen-Max进行深度推理
    const prompt = this.buildPrompt(evidence, gaps);
    const response = await bailian.chat.completion.create({
      model: 'qwen-max-latest',
      messages: [{ role: 'user', content: prompt }],
      enable_thinking: true  // 启用思维链
    });
    return this.parseHypotheses(response);
  }
}
```

**C. 工具调用能力（MCP/Function Calling）**
```javascript
// 定义Agent可调用的工具集
const TOOLS = [
  {
    name: 'search_arxiv',
    description: '搜索arXiv论文数据库',
    parameters: { query: 'string', max_results: 'number' }
  },
  {
    name: 'query_astronomy_db',
    description: '查询天文数据库（国家天文科学数据中心）',
    parameters: { object_name: 'string', data_type: 'string' }
  },
  {
    name: 'run_simulation',
    description: '运行科学模拟代码',
    parameters: { code: 'string', language: 'string' }
  },
  {
    name: 'visualize_data',
    description: '生成数据可视化图表',
    parameters: { data: 'array', chart_type: 'string' }
  },
  {
    name: 'evaluate_hypothesis',
    description: '评估假设的可验证性',
    parameters: { hypothesis: 'string', criteria: 'array' }
  }
];
```

### 3.3 维度三：核心功能新增 — 五大AI科研模块

**模块一：科学问题理解引擎（Science Question Understanding）**

```
功能定位：将用户输入的科学问题转化为结构化研究对象

新增页面：/research/question
新增组件：QuestionAnalyzer.tsx

核心功能：
├── 问题解析：自动识别问题类型（因果/机制/关联/预测）
├── 实体抽取：提取关键科学实体（使用Qwen-NER能力）
├── 学科分类：自动归类到学科领域（物理/天文/生物/化学等）
├── 相似问题推荐：基于知识图谱推荐相关研究问题
├── 可行性评估：评估问题的研究可行性（数据/方法/时间）
└── 研究路径推荐：推荐可能的研究方法论
```

**模块二：智能文献综述生成器（Smart Literature Review）**

```
功能定位：自动检索、解析、整合文献，生成结构化综述

新增页面：/research/literature
新增组件：LiteratureReview.tsx, EvidenceMap.tsx

核心功能：
├── 多源检索：同时检索arXiv/SPIE/ADS/中国知网等数据库
├── 智能筛选：基于相关性/时效性/影响力自动筛选文献
├── 关键信息提取：自动提取摘要/方法/结论/数据集
├── 证据图谱生成：可视化文献间的引用关系和证据链
├── 知识缺口识别：自动识别领域内的研究空白
├── 综述报告生成：生成带引用格式的文献综述文档
└── 文献可信度评估：评估文献质量和证据强度
```

**模块三：科学假设生成与评估系统（Hypothesis Generation & Evaluation）**

```
功能定位：基于知识缺口生成可验证的科学假设

新增页面：/research/hypothesis
新增组件：HypothesisGenerator.tsx, HypothesisEvaluator.tsx, AssumptionTree.tsx

核心功能：
├── 候选假设生成：基于知识缺口生成3-5个候选假设
├── 假设结构化：每个假设包含：背景/前提/预测/验证方法
├── 创新性评估：评估假设的新颖性（与现有研究对比）
├── 可验证性评估：评估假设的可检验性（可获取数据/可行实验）
├── 逻辑一致性检查：检测假设内部的逻辑矛盾
├── 证据支持度：评估现有文献对假设的支持程度
├── 风险分析：识别可能证伪假设的反例
├── 假设版本管理：支持假设的多轮迭代和版本对比
└── 人工反馈接口：支持研究者对假设进行评价和修正
```

**模块四：研究计划与实验设计模块（Research Plan & Experiment Design）**

```
功能定位：将假设转化为可执行的研究计划

新增页面：/research/plan
新增组件：ResearchPlan.tsx, ExperimentDesigner.tsx, TimelineChart.tsx

核心功能：
├── 研究目标分解：将假设分解为可操作的子目标
├── 实验方案设计：自动生成实验步骤、对照组、变量控制
├── 数据收集规划：规划数据类型、来源、采集方法
├── 统计方法推荐：根据数据类型推荐合适的统计方法
├── 代码生成：生成实验模拟的Python/R/MATLAB代码
├── 任务甘特图：生成研究任务的时间线图表
├── 资源需求估算：估算计算资源/时间/人力需求
├── 风险评估与备案：识别风险点并提供备选方案
└── 计划版本迭代：根据实验反馈迭代优化计划
```

**模块五：天文数据集成与科学数据平台（Astronomy Data Integration）**

```
功能定位：集成国家天文科学数据中心数据，支持天文研究

新增页面：/data/astronomy, /data/integration
新增组件：AstroDataBrowser.tsx, DataFusionEngine.tsx, LightCurveViewer.tsx

核心功能：
├── 太阳物理数据接入：JW-SSD太阳黑子数据集、JW-FD耀斑数据集
├── TESS光变曲线接入：支持恒星耀发自动识别
├── 数据预处理：自动清洗、归一化、特征提取
├── 多模态数据融合：整合图像/时序/光谱数据
├── 数据可视化：生成专业天文图表（光变曲线/能谱/磁场图）
├── 数据溯源：记录数据来源、处理过程、版本信息
├── CSV/JSON输出：支持结构化数据导出
└── 数据质量评估：自动检测异常值和数据完整性
```

### 3.4 维度四：知识图谱构建 — 天文科学知识图谱

**目标**：构建可查询、可推理、可视化的天文领域知识图谱

**技术实现**：
```
知识图谱架构：

实体类型（Nodes）：
├── 天体对象：恒星/行星/黑洞/星系/太阳/耀斑/黑子
├── 物理概念：磁场/引力波/能谱/光变/红移/光谱
├── 观测设备：TESS/SDSS/LAMOST/GAIA/慧眼
├── 科学方法：数值模拟/统计分析/机器学习/蒙特卡洛
├── 数据产品：光变曲线/光谱图像/星表/模拟数据
└── 研究机构：国家天文台/中科院/大学/天文台

关系类型（Edges）：
├── 观测关系：TESS → 观测 → 恒星
├── 因果关系：磁场变化 → 导致 → 耀斑爆发
├── 分类关系：太阳黑子 → 属于 → 太阳活动
├── 方法关系：蒙特卡洛 → 用于 → 参数估计
├── 数据关系：JW-SSD → 包含 → 太阳黑子数据
└── 演化关系：主序星 → 演化为 → 红巨星

图谱功能：
├── 实体查询：查询特定天体/概念的属性和关系
├── 路径发现：发现两个概念之间的关联路径
├── 知识推理：基于规则推断隐含知识
├── 可视化展示：力导向图/环形图/层次图展示
├── 证据链构建：为假设生成构建证据链
└── 缺口发现：发现知识图谱中的稀疏区域
```

### 3.5 维度五：前端升级 — 全新AI-Scientist交互界面

**目标**：将学术管理平台UI升级为专业科研AI平台UI

**设计升级方案**：

```
视觉风格：科技蓝 + 学术白 + 数据可视化色彩
主色调：#0A2540（深海蓝）+ #00D4AA（科技青）+ #FFFFFF（纯白）
辅助色：#FF6B6B（警示红）+ #FFD93D（重点黄）+ #6BCB77（成功绿）

字体：
├── 标题：Inter / Noto Sans SC（现代感）
├── 正文：Inter / Noto Sans SC
├── 代码：JetBrains Mono / Fira Code
└── 数据：Roboto Mono

布局升级：
├── 新增AI助手悬浮球（全局可调用）
├── 新增左侧智能体导航面板
├── 主工作区采用三栏布局：文献|画布|聊天
├── 支持拖拽式工作流编排
├── 新增数据可视化大屏模式
└── 新增暗黑模式（科学可视化专用）
```

**新增页面清单**：

| 页面路径 | 页面名称 | 功能描述 | 核心组件 |
|---------|---------|---------|---------|
| /ai-hub | AI科研中心 | 多智能体协作入口 | AgentHub.tsx |
| /research/question | 问题理解 | 科学问题结构化分析 | QuestionAnalyzer.tsx |
| /research/literature | 文献综述 | AI文献检索与综述 | LiteratureReview.tsx |
| /research/hypothesis | 假设生成 | 候选假设生成与评估 | HypothesisGenerator.tsx |
| /research/plan | 研究计划 | 实验设计与任务规划 | ResearchPlan.tsx |
| /research/iterate | 迭代优化 | 反馈驱动的假设迭代 | IterationLab.tsx |
| /data/astronomy | 天文数据 | 太阳物理数据浏览 | AstroDataBrowser.tsx |
| /data/integration | 数据整合 | 多源数据融合 | DataFusionEngine.tsx |
| /knowledge/graph | 知识图谱 | 天文知识图谱可视化 | KnowledgeGraph.tsx |
| /knowledge/evidence | 证据链 | 假设证据链展示 | EvidenceChain.tsx |
| /visualization/dashboard | 数据大屏 | 科研成果可视化 | ResearchDashboard.tsx |
| /settings/agents | 智能体设置 | Agent配置与管理 | AgentSettings.tsx |
| /settings/api | API管理 | 百炼API配置 | BailianConfig.tsx |
| /docs/tutorial | 使用教程 | 平台使用指南 | TutorialCenter.tsx |
| /community/showcase | 案例展示 | 优秀研究案例 | ShowcaseGallery.tsx |

### 3.6 维度六：后端升级 — 百炼API代理与数据层扩展

**目标**：构建安全的百炼API代理层，扩展数据存储能力

**A. Edge Functions升级方案**：

```javascript
// edge-functions/api/index.js 升级

// 新增路由
const routes = {
  // 现有路由（保留）
  ...existingRoutes,
  
  // 新增：百炼API代理（安全转发，不暴露API Key）
  'POST /api/bailian/chat': handleBailianChat,
  'POST /api/bailian/agent/:agentId': handleAgentCall,
  'POST /api/bailian/rag': handleRAGQuery,
  'POST /api/bailian/tools': handleToolCall,
  
  // 新增：多智能体编排
  'POST /api/agents/orchestrate': handleOrchestration,
  'POST /api/agents/literature': handleLiteratureAgent,
  'POST /api/agents/hypothesis': handleHypothesisAgent,
  'POST /api/agents/experiment': handleExperimentAgent,
  'POST /api/agents/evaluate': handleEvaluationAgent,
  
  // 新增：知识图谱API
  'GET /api/knowledge/graph': handleGraphQuery,
  'POST /api/knowledge/entity': handleEntitySearch,
  'GET /api/knowledge/path': handlePathDiscovery,
  
  // 新增：天文数据API
  'GET /api/astro/data/:dataset': handleAstroData,
  'POST /api/astro/query': handleAstroQuery,
  'GET /api/astro/lightcurve/:objectId': handleLightCurve,
  
  // 新增：数据整合API
  'POST /api/data/fuse': handleDataFusion,
  'POST /api/data/csv': handleCSVExport,
  'POST /api/data/visualize': handleVisualization,
  
  // 新增：研究会话管理
  'POST /api/sessions/create': createResearchSession,
  'GET /api/sessions/:sessionId': getSessionState,
  'POST /api/sessions/:sessionId/feedback': submitFeedback,
  
  // 新增：评估与反馈
  'POST /api/evaluate/hypothesis': evaluateHypothesis,
  'POST /api/evaluate/plan': evaluatePlan,
  'GET /api/evaluate/history': getEvaluationHistory
};
```

**B. 数据存储扩展**：

```javascript
// KV Storage 数据结构扩展

// 1. 研究会话存储
Key: session:{sessionId}
Value: {
  id: string,
  userId: string,
  title: string,           // 研究主题
  domain: string,          // 学科领域
  question: object,        // 结构化问题
  literature: array,       // 文献综述结果
  hypotheses: array,       // 候选假设列表
  selectedHypothesis: object, // 选中的假设
  plan: object,            // 研究计划
  iterations: array,       // 迭代历史
  status: string,          // 状态
  createdAt: string,
  updatedAt: string
}

// 2. 知识图谱节点
Key: kg:node:{entityId}
Value: {
  id: string,
  type: string,            // 实体类型
  name: string,            // 实体名称
  properties: object,      // 属性
  source: string,          // 数据来源
  confidence: number       // 置信度
}

// 3. 知识图谱关系
Key: kg:edge:{edgeId}
Value: {
  id: string,
  source: string,          // 源实体ID
  target: string,          // 目标实体ID
  relation: string,          // 关系类型
  evidence: array,         // 支持证据
  confidence: number
}

// 4. 天文数据缓存
Key: astro:data:{dataset}:{objectId}
Value: {
  dataset: string,         // 数据集名称
  objectId: string,        // 天体ID
  data: object,            // 原始数据
  processed: object,       // 处理后数据
  fetchedAt: string        // 获取时间
}

// 5. 智能体对话历史
Key: agent:chat:{agentId}:{sessionId}
Value: {
  agentId: string,
  sessionId: string,
  messages: array,         // 对话历史
  toolCalls: array,        // 工具调用记录
  tokens: number           // 累计token数
}

// 6. 评估记录
Key: eval:{hypothesisId}
Value: {
  hypothesisId: string,
  scores: {                // 多维度评分
    novelty: number,       // 创新性
    verifiability: number, // 可验证性
    logicality: number,    // 逻辑性
    evidence: number       // 证据支持度
  },
  feedback: string,        // 人工反馈
  evaluator: string,       // 评估者（AI/人工）
  evaluatedAt: string
}
```

---

## 四、项目拓展与差异化亮点

### 4.1 拓展一：AI数字分身 — 个性化科研助手

**功能**：基于Qwen模型构建持续学习的科研助手
- 用户画像：记录用户的研究领域、兴趣方向、写作风格
- 长期记忆：记录用户的历史研究、偏好设置、反馈习惯
- 个性化输出：根据用户风格调整假设的表达方式
- 情绪感知：识别用户的研究焦虑，提供鼓励和建议

### 4.2 拓展二：科学传播可视化 — 艺术化表达

**功能**：将AI生成的研究成果转化为多元传播内容
- 科普海报生成：将复杂假设转化为直观海报
- 图文摘要生成：自动生成论文图文摘要（Graphical Abstract）
- 动态演示视频：生成科学原理的动画演示
- 交互式科普装置：Web端交互式科学展示
- 多受众适配：同一内容生成不同难度版本（专家/学生/大众）

### 4.3 拓展三：跨学科融合引擎

**功能**：支持自然科学和社会科学的交叉研究
- 学科桥接：发现不同学科间的相似方法论
- 跨域迁移：将一个领域的假设迁移到另一个领域
- 融合创新：识别跨学科研究机会
- 方法借用：推荐其他学科可用的研究方法

### 4.4 拓展四：科研协作网络

**功能**：构建研究者协作的社交网络
- 兴趣匹配：匹配相似研究兴趣的研究者
- 假设众评：邀请其他研究者评审假设
- 协作编辑：多人协作编辑研究计划
- 成果追踪：追踪假设的验证进展和引用情况

---

## 五、技术实现路线图

### Phase 1：基础架构（第1-2周）
- [ ] 注册阿里云百炼平台，获取API Key
- [ ] 配置Qwen系列模型接入
- [ ] 升级Edge Functions，新增百炼API代理路由
- [ ] 配置环境变量（BAILIAN_API_KEY, MODEL_ENDPOINTS）
- [ ] 前端项目结构重构，新增AI模块目录

### Phase 2：核心智能体（第3-4周）
- [ ] 实现文献整合者Agent（LiteratureAgent）
- [ ] 实现假设生成器Agent（HypothesisAgent）
- [ ] 实现实验规划师Agent（ExperimentAgent）
- [ ] 实现评估验证官Agent（EvaluationAgent）
- [ ] 实现智能体编排器（AgentOrchestrator）
- [ ] 实现工具调用接口（MCP/Function Calling）

### Phase 3：前端界面（第5-6周）
- [ ] 开发AI科研中心（/ai-hub）
- [ ] 开发问题理解模块（/research/question）
- [ ] 开发文献综述模块（/research/literature）
- [ ] 开发假设生成模块（/research/hypothesis）
- [ ] 开发研究计划模块（/research/plan）
- [ ] 开发迭代优化模块（/research/iterate）

### Phase 4：数据与图谱（第7-8周）
- [ ] 接入国家天文科学数据中心API
- [ ] 实现太阳物理数据浏览（JW-SSD/JW-FD/TESS）
- [ ] 构建天文知识图谱（实体抽取/关系构建）
- [ ] 实现知识图谱可视化
- [ ] 实现证据链展示
- [ ] 实现数据可视化大屏

### Phase 5：拓展功能（第9-10周）
- [ ] 开发AI数字分身功能
- [ ] 开发科学传播可视化模块
- [ ] 开发跨学科融合引擎
- [ ] 开发科研协作网络
- [ ] 实现多轮反馈迭代机制
- [ ] 实现版本对比功能

### Phase 6：测试与优化（第11-12周）
- [ ] 编写测试用例（单元测试/集成测试）
- [ ] 性能优化（响应速度/并发处理）
- [ ] 安全加固（API Key保护/输入校验）
- [ ] 制作演示视频（≤10分钟）
- [ ] 编写技术方案文档（PDF≤20页）
- [ ] 部署上线并验证

---

## 六、预期技术方案文档结构（20页PDF）

```
1. 项目概述（1页）
   - 项目背景与目标
   - 参赛赛道与方向
   - 团队介绍

2. 问题分析（1页）
   - 传统科研模式的痛点
   - AI for Science的发展趋势
   - 国产大模型的战略意义

3. 系统架构（2页）
   - 总体架构图
   - 多智能体协作架构
   - 技术栈与部署方案

4. 核心设计（4页）
   - 4.1 文献整合者Agent设计
   - 4.2 假设生成器Agent设计
   - 4.3 实验规划师Agent设计
   - 4.4 评估验证官Agent设计
   - 4.5 智能体编排机制

5. 模型与算法（3页）
   - 5.1 Qwen系列模型选型与配置
   - 5.2 RAG检索增强实现
   - 5.3 思维链（CoT）与反思机制
   - 5.4 工具调用（MCP）实现

6. 数据与知识（2页）
   - 6.1 天文数据集成方案
   - 6.2 知识图谱构建方法
   - 6.3 数据溯源与质量保障

7. 实验与验证（3页）
   - 7.1 测试案例设计（Science 125问题）
   - 7.2 假设质量评估结果
   - 7.3 多轮迭代优化展示
   - 7.4 与基线方法对比

8. 创新点与拓展（2页）
   - 8.1 多智能体协作创新
   - 8.2 可验证性评估机制
   - 8.3 天文数据深度融合
   - 8.4 科学传播可视化拓展

9. 应用前景与总结（1页）
   - 应用场景
   - 社会价值
   - 未来展望

10. 附录（1页）
    - API文档链接
    - 代码仓库链接
    - 演示视频链接
```

---

## 七、风险与应对

| 风险 | 影响 | 应对方案 |
|------|------|---------|
| 百炼API调用成本 | 高 | 实现智能缓存、批处理、降级策略 |
| Qwen模型推理延迟 | 中 | 流式输出、异步处理、进度指示 |
| 天文数据访问受限 | 中 | 预下载公开数据集、本地缓存、模拟数据 |
| 知识图谱构建质量 | 中 | 多轮验证、人工校验、置信度标注 |
| 假设生成偏差 | 高 | 多智能体交叉验证、反例检测、人工反馈 |
| 长文本处理限制 | 中 | 分块处理、摘要压缩、长上下文模型 |
| 部署性能瓶颈 | 低 | EdgeOne全球加速、CDN缓存、懒加载 |

---

## 八、总结

本项目将**Academic-Web**从单一的学术管理平台，全面升级为**基于千问（Qwen）系列模型的AI Scientist多智能体科研平台**，实现了以下核心转变：

1. **从静态管理到智能生成**：从人工录入论文到AI自动生成假设
2. **从单点功能到闭环系统**：从孤立功能到"问题→文献→假设→实验→评估→迭代"完整闭环
3. **从通用平台到专业领域**：从通用学术平台到聚焦天文/物理的科学假设生成平台
4. **从国内部署到国际兼容**：从EdgeOne Pages到兼容阿里云百炼平台
5. **从单机应用到协作网络**：从个人工具到科研协作生态

通过12周的技术实现，本项目将具备参加**XH-202619**赛道一（科学问题）终审擂台赛的完整能力，并有望拓展到赛道二（数据场景）和赛道三（科普科教）的交叉领域，形成差异化竞争优势。

---

*本计划书由AI-Scientist Hub项目团队编制*
*版本：v1.0 | 日期：2026年7月*
