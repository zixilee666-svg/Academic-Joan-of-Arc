# AI-Scientist Hub 龙虾复现计划

## 项目信息
- 仓库：https://github.com/zixilee666-svg/Academic-Web
- 比赛：挑战杯"揭榜挂帅" XH-202619
- 基座模型：千问(Qwen)系列，阿里云百炼平台
- 技术栈：React 18 + TypeScript + Vite + Tailwind CSS + Chart.js
- 状态管理：Zustand（轻量）
- 后端：EdgeOne Edge Functions + KV Storage

## 设计规范
- 主色调：#0A2540（深海蓝）+ #00D4AA（科技青）+ #FFFFFF（纯白）
- 辅助色：#FF6B6B（警示红）+ #FFD93D（重点黄）+ #6BCB77（成功绿）
- 字体：标题/正文 Inter + Noto Sans SC，代码 JetBrains Mono / Fira Code
- 组件库：Tailwind CSS + 少量 shadcn/ui
- 图表库：Chart.js
- 数据流：React Context 或 Zustand

## Phase 3 执行计划（第5-6周）：前端界面

### 阶段 3A：核心骨架（前置依赖）
- **P3-T1** AI科研中心（/ai-hub）— 三栏布局：智能体面板 | 工作画布 | AI对话
  - 角色：coder
  - 说明：作为整个Phase 3的入口页面，需要定义Agent状态类型、日志类型、聊天消息类型，供后续任务引用

### 阶段 3B：研究流程页面（可并行）
- **P3-T2** 问题理解（/research/question）— 问题解析、实体抽取、学科分类
- **P3-T3** 文献综述（/research/literature）— 文献列表、证据图谱、知识缺口
- **P3-T4** 假设生成（/research/hypothesis）— 假设卡片、评估雷达图、版本对比
- **P3-T5** 研究计划（/research/plan）— 实验方案、甘特图、代码生成
- **P3-T6** 迭代优化（/research/iterate）— 反馈输入、版本对比、迭代历史

## Phase 4 执行计划（第7-8周）：数据与图谱

### 阶段 4A：数据与图谱（可并行）
- **P4-T1** 天文数据浏览器（/data/astronomy）— JW-SSD/JW-FD/TESS数据表格展示
- **P4-T2** 数据整合（/data/integration）— 多源数据融合界面
- **P4-T3** 知识图谱可视化（/knowledge/graph）— SVG力导向图/节点关系
- **P4-T4** 证据链展示（/knowledge/evidence）— 假设→文献→证据的链式展示
- **P4-T5** 数据大屏（/visualization/dashboard）— Chart.js图表、实时指标

## 技能加载策略
- 阶段 3A：无预加载技能，直接执行
- 阶段 3B：无预加载技能，直接执行
- 阶段 4A：需要 `seaborn-visualization`（用于数据大屏图表），但前端使用 Chart.js 所以实际无需加载
- 最终产出：直接产出 Markdown 提示词文件，不转换为 .docx（用户要求 Markdown 格式）

## 共享类型定义（所有子任务需保持一致）
```typescript
// types/agents.ts
export type AgentStatus = 'idle' | 'running' | 'done' | 'error' | 'waiting';
export type AgentId = 'literature' | 'hypothesis' | 'experiment' | 'evaluation';

export interface AgentState {
  id: AgentId;
  name: string;
  model: string;
  status: AgentStatus;
  progress: number;
  description: string;
}

export interface LogEntry {
  timestamp: string;
  agent: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent?: string;
  timestamp: string;
}

export interface Hypothesis {
  id: string;
  title: string;
  description: string;
  novelty: number;
  verifiability: number;
  logicality: number;
  evidenceSupport: number;
  practicality: number;
  status: 'candidate' | 'selected' | 'rejected';
  version: number;
  createdAt: string;
}

export interface ResearchQuestion {
  id: string;
  rawText: string;
  type: 'causal' | 'mechanism' | 'correlation' | 'prediction' | 'other';
  entities: string[];
  domain: string;
  subDomain: string;
  feasibility: 'high' | 'medium' | 'low';
}

export interface LiteraturePaper {
  id: string;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  doi?: string;
  keyFinding: string;
  relevance: number;
}

export interface KnowledgeGap {
  id: string;
  description: string;
  severity: 'critical' | 'major' | 'minor';
}

export interface ResearchPlan {
  id: string;
  hypothesisId: string;
  objectives: string[];
  experiments: Experiment[];
  timeline: TimelineItem[];
  code?: string;
  resources: string[];
  risks: string[];
}

export interface Experiment {
  id: string;
  name: string;
  steps: string[];
  variables: { control: string[]; independent: string[]; dependent: string[] };
}

export interface TimelineItem {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
}

export interface AstroDataRow {
  id: string;
  observationTime: string;
  noaaNumber: string;
  magneticType: string;
  shearAngle: number;
  twist: number;
  magneticGradient: number;
  flareLevel: string;
}

export interface KnowledgeNode {
  id: string;
  name: string;
  type: 'celestial' | 'concept' | 'instrument' | 'method' | 'data' | 'institution';
  x: number;
  y: number;
  radius: number;
  color: string;
}

export interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
}

export interface EvidenceChainItem {
  id: string;
  type: 'hypothesis' | 'literature' | 'data' | 'experiment' | 'conclusion';
  title: string;
  description: string;
  confidence: number;
  children?: string[];
}
```

## 共享组件约定
```
components/
  ui/          # 基础UI组件（shadcn/ui 风格）
  layout/      # 布局组件（Header, Sidebar, ThreeColumnLayout）
  charts/      # 图表封装（RadarChart, GanttChart, LineChart, BarChart, DoughnutChart, ScatterChart）
  agents/      # Agent相关（AgentCard, AgentLog, AgentStatusBadge）
  knowledge/   # 知识图谱（GraphCanvas, NodeDetail, EdgeLabel）
  data/        # 数据展示（DataTable, DataFilter, ExportButton）

hooks/
  useAgents.ts    # Agent状态管理
  useChat.ts      # 聊天消息管理
  useBailian.ts   # 百炼API调用

services/
  bailian.ts      # 百炼平台API封装
  agents.ts       # 智能体API封装
  knowledge.ts    # 知识图谱API
  astro.ts        # 天文数据API
  session.ts      # 研究会话管理
```

## 路由结构
```
/                          # 首页（已存在）
/ai-hub                    # AI科研中心（P3-T1）
/research/question         # 问题理解（P3-T2）
/research/literature       # 文献综述（P3-T3）
/research/hypothesis       # 假设生成（P3-T4）
/research/plan             # 研究计划（P3-T5）
/research/iterate          # 迭代优化（P3-T6）
/data/astronomy            # 天文数据（P4-T1）
/data/integration          # 数据整合（P4-T2）
/knowledge/graph           # 知识图谱（P4-T3）
/knowledge/evidence        # 证据链（P4-T4）
/visualization/dashboard   # 数据大屏（P4-T5）
```
