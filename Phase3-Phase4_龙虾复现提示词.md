# AI-Scientist Hub Phase 3 & Phase 4 — 龙虾复现提示词

> 项目：基于国产开源大模型的AI Scientist科研智能平台  
> 比赛：挑战杯"揭榜挂帅" XH-202619  
> 仓库：https://github.com/zixilee666-svg/Academic-Web  
> 技术栈：React 18 + TypeScript + Vite + Tailwind CSS + Chart.js  
> 基座模型：千问(Qwen)系列 via 阿里云百炼平台  
> 状态管理：Zustand（轻量）  
> 设计规范：主色 #0A2540 / #00D4AA，字体 Inter/Noto Sans SC，代码 JetBrains Mono  

---

## 全局共享类型（所有子任务需遵守）

```typescript
// src/types/agents.ts
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

---

## Phase 3：前端界面（第5-6周）

---

### 【P3-T1】AI科研中心（/ai-hub）

```
【龙虾角色】：coder
【龙虾ID】：P3-T1
【任务名称】：AI科研中心三栏布局页面开发
【上下文】：
- 仓库路径：/src/pages/AIHub.tsx 为新增入口页面
- 前置完成状态：Phase 1-2 已完成百炼API接入、四大Agent基础架构
- 设计规范：主色 #0A2540/#00D4AA，字体 Inter/Noto Sans SC，代码 JetBrains Mono
- 组件库：Tailwind CSS + 少量 shadcn/ui 组件
- 该页面是整个AI Scientist系统的核心工作空间，需定义全局类型供后续页面引用

【具体指令】：
1. 页面结构：实现 /ai-hub 路由对应页面，采用三栏布局（12列网格）：
   - 左栏（col-span-3）：智能体面板（AgentPanel组件）
   - 中栏（col-span-6）：工作画布（WorkspaceCanvas组件）
   - 右栏（col-span-3）：AI对话面板（AIChatPanel组件）
   - 整体高度固定为 h-[calc(100vh-180px)]，sticky 顶部导航

2. 智能体面板（AgentPanel）：
   - Props：agents: AgentState[]，onAgentClick: (id: AgentId) => void
   - 每个Agent卡片展示：图标、名称、模型标签、状态徽章、进度条、描述
   - 状态徽章：idle(灰色等待)、running(黄色运行中)、done(绿色完成)、error(红色错误)、waiting(蓝色等待)
   - 底部执行日志区域：可滚动，显示 LogEntry[] 列表，按时间倒序
   - 日志样式：font-mono text-xs，不同 type 用不同颜色

3. 工作画布（WorkspaceCanvas）：
   - 支持动态内容切换，根据当前活跃Agent展示不同内容
   - 默认展示：研究问题输入框 + 提交按钮
   - 提交后触发百炼API调用，状态流转到文献Agent
   - 使用 Zustand 存储当前会话状态（sessionStore）
   - 画布内容包含：问题输入卡片、文献综述预览、假设卡片预览、执行日志时间线

4. AI对话面板（AIChatPanel）：
   - Props：messages: ChatMessage[]，onSendMessage: (msg: string) => void
   - 消息气泡：用户消息靠右深色背景(#0A2540)，AI消息靠左浅绿色背景(#F0FDFA)
   - 输入框底部固定，发送按钮带图标
   - 支持显示不同Agent的头像和名称
   - 自动滚动到底部，打字机效果（typing-cursor CSS类）

5. Zustand Store 设计：
   - 创建 src/stores/sessionStore.ts
   - 状态：currentSession、agents、logs、messages、activeAgent
   - Actions：setActiveAgent、addLog、addMessage、updateAgentStatus、createSession

6. API 封装：
   - 创建 src/services/bailian.ts，封装百炼平台调用
   - 函数：sendChat(message, model)、callAgent(agentId, payload)、createSession(topic)
   - 使用 fetch，baseURL 从环境变量读取 VITE_BAILIAN_API_URL
   - 错误处理：统一返回 { data, error } 格式，error 时 toast 提示

7. 路由配置：
   - 在 src/App.tsx 或路由配置中添加 /ai-hub 路由
   - 懒加载：React.lazy(() => import('./pages/AIHub'))

8. 响应式：
   - 移动端（<1024px）时三栏变为单栏垂直堆叠，左栏可折叠为侧边栏抽屉

【代码规范】：
- 文件命名：AIHub.tsx、AgentPanel.tsx、WorkspaceCanvas.tsx、AIChatPanel.tsx、sessionStore.ts、bailian.ts
- 目录结构：src/pages/AIHub/ 存放页面相关组件，src/stores/ 存放状态，src/services/ 存放API
- 类型定义：src/types/agents.ts（全局共享，所有子任务引用）
- 所有组件使用 FC<Props> 形式，Props 接口单独导出
- 样式全部使用 Tailwind class，不使用 CSS-in-JS
- 图标使用 lucide-react（项目中已存在）

【验收标准】：
1. /ai-hub 页面可正常访问，三栏布局在桌面端正确展示
2. 智能体面板展示4个Agent（文献整合者、假设生成器、实验规划师、评估验证官），状态和进度可动态更新
3. 工作画布支持问题输入，提交后可在画布中展示结构化研究问题
4. AI对话面板可发送/接收消息，消息气泡样式正确，自动滚动
5. Zustand store 状态可跨组件共享，状态更新触发UI重渲染
6. 百炼API服务封装正确，包含错误处理和loading状态
7. 移动端响应式布局正确，左栏可折叠
8. 代码通过 TypeScript 编译无错误，ESLint 无严重警告

【预期产出】：
- src/pages/AIHub.tsx
- src/pages/AIHub/AgentPanel.tsx
- src/pages/AIHub/WorkspaceCanvas.tsx
- src/pages/AIHub/AIChatPanel.tsx
- src/stores/sessionStore.ts
- src/services/bailian.ts
- src/types/agents.ts
- src/App.tsx（路由更新）
```

---

### 【P3-T2】问题理解（/research/question）

```
【龙虾角色】：coder
【龙虾ID】：P3-T2
【任务名称】：科学问题理解引擎页面开发
【上下文】：
- 仓库路径：/src/pages/QuestionPage.tsx
- 前置完成状态：P3-T1 已定义全局类型（ResearchQuestion、AgentState等），百炼API服务已封装
- 设计规范：主色 #0A2540/#00D4AA，字体 Inter/Noto Sans SC
- 组件库：Tailwind CSS，图表使用 Chart.js（如需要）
- 该页面将用户输入的自然语言科学问题转化为结构化研究对象

【具体指令】：
1. 页面结构：实现 /research/question 路由页面，包含以下区域：
   - 顶部：页面标题 + 当前研究会话主题显示
   - 主体：两栏布局（左侧输入/右侧分析结果）
   - 左栏（col-span-5）：问题输入区 + 历史问题列表
   - 右栏（col-span-7）：分析结果展示区（多卡片tab切换）

2. 问题输入区（QuestionInput）：
   - 大文本框（textarea），支持多行输入，placeholder 提示示例科学问题
   - 提交按钮：主色 #00D4AA，带 loading 状态（调用百炼API）
   - 支持语音/图片输入（预留接口，UI占位）
   - 快速问题模板：3个预设按钮（太阳耀斑/恒星演化/黑洞形成）

3. 分析结果展示（AnalysisResult）：
   - 使用 Tab 切换不同分析维度：
     - Tab 1「问题解析」：展示问题类型标签（因果/机制/关联/预测）、结构化问题卡片
     - Tab 2「实体抽取」：展示提取的实体列表，每个实体带类型标签（天体/概念/方法/设备）
     - Tab 3「学科分类」：展示学科分类树（天文→太阳物理→耀斑物理），置信度条
     - Tab 4「相似推荐」：展示相似研究问题列表，带相关性分数
     - Tab 5「可行性评估」：展示可行性雷达图（数据可获取性/方法成熟度/时间合理性/资源可及性）

4. 问题解析组件（QuestionParserCard）：
   - Props：question: ResearchQuestion
   - 展示：原始问题文本、解析后的问题类型badge、关键词高亮
   - 类型badge颜色：因果(蓝色)、机制(绿色)、关联(黄色)、预测(紫色)

5. 实体抽取组件（EntityExtractionList）：
   - Props：entities: { name, type, confidence }[]
   - 列表展示，每个实体带图标、名称、类型标签、置信度进度条
   - 支持点击实体跳转到知识图谱（/knowledge/graph?entity=xxx）

6. 学科分类组件（DomainClassification）：
   - Props：domain: string, subDomain: string, confidence: number, hierarchy: string[]
   - 展示层级面包屑：科学 → 天文 → 太阳物理 → 耀斑触发机制
   - 每个层级带置信度圆形进度条

7. 可行性评估雷达图：
   - 使用 Chart.js 的 Radar 类型
   - 5个维度：数据可获取性、方法成熟度、时间合理性、资源可及性、创新性难度
   - 每个维度 0-10 分，动态渲染

8. API 集成：
   - 调用 src/services/bailian.ts 中的 analyzeQuestion(text) 接口
   - 接口返回结构化数据：{ question, entities, domain, feasibility, similarQuestions }
   - 使用 React Query（或 Zustand + useEffect）管理异步状态
   - 加载状态：骨架屏（Skeleton）动画

9. 历史问题列表：
   - 展示最近5条用户输入的问题，可点击快速重新分析
   - 存储在 sessionStore 中

【代码规范】：
- 文件命名：QuestionPage.tsx、QuestionInput.tsx、AnalysisResult.tsx、QuestionParserCard.tsx、EntityExtractionList.tsx、DomainClassification.tsx、FeasibilityRadar.tsx
- 目录结构：src/pages/research/QuestionPage.tsx 及同级目录下组件
- 类型复用：src/types/agents.ts 中的 ResearchQuestion
- 图表组件放在 src/components/charts/RadarChart.tsx（复用封装）

【验收标准】：
1. /research/question 页面可正常访问，两栏布局正确
2. 问题输入框可输入文本，提交后调用百炼API，显示loading状态
3. 分析结果Tab切换正常，5个Tab内容正确展示
4. 问题解析展示问题类型badge和结构化信息
5. 实体抽取展示实体列表，带类型和置信度
6. 学科分类展示层级面包屑和置信度
7. 可行性雷达图使用Chart.js正确渲染5个维度
8. 历史问题列表可点击并重新加载分析结果
9. 移动端响应式：两栏变为单栏垂直堆叠
10. TypeScript 编译无错误，API 错误有 toast 提示

【预期产出】：
- src/pages/research/QuestionPage.tsx
- src/pages/research/QuestionInput.tsx
- src/pages/research/AnalysisResult.tsx
- src/pages/research/QuestionParserCard.tsx
- src/pages/research/EntityExtractionList.tsx
- src/pages/research/DomainClassification.tsx
- src/components/charts/RadarChart.tsx
- src/services/bailian.ts（扩展 analyzeQuestion 方法）
```

---

### 【P3-T3】文献综述（/research/literature）

```
【龙虾角色】：coder
【龙虾ID】：P3-T3
【任务名称】：智能文献综述生成器页面开发
【上下文】：
- 仓库路径：/src/pages/LiteraturePage.tsx
- 前置完成状态：P3-T1已定义全局类型（LiteraturePaper、KnowledgeGap等），百炼API服务已封装
- 设计规范：主色 #0A2540/#00D4AA，字体 Inter/Noto Sans SC
- 组件库：Tailwind CSS，图表使用 Chart.js
- 该页面自动检索、解析、整合文献，生成结构化综述并展示证据图谱

【具体指令】：
1. 页面结构：实现 /research/literature 路由页面，三栏布局：
   - 左栏（col-span-3）：文献检索控制面板
   - 中栏（col-span-6）：文献列表 + 综述报告
   - 右栏（col-span-3）：证据图谱 + 知识缺口

2. 文献检索控制面板（LiteratureSearchPanel）：
   - 搜索输入框：支持关键词、作者、期刊、DOI搜索
   - 数据源选择：多选框（arXiv/SPIE/ADS/中国知网/国家天文数据中心）
   - 筛选条件：时间范围（滑动条）、相关性阈值（0-1）、影响因子范围
   - 搜索按钮：触发百炼文献Agent API调用
   - 高级搜索：展开/折叠，支持布尔逻辑（AND/OR/NOT）

3. 文献列表组件（LiteratureList）：
   - Props：papers: LiteraturePaper[], onSelect: (paper: LiteraturePaper) => void, selectedId?: string
   - 列表项展示：序号、标题、作者、期刊、年份、相关度分数、关键发现摘要
   - 选中项高亮边框（#00D4AA）
   - 支持排序：按相关性/时间/引用次数
   - 分页：每页10条，支持跳页

4. 文献详情卡片（LiteratureDetailCard）：
   - 展示选中文献的完整信息：标题、作者、摘要、方法、结论、数据集、引用格式
   - 支持复制引用（GB/T 7714、APA、MLA格式切换）
   - 标记为"核心文献"按钮，标记后显示特殊图标

5. 综述报告生成区（ReviewReport）：
   - 自动生成的综述文本，分段展示：研究背景、方法概述、主要发现、争议点、未来方向
   - 每段文本可展开/折叠
   - 引用标注：文中[1][2]等标注，点击跳转到对应文献
   - 支持导出：Markdown / PDF / Word 格式（前端模拟导出，实际调用后端API）
   - 顶部显示：检索到的文献总数、核心文献数、平均相关度

6. 证据图谱（EvidenceGraph，简化版）：
   - 使用 SVG 或 D3 的简化版，展示文献间的引用关系
   - 节点：文献（圆形，大小代表影响力），颜色代表相关性（高#00D4AA→中#3B82F6→低#CBD5E0）
   - 边：引用关系（带箭头），粗细代表引用次数
   - 支持缩放、拖拽（使用原生SVG事件或d3-zoom，如d3太重在React中可直接用SVG+transform）
   - 由于不引入d3，使用纯SVG实现：SVG viewBox + 简单的拖拽逻辑（onMouseDown/onMouseMove/onMouseUp）

7. 知识缺口组件（KnowledgeGapList）：
   - Props：gaps: KnowledgeGap[]
   - 列表展示缺口描述，severity用颜色区分：critical(红色)、major(橙色)、minor(黄色)
   - 每个缺口带"生成假设"按钮，点击跳转到 /research/hypothesis?gapId=xxx

8. 文献可信度评估（可选）：
   - 每篇文献带可信度评分（0-100），基于期刊影响因子、引用数、作者H指数
   - 展示在文献列表中，用进度条或颜色表示

9. API 集成：
   - 调用 src/services/bailian.ts 中的 searchLiterature(query, filters) 和 generateReview(paperIds)
   - 搜索结果用 Zustand 的 literatureStore 管理
   - 加载状态：骨架屏 + 进度条（文献Agent执行进度）

【代码规范】：
- 文件命名：LiteraturePage.tsx、LiteratureSearchPanel.tsx、LiteratureList.tsx、LiteratureDetailCard.tsx、ReviewReport.tsx、EvidenceGraph.tsx、KnowledgeGapList.tsx
- 目录结构：src/pages/research/LiteraturePage.tsx 及同级目录下组件
- 类型复用：src/types/agents.ts 中的 LiteraturePaper、KnowledgeGap
- 图表组件放在 src/components/charts/ 下（如需要网络图）
- 搜索参数使用 URL query string 保存，支持刷新后恢复状态

【验收标准】：
1. /research/literature 页面可正常访问，三栏布局正确
2. 检索控制面板支持关键词输入、数据源选择、筛选条件设置
3. 提交搜索后显示loading，调用百炼API，返回文献列表
4. 文献列表展示正确，支持排序和分页，选中项高亮
5. 文献详情卡片展示完整信息，支持引用格式切换和复制
6. 综述报告生成区展示分段文本，引用标注可点击跳转
7. 证据图谱使用SVG展示文献间关系，支持缩放和拖拽
8. 知识缺口列表展示正确，severity颜色区分正确，"生成假设"按钮可跳转
9. 搜索状态持久化到URL query string
10. 移动端响应式：三栏变为单栏垂直堆叠，左栏变为顶部搜索区
11. TypeScript 编译无错误

【预期产出】：
- src/pages/research/LiteraturePage.tsx
- src/pages/research/LiteratureSearchPanel.tsx
- src/pages/research/LiteratureList.tsx
- src/pages/research/LiteratureDetailCard.tsx
- src/pages/research/ReviewReport.tsx
- src/pages/research/EvidenceGraph.tsx
- src/pages/research/KnowledgeGapList.tsx
- src/stores/literatureStore.ts（Zustand store）
- src/services/bailian.ts（扩展 searchLiterature、generateReview 方法）
```

---

### 【P3-T4】假设生成（/research/hypothesis）

```
【龙虾角色】：coder
【龙虾ID】：P3-T4
【任务名称】：科学假设生成与评估系统页面开发
【上下文】：
- 仓库路径：/src/pages/HypothesisPage.tsx
- 前置完成状态：P3-T1已定义全局类型（Hypothesis等），P3-T3已完成文献综述和知识缺口
- 设计规范：主色 #0A2540/#00D4AA，字体 Inter/Noto Sans SC
- 组件库：Tailwind CSS，图表使用 Chart.js（雷达图）
- 该页面基于知识缺口生成可验证的科学假设，并支持多维度评估

【具体指令】：
1. 页面结构：实现 /research/hypothesis 路由页面，三栏布局：
   - 左栏（col-span-3）：研究问题与知识缺口输入
   - 中栏（col-span-6）：候选假设列表（核心区域）
   - 右栏（col-span-3）：评估雷达图 + 操作按钮 + 版本对比

2. 左栏：问题与缺口（HypothesisInputPanel）：
   - 展示当前研究问题（只读卡片，从sessionStore读取）
   - 知识缺口列表：从P3-T3传入或从URL参数读取（?gapId=xxx）
   - 用户可勾选哪些缺口作为假设生成依据
   - "生成候选假设"按钮：调用百炼假设Agent，生成3-5个假设
   - 生成过程中显示loading动画和进度（假设1/5...假设2/5...）
   - 支持重新生成（带温度参数滑动条，0-1）

3. 候选假设卡片（HypothesisCard）：
   - Props：hypothesis: Hypothesis, isSelected: boolean, onSelect: () => void, isRecommended: boolean
   - 卡片样式：左侧4px边框（#00D4AA），hover 时 translateY(-2px) + shadow
   - 顶部：假设编号（H1、H2...），推荐标签（"推荐"绿色badge）
   - 评分展示：创新性、可验证性、逻辑性 三个分数，用颜色区分（高≥8绿色，中6-8黄色，低<6红色）
   - 假设描述：结构化展示（假设：... / 前提：... / 预测：... / 验证方法：...）
   - 底部信息：支持文献数、证据强度、生成时间
   - 支持展开/折叠详细内容（前提、预测、验证方法、反例检测）

4. 中栏顶部：假设对比选择器（HypothesisComparisonBar）：
   - 多选框，选择2-3个假设进行详细对比
   - "对比选中假设"按钮：下方展开对比表格

5. 假设对比表格（HypothesisComparisonTable）：
   - 表格列：维度（创新性、可验证性、逻辑性、证据支持、实用性）
   - 表格行：每个选中的假设，分数高亮最佳值（加粗+绿色）
   - 底部：推荐结论（"H1 在可验证性和创新性方面表现最佳"）

6. 右栏：评估雷达图（HypothesisRadarChart）：
   - 使用 Chart.js Radar，展示最多3个假设的5维度对比
   - 维度：创新性、可验证性、逻辑性、证据支持、实用性
   - 颜色：H1(#00D4AA)、H2(#F59E0B)、H3(#6B7280)
   - 点击假设卡片时自动更新雷达图（选中该假设）
   - 雷达图下方：图例 + 简要解读文字

7. 操作按钮区（HypothesisActions）：
   - "选择此假设并生成研究计划"（主按钮，#00D4AA）→ 跳转到 /research/plan?hypothesisId=xxx
   - "重新生成假设"（次按钮）→ 重新调用API
   - "提供人工反馈"（次按钮）→ 弹出模态框，输入反馈文本，提交后触发假设迭代
   - "查看版本历史"（次按钮）→ 展开版本列表

8. 版本对比组件（VersionComparison）：
   - 展示当前假设的多轮迭代版本（V1.0 → V2.0 → V3.0）
   - 每个版本带：时间、平均评分、变更摘要（"新增反例检测"）
   - 版本间差异可视化：用颜色标注新增/删除/修改内容
   - 支持回滚到某个版本

9. 假设详细弹窗（HypothesisDetailModal）：
   - 点击假设卡片时展开全屏模态（或侧边抽屉）
   - 展示完整假设结构：背景、前提、核心假设、预测、验证方法、反例检测、风险提示
   - 支持编辑前提/验证方法（研究者反馈）

10. API 集成：
    - 调用 src/services/bailian.ts 中的 generateHypotheses(gaps, context) 和 evaluateHypothesis(hypothesisId)
    - 使用 Zustand 的 hypothesisStore 管理假设列表和选中状态
    - 生成假设时流式输出，逐步展示每个假设卡片

【代码规范】：
- 文件命名：HypothesisPage.tsx、HypothesisInputPanel.tsx、HypothesisCard.tsx、HypothesisComparisonBar.tsx、HypothesisComparisonTable.tsx、HypothesisRadarChart.tsx、HypothesisActions.tsx、VersionComparison.tsx、HypothesisDetailModal.tsx
- 目录结构：src/pages/research/HypothesisPage.tsx 及同级目录下组件
- 类型复用：src/types/agents.ts 中的 Hypothesis、KnowledgeGap
- 雷达图组件：src/components/charts/RadarChart.tsx（复用P3-T2的，扩展为多数据集）
- 模态框使用 Tailwind + 简单portal实现（不引入额外UI库），或封装一个通用 Modal 组件

【验收标准】：
1. /research/hypothesis 页面可正常访问，三栏布局正确
2. 左栏展示研究问题和知识缺口，可勾选缺口并生成假设
3. 生成假设时显示进度动画，生成后展示3-5个假设卡片
4. 假设卡片展示正确：编号、评分、描述、结构化信息
5. 假设评分颜色正确：高(绿色)、中(黄色)、低(红色)
6. 选中假设后雷达图自动更新，展示5维度对比
7. 多选假设后可展开对比表格，最佳值高亮
8. 操作按钮区功能正确：生成计划、重新生成、人工反馈、版本历史
9. 版本对比展示多轮迭代，支持回滚
10. 假设详细弹窗展示完整结构，支持编辑
11. 移动端响应式：三栏变为单栏垂直堆叠
12. TypeScript 编译无错误，流式输出动画正常

【预期产出】：
- src/pages/research/HypothesisPage.tsx
- src/pages/research/HypothesisInputPanel.tsx
- src/pages/research/HypothesisCard.tsx
- src/pages/research/HypothesisComparisonBar.tsx
- src/pages/research/HypothesisComparisonTable.tsx
- src/components/charts/RadarChart.tsx
- src/pages/research/HypothesisActions.tsx
- src/pages/research/VersionComparison.tsx
- src/pages/research/HypothesisDetailModal.tsx
- src/stores/hypothesisStore.ts
- src/components/ui/Modal.tsx（通用模态框，如果尚不存在）
- src/services/bailian.ts（扩展 generateHypotheses、evaluateHypothesis、submitFeedback 方法）
```

---

### 【P3-T5】研究计划（/research/plan）

```
【龙虾角色】：coder
【龙虾ID】：P3-T5
【任务名称】：研究计划与实验设计模块页面开发
【上下文】：
- 仓库路径：/src/pages/PlanPage.tsx
- 前置完成状态：P3-T4已完成假设生成和评估，全局类型已定义（ResearchPlan、Experiment、TimelineItem）
- 设计规范：主色 #0A2540/#00D4AA，字体 Inter/Noto Sans SC，代码 JetBrains Mono
- 组件库：Tailwind CSS，图表使用 Chart.js（甘特图用条形图模拟）
- 该页面将选中的假设转化为可执行的研究计划

【具体指令】：
1. 页面结构：实现 /research/plan 路由页面，两栏布局：
   - 左栏（col-span-4）：选中的假设摘要 + 计划配置面板
   - 右栏（col-span-8）：计划详情展示区（Tab切换）

2. 假设摘要卡片（SelectedHypothesisCard）：
   - 从 URL 参数读取 hypothesisId（/research/plan?hypothesisId=xxx）
   - 从 hypothesisStore 获取假设详情，展示标题和核心描述
   - 底部展示该假设的5维度评分（小型进度条）
   - "更换假设"按钮：跳回 /research/hypothesis

3. 计划配置面板（PlanConfigPanel）：
   - 研究周期选择：3个月/6个月/1年/2年（单选按钮组）
   - 资源预算：计算资源/观测时间/人力投入（滑动条）
   - 数据偏好：首选数据源（多选：JW-SSD/JW-FD/TESS/模拟数据）
   - 语言偏好：Python/R/MATLAB（单选，默认Python）
   - "生成研究计划"按钮：调用百炼实验规划师Agent

4. 计划详情展示区（PlanDetailTabs）：
   - Tab 1「实验方案」：展示实验设计详情
   - Tab 2「甘特图」：展示任务时间线
   - Tab 3「代码生成」：展示生成的实验代码
   - Tab 4「资源估算」：展示资源需求表格
   - Tab 5「风险评估」：展示风险矩阵和备案

5. 实验方案组件（ExperimentDesigner）：
   - Props：experiments: Experiment[]
   - 每个实验展示：实验名称、实验步骤（编号列表）、变量控制表（对照组/自变量/因变量）
   - 步骤列表支持拖拽排序（使用简单拖拽逻辑，不引入dnd库）
   - "导出实验方案"按钮：导出为Markdown文本

6. 甘特图组件（GanttChart）：
   - 使用 Chart.js 的 Horizontal Bar 类型模拟甘特图
   - 每个任务一行，X轴为时间（天/周/月）
   - 任务颜色根据类型区分：数据采集(蓝色)、分析(绿色)、代码开发(黄色)、验证(红色)
   - 支持任务进度条叠加（已完成部分用深色，未完成用浅色）
   - 鼠标悬停显示任务详情tooltip
   - 由于是Chart.js，需要自定义tooltip回调展示起止日期

7. 代码生成组件（CodeGenerator）：
   - 展示百炼实验规划师（Qwen-Coder）生成的Python/R/MATLAB代码
   - 代码高亮：使用简单的高亮（pre + code 标签 + 基本颜色类），不引入Prism.js（避免额外依赖）
   - 或直接在pre标签内用span + class实现简单语法高亮（关键字、字符串、注释）
   - 代码可复制（Copy按钮）
   - 代码可编辑（Ace/Monaco太重，用textarea编辑，切换编辑/预览模式）
   - "重新生成代码"按钮：调用API重新生成
   - 支持下载为 .py/.r/.m 文件

8. 资源估算组件（ResourceEstimator）：
   - 表格展示：资源类型、需求数量、单位、估算成本、优先级
   - 资源类型：GPU算力时、存储空间、观测时间、人力、软件许可
   - 底部总计行
   - 成本用人民币符号（¥）展示，数字用 JetBrains Mono

9. 风险评估矩阵（RiskMatrix）：
   - 2x2矩阵：影响程度(低/高) x 发生概率(低/高)
   - 每个风险点放在对应象限中
   - 高影响+高概率（红色区域）的风险优先展示
   - 每个风险带"查看备案"按钮，展开显示备选方案

10. API 集成：
    - 调用 src/services/bailian.ts 中的 generatePlan(hypothesisId, config) 和 generateCode(planId, language)
    - 使用 Zustand 的 planStore 管理计划状态
    - 生成计划时流式输出，逐步展示实验方案和甘特图

11. 计划版本管理：
    - 支持保存多个计划版本
    - 版本对比：展示两个版本的差异（类似diff）
    - 支持导出计划为PDF（前端模拟，调用window.print()或后端API）

【代码规范】：
- 文件命名：PlanPage.tsx、SelectedHypothesisCard.tsx、PlanConfigPanel.tsx、PlanDetailTabs.tsx、ExperimentDesigner.tsx、GanttChart.tsx、CodeGenerator.tsx、ResourceEstimator.tsx、RiskMatrix.tsx
- 目录结构：src/pages/research/PlanPage.tsx 及同级目录下组件
- 类型复用：src/types/agents.ts 中的 ResearchPlan、Experiment、TimelineItem
- 甘特图组件：src/components/charts/GanttChart.tsx
- 代码编辑器使用简单 textarea + 预览模式切换，不引入外部编辑器库

【验收标准】：
1. /research/plan 页面可正常访问，两栏布局正确
2. 假设摘要卡片正确展示从URL传入的假设信息
3. 计划配置面板支持研究周期、资源、数据源、语言选择
4. 提交配置后调用百炼API，显示loading，生成计划详情
5. 实验方案Tab展示实验列表，每个实验包含步骤和变量控制表
6. 甘特图使用Chart.js正确展示任务时间线，颜色区分任务类型，悬停显示详情
7. 代码生成Tab展示Python代码，带简单语法高亮、复制和下载功能
8. 资源估算Tab展示资源表格，底部有总计
9. 风险评估Tab展示2x2矩阵，风险点按象限正确分布
10. 计划版本支持保存和对比
11. 移动端响应式：两栏变为单栏垂直堆叠
12. TypeScript 编译无错误

【预期产出】：
- src/pages/research/PlanPage.tsx
- src/pages/research/SelectedHypothesisCard.tsx
- src/pages/research/PlanConfigPanel.tsx
- src/pages/research/PlanDetailTabs.tsx
- src/pages/research/ExperimentDesigner.tsx
- src/components/charts/GanttChart.tsx
- src/pages/research/CodeGenerator.tsx
- src/pages/research/ResourceEstimator.tsx
- src/pages/research/RiskMatrix.tsx
- src/stores/planStore.ts
- src/services/bailian.ts（扩展 generatePlan、generateCode 方法）
```

---

### 【P3-T6】迭代优化（/research/iterate）

```
【龙虾角色】：coder
【龙虾ID】：P3-T6
【任务名称】：迭代优化与反馈驱动页面开发
【上下文】：
- 仓库路径：/src/pages/IteratePage.tsx
- 前置完成状态：P3-T4已完成假设生成，P3-T5已完成研究计划，全局类型已定义
- 设计规范：主色 #0A2540/#00D4AA，字体 Inter/Noto Sans SC
- 组件库：Tailwind CSS，图表使用 Chart.js
- 该页面支持研究者对假设/计划进行反馈，AI根据反馈迭代优化

【具体指令】：
1. 页面结构：实现 /research/iterate 路由页面，三栏布局：
   - 左栏（col-span-3）：反馈输入面板 + 迭代历史列表
   - 中栏（col-span-6）：版本对比与内容展示（核心区域）
   - 右栏（col-span-3）：评分趋势图 + 迭代建议

2. 反馈输入面板（FeedbackInputPanel）：
   - 当前对象选择：假设 / 研究计划 / 实验方案（单选）
   - 从sessionStore获取当前选中的假设ID和计划ID
   - 反馈类型选择：
     - 假设反馈：逻辑不严密/前提不充分/预测不明确/验证方法不可行/反例未考虑/其他
     - 计划反馈：时间安排不合理/资源不足/步骤缺失/风险未考虑/其他
   - 反馈文本输入框：大文本框，支持多行
   - 优先级：高/中/低
   - 附件上传（预留接口，UI占位）
   - "提交反馈"按钮：调用百炼评估验证官Agent，触发迭代

3. 迭代历史列表（IterationHistoryList）：
   - Props：iterations: { id, version, timestamp, feedback, changes, scoreBefore, scoreAfter }[]
   - 列表展示所有迭代轮次，倒序排列（最新在前）
   - 每个迭代项：版本号、时间、反馈摘要、变更数量、评分变化（箭头+颜色）
   - 点击展开查看详情：完整反馈文本、AI修改内容、变更对比
   - 评分变化：上升（绿色↑）、下降（红色↓）、持平（灰色→）

4. 版本对比组件（VersionDiffViewer）：
   - 两栏并排对比：左侧"上一版本"、右侧"当前版本"
   - 文本级diff：新增内容绿色背景，删除内容红色删除线，修改内容黄色高亮
   - 支持切换对比的两个版本（下拉选择：V1 vs V2、V2 vs V3 等）
   - 对比维度切换：假设描述 / 实验方案 / 代码 / 评估分数
   - 底部汇总：变更统计（新增X处、修改Y处、删除Z处）

5. 假设版本卡片（HypothesisVersionCard）：
   - 展示单个版本的假设完整内容：标题、描述、前提、预测、验证方法、评分
   - 评分用5个小型进度条展示（创新性、可验证性、逻辑性、证据支持、实用性）
   - 支持折叠/展开详细内容
   - 带"设为当前版本"按钮

6. 评分趋势图（ScoreTrendChart）：
   - 使用 Chart.js Line 类型
   - X轴：迭代版本（V1, V2, V3...）
   - Y轴：各维度评分（0-10）
   - 多线：创新性(蓝色)、可验证性(绿色)、逻辑性(黄色)、证据支持(红色)、实用性(紫色)
   - 悬停显示具体分数
   - 支持显示/隐藏某条维度线

7. 迭代建议组件（IterationSuggestions）：
   - 展示AI自动生成的改进建议（基于评估验证官分析）
   - 每条建议带：类型图标、建议文本、预期改进维度、置信度
   - 类型：逻辑改进、数据补充、方法优化、反例处理、表述优化
   - 每条建议带"应用建议"按钮（一键将建议转化为反馈文本填入左侧输入框）

8. 迭代进度追踪（IterationProgressTracker）：
   - 步骤条：反馈提交 → AI分析 → 生成修改 → 评估新方案 → 完成
   - 当前步骤高亮（#00D4AA），已完成步骤打勾，未开始步骤灰色
   - 每个步骤显示预计时间和实际时间

9. API 集成：
   - 调用 src/services/bailian.ts 中的：
     - submitFeedback(feedback) — 提交反馈
     - iterateHypothesis(hypothesisId, feedback) — 触发迭代
     - getIterationHistory(hypothesisId) — 获取迭代历史
   - 使用 Zustand 的 iterateStore 管理迭代状态
   - 迭代过程流式输出，实时更新进度追踪器

10. 协作功能（预留）：
    - 分享迭代链接按钮（复制到剪贴板）
    - 邀请协作者输入框（预留，UI占位）

【代码规范】：
- 文件命名：IteratePage.tsx、FeedbackInputPanel.tsx、IterationHistoryList.tsx、VersionDiffViewer.tsx、HypothesisVersionCard.tsx、ScoreTrendChart.tsx、IterationSuggestions.tsx、IterationProgressTracker.tsx
- 目录结构：src/pages/research/IteratePage.tsx 及同级目录下组件
- 类型复用：src/types/agents.ts 中的 Hypothesis
- 图表组件：src/components/charts/LineChart.tsx（复用封装）
- Diff渲染使用简单文本diff算法（不引入外部diff库），用 split('\n') + 逐行对比实现基本diff效果

【验收标准】：
1. /research/iterate 页面可正常访问，三栏布局正确
2. 反馈输入面板支持选择对象、反馈类型、输入文本、优先级
3. 提交反馈后触发百炼API，显示迭代进度追踪器
4. 迭代历史列表展示所有轮次，倒序排列，评分变化用颜色箭头
5. 版本对比组件正确展示两栏diff，新增/删除/修改内容颜色正确
6. 假设版本卡片展示完整内容和评分
7. 评分趋势图使用Chart.js正确展示多维度评分随版本变化
8. 迭代建议组件展示AI建议，支持一键应用
9. 迭代进度追踪器展示5步骤，当前步骤高亮
10. 移动端响应式：三栏变为单栏垂直堆叠
11. TypeScript 编译无错误，diff渲染正确

【预期产出】：
- src/pages/research/IteratePage.tsx
- src/pages/research/FeedbackInputPanel.tsx
- src/pages/research/IterationHistoryList.tsx
- src/pages/research/VersionDiffViewer.tsx
- src/pages/research/HypothesisVersionCard.tsx
- src/components/charts/LineChart.tsx
- src/pages/research/IterationSuggestions.tsx
- src/pages/research/IterationProgressTracker.tsx
- src/stores/iterateStore.ts
- src/services/bailian.ts（扩展 submitFeedback、iterateHypothesis、getIterationHistory 方法）
```

---

## Phase 4：数据与图谱（第7-8周）

---

### 【P4-T1】天文数据浏览器（/data/astronomy）

```
【龙虾角色】：coder
【龙虾ID】：P4-T1
【任务名称】：天文数据浏览器页面开发（JW-SSD/JW-FD/TESS）
【上下文】：
- 仓库路径：/src/pages/AstroDataPage.tsx
- 前置完成状态：P3各页面已完成，全局类型已定义（AstroDataRow）
- 设计规范：主色 #0A2540/#00D4AA，代码字体 JetBrains Mono
- 组件库：Tailwind CSS，图表使用 Chart.js
- 数据源：JW-SSD太阳黑子数据集、JW-FD耀斑数据集、TESS光变曲线
- 该页面集成国家天文科学数据中心数据，支持天文研究数据浏览

【具体指令】：
1. 页面结构：实现 /data/astronomy 路由页面，两栏布局：
   - 左栏（col-span-3）：数据源选择 + 筛选面板
   - 右栏（col-span-9）：数据表格 + 数据可视化 + AI洞察

2. 数据源选择器（DataSourceSelector）：
   - 三个选项卡：JW-SSD（太阳黑子）、JW-FD（耀斑）、TESS（光变曲线）
   - 每个选项卡带：数据源名称、描述、记录数、最后更新时间
   - 切换数据源时清空当前表格数据，显示loading
   - 默认选中 JW-SSD

3. 数据筛选面板（DataFilterPanel）：
   - 根据数据源动态展示筛选条件：
     - JW-SSD：NOAA编号、磁场类型（α/β/βγ/δ）、时间范围、剪切角范围、缠绕度范围
     - JW-FD：耀斑等级（C/M/X）、时间范围、活动区编号
     - TESS：恒星TIC编号、光变类型（耀发/食变/脉动）、时间范围
   - 筛选条件使用输入框、下拉选择、双滑块（范围）
   - "应用筛选"按钮和"重置筛选"按钮
   - 筛选状态保存到URL query参数

4. 数据表格组件（AstroDataTable）：
   - Props：data: AstroDataRow[], columns: ColumnDef[], onRowClick: (row) => void
   - 动态列：根据数据源切换列定义
     - JW-SSD列：ID、观测时间、NOAA编号、磁场类型、剪切角、缠绕度、磁梯度、爆发等级
     - JW-FD列：ID、事件时间、NOAA编号、耀斑等级、X射线峰值通量、持续时间、活动区位置
     - TESS列：ID、TIC编号、观测时间、光变类型、星等变化、周期、置信度
   - 表格样式：表头灰色背景，行hover蓝色背景，交替行浅色背景
   - 数据值用 JetBrains Mono 字体，数值右对齐
   - 特殊值高亮：X级耀斑红色、M级黄色、C级绿色
   - 分页：每页20条，支持跳页和页码显示
   - 排序：点击表头排序，支持升序/降序切换

5. 数据可视化区（DataVisualizationSection）：
   - 根据数据源展示不同图表：
     - JW-SSD：
       - 散点图：剪切角 vs 爆发等级（Chart.js Scatter）
       - 饼图：磁场类型分布（Chart.js Doughnut）
     - JW-FD：
       - 时间序列：每日耀发数量/总能量（Chart.js Line）
       - 柱状图：各等级耀斑分布（Chart.js Bar）
     - TESS：
       - 光变曲线图：时间 vs 相对亮度（Chart.js Line，多数据集）
       - 箱线图：不同类型光变曲线的周期分布（用Bar模拟）
   - 图表容器高度固定（h-64），responsive: true
   - 图表颜色统一使用项目色板

6. AI数据洞察组件（AIDataInsights）：
   - 展示3-5条AI自动生成的数据洞察（从百炼API获取）
   - 每条洞察带：发现图标、洞察文本、置信度、相关数据点数量
   - 类型区分：统计发现（蓝色）、异常检测（红色）、趋势预测（绿色）、关联发现（紫色）
   - 支持点击"查看详情"展开相关数据表格行高亮

7. 数据导出功能：
   - 导出按钮：CSV / JSON / Excel（前端CSV和JSON直接导出，Excel调用后端API）
   - 导出范围：当前筛选结果 / 当前页 / 全部数据
   - 导出进度：大数据量时显示进度条

8. 数据详情抽屉（DataDetailDrawer）：
   - 点击表格行展开右侧抽屉（或底部面板）
   - 展示该行所有字段的完整信息
   - 展示该数据点的原始数据来源和采集时间
   - 展示该数据点的AI分析摘要（如有）
   - "加入数据融合"按钮：将数据点加入P4-T2的融合列表

9. API 集成：
   - 创建 src/services/astro.ts：
     - fetchAstroData(source, filters, pagination) — 获取天文数据
     - getDataInsights(source, filters) — 获取AI洞察
   - 数据模拟：由于天文数据API可能受限，需要内置模拟数据生成器（生成1000条合理数据）
   - 使用 Zustand 的 astroDataStore 管理数据状态和筛选条件
   - 大数据表格使用虚拟滚动（如超过1000条），可用 react-window 或简单分页处理

10. 数据质量指示：
    - 表格上方展示数据质量指标：完整度、异常值比例、最新数据时间
    - 用进度条和颜色展示

【代码规范】：
- 文件命名：AstroDataPage.tsx、DataSourceSelector.tsx、DataFilterPanel.tsx、AstroDataTable.tsx、DataVisualizationSection.tsx、AIDataInsights.tsx、DataDetailDrawer.tsx
- 目录结构：src/pages/data/AstroDataPage.tsx 及同级目录下组件
- 类型复用：src/types/agents.ts 中的 AstroDataRow
- 表格组件可封装为通用 DataTable 组件放在 src/components/data/
- 图表组件放在 src/components/charts/ 下
- 服务层：src/services/astro.ts
- 数据模拟：src/mock/astroData.ts

【验收标准】：
1. /data/astronomy 页面可正常访问，两栏布局正确
2. 数据源选择器支持JW-SSD/JW-FD/TESS切换，切换后加载对应数据
3. 筛选面板根据数据源动态展示条件，筛选结果正确
4. 数据表格展示正确，列随数据源切换，特殊值高亮，支持排序和分页
5. 数据可视化区展示对应图表，Chart.js渲染正确，颜色统一
6. AI数据洞察展示正确，支持类型区分和详情展开
7. 数据导出功能正常（CSV/JSON直接下载）
8. 数据详情抽屉展示完整信息，"加入数据融合"按钮可用
9. 筛选状态保存到URL，刷新后恢复
10. 模拟数据合理，与真实天文数据格式一致
11. 移动端响应式：左栏筛选变为顶部折叠区，表格横向滚动
12. TypeScript 编译无错误，大表格分页性能良好

【预期产出】：
- src/pages/data/AstroDataPage.tsx
- src/pages/data/DataSourceSelector.tsx
- src/pages/data/DataFilterPanel.tsx
- src/components/data/AstroDataTable.tsx
- src/components/data/DataTable.tsx（通用表格，复用）
- src/pages/data/DataVisualizationSection.tsx
- src/pages/data/AIDataInsights.tsx
- src/pages/data/DataDetailDrawer.tsx
- src/services/astro.ts
- src/mock/astroData.ts（JW-SSD/JW-FD/TESS 模拟数据生成器）
- src/stores/astroDataStore.ts
- src/components/charts/ScatterChart.tsx、PieChart.tsx、LineChart.tsx、BarChart.tsx
```

---

### 【P4-T2】数据整合（/data/integration）

```
【龙虾角色】：coder
【龙虾ID】：P4-T2
【任务名称】：多源数据融合界面开发
【上下文】：
- 仓库路径：/src/pages/DataIntegrationPage.tsx
- 前置完成状态：P4-T1已完成天文数据浏览器，全局类型已定义
- 设计规范：主色 #0A2540/#00D4AA，代码字体 JetBrains Mono
- 组件库：Tailwind CSS，图表使用 Chart.js
- 该页面支持多源天文数据的融合、对齐和关联分析

【具体指令】：
1. 页面结构：实现 /data/integration 路由页面，三栏布局：
   - 左栏（col-span-3）：数据源选择器 + 已选数据列表
   - 中栏（col-span-6）：融合预览与配置（核心区域）
   - 右栏（col-span-3）：融合结果统计 + 关联分析

2. 数据源选择器（IntegrationSourceSelector）：
   - 展示可用数据源列表：JW-SSD、JW-FD、TESS、SDO、LAMOST（每个带图标和记录数）
   - 多选框选择要融合的数据源
   - 每个数据源带"预览"按钮，点击展开10条样本数据
   - 已选数据源在底部汇总栏展示，可点击移除

3. 已选数据列表（SelectedDataList）：
   - 从P4-T1的"加入数据融合"按钮或手动上传添加数据
   - 每个数据项展示：来源、数据类型、记录数、时间范围、字段列表
   - 支持拖拽排序（决定融合优先级）
   - 每个数据项带删除按钮
   - 底部展示总数据量和预计融合时间

4. 融合配置面板（FusionConfigPanel）：
   - 融合键选择：选择用于对齐数据的关键字段（如时间、NOAA编号、活动区ID）
   - 时间对齐选项：
     - 精确匹配（同一时刻）
     - 时间窗口（±N小时/天）
     - 最近邻匹配
   - 缺失值处理：删除 / 插值（线性/样条） / 填充（均值/中位数）
   - 冲突处理：优先数据源排序（拖拽排序）
   - "执行融合"按钮：调用后端API（或前端模拟融合逻辑）

5. 融合预览表格（FusionPreviewTable）：
   - 展示融合后的数据预览（前50行）
   - 列头带来源标识（不同颜色背景区分来源字段）
   - 展示融合标记：匹配成功（绿色勾）、时间窗口匹配（黄色半勾）、缺失值（红色横线）
   - 支持列的显示/隐藏
   - 支持按融合标记筛选（只看冲突行、只看完整行等）

6. 数据关联可视化（DataCorrelationViz）：
   - 使用散点图矩阵（Scatter Plot Matrix）或简化版热力图
   - 展示不同数据源字段间的相关系数
   - 颜色：正相关（蓝色）、负相关（红色）、无相关（灰色）
   - 使用 Chart.js Bubble 或自定义 SVG 热力图
   - 支持点击某个相关系数查看散点图详情

7. 融合结果统计（FusionStatsPanel）：
   - 展示融合统计卡片：
     - 总记录数、融合成功数、部分匹配数、缺失值数
     - 各数据源贡献比例（进度条）
     - 融合后数据质量评分（0-100）
   - 数据质量指标：完整度、一致性、时效性、准确性
   - 每个指标用圆形进度条展示

8. 关联分析组件（CorrelationAnalysis）：
   - 自动发现的数据关联规则（如："当JW-SSD磁场类型为δ时，JW-FD有85%概率记录X级耀斑"）
   - 每条规则带：置信度、支持度、提升度、可视化证据（迷你条形图）
   - 规则按置信度排序，支持筛选
   - "导出规则"按钮

9. 融合历史管理（FusionHistory）：
   - 保存历次融合配置和结果
   - 列表展示：融合时间、数据源、记录数、质量评分
   - 支持重新加载历史融合配置
   - 支持删除历史记录

10. API 集成：
    - 创建 src/services/integration.ts：
      - fuseData(sources, config) — 执行数据融合
      - analyzeCorrelation(fusedData) — 关联分析
      - getFusionHistory() — 获取融合历史
    - 使用 Zustand 的 integrationStore 管理状态
    - 融合过程显示进度条和实时日志

11. 导出融合结果：
    - 支持导出为 CSV / JSON / Parquet（Parquet调用后端）
    - 导出包含融合标记和元数据

【代码规范】：
- 文件命名：DataIntegrationPage.tsx、IntegrationSourceSelector.tsx、SelectedDataList.tsx、FusionConfigPanel.tsx、FusionPreviewTable.tsx、DataCorrelationViz.tsx、FusionStatsPanel.tsx、CorrelationAnalysis.tsx、FusionHistory.tsx
- 目录结构：src/pages/data/DataIntegrationPage.tsx 及同级目录下组件
- 数据表格复用 src/components/data/DataTable.tsx
- 图表复用 src/components/charts/ 下组件
- 服务层：src/services/integration.ts
- 融合逻辑（前端模拟）放在 src/utils/fusionEngine.ts

【验收标准】：
1. /data/integration 页面可正常访问，三栏布局正确
2. 数据源选择器支持多选，每个数据源可预览样本
3. 已选数据列表展示正确，支持删除和排序
4. 融合配置面板支持融合键、时间对齐、缺失值处理、冲突处理配置
5. 执行融合后展示预览表格，融合标记颜色正确
6. 数据关联可视化展示相关系数热力图，颜色正确
7. 融合结果统计展示正确，质量指标用圆形进度条
8. 关联分析组件展示自动发现的规则，带置信度等统计量
9. 融合历史管理支持保存、加载、删除
10. 融合结果支持导出CSV/JSON
11. 移动端响应式：三栏变为单栏垂直堆叠
12. TypeScript 编译无错误，融合模拟逻辑正确

【预期产出】：
- src/pages/data/DataIntegrationPage.tsx
- src/pages/data/IntegrationSourceSelector.tsx
- src/pages/data/SelectedDataList.tsx
- src/pages/data/FusionConfigPanel.tsx
- src/pages/data/FusionPreviewTable.tsx
- src/pages/data/DataCorrelationViz.tsx
- src/pages/data/FusionStatsPanel.tsx
- src/pages/data/CorrelationAnalysis.tsx
- src/pages/data/FusionHistory.tsx
- src/services/integration.ts
- src/stores/integrationStore.ts
- src/utils/fusionEngine.ts
```

---

### 【P4-T3】知识图谱可视化（/knowledge/graph）

```
【龙虾角色】：coder
【龙虾ID】：P4-T3
【任务名称】：天文知识图谱可视化页面开发（SVG力导向图）
【上下文】：
- 仓库路径：/src/pages/KnowledgeGraphPage.tsx
- 前置完成状态：P3各页面已完成，全局类型已定义（KnowledgeNode、KnowledgeEdge）
- 设计规范：主色 #0A2540/#00D4AA
- 组件库：Tailwind CSS，不使用D3（避免重依赖），使用纯SVG实现力导向图
- 该页面构建可查询、可视化的天文领域知识图谱

【具体指令】：
1. 页面结构：实现 /knowledge/graph 路由页面，四栏布局：
   - 顶部栏（全宽）：搜索栏 + 图谱控制按钮
   - 左栏（col-span-3）：实体类型筛选 + 实体列表
   - 中栏（col-span-6）：图谱可视化画布（核心区域）
   - 右栏（col-span-3）：选中实体详情 + 关联路径

2. 搜索栏（GraphSearchBar）：
   - 搜索输入框：支持按实体名称、类型、关系搜索
   - 自动补全：输入时展示匹配实体列表（下拉）
   - 搜索按钮和清除按钮
   - 搜索结果高亮在图谱中（脉冲动画）

3. 图谱控制按钮（GraphControls）：
   - 缩放控制：放大/缩小/重置（+ / - / ⟲）
   - 布局切换：力导向 / 环形 / 层次（3个按钮）
   - 物理模拟开关：开启/暂停力导向模拟
   - 截图导出：将SVG保存为PNG（使用canvas绘制SVG再导出）
   - 全屏切换按钮

4. 实体类型筛选（EntityTypeFilter）：
   - 复选框列表：天体对象（蓝色）、物理概念（黄色）、观测设备（绿色）、科学方法（紫色）、数据产品（粉色）、研究机构（灰色）
   - 每个类型带：颜色圆点、类型名称、实体数量
   - 全选/全不选按钮
   - 筛选结果实时更新图谱展示

5. 实体列表（EntityList）：
   - 按类型分组展示所有实体
   - 每个实体：名称、类型标签、关系数量
   - 支持字母排序和按关系数排序
   - 点击实体在图谱中聚焦该节点（居中并高亮）
   - 悬停显示实体简介tooltip

6. 图谱可视化画布（GraphCanvas）— 核心组件，纯SVG实现：
   - 使用 SVG viewBox="0 0 800 600" 自适应容器
   - 力导向模拟：使用自定义简化版力导向算法（不引入D3-force）
     - 节点间斥力：Coulomb-like 排斥，距离越近斥力越大
     - 边引力：Hooke-like 吸引，边越长引力越大
     - 中心引力：节点向画布中心吸引
     - 使用 requestAnimationFrame 实现动画循环
     - 每帧更新节点位置，重新渲染SVG元素
   - 节点渲染：
     - 圆形节点，半径根据类型不同（天体>概念>方法>设备）
     - 颜色根据类型：天体(蓝色系)、概念(黄色系)、设备(绿色系)、方法(紫色系)、数据(粉色系)、机构(灰色系)
     - 节点标签：名称在节点下方，文字不重叠处理（简单偏移）
     - 选中节点：stroke #00D4AA，stroke-width 2，外发光效果（filter drop-shadow）
     - 悬停节点：放大1.1倍，亮度提升
   - 边渲染：
     - 带箭头的直线（marker-end="url(#arrow)"）
     - 颜色：#CBD5E0，透明度根据关系数量动态调整（边越少越明显）
     - 粗细：1-2px，关系类型标签在边中部（文字路径或简单偏移）
   - 交互：
     - 节点可拖拽：onMouseDown 记录偏移，onMouseMove 更新位置，onMouseUp 释放
     - 拖拽时暂停力导向模拟，释放后恢复
     - 点击节点选中，更新右栏详情
     - 滚轮缩放：修改 viewBox 或 transform scale
     - 画布平移：拖拽空白处平移整个画布
     - 双击空白处：重置视图
   - 性能优化：
     - 节点数>100时，简化渲染（隐藏标签，只显示高关系数节点）
     - 使用 useRef 存储节点位置，避免React状态频繁更新
     - 力导向计算在 requestAnimationFrame 中，每帧只更新DOM属性不触发重渲染

7. 力导向算法实现（useForceGraph hook）：
   - 输入：nodes: KnowledgeNode[], edges: KnowledgeEdge[], width, height
   - 输出：nodePositions: { id, x, y }[]
   - 参数：repulsionStrength, springLength, damping, centerGravity
   - 使用 useRef 存储速度/位置，每帧更新
   - 收敛条件：总动能 < threshold 或最大迭代次数

8. 选中实体详情（EntityDetailPanel）：
   - 展示：实体名称、类型、图标、简介、属性列表（键值对）
   - 属性列表：如天体对象展示（质量、半径、光谱类型、距离）
   - 数据来源、置信度（0-1）、最后更新时间
   - "在图谱中展开"按钮：展示该实体的1-hop邻居
   - "加入研究会话"按钮：将实体加入当前研究问题上下文

9. 关联路径发现（PathDiscoveryPanel）：
   - 选择两个实体，发现它们之间的最短路径/关联路径
   - 展示路径：实体A → 关系1 → 实体B → 关系2 → 实体C
   - 每条路径带：路径长度、关系强度、置信度
   - 支持多条路径对比（如2-hop vs 3-hop路径）
   - 路径在图谱中高亮（节点和边用 #00D4AA 高亮）

10. 布局算法（三种）：
    - 力导向：上述自定义算法
    - 环形：节点按类型分组，均匀分布在圆周上
    - 层次：中心节点在中心，1-hop节点在第二层，2-hop在第三层（按BFS布局）
    - 切换布局时平滑过渡动画（线性插值位置）

11. API 集成：
    - 创建 src/services/knowledge.ts：
      - getGraphData(domain, filters) — 获取图谱数据
      - searchEntity(query) — 搜索实体
      - getEntityDetails(entityId) — 获取实体详情
      - findPath(sourceId, targetId) — 路径发现
    - 使用 Zustand 的 knowledgeStore 管理图谱状态
    - 内置模拟数据：至少50个节点、80条边（天文领域）

12. 图谱数据示例：
    - 节点：太阳、耀斑、黑子、日冕、磁场、磁重联、剪切角、缠绕度、TESS、SDO、JW-SSD、δ型、β型、X射线、光变曲线、数值模拟、蒙特卡洛、国家天文台、LAMOST等
    - 边：太阳→发生→耀斑、磁场→驱动→耀斑、TESS→观测→恒星、δ型→属于→黑子、JW-SSD→包含→黑子数据等

【代码规范】：
- 文件命名：KnowledgeGraphPage.tsx、GraphSearchBar.tsx、GraphControls.tsx、EntityTypeFilter.tsx、EntityList.tsx、GraphCanvas.tsx、useForceGraph.ts、EntityDetailPanel.tsx、PathDiscoveryPanel.tsx
- 目录结构：src/pages/knowledge/KnowledgeGraphPage.tsx 及同级目录下组件
- 类型复用：src/types/agents.ts 中的 KnowledgeNode、KnowledgeEdge
- 力导向算法：src/hooks/useForceGraph.ts
- 图谱服务：src/services/knowledge.ts
- 模拟数据：src/mock/knowledgeGraph.ts

【验收标准】：
1. /knowledge/graph 页面可正常访问，四栏布局正确
2. 搜索栏支持实体搜索，自动补全正常，搜索结果高亮
3. 图谱控制按钮功能正常：缩放、布局切换、物理模拟、截图、全屏
4. 实体类型筛选支持6种类型，筛选结果实时更新图谱
5. 实体列表支持点击聚焦，图谱中对应节点居中高亮
6. 图谱画布使用SVG正确渲染节点和边，节点颜色按类型区分
7. 力导向模拟运行正常，节点可拖拽，拖拽时暂停模拟
8. 节点点击选中后右栏展示实体详情和属性列表
9. 关联路径发现支持选择两个实体，展示路径和高亮
10. 三种布局（力导向/环形/层次）切换正常，切换有平滑动画
11. 滚轮缩放和画布平移正常
12. 节点数>100时性能良好，不卡顿（requestAnimationFrame优化）
13. 移动端响应式：左栏和右栏变为可折叠抽屉，图谱占全屏
14. TypeScript 编译无错误，SVG交互事件正确

【预期产出】：
- src/pages/knowledge/KnowledgeGraphPage.tsx
- src/pages/knowledge/GraphSearchBar.tsx
- src/pages/knowledge/GraphControls.tsx
- src/pages/knowledge/EntityTypeFilter.tsx
- src/pages/knowledge/EntityList.tsx
- src/components/knowledge/GraphCanvas.tsx
- src/hooks/useForceGraph.ts
- src/pages/knowledge/EntityDetailPanel.tsx
- src/pages/knowledge/PathDiscoveryPanel.tsx
- src/services/knowledge.ts
- src/stores/knowledgeStore.ts
- src/mock/knowledgeGraph.ts（至少50节点80边）
```

---

### 【P4-T4】证据链展示（/knowledge/evidence）

```
【龙虾角色】：coder
【龙虾ID】：P4-T4
【任务名称】：证据链展示页面开发（假设→文献→证据链式展示）
【上下文】：
- 仓库路径：/src/pages/EvidenceChainPage.tsx
- 前置完成状态：P3-T3已完成文献综述，P3-T4已完成假设生成，P4-T3已完成知识图谱
- 设计规范：主色 #0A2540/#00D4AA
- 组件库：Tailwind CSS，使用纯CSS/SVG实现链式可视化（不引入额外图表库）
- 该页面为假设生成构建完整的证据链，展示假设→文献→数据→实验→结论的完整逻辑

【具体指令】：
1. 页面结构：实现 /knowledge/evidence 路由页面，两栏布局：
   - 左栏（col-span-4）：证据链导航树 + 假设选择器
   - 右栏（col-span-8）：证据链可视化 + 详细内容

2. 假设选择器（HypothesisSelector）：
   - 下拉选择当前研究的假设（从hypothesisStore读取）
   - 或从URL参数读取（?hypothesisId=xxx）
   - 展示假设标题和简要描述
   - 切换假设时重新加载证据链

3. 证据链导航树（EvidenceChainTree）：
   - 树形结构展示证据链层次：
     - 第一层：假设（根节点）
     - 第二层：核心前提（可展开）
     - 第三层：支持文献（可展开）
     - 第四层：实验数据（可展开）
     - 第五层：推导结论（可展开）
   - 每个节点带：类型图标、标题、置信度（小进度条）、状态图标（✓/✗/？）
   - 节点可展开/折叠，展开后显示子节点
   - 点击节点在右栏展示详情
   - 树结构使用缩进和竖线表示层级（纯CSS实现）

4. 证据链可视化（EvidenceChainViz）— 核心组件：
   - 使用水平流程图/时间线形式展示证据链
   - 从左到右：假设 → 前提 → 文献证据 → 数据证据 → 实验证据 → 结论
   - 每个节点用卡片表示，带类型颜色：
     - 假设（#00D4AA 背景）、前提（#0A2540 背景）、文献（#3B82F6 背景）、
     - 数据（#F59E0B 背景）、实验（#10B981 背景）、结论（#8B5CF6 背景）
   - 节点间用箭头连接，箭头粗细代表证据强度（强粗、弱细）
   - 箭头颜色：强证据（#00D4AA）、中等（#3B82F6）、弱（#CBD5E0）
   - 节点可点击展开详情面板（下方滑出）
   - 支持链的完整性检查：缺失环节用虚线箭头 + 红色警告标记
   - 支持多条证据链对比（最多2条，上下并排）
   - 使用纯CSS和SVG实现，不使用D3或流程图库

5. 证据详情面板（EvidenceDetailPanel）：
   - 根据选中证据类型展示不同内容：
     - 假设：完整描述、评分、版本历史
     - 文献：标题、作者、期刊、关键发现、引用位置、相关度
     - 数据：数据源、样本量、统计结果、置信区间、图表
     - 实验：实验设计、变量、结果、误差分析、可重复性
     - 结论：推导逻辑、适用条件、不确定性、未来验证方向
   - 每个详情带"查看来源"按钮（跳转到原始页面）
   - 支持编辑置信度（研究者手动调整）

6. 证据评估矩阵（EvidenceEvaluationMatrix）：
   - 表格展示每条证据的多维度评估：
     - 维度：来源可信度、方法严谨性、数据充分性、逻辑一致性、时效性、可重复性
     - 每个维度 0-10 分，用小型进度条
     - 底部：加权总分和可信度等级（高/中/低）
   - 支持调整权重（每个维度可调整权重slider）
   - 总分实时重新计算

7. 链式完整性检查（ChainIntegrityChecker）：
   - 自动检查证据链的完整性：
     - 检查1：假设是否有充分文献支持（文献数<3则警告）
     - 检查2：文献证据是否与数据证据一致（不一致则标记冲突）
     - 检查3：数据证据是否覆盖所有前提（未覆盖则标记缺失）
     - 检查4：推导结论是否逻辑严密（调用百炼评估Agent）
   - 检查结果用卡片列表展示：通过（绿色勾）、警告（黄色叹号）、错误（红色叉）
   - 每个检查结果带"修复建议"按钮，点击展开AI建议

8. 证据溯源（EvidenceProvenance）：
   - 展示每条证据的完整来源链：
     - 原始数据 → 处理方法 → 分析工具 → 结论 → 引用位置
   - 使用垂直时间线展示（时间线样式：左侧竖线 + 右侧卡片）
   - 每个步骤带：时间、操作者（AI/人工）、工具、输入输出摘要
   - 支持导出溯源报告（JSON格式）

9. 证据强度统计（EvidenceStrengthStats）：
   - 顶部统计卡片：
     - 总证据数、文献证据数、数据证据数、实验证据数
     - 平均证据强度（0-100）
     - 链完整性评分（0-100）
   - 使用进度条和数字展示

10. API 集成：
    - 创建 src/services/evidence.ts：
      - getEvidenceChain(hypothesisId) — 获取证据链
      - evaluateEvidence(evidenceId) — 评估单条证据
      - checkChainIntegrity(hypothesisId) — 完整性检查
      - updateConfidence(evidenceId, score) — 更新置信度
    - 使用 Zustand 的 evidenceStore 管理状态
    - 证据链数据可由前端基于假设和文献数据自动构建（无需后端API时）

11. 交互设计：
    - 右栏证据链可视化支持：
      - 拖拽节点重新排列（仅调整展示顺序，不改变逻辑）
      - 点击节点高亮相关上下游节点（高亮路径上的所有节点和边）
      - 双击节点锁定高亮（再次点击取消）

【代码规范】：
- 文件命名：EvidenceChainPage.tsx、HypothesisSelector.tsx、EvidenceChainTree.tsx、EvidenceChainViz.tsx、EvidenceDetailPanel.tsx、EvidenceEvaluationMatrix.tsx、ChainIntegrityChecker.tsx、EvidenceProvenance.tsx、EvidenceStrengthStats.tsx
- 目录结构：src/pages/knowledge/EvidenceChainPage.tsx 及同级目录下组件
- 类型复用：src/types/agents.ts 中的 EvidenceChainItem、Hypothesis、LiteraturePaper
- 服务层：src/services/evidence.ts
- 树形组件使用纯Tailwind实现，不引入树形组件库
- 证据链可视化使用纯CSS+SVG，不引入流程图库

【验收标准】：
1. /knowledge/evidence 页面可正常访问，两栏布局正确
2. 假设选择器支持选择当前研究的假设
3. 证据链导航树展示5层树形结构，支持展开/折叠，点击节点展示详情
4. 证据链可视化使用水平流程图展示，节点颜色按类型区分，箭头粗细代表强度
5. 缺失环节用虚线箭头+红色警告标记
6. 证据详情面板根据类型展示不同内容，信息完整
7. 证据评估矩阵展示6维度评估，支持权重调整，总分实时计算
8. 链式完整性检查展示4项检查结果，带修复建议
9. 证据溯源使用时间线展示完整来源链
10. 统计卡片展示正确，数据准确
11. 节点高亮路径功能正常，双击锁定/取消
12. 移动端响应式：左栏变为顶部折叠区，右栏全屏
13. TypeScript 编译无错误，树形结构和流程图渲染正确

【预期产出】：
- src/pages/knowledge/EvidenceChainPage.tsx
- src/pages/knowledge/HypothesisSelector.tsx
- src/pages/knowledge/EvidenceChainTree.tsx
- src/components/knowledge/EvidenceChainViz.tsx
- src/pages/knowledge/EvidenceDetailPanel.tsx
- src/pages/knowledge/EvidenceEvaluationMatrix.tsx
- src/pages/knowledge/ChainIntegrityChecker.tsx
- src/pages/knowledge/EvidenceProvenance.tsx
- src/pages/knowledge/EvidenceStrengthStats.tsx
- src/services/evidence.ts
- src/stores/evidenceStore.ts
- src/utils/evidenceBuilder.ts（前端自动构建证据链逻辑）
```

---

### 【P4-T5】数据大屏（/visualization/dashboard）

```
【龙虾角色】：coder
【龙虾ID】：P4-T5
【任务名称】：科研数据可视化大屏页面开发
【上下文】：
- 仓库路径：/src/pages/DashboardPage.tsx
- 前置完成状态：Phase 3所有页面已完成，各Store已收集数据
- 设计规范：主色 #0A2540/#00D4AA，字体 Inter/Noto Sans SC，代码 JetBrains Mono
- 组件库：Tailwind CSS，图表使用 Chart.js（所有图表类型）
- 该页面展示AI-Scientist Hub平台的运行数据和科研成果统计

【具体指令】：
1. 页面结构：实现 /visualization/dashboard 路由页面，全宽布局：
   - 顶部：系统状态栏 + 实时时间 + 刷新按钮
   - 第一行：4个关键指标卡片（KPI Cards）
   - 第二行：3个图表（会话趋势 / 学科分布 / Agent负载）
   - 第三行：最新研究动态 + 实时告警
   - 整体使用深色/浅色主题切换（默认浅色，但支持数据大屏专用深色模式）
   - 深色模式：背景 #0A2540，卡片 #0D3B5C，文字白色/灰色，强调色 #00D4AA

2. 系统状态栏（SystemStatusBar）：
   - 展示：系统运行状态（绿色正常）、最后更新时间、数据刷新按钮（手动刷新）
   - 自动刷新：每30秒自动刷新一次（setInterval + useEffect清理）
   - 刷新时显示旋转动画
   - 主题切换按钮：浅色/深色模式切换

3. 关键指标卡片（KpiCards）— 4个卡片：
   - 卡片1：今日研究会话数（数字 + 较昨日变化百分比 + 趋势箭头）
   - 卡片2：生成假设总数（数字 + 较昨日变化 + 趋势箭头）
   - 卡片3：百炼API调用次数（数字 + Token消耗量）
   - 卡片4：平均评估得分（数字 + 较上周变化 + 趋势箭头）
   - 每个卡片样式：白色背景（深色模式下深色背景），圆角，阴影，hover微上浮
   - 数字使用 JetBrains Mono 字体，大号（text-2xl font-bold）
   - 变化趋势：上升绿色（↑）、下降红色（↓）、持平灰色（→）
   - 卡片顶部带小图标和标签

4. 研究会话趋势图（SessionTrendChart）：
   - 使用 Chart.js Line 类型
   - 展示最近7天的研究会话数和假设生成数
   - 两条线：研究会话（#00D4AA，填充rgba(0,212,170,0.1)）、假设生成（#3B82F6，填充rgba(59,130,246,0.1)）
   - 线条平滑（tension: 0.4）
   - X轴：周一到周日，Y轴：数量
   - 响应式，高度 h-56
   - 悬停显示具体数值tooltip
   - 支持切换时间范围：7天/30天/90天

5. 研究领域分布图（DomainDistributionChart）：
   - 使用 Chart.js Bar 类型（或 Doughnut 类型，按设计选择）
   - 展示各研究领域（太阳物理、恒星演化、宇宙学、行星科学、高能天体、天体测量）的研究会话分布
   - 每个学科用不同颜色：太阳物理(#00D4AA)、恒星演化(#3B82F6)、宇宙学(#F59E0B)、行星科学(#EF4444)、高能天体(#8B5CF6)、天体测量(#10B981)
   - 响应式，高度 h-56
   - 悬停显示具体数量和百分比

6. 智能体负载监控（AgentLoadMonitor）：
   - 展示4个Agent的负载：
     - 文献整合者（Qwen-Plus）：蓝色进度条 + 百分比 + req/min
     - 假设生成器（Qwen-Max）：绿色进度条 + 百分比 + req/min
     - 实验规划师（Qwen-Coder）：黄色进度条 + 百分比 + req/min
     - 评估验证官（Qwen-Max）：紫色进度条 + 百分比 + req/min
   - 每个进度条带颜色背景，实时更新（每5秒）
   - 下方系统状态网格：
     - API响应时间、KV存储状态、知识图谱状态、天文数据状态
     - 每个状态用绿色圆点+文字，异常时变红色
   - 响应式，高度 h-56

7. 最新研究动态（LatestResearchFeed）：
   - 3个卡片横向排列：
     - 太阳物理："基于磁场拓扑的耀斑预测" — 假设H1已进入实验规划阶段
     - 恒星演化："红巨星质量损失机制" — 新研究会话已启动，文献整合者正在检索
     - 宇宙学："暗物质分布模拟" — 实验规划师已生成N-body模拟代码，等待评估
   - 每个卡片：学科标签（颜色badge）、标题、状态描述、进度条
   - 卡片背景色与学科颜色一致（浅色，10%透明度）
   - 点击卡片跳转到对应研究会话

8. 实时告警面板（RealTimeAlerts）：
   - 展示最近5条系统告警或研究提醒：
     - 告警类型：API调用频率过高（黄色）、Agent执行错误（红色）、新研究完成（绿色）、数据异常（橙色）
   - 每条：时间、类型图标、消息、操作按钮（查看详情/忽略）
   - 告警自动滚动（最新在上），支持手动清除
   - 无告警时显示"系统运行正常"提示

9. 大屏深色模式（DashboardDarkMode）：
   - 切换时所有组件颜色反转：
     - 背景：#0A2540 → #F6F9FC
     - 卡片：#0D3B5C → #FFFFFF
     - 文字：白色 → #1A202C
     - 图表：Chart.js 配置颜色数组切换（提供darkModeColors和lightModeColors）
   - 切换动画：0.3s transition
   - 偏好保存到 localStorage

10. 数据实时更新：
    - 使用 WebSocket 或轮询（每30秒fetch）获取最新数据
    - 数据从各Store聚合：sessionStore、hypothesisStore、planStore、iterateStore
    - 或从后端API获取：src/services/dashboard.ts — getDashboardData()
    - 更新时数字变化动画（从旧值过渡到新值，使用requestAnimationFrame）

11. 响应式布局：
    - 桌面端（≥1280px）：4卡片 + 3图表 + 动态区（并排）
    - 平板端（768-1279px）：4卡片（2x2） + 3图表（垂直堆叠） + 动态区（垂直）
    - 移动端（<768px）：所有组件垂直堆叠，卡片全宽

12. 数据模拟：
    - 如果后端API未就绪，使用 mock 数据生成器
    - 数据应合理：会话数递增、假设数递增、评分波动上升、Agent负载在20-80%间波动

【代码规范】：
- 文件命名：DashboardPage.tsx、SystemStatusBar.tsx、KpiCards.tsx、SessionTrendChart.tsx、DomainDistributionChart.tsx、AgentLoadMonitor.tsx、LatestResearchFeed.tsx、RealTimeAlerts.tsx、useDashboardData.ts
- 目录结构：src/pages/visualization/DashboardPage.tsx 及同级目录下组件
- 图表组件：src/components/charts/LineChart.tsx、BarChart.tsx（复用已有封装）
- 数据服务：src/services/dashboard.ts
- 深色模式工具：src/hooks/useDarkMode.ts（或扩展sessionStore）
- 所有图表统一使用 Chart.js，封装通用图表配置（colors、fonts、responsive）

【验收标准】：
1. /visualization/dashboard 页面可正常访问，全宽布局正确
2. 系统状态栏展示状态、时间、刷新按钮，自动刷新正常
3. 4个KPI卡片展示正确，数字使用等宽字体，变化趋势颜色和箭头正确
4. 研究会话趋势图使用Chart.js Line正确渲染，两条线带填充，支持时间范围切换
5. 研究领域分布图使用Chart.js Bar正确渲染，6个学科颜色正确
6. 智能体负载监控展示4个Agent进度条，颜色正确，百分比和req/min准确
7. 系统状态网格展示4个状态指标，正常绿色，异常红色
8. 最新研究动态展示3个学科卡片，内容正确，带进度条
9. 实时告警面板展示最近告警，支持类型区分和清除操作
10. 深色/浅色模式切换正常，所有组件颜色正确过渡，Chart.js颜色切换正确
11. 数据自动更新正常（30秒轮询），数字变化有动画
12. 三端响应式布局正确（桌面/平板/移动端）
13. TypeScript 编译无错误，Chart.js图表无渲染错误

【预期产出】：
- src/pages/visualization/DashboardPage.tsx
- src/pages/visualization/SystemStatusBar.tsx
- src/pages/visualization/KpiCards.tsx
- src/components/charts/SessionTrendChart.tsx
- src/components/charts/DomainDistributionChart.tsx
- src/pages/visualization/AgentLoadMonitor.tsx
- src/pages/visualization/LatestResearchFeed.tsx
- src/pages/visualization/RealTimeAlerts.tsx
- src/hooks/useDashboardData.ts
- src/hooks/useDarkMode.ts
- src/services/dashboard.ts
- src/stores/dashboardStore.ts
- src/mock/dashboardData.ts
```

---

## 全局共享产出（跨所有子任务）

以下文件需在P3-T1或最早子任务中创建，供后续所有子任务引用：

1. **src/types/agents.ts** — 全局类型定义（见本文档开头）
2. **src/components/ui/Modal.tsx** — 通用模态框（Portal + 遮罩层 + 内容区）
3. **src/components/ui/Toast.tsx** — 通用Toast提示（或直接使用简单实现）
4. **src/components/layout/ThreeColumnLayout.tsx** — 三栏布局模板
5. **src/components/layout/SidebarDrawer.tsx** — 移动端侧边栏抽屉
6. **src/components/charts/RadarChart.tsx** — 封装Chart.js雷达图
7. **src/components/charts/LineChart.tsx** — 封装Chart.js折线图
8. **src/components/charts/BarChart.tsx** — 封装Chart.js柱状图
9. **src/components/charts/ScatterChart.tsx** — 封装Chart.js散点图
10. **src/components/charts/DoughnutChart.tsx** — 封装Chart.js环形图
11. **src/components/charts/GanttChart.tsx** — 封装Chart.js甘特图（横向条形图模拟）
12. **src/components/data/DataTable.tsx** — 通用数据表格（表头、行、分页、排序）
13. **src/hooks/useBailian.ts** — 百炼API调用Hook（封装loading、error、retry）
14. **src/lib/utils.ts** — 工具函数（cn合并、date格式化、debounce等）
15. **src/App.tsx** — 路由配置（所有新路由）
16. **src/index.css** — 全局样式（字体、颜色变量、滚动条、动画等）

---

## 路由汇总（App.tsx 中需配置）

```tsx
// 懒加载所有页面
const AIHub = lazy(() => import('./pages/AIHub'));
const QuestionPage = lazy(() => import('./pages/research/QuestionPage'));
const LiteraturePage = lazy(() => import('./pages/research/LiteraturePage'));
const HypothesisPage = lazy(() => import('./pages/research/HypothesisPage'));
const PlanPage = lazy(() => import('./pages/research/PlanPage'));
const IteratePage = lazy(() => import('./pages/research/IteratePage'));
const AstroDataPage = lazy(() => import('./pages/data/AstroDataPage'));
const DataIntegrationPage = lazy(() => import('./pages/data/DataIntegrationPage'));
const KnowledgeGraphPage = lazy(() => import('./pages/knowledge/KnowledgeGraphPage'));
const EvidenceChainPage = lazy(() => import('./pages/knowledge/EvidenceChainPage'));
const DashboardPage = lazy(() => import('./pages/visualization/DashboardPage'));

// 路由配置（使用 React Router v6）
<Route path="/ai-hub" element={<AIHub />} />
<Route path="/research/question" element={<QuestionPage />} />
<Route path="/research/literature" element={<LiteraturePage />} />
<Route path="/research/hypothesis" element={<HypothesisPage />} />
<Route path="/research/plan" element={<PlanPage />} />
<Route path="/research/iterate" element={<IteratePage />} />
<Route path="/data/astronomy" element={<AstroDataPage />} />
<Route path="/data/integration" element={<DataIntegrationPage />} />
<Route path="/knowledge/graph" element={<KnowledgeGraphPage />} />
<Route path="/knowledge/evidence" element={<EvidenceChainPage />} />
<Route path="/visualization/dashboard" element={<DashboardPage />} />
```

---

## 执行优先级建议

| 阶段 | 优先级 | 任务 | 依赖 |
|------|--------|------|------|
| P3 | P0 | P3-T1 AI科研中心 | 无（创建全局类型和基础设施） |
| P3 | P0 | P3-T4 假设生成 | 无（核心功能，可独立开发） |
| P3 | P1 | P3-T2 问题理解 | P3-T1（复用类型） |
| P3 | P1 | P3-T3 文献综述 | P3-T1（复用类型） |
| P3 | P1 | P3-T5 研究计划 | P3-T4（依赖假设） |
| P3 | P2 | P3-T6 迭代优化 | P3-T4, P3-T5（依赖假设和计划） |
| P4 | P1 | P4-T5 数据大屏 | P3所有（聚合数据展示） |
| P4 | P1 | P4-T3 知识图谱 | P3-T2（依赖实体抽取） |
| P4 | P2 | P4-T1 天文数据 | 无（独立数据功能） |
| P4 | P2 | P4-T2 数据整合 | P4-T1（依赖数据源） |
| P4 | P2 | P4-T4 证据链 | P3-T3, P3-T4, P4-T3（依赖文献、假设、图谱） |

---

*文档版本：v1.0*  
*生成时间：2026年7月*  
*适用项目：AI-Scientist Hub（XH-202619）*
