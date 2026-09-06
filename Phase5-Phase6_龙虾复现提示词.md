# AI Scientist Hub — Phase 5 & Phase 6 龙虾复现提示词集

> 项目：基于国产开源大模型的AI Scientist科研智能平台
> 比赛：挑战杯"揭榜挂帅"XH-202619
> 基座模型：千问(Qwen)系列，阿里云百炼平台
> 前置完成：Phase 1-4（基础架构、核心智能体、前端界面、数据与图谱）
> 技术栈：React 18 + TypeScript + Vite + Tailwind CSS + EdgeOne Edge Functions + EdgeOne KV Storage + EdgeOne Pages

---

## 目录

- [Phase 5：拓展功能（第9-10周）](#phase-5)
  - [P5-T1：AI数字分身系统](#p5-t1)
  - [P5-T2：科学传播可视化](#p5-t2)
  - [P5-T3：跨学科融合引擎](#p5-t3)
  - [P5-T4：科研协作网络](#p5-t4)
- [Phase 6：测试与优化（第11-12周）](#phase-6)
  - [P6-T1：测试体系构建](#p6-t1)
  - [P6-T2：性能优化](#p6-t2)
  - [P6-T3：安全加固](#p6-t3)
  - [P6-T4：演示视频制作](#p6-t4)
  - [P6-T5：技术方案文档（20页PDF）](#p6-t5)
  - [P6-T6：部署上线](#p6-t6)

---

## <a name="phase-5"></a>Phase 5：拓展功能（第9-10周）

> Phase 5 目标：在已完成的多智能体科研闭环基础上，增加四大差异化拓展功能，提升平台的人文关怀、传播能力、学科广度与协作深度。

---

### <a name="p5-t1"></a>【龙虾角色】：前端全栈工程师 + AI 交互设计师

【龙虾ID】：P5-T1

【任务名称】：AI数字分身系统 — 个性化科研助手

【上下文】：
- 前置完成状态：Phase 1-4 已完成。前端采用 React 18 + TypeScript + Vite + Tailwind CSS；后端为 EdgeOne Edge Functions；数据存储为 EdgeOne KV Storage。四大核心智能体（文献整合者、假设生成器、实验规划师、评估验证官）已通过百炼平台 Qwen 系列模型实现完整闭环。用户系统（JWT 注册/登录/资料管理）已就绪。
- 技术约束：
  - 所有 AI 调用必须经 Edge Functions 代理，禁止前端直接暴露百炼 API Key
  - KV Storage 单值上限 2MB，需分片存储长期记忆数据
  - Edge Functions 单次执行时间上限 50s（CPU 时间），超时需异步化
  - 使用 Qwen-Plus 处理用户画像分析，Qwen-Max 处理情绪感知推理
  - 保持现有设计系统（科技蓝 #0A2540 / 科技青 #00D4AA / 纯白 #FFFFFF）

【具体指令】：

#### 1. 数据模型设计（KV Storage 层）

在 `src/types/avatar.ts` 中定义完整 TypeScript 类型：

```typescript
// 用户画像 — 静态属性（由用户填写 + AI 推断）
interface UserProfile {
  userId: string;
  researchField: string[];       // 研究领域标签
  interestDirection: string[];   // 细分兴趣方向
  writingStyle: WritingStyle;     // 写作风格偏好
  expertiseLevel: 'undergraduate' | 'master' | 'phd' | 'professor' | 'industry';
  preferredLanguage: 'zh' | 'en' | 'mixed'; // 输出语言偏好
  responseDepth: 'concise' | 'balanced' | 'detailed'; // 回复详略程度
  // AI 推断字段
  inferredTraits: {
    creativityTendency: number;   // 0-1，偏发散还是收敛
    rigorPreference: number;       // 0-1，偏严谨还是灵活
    visualPreference: number;      // 0-1，是否偏好图表
  };
  updatedAt: string;
}

// 长期记忆 — 动态累积（时间衰减 + 重要性加权）
interface LongTermMemory {
  userId: string;
  memories: MemoryItem[];
}

interface MemoryItem {
  id: string;
  type: 'research_topic' | 'feedback' | 'preference' | 'achievement' | 'emotion' | 'collaboration';
  content: string;
  timestamp: string;
  importance: number;            // 1-5，由 AI 评估
  decayFactor: number;            // 衰减系数，越久越低
  contextSnapshot: {
    sessionId: string;
    agentId: string;
    relatedHypothesisId?: string;
  };
}

// 情绪感知 — 单次会话内有效
interface EmotionState {
  userId: string;
  sessionId: string;
  currentEmotion: 'calm' | 'excited' | 'frustrated' | 'anxious' | 'confused' | 'satisfied';
  confidence: number;             // 识别置信度
  intensity: number;              // 1-5 强度
  triggers: string[];             // 触发关键词/事件
  suggestion: string;               // 系统建议的应对策略
  lastUpdated: string;
}

// 个性化输出模板
interface PersonalizationTemplate {
  userId: string;
  greetingTemplate: string;       // 打招呼模板（如"博士，今天想探索什么？"）
  hypothesisPrefix: string;        // 假设输出前缀风格
  explanationStyle: 'analogy' | 'deductive' | 'narrative' | 'technical'; // 解释方式
  encouragementPhrases: string[]; // 鼓励用语库（根据情绪状态动态选择）
  criticismSoftening: string;      // 批评/修正时的软化措辞
}
```

#### 2. Edge Functions API 设计（`edge-functions/api/avatar/`）

新增以下路由：

```javascript
// edge-functions/api/index.js 中注册
'POST /api/avatar/profile': handleAvatarProfile,      // 创建/更新用户画像
'GET  /api/avatar/profile/:userId': getAvatarProfile,   // 获取用户画像
'POST /api/avatar/memory': handleMemoryStore,          // 存储记忆片段
'GET  /api/avatar/memory/:userId': getMemories,        // 检索记忆（支持 top-k 重要性筛选）
'POST /api/avatar/emotion': handleEmotionDetect,       // 情绪检测（基于最近对话）
'POST /api/avatar/personalize': handlePersonalize,    // 个性化输出（输入原始文本 + 用户画像 → 输出个性化文本）
'POST /api/avatar/summarize': handleMemorySummarize,   // 记忆摘要（定期压缩记忆）
```

**`handleAvatarProfile` 实现细节**：
1. 接收用户填写的基础信息（researchField, expertiseLevel, preferredLanguage 等）
2. 调用百炼平台 Qwen-Plus，Prompt 为："基于以下用户科研背景，推断其写作风格偏好、创造力倾向、严谨性偏好。背景：{userInfo}。输出 JSON 格式。"
3. 将推断结果合并存入 KV Storage：`avatar:profile:{userId}`
4. 同时初始化默认个性化模板：`avatar:template:{userId}`

**`handleMemoryStore` 实现细节**：
1. 每次智能体交互结束后，由编排器触发调用
2. 提取关键信息：本次研究主题、用户反馈、用户偏好表达、情绪关键词
3. 调用 Qwen-Plus 评估 importance（1-5）和 type 分类
4. 存储到 KV：`avatar:memory:{userId}`，采用追加模式（注意 KV 单值上限，需实现分片）
5. 当单值超过 1.5MB 时，触发 `handleMemorySummarize` 进行记忆压缩：将 10 条最老的低重要性记忆合并为 1 条摘要

**`handleEmotionDetect` 实现细节**：
1. 接收最近 3 轮对话历史（用户消息 + 系统回复）
2. 调用 Qwen-Max（启用 enable_thinking）进行情绪分析，Prompt 示例：
   ```
   分析以下对话中用户当前的情绪状态。只关注用户的情绪，不分析内容本身。
   对话：
   [用户]: 这个假设又被否定了，感觉没什么进展...
   [助手]: 否定假设也是科研的重要一步，说明您正在排除错误路径。
   
   输出要求：JSON 格式，包含 currentEmotion, confidence, intensity, triggers, suggestion。
   ```
3. 返回情绪状态，前端据此调整 UI 主题色（轻度焦虑 → 更柔和的绿色提示）、调整助手回复语气

**`handlePersonalize` 实现细节**：
1. 输入：原始文本（来自任意 Agent 的输出）+ userId
2. 读取用户画像和个性化模板
3. 调用 Qwen-Plus，Prompt 构造：
   ```
   你是一个个性化写作助手。请根据以下用户画像，将原始文本改写为符合用户偏好的版本。
   
   用户画像：
   - 研究领域：{fields}
   - 专家水平：{level}
   - 写作风格：{style}
   - 解释偏好：{explanationStyle}
   - 语言偏好：{language}
   - 详略程度：{depth}
   
   原始文本：
   {originalText}
   
   要求：
   1. 保持原文的科学准确性不变
   2. 调整语气、用词复杂度、解释深度以匹配用户画像
   3. 添加符合用户偏好的开场白/过渡语
   4. 如果检测到用户近期情绪低落，添加适当鼓励
   5. 输出纯文本，不要添加额外标记
   ```
4. 返回个性化文本，前端渲染

#### 3. 前端组件实现

**`src/components/avatar/AvatarProfileSetup.tsx`** — 用户画像设置向导：
- 步骤 1：基础信息（研究领域多选输入、专家水平单选、语言偏好）
- 步骤 2：风格偏好（通过展示 3 个不同风格的同一段科学解释，让用户选择最偏好的一种）
- 步骤 3：AI 推断确认（展示 Qwen 推断的创造力倾向、严谨性偏好，允许用户调整）
- 步骤 4：完成，展示生成的个性化问候语预览
- 使用 `framer-motion` 做步骤切换动画，Tailwind 做表单样式

**`src/components/avatar/AvatarPanel.tsx`** — 全局悬浮 AI 数字分身面板：
- 位置：页面右下角，固定定位，z-index: 50
- 默认状态：圆形头像 + 呼吸动画（CSS animation pulse），hover 显示"Hi, {name}"
- 展开状态：点击后展开为 320px 宽聊天面板，高度自适应（最大 500px）
- 面板头部：显示用户头像 + 当前情绪状态 emoji（😊/😰/🤔/🎉 等）+ 情绪标签
- 面板内容：快速操作按钮（"继续上次研究" / "查看我的记忆" / "调整偏好"）
- 面板底部：语音输入按钮（预留，优先实现文字）+ 发送框
- 每次用户与主工作区 Agent 交互后，数字分身面板自动更新情绪状态

**`src/components/avatar/MemoryTimeline.tsx`** — 记忆时间线展示：
- 页面：`/avatar/memories`
- 设计：垂直时间线，左侧日期，右侧记忆卡片
- 卡片颜色按 type 区分（research_topic 蓝 / feedback 绿 / emotion 黄 / achievement 紫）
- 支持按 type 筛选、按重要性排序、按时间范围搜索
- 记忆卡片 hover 显示关联的假设/会话上下文

**`src/components/avatar/EmotionIndicator.tsx`** — 情绪状态指示器：
- 小型组件，嵌入在页面顶部导航栏右侧
- 根据当前情绪显示不同颜色 dot 和 tooltip（平静=蓝 / 焦虑=橙 / 兴奋=绿 / 沮丧=灰）
- 点击展开 3 条系统建议（如焦虑时："深呼吸，科研是马拉松" / "需要查看已完成成果？" / "推荐休息 5 分钟"）

#### 4. 与现有 Agent 系统的集成

修改 `AgentOrchestrator`（`src/services/agentOrchestrator.ts`）：
- 在每次 Agent 调用 `bailian.chat.completion` 后，将原始输出传入 `handlePersonalize`
- 在 Agent 编排流程的每个阶段结束时，调用 `handleMemoryStore` 记录关键信息
- 在会话开始时，读取用户记忆摘要作为上下文的一部分传递给 Qwen 的 system prompt
- 示例 system prompt 追加：
  ```
  [用户画像] 该用户是 {expertiseLevel}，研究领域 {researchField}，偏好 {explanationStyle} 解释方式。
  [近期记忆摘要] 用户最近关注 {top3Topics}，对 {recentFeedback} 表达了反馈。
  [当前情绪] 用户当前情绪 {currentEmotion}，建议语气 {suggestion}。
  ```

【验收标准】：
- [ ] `AvatarProfileSetup` 向导能正确收集用户偏好并调用 API 完成画像创建
- [ ] 用户画像能被 Qwen 正确推断，且推断结果可人工校准
- [ ] 每次 Agent 交互后，关键记忆被正确存储到 KV Storage，且能在时间线中查看
- [ ] 当 KV 单值接近上限时，记忆自动压缩机制正常工作，不丢失高重要性记忆
- [ ] 情绪检测能识别至少 5 种情绪状态（平静/兴奋/沮丧/焦虑/困惑），准确率 ≥ 70%（基于人工测试集 20 条对话）
- [ ] 个性化输出使同一 Agent 回复对博士生和本科生呈现不同复杂度（人工评审差异度 ≥ 3/5 分）
- [ ] 数字分身面板在前端所有页面可见，且不影响主工作区布局
- [ ] 整个系统响应时间增加 < 200ms（个性化处理带来的额外延迟）
- [ ] 长期记忆在跨会话中持续有效，用户重新登录后仍能看到历史记忆

【预期产出】：
- `src/types/avatar.ts` — 类型定义
- `src/components/avatar/AvatarProfileSetup.tsx` — 画像设置向导
- `src/components/avatar/AvatarPanel.tsx` — 数字分身面板
- `src/components/avatar/MemoryTimeline.tsx` — 记忆时间线
- `src/components/avatar/EmotionIndicator.tsx` — 情绪指示器
- `src/services/avatarService.ts` — 前端 API 封装
- `edge-functions/api/avatar/profile.js` — 画像管理 Edge Function
- `edge-functions/api/avatar/memory.js` — 记忆管理 Edge Function
- `edge-functions/api/avatar/emotion.js` — 情绪检测 Edge Function
- `edge-functions/api/avatar/personalize.js` — 个性化输出 Edge Function
- `src/services/agentOrchestrator.ts`（修改）— 集成个性化调用
- `tests/avatar/` — 相关测试文件

---

### <a name="p5-t2"></a>【龙虾角色】：前端可视化工程师 + 创意设计师

【龙虾ID】：P5-T2

【任务名称】：科学传播可视化 — 科普海报、图文摘要、动态演示

【上下文】：
- 前置完成状态：Phase 1-4 已完成。平台已具备假设生成、研究计划、实验设计、知识图谱可视化等核心科研功能。假设和实验结果以文本/JSON/图表形式输出。知识图谱使用 D3.js 或 ECharts 力导向图展示。前端使用 React 18 + Tailwind + Vite。
- 技术约束：
  - 海报生成：使用 `html-to-image` 或 `html2canvas` 将 DOM 转为图片，或调用百炼 Qwen-VL 生成
  - 动态演示：使用 `framer-motion` + React 状态驱动，禁止引入视频文件（EdgeOne Pages 无视频存储）
  - 所有生成内容需支持一键导出 PNG/SVG
  - 保持设计系统一致性（主色 #0A2540 / #00D4AA）
  - 多受众版本由 Qwen-Plus 负责改写，前端负责版式渲染

【具体指令】：

#### 1. 科普海报生成器（Poster Generator）

**页面**：`/visualization/poster`

**核心组件**：`src/components/visualization/PosterGenerator.tsx`

**功能流程**：
1. 用户输入：选择要转化的科研成果（假设 / 研究计划 / 实验结果）+ 选择海报风格（学术 / 科普 / 极简 / 中国风）
2. 后端调用：
   - 调用 Qwen-Plus，Prompt："将以下科研成果转化为科普海报文案。目标受众：高中生。要求：标题吸引眼球、3 个核心要点、1 个趣味比喻、1 个行动号召。输出 JSON 格式：{title, subtitle, keyPoints[], analogy, callToAction, suggestedColorTheme, suggestedIconKeywords[]}"
   - 同时调用 Qwen-VL（多模态）生成主视觉描述图（可选，若平台有图片生成能力；否则用前端 SVG 绘制）
3. 前端渲染：
   - 海报模板系统：预定义 4 种布局模板（学术竖版 / 科普横版 / 极简居中 / 中国风卷轴）
   - 模板组件：`PosterTemplateAcademic.tsx` / `PosterTemplatePopular.tsx` / `PosterTemplateMinimal.tsx` / `PosterTemplateChinese.tsx`
   - 每个模板接收文案数据和颜色主题，渲染为可交互的 DOM 结构
   - 支持实时编辑：用户可修改标题、要点、调整颜色（色相 slider）、替换图标（从预设 icon 库选择）
   - 导出功能：使用 `html-to-image` 的 `toPng` 将 DOM 导出为 1080x1920（竖版）或 1920x1080（横版）PNG
4. 技术实现：
   - 海报容器使用绝对定位 + `transform: scale()` 实现"画布预览"模式（实际尺寸很大，但预览缩小显示）
   - 文字排版使用 CSS Grid 和 Flexbox，字体使用 `Noto Sans SC` + `Inter`
   - 图标使用 `lucide-react` 或自定义 SVG 图标库
   - 导出时确保中文字体正确渲染（使用 `html-to-image` 的 `fontEmbedCSS` 选项内联字体）

**海报文案生成 API**：
```javascript
// edge-functions/api/visualization/poster-text.js
'POST /api/visualization/poster-text'
// 输入：{ content: string, style: 'academic' | 'popular' | 'minimal' | 'chinese', audience: string }
// 输出：{ title, subtitle, keyPoints[], analogy, callToAction, colorTheme, iconKeywords }
// 使用 Qwen-Plus 生成，temperature=0.8（需要创意性）
```

#### 2. 图文摘要生成器（Graphical Abstract）

**页面**：`/visualization/graphical-abstract`

**核心组件**：`src/components/visualization/GraphicalAbstractGenerator.tsx`

**功能流程**：
1. 用户输入：粘贴论文摘要或选择平台内已生成的假设
2. 后端调用：
   - 调用 Qwen-Plus，Prompt："将以下论文摘要转化为图文摘要（Graphical Abstract）的脚本。要求：用 5-7 个步骤展示核心逻辑，每个步骤包含：简短文字描述（≤15字）、对应图标关键词、步骤间箭头关系。输出 JSON 格式：{steps: [{id, text, icon, next: [id]}], title, overallFlow}"
3. 前端渲染：
   - 使用 SVG 或 React + CSS 绘制流程图，每个步骤是圆角矩形 + 图标 + 文字
   - 箭头连接：使用 `leader-line` 或纯 SVG `<path>` 贝塞尔曲线
   - 支持拖拽调整步骤位置（使用 `react-beautiful-dnd` 或自定义拖拽）
   - 支持步骤增删改：用户可手动添加/删除步骤，修改文字
   - 自动排版：使用简单 DAG 布局算法（拓扑排序 + 分层）自动排列步骤位置
   - 导出：SVG 直接下载（保留矢量），或 PNG 下载（1080px 宽）
4. 技术细节：
   - 每个步骤节点使用 `framer-motion` 做入场动画（staggerChildren）
   - 箭头使用 SVG `<marker>` 定义箭头头
   - 整体画布使用 `overflow: auto` + `min-width/min-height` 支持大流程图

**Graphical Abstract 文案 API**：
```javascript
// edge-functions/api/visualization/graphical-abstract.js
'POST /api/visualization/graphical-abstract'
// 输入：{ abstract: string }
// 输出：{ title, steps: [{id, text, icon, next: [id]}] }
```

#### 3. 动态演示（Animated Demo）

**页面**：`/visualization/animated-demo`

**核心组件**：`src/components/visualization/AnimatedDemo.tsx`

**功能定义**：将科学原理（如"太阳耀斑爆发机制" / "恒星演化过程" / "引力波探测原理"）转化为交互式动画演示。不生成视频，而是使用 React 状态驱动 + SVG 动画 + framer-motion 实现可交互的网页演示。

**功能流程**：
1. 用户选择：从预设模板库选择主题（天文/物理相关）或输入自定义主题
2. 后端调用：
   - 调用 Qwen-Plus，Prompt："为以下科学主题设计一个 5-8 步骤的动画演示脚本。每个步骤包含：步骤标题、详细说明文字（≤50字）、动画类型（fade/move/scale/rotate/morph）、涉及的视觉元素描述。主题：{topic}。输出 JSON 格式。"
3. 前端渲染：
   - 动画引擎：使用 `framer-motion` + React 状态机驱动
   - 每个步骤对应一个 `DemoScene` 组件，接收 `sceneData` 和 `isActive` 和 `progress`
   - 控制面板：播放/暂停按钮、进度条、步骤导航（1-2-3-4-5）、速度调节（0.5x/1x/2x）
   - 视觉元素：天文主题使用 SVG 绘制（太阳/黑子/耀斑/磁场线/望远镜等），物理主题使用几何图形 + 公式
   - 动画类型映射：
     - fade → `opacity` 动画
     - move → `x/y` 位移动画
     - scale → `scale` 缩放动画
     - rotate → `rotate` 旋转动画
     - morph → SVG `path` 变形（使用 `framer-motion` 的 `pathLength` 或 `d` 属性动画）
   - 文字解说：当前步骤文字以打字机效果（使用 `react-type-animation` 或自定义 hook）逐步显示
4. 预设模板库（至少 3 个）：
   - 太阳耀斑爆发：磁场线缠绕 → 能量积聚 → 磁场重联 → 耀斑爆发 → 物质抛射 → 能量释放 → 平静恢复
   - 恒星演化：气体云坍缩 → 原恒星 → 主序星 → 红巨星 → 行星状星云 → 白矮星
   - 引力波探测：黑洞合并 → 时空涟漪 → 激光干涉 → 信号探测 → 数据分析 → 确认源

**动画脚本 API**：
```javascript
// edge-functions/api/visualization/animated-demo.js
'POST /api/visualization/animated-demo'
// 输入：{ topic: string, steps?: number }
// 输出：{ title, steps: [{id, title, text, animationType, elements: [{type, description, initialState, finalState}]}] }
```

#### 4. 多受众适配引擎

**功能**：同一科研成果，生成不同难度/风格的版本

**页面**：集成在各成果展示页面（假设详情、计划详情等），新增"分享/传播"按钮

**核心组件**：`src/components/visualization/AudienceAdapter.tsx`

**实现**：
- 点击"分享/传播"后，弹出模态框，选择受众：专家同行 / 研究生 / 高中生 / 公众
- 调用后端 API：
  ```javascript
  // edge-functions/api/visualization/adapt-audience.js
  'POST /api/visualization/adapt-audience'
  // 输入：{ content: string, audience: 'expert' | 'graduate' | 'highschool' | 'public', format: 'text' | 'poster' | 'slides' }
  // 输出：{ adaptedContent, suggestedVisualType, keyConceptsToExplain, difficultyScore }
  // 使用 Qwen-Plus，根据受众调整术语密度、解释深度、比喻使用频率
  ```
- 前端渲染：
  - text 格式：直接显示改编文本，高亮需要解释的关键概念（tooltip 显示通俗解释）
  - poster 格式：调用 Poster Generator 自动生成海报
  - slides 格式：生成简版 PPT 大纲（暂不实现 PPT 导出，仅展示大纲）

#### 5. 科学传播数据看板

**页面**：`/visualization/dashboard`

**组件**：`src/components/visualization/ScienceDashboard.tsx`

- 展示本平台生成的所有科普内容统计：海报数量、图文摘要数量、覆盖主题分布
- 使用 ECharts 绘制饼图（主题分布）+ 柱状图（月度产出）+ 词云（高频关键词）
- 提供"热门科普内容"展示位，支持点赞/收藏

【验收标准】：
- [ ] 科普海报生成器支持 4 种模板，导出 PNG 分辨率 ≥ 1080p，中文字体正确渲染
- [ ] 从假设文本到海报文案生成时间 ≤ 10s（含 Qwen 调用 + 前端渲染）
- [ ] 图文摘要生成器支持自动布局，5-15 个步骤的流程图可清晰展示，导出 SVG 保留矢量
- [ ] 动态演示支持播放/暂停/进度控制/步骤跳转，3 个预设模板动画流畅（60fps）
- [ ] 多受众适配能区分专家版和公众版，术语密度差异明显（人工评审差异度 ≥ 3/5）
- [ ] 科学传播看板正确展示统计数据，ECharts 图表响应式适配
- [ ] 所有可视化组件支持暗黑模式（使用 `dark` class 切换配色）
- [ ] 海报和图文摘要内容导出后，在其他设备打开时字体和排版保持一致

【预期产出】：
- `src/components/visualization/PosterGenerator.tsx` — 海报生成主组件
- `src/components/visualization/PosterTemplate*.tsx` — 4 种海报模板
- `src/components/visualization/GraphicalAbstractGenerator.tsx` — 图文摘要生成器
- `src/components/visualization/AnimatedDemo.tsx` — 动态演示引擎
- `src/components/visualization/DemoScene.tsx` — 单场景动画组件
- `src/components/visualization/AudienceAdapter.tsx` — 多受众适配组件
- `src/components/visualization/ScienceDashboard.tsx` — 传播看板
- `src/templates/demo-scenes/` — 3 个预设动画模板数据
- `edge-functions/api/visualization/*.js` — 5 个后端 API 文件
- `src/hooks/useImageExport.ts` — 图片导出通用 hook
- `src/hooks/useAnimationEngine.ts` — 动画引擎 hook

---

### <a name="p5-t3"></a>【龙虾角色】：AI 算法工程师 + 知识图谱工程师

【龙虾ID】：P5-T3

【任务名称】：跨学科融合引擎 — 学科桥接与跨域迁移

【上下文】：
- 前置完成状态：Phase 4 已完成天文领域知识图谱构建，包含实体类型（天体对象、物理概念、观测设备、科学方法、数据产品、研究机构）和关系类型（观测、因果、分类、方法、数据、演化）。知识图谱存储在 EdgeOne KV Storage，使用 `kg:node:{entityId}` 和 `kg:edge:{edgeId}` 结构。图查询使用内存中图结构（D3 力导向图渲染）。
- 技术约束：
  - 跨学科融合需基于现有知识图谱进行图推理，不能重新构建完整图数据库
  - 使用 Qwen-Max 进行跨学科类比推理（思维链模式）
  - Edge Functions 50s 超时限制，复杂推理需拆分为多步骤
  - 支持学科：天文、物理、生物、化学、地理、计算机（至少这 6 个）
  - 所有融合结果需标注置信度和来源依据

【具体指令】：

#### 1. 学科本体模型扩展

在 `src/types/knowledgeGraph.ts` 中扩展学科本体：

```typescript
// 学科领域定义
interface Discipline {
  id: string;                    // 如 'astronomy', 'physics', 'biology'
  name: string;                  // 中文名
  nameEn: string;                // 英文名
  coreConcepts: string[];        // 核心概念列表
  typicalMethods: string[];    // 典型方法列表
  keyMetrics: string[];          // 关键指标/度量
  relatedDisciplines: string[];  // 历史上关联紧密的学科
  abstractionLevel: 'micro' | 'meso' | 'macro'; // 研究尺度
  dataCharacteristics: string; // 数据类型特征（时序/图像/网络/文本）
}

// 跨学科桥接关系
interface CrossDisciplineBridge {
  id: string;
  sourceConcept: string;         // 源学科概念（kg:node ID）
  sourceDiscipline: string;      // 源学科 ID
  targetConcept: string;          // 目标学科概念（kg:node ID）
  targetDiscipline: string;      // 目标学科 ID
  bridgeType: 'method_borrow' | 'analogy' | 'mathematical_isomorphism' | 'data_fusion' | 'theory_unification';
  explanation: string;            // 桥接解释（为什么这两个概念可以关联）
  confidence: number;            // 0-1 置信度
  evidence: string[];            // 支持证据（文献/案例）
  generatedBy: 'ai' | 'user' | 'hybrid'; // 生成方式
  createdAt: string;
}

// 跨域迁移结果
interface CrossDomainMigration {
  id: string;
  originalHypothesisId: string;  // 原始假设 ID
  sourceDiscipline: string;
  targetDiscipline: string;
  originalHypothesis: string;    // 原始假设文本
  migratedHypothesis: string;    // 迁移后假设文本
  adaptationNotes: string[];      // 适配说明（哪些术语需要替换，哪些方法需要调整）
  feasibilityAssessment: {
    dataAvailability: number;  // 0-1 数据可得性
    methodTransferability: number;// 0-1 方法可迁移性
    conceptualGap: number;       // 0-1 概念差距（越小越好）
    overallScore: number;       // 综合评分
  };
  suggestedCollaborators: string[]; // 建议合作的学科方向
}

// 融合创新机会
interface FusionOpportunity {
  id: string;
  disciplines: string[];         // 涉及的学科（2-3 个）
  opportunityDescription: string;// 机会描述
  potentialImpact: 'high' | 'medium' | 'low';
  researchDirection: string[];   // 可能的研究方向
  requiredExpertise: string[];   // 所需 expertise
  confidence: number;
  generatedAt: string;
}
```

#### 2. 学科桥接 API（Edge Functions）

```javascript
// edge-functions/api/fusion/disciplines.js
'GET  /api/fusion/disciplines': getAllDisciplines,     // 获取所有学科定义
'GET  /api/fusion/disciplines/:id': getDiscipline,     // 获取单个学科详情
'GET  /api/fusion/bridges': getBridges,                // 获取所有桥接关系（支持按学科筛选）
'POST /api/fusion/bridges/discover': discoverBridges,  // 自动发现桥接关系
'POST /api/fusion/migrate': migrateHypothesis,          // 跨域迁移假设
'POST /api/fusion/opportunities': findOpportunities,    // 发现融合创新机会
'POST /api/fusion/evaluate': evaluateBridge,            // 评估桥接质量
```

**`discoverBridges` 实现细节**：
1. 输入：两个学科 ID（如 `astronomy` 和 `physics`）或单个概念（如 `black_hole`）
2. 从 KV 读取两个学科的核心概念列表（预定义在 `discipline-config.json` 中）
3. 调用 Qwen-Max（enable_thinking），Prompt 构造：
   ```
   你是一位跨学科研究专家。请分析以下两个学科的核心概念，发现它们之间可能的桥接关系。
   
   学科 A：{disciplineA}，核心概念：{conceptsA}
   学科 B：{disciplineB}，核心概念：{conceptsB}
   
   对于每一对可能关联的概念，请分析：
   1. 桥接类型：方法借用(method_borrow) / 类比推理(analogy) / 数学同构(mathematical_isomorphism) / 数据融合(data_fusion) / 理论统一(theory_unification)
   2. 桥接解释：为什么这两个概念可以关联？（≥100字）
   3. 置信度：0-1 的评估
   4. 支持证据：举出至少1个已知的跨学科研究案例
   
   输出 JSON 数组，每个元素包含 bridgeType, explanation, confidence, evidence。
   最多输出 10 个最高置信度的桥接关系。
   ```
4. 将结果存入 KV：`fusion:bridge:{bridgeId}`
5. 返回桥接列表

**`migrateHypothesis` 实现细节**：
1. 输入：原始假设文本 + 源学科 + 目标学科
2. 先调用 `discoverBridges` 获取两学科间所有桥接关系（作为上下文）
3. 调用 Qwen-Max，Prompt 构造：
   ```
   你是一位跨学科研究顾问。请将一个学科的科研假设迁移到另一个学科。
   
   原始假设（{sourceDiscipline}）：
   {originalHypothesis}
   
   目标学科：{targetDiscipline}
   
   已知的学科桥接关系：
   {bridges}
   
   请完成：
   1. 迁移后的假设：将核心概念替换为目标学科的对应概念，保持逻辑结构不变
   2. 适配说明：列出所有需要替换的术语、需要调整的方法、可能需要的新数据类型
   3. 可行性评估：数据可得性(0-1)、方法可迁移性(0-1)、概念差距(0-1)、综合评分
   4. 建议合作方向：哪些目标学科子领域最可能对此感兴趣
   
   输出 JSON 格式。
   ```
4. 将结果存入 KV：`fusion:migration:{migrationId}`
5. 返回迁移结果

**`findOpportunities` 实现细节**：
1. 输入：用户的研究领域（可选，不输入则扫描所有学科对）
2. 调用 Qwen-Max，Prompt 构造：
   ```
   分析以下学科列表，发现最具潜力的跨学科融合创新机会。
   学科列表：{disciplines}
   每个学科的核心特征：{disciplineDetails}
   
   请识别 2-3 个学科组合，描述：
   1. 融合机会：为什么这两个学科的结合会产生新洞察？
   2. 潜在影响：高/中/低
   3. 研究方向：3-5 个具体的研究方向
   4. 所需 expertise：需要哪些专业知识
   5. 置信度：基于当前科学发展趋势的评估
   
   输出 JSON 数组。
   ```
3. 返回机会列表

#### 3. 前端可视化界面

**页面 1：`/fusion/discipline-map` — 学科图谱**
- 使用 ECharts 的 Graph 图表或 D3.js 力导向图
- 节点：6 个学科（天文/物理/生物/化学/地理/计算机），大小按学科影响力，颜色按学科
- 边：学科间的桥接关系，粗细按置信度，颜色渐变表示桥接类型
- 交互：点击边显示桥接详情（解释、证据、案例）；点击节点显示学科详情面板；支持拖拽节点重新布局
- 支持"探索模式"：选中两个学科，点击"发现桥接"按钮，调用 `discoverBridges`

**页面 2：`/fusion/migrate` — 假设迁移工作台**
- 左侧：输入原始假设（文本框）+ 源学科选择（下拉）+ 目标学科选择（下拉）
- 中间：迁移结果展示区，使用 diff 样式展示原文 vs 迁移后文本（红色删除线标记替换的术语，绿色高亮新增术语）
- 右侧：可行性评估雷达图（ECharts radar），展示数据可得性/方法可迁移性/概念差距/创新潜力/可行性
- 底部：适配说明列表（可展开每项的详细解释）+ 建议合作方向标签

**页面 3：`/fusion/opportunities` — 融合创新机会墙**
- 使用瀑布流/卡片布局展示 `findOpportunities` 返回的结果
- 每张卡片：学科组合标签（如"天文 + 计算机"）+ 机会描述摘要 + 潜在影响徽章 + 置信度进度条
- 点击卡片展开：详细描述 + 研究方向列表 + 所需 expertise 标签 + "基于此创建研究假设"按钮（点击后跳转到假设生成器，预填充相关学科）
- 支持按学科筛选、按影响排序、按置信度排序

**页面 4：`/fusion/method-borrow` — 方法借用库**
- 展示各学科的典型方法列表（预定义在 `discipline-config.json`）
- 每个方法卡片：方法名 + 所属学科 + 适用场景 + 典型应用案例 + "迁移到..." 按钮
- 点击"迁移到"：选择目标学科，调用 Qwen-Max 生成该方法在目标学科的应用方式
- 示例："蒙特卡洛模拟"（物理）→ 迁移到"生物"→ "在蛋白质折叠预测中，使用蒙特卡洛模拟来探索构象空间"

#### 4. 学科配置数据

创建 `src/data/discipline-config.json`（至少 6 个学科）：

```json
{
  "disciplines": [
    {
      "id": "astronomy",
      "name": "天文学",
      "nameEn": "Astronomy",
      "coreConcepts": ["恒星", "黑洞", "星系", "暗物质", "宇宙学", "光谱", "引力波"],
      "typicalMethods": ["数值模拟", "观测统计", "光谱分析", "光度测量", "时序分析"],
      "keyMetrics": ["光度", "红移", "质量", "温度", "距离"],
      "relatedDisciplines": ["physics", "mathematics", "computer"],
      "abstractionLevel": "macro",
      "dataCharacteristics": "时序图像为主，多波段光谱，大规模星表"
    },
    {
      "id": "physics",
      "name": "物理学",
      "nameEn": "Physics",
      "coreConcepts": ["量子力学", "相对论", "热力学", "电磁学", "统计力学", "场论"],
      "typicalMethods": ["解析推导", "数值计算", "蒙特卡洛模拟", "实验验证", "对称性分析"],
      "keyMetrics": ["能量", "动量", "熵", "耦合常数", "截面"],
      "relatedDisciplines": ["astronomy", "chemistry", "mathematics", "computer"],
      "abstractionLevel": "meso",
      "dataCharacteristics": "实验数据为主，精确测量，误差分析"
    }
    // ... 生物、化学、地理、计算机
  ]
}
```

【验收标准】：
- [ ] 学科图谱正确展示 6 个学科节点和它们之间的桥接关系，力导向图交互流畅
- [ ] `discoverBridges` 能正确返回至少 5 个跨学科桥接关系，每条包含合理的解释和证据
- [ ] 假设迁移功能能将天文领域假设正确迁移到物理/生物/计算机领域，保持逻辑一致性
- [ ] 迁移结果的 diff 视图正确标注术语替换，人工审核准确率 ≥ 80%
- [ ] 可行性评估雷达图正确展示 5 个维度，雷达图数据由 Qwen 生成且合理
- [ ] 融合创新机会墙至少展示 6 个机会卡片，每个卡片包含可点击的详细内容
- [ ] 方法借用库支持至少 10 个方法的跨学科迁移，迁移结果具有科研参考价值
- [ ] 整个跨学科融合引擎响应时间 ≤ 30s（含 Qwen 多步调用），超时提供进度提示和结果缓存
- [ ] 所有桥接关系和迁移结果存储在 KV Storage，支持历史查询和重新加载

【预期产出】：
- `src/types/fusion.ts` — 跨学科类型定义
- `src/data/discipline-config.json` — 学科配置数据
- `src/components/fusion/DisciplineMap.tsx` — 学科图谱可视化
- `src/components/fusion/MigrateWorkbench.tsx` — 假设迁移工作台
- `src/components/fusion/OpportunityWall.tsx` — 融合创新机会墙
- `src/components/fusion/MethodBorrowLibrary.tsx` — 方法借用库
- `src/components/fusion/FusionRadarChart.tsx` — 可行性雷达图
- `src/components/fusion/DiffViewer.tsx` — 假设迁移 diff 视图
- `edge-functions/api/fusion/disciplines.js` — 学科管理 API
- `edge-functions/api/fusion/bridges.js` — 桥接发现 API
- `edge-functions/api/fusion/migrate.js` — 假设迁移 API
- `edge-functions/api/fusion/opportunities.js` — 机会发现 API
- `src/services/fusionService.ts` — 前端融合服务封装

---

### <a name="p5-t4"></a>【龙虾角色】：后端工程师 + 协作系统设计师

【龙虾ID】：P5-T4

【任务名称】：科研协作网络 — 兴趣匹配、假设众评、协作编辑

【上下文】：
- 前置完成状态：Phase 1-4 已完成。用户系统（JWT 注册/登录）已就绪，用户数据存储在 EdgeOne KV。假设生成系统支持版本管理（`hypotheses` 数组存储在 `session:{sessionId}` 中）。项目管理系统（看板/进度）已有基础实现。前端使用 React 18 + Tailwind。
- 技术约束：
  - EdgeOne KV 无事务支持，协作编辑需使用乐观锁 + 版本向量
  - Edge Functions 无 WebSocket 支持，实时协作使用轮询（polling，间隔 5s）或 Server-Sent Events（SSE，若 EdgeOne 支持）
  - 用户匹配算法在 Edge Function 内实现，不能依赖外部向量数据库
  - 假设众评需要防刷机制：同一用户 24h 内对同一假设只能评一次
  - 协作编辑冲突解决：使用 Operational Transformation (OT) 简化版或 last-write-wins + 版本提示

【具体指令】：

#### 1. 数据模型设计

```typescript
// 用户兴趣向量（简化版，不用真实向量，用标签权重）
interface UserInterestVector {
  userId: string;
  tags: Record<string, number>; // 标签 → 权重（0-1），如 { "黑洞": 0.9, "深度学习": 0.7 }
  updatedAt: string;
}

// 兴趣匹配结果
interface InterestMatch {
  id: string;
  userId: string;          // 当前用户
  matchedUserId: string;   // 匹配到的用户
  matchScore: number;     // 0-1 匹配度
  commonTags: string[];    // 共同兴趣标签
  complementaryTags: string[]; // 互补标签（可能产生跨学科协作）
  matchReason: string;      // 匹配原因说明
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

// 假设众评
interface HypothesisReview {
  id: string;
  hypothesisId: string;
  reviewerId: string;
  reviewerName: string;    // 脱敏展示
  reviewType: 'novelty' | 'feasibility' | 'logic' | 'significance' | 'overall';
  score: number;           // 1-5 或 1-10
  comment: string;
  upvotes: number;         // 其他用户点赞数
  createdAt: string;
}

interface HypothesisReviewSummary {
  hypothesisId: string;
  totalReviews: number;
  averageScore: number;
  scoreDistribution: { 1: number, 2: number, 3: number, 4: number, 5: number };
  reviewTags: string[];     // 高频评价关键词（由 Qwen 提取）
  consensusLevel: 'high' | 'medium' | 'low'; // 共识度（分数方差小则高）
  topComments: string[];   // 精选评论（按点赞排序 top 3）
}

// 协作会话（用于协作编辑）
interface CollaborationSession {
  id: string;
  type: 'hypothesis' | 'research_plan' | 'experiment_design' | 'paper_draft';
  targetId: string;        // 编辑的目标对象 ID
  title: string;
  ownerId: string;          // 创建者
  participants: string[];   // 参与者 userId 列表
  status: 'active' | 'archived' | 'merged';
  createdAt: string;
  updatedAt: string;
  lastEditAt: string;
  version: number;         // 乐观锁版本号
}

// 协作编辑操作（简化 OT）
interface EditOperation {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  operationType: 'insert' | 'delete' | 'replace' | 'reorder' | 'comment';
  targetField: string;       // 编辑的字段，如 "hypothesis.abstract"
  position?: number;         // 插入/删除位置
  content?: string;          // 插入/替换内容
  oldContent?: string;       // 删除/替换的旧内容（用于冲突检测）
  timestamp: string;
  version: number;         // 操作时的版本号
  parentVersion: number;     // 基于哪个版本进行的操作
}

// 协作编辑快照
interface CollaborationSnapshot {
  sessionId: string;
  version: number;
  content: object;          // 当前文档内容（JSON）
  operations: EditOperation[]; // 操作历史（最近 50 条）
  lastModifiedAt: string;
}
```

#### 2. Edge Functions API

```javascript
// 兴趣匹配
'GET  /api/collaboration/matches': getMatches,              // 获取匹配推荐
'POST /api/collaboration/matches/refresh': refreshMatches,  // 刷新匹配（重新计算）
'POST /api/collaboration/matches/:id/respond': respondMatch, // 接受/拒绝匹配
'GET  /api/collaboration/matches/:id/profile': getMatchProfile, // 查看匹配用户资料（脱敏）

// 假设众评
'POST /api/collaboration/reviews': submitReview,             // 提交评价
'GET  /api/collaboration/reviews/:hypothesisId': getReviews, // 获取假设评价列表
'GET  /api/collaboration/reviews/:hypothesisId/summary': getReviewSummary, // 获取评价摘要
'POST /api/collaboration/reviews/:id/upvote': upvoteReview, // 点赞评价
'POST /api/collaboration/reviews/:id/flag': flagReview,     // 举报评价

// 协作编辑
'POST /api/collaboration/sessions': createSession,            // 创建协作会话
'GET  /api/collaboration/sessions': getSessions,              // 获取会话列表
'GET  /api/collaboration/sessions/:id': getSession,           // 获取会话详情
'POST /api/collaboration/sessions/:id/join': joinSession,     // 加入会话
'POST /api/collaboration/sessions/:id/operations': submitOperation, // 提交编辑操作
'GET  /api/collaboration/sessions/:id/snapshot': getSnapshot, // 获取最新快照（轮询用）
'POST /api/collaboration/sessions/:id/merge': mergeSession,   // 合并会话成果到主版本
```

**`getMatches` / `refreshMatches` 实现细节**：
1. 读取当前用户的兴趣标签权重（`user:interest:{userId}`）
2. 读取所有其他用户的兴趣标签（批量读取，限制最多 100 个用户，按最近活跃排序）
3. 计算匹配度：使用 Jaccard 相似度（共同标签）+ 加权余弦相似度（标签权重）
   ```javascript
   matchScore = 0.5 * jaccardSimilarity(tagsA, tagsB) + 0.5 * weightedCosineSimilarity(weightsA, weightsB)
   ```
4. 补充信息：调用 Qwen-Plus，Prompt："用户A兴趣：{tagsA}。用户B兴趣：{tagsB}。请分析为什么这两位研究者可能产生有价值的协作，并指出互补的潜在方向。输出 50 字以内。"
5. 存储匹配结果到 KV：`collaboration:match:{matchId}`，TTL 7 天
6. 返回 Top 10 匹配

**`submitReview` 实现细节**：
1. 防刷检查：检查 `review:lock:{userId}:{hypothesisId}` 是否存在，存在则拒绝（TTL 24h）
2. 输入验证：score 在 1-5 之间，comment 长度 ≤ 500 字，必须经过内容过滤（禁止辱骂、广告等）
3. 存储评价：`collaboration:review:{reviewId}`
4. 更新评价摘要：异步触发（通过 Edge Functions 的异步模式或下次读取时计算）
5. 返回评价确认

**`submitOperation` / `getSnapshot` 实现细节（协作编辑核心）**：
1. `submitOperation`：
   - 读取当前快照版本（`collaboration:snapshot:{sessionId}`）
   - 如果 `operation.version !== currentVersion`，则操作基于旧版本，进入冲突检测：
     - 如果操作的是不同字段 → 无冲突，直接应用
     - 如果操作的是同一字段但操作类型不同（如一个 insert 一个 delete）→ 无冲突，直接应用
     - 如果操作的是同一字段且操作类型相同（如两个 replace）→ 冲突，返回冲突提示，要求用户手动解决
   - 应用操作到内容，版本号 +1，写入新快照
   - 将操作追加到操作历史（最多保留 50 条）
   - 返回最新版本号和内容
2. `getSnapshot`：
   - 读取 `collaboration:snapshot:{sessionId}`
   - 返回版本号、内容、最近操作历史（用于前端展示"谁在编辑"）
3. 前端轮询：每 5 秒调用 `getSnapshot`，如果版本号变化则更新界面
4. 若 EdgeOne 支持 SSE，优先使用 SSE 推送版本号变化，前端收到后拉取完整快照

#### 3. 前端协作界面

**页面 1：`/collaboration/matches` — 兴趣匹配中心**
- 顶部："我的兴趣标签"编辑区（可增删标签，调整权重 slider）
- 主体：匹配卡片列表，每张卡片：
  - 左侧：用户头像占位符（使用首字母 + 颜色）
  - 中间：匹配度百分比（大字体）+ 共同标签（绿色 badge）+ 互补标签（紫色 badge）+ 匹配原因说明
  - 右侧："接受"按钮（绿色）+ "查看资料"按钮（蓝色）+ "忽略"按钮（灰色）
- 支持筛选：按匹配度范围、按是否包含特定标签
- 点击"查看资料"：展开面板，显示该用户的脱敏资料（研究领域、最近研究方向、可协作方向）

**页面 2：`/collaboration/reviews/:hypothesisId` — 假设评价广场**
- 顶部：假设标题 + 假设摘要 + 当前综合评分（大数字，1-5 星）+ 评价总数
- 评分分布：横向柱状图展示 1-5 星的分布
- 评价标签云：高频评价关键词（如"创新性强"、"实验设计清晰"、"数据支撑不足"）
- 评价列表：每条评价卡片：评分（星级）+ 评论 + 点赞按钮 + 时间 + 评价类型徽章
- 底部：评价输入区（星级选择器 + 评论文本框 + 评价类型选择）+ 提交按钮
- 共识度指示器：根据分数方差显示"高度共识"/"存在分歧"/"争议较大"，用不同颜色

**页面 3：`/collaboration/edit/:sessionId` — 协作编辑器**
- 三栏布局：
  - 左栏（20%）：参与者列表（在线状态 + 最近操作字段）+ 操作历史（最近 10 条，带时间戳）
  - 中栏（60%）：协作编辑区（根据 type 不同渲染不同编辑器）
    - `hypothesis` 类型：假设标题 + 摘要 + 前提 + 预测 + 验证方法，每个字段可独立编辑
    - `research_plan` 类型：任务列表，支持增删改任务，拖拽排序
    - `experiment_design` 类型：实验步骤，支持步骤增删改
  - 右栏（20%）：实时讨论区（基于文本的简易聊天，非实时 WebSocket，轮询或 SSE）
- 编辑区实现：
  - 每个字段是一个可编辑区域（`contentEditable` 或 `<textarea>`）
  - 用户输入时，每 2 秒或 blur 时提交 `submitOperation`（减少 API 调用）
  - 字段顶部显示"当前编辑者：{userName}"（基于最近操作）
  - 如果检测到版本冲突，弹出冲突解决面板：显示两个版本的内容，让用户选择保留哪个或手动合并
- 讨论区：
  - 简单的消息列表，每 5 秒轮询新消息
  - 支持 @ 提及参与者（输入 @ 弹出参与者列表）
  - 消息类型：普通文本 / 关联到特定字段的评论（点击字段旁的评论图标）

**页面 4：`/collaboration/sessions` — 协作会话管理**
- 列表展示所有我参与的会话（创建者 + 参与者）
- 每张卡片：会话标题 + 类型徽章 + 参与者头像列表 + 最后更新时间 + 状态（活跃/已归档/已合并）
- 操作：进入编辑 / 归档 / 合并（仅创建者可合并）
- 合并功能：将协作会话的最终内容合并到主版本（如将协作编辑的假设合并到个人假设库）

#### 4. 协作编辑核心算法（简化 OT）

实现 `src/utils/collaboration/ot.ts`：

```typescript
// 简化版：只处理 JSON 对象的字段级操作，不做字符级 OT
// 冲突检测规则：
// 1. 如果两个操作修改不同字段 → 无冲突，合并
// 2. 如果两个操作修改同一字段，且都是 "replace" → 冲突，需要手动解决
// 3. 如果两个操作修改同一字段，一个是 "delete" 一个是 "insert" → 无冲突，但顺序敏感（按时间戳排序）
// 4. 如果两个操作都是 "reorder"（数组）且修改不同位置 → 无冲突
// 5. 如果两个操作都是 "reorder" 且修改同一位置 → 冲突

function detectConflict(op1: EditOperation, op2: EditOperation): boolean {
  if (op1.targetField !== op2.targetField) return false;
  if (op1.operationType === 'insert' && op2.operationType === 'delete') return false;
  if (op1.operationType === 'delete' && op2.operationType === 'insert') return false;
  if (op1.operationType === 'comment' || op2.operationType === 'comment') return false;
  return true; // 其他情况视为冲突
}

function applyOperation(content: object, op: EditOperation): object {
  const newContent = JSON.parse(JSON.stringify(content)); // 深拷贝
  const fieldPath = op.targetField.split('.');
  let target = newContent;
  for (let i = 0; i < fieldPath.length - 1; i++) {
    target = target[fieldPath[i]];
  }
  const lastKey = fieldPath[fieldPath.length - 1];
  
  switch (op.operationType) {
    case 'insert':
      if (Array.isArray(target[lastKey])) {
        target[lastKey].splice(op.position || 0, 0, op.content);
      }
      break;
    case 'delete':
      if (Array.isArray(target[lastKey])) {
        target[lastKey].splice(op.position || 0, 1);
      } else {
        delete target[lastKey];
      }
      break;
    case 'replace':
      target[lastKey] = op.content;
      break;
    case 'reorder':
      // 数组重排序，content 为新的数组顺序
      target[lastKey] = JSON.parse(op.content || '[]');
      break;
  }
  return newContent;
}
```

【验收标准】：
- [ ] 兴趣匹配能基于用户标签正确推荐 Top 10 匹配用户，匹配度计算合理（人工验证 ≥ 70% 的推荐有价值）
- [ ] 匹配推荐页面支持接受/拒绝/查看资料，用户资料脱敏展示（不暴露真实姓名、邮箱）
- [ ] 假设评价支持 5 星评分 + 评论 + 点赞，防刷机制有效（同一用户 24h 内无法重复评价）
- [ ] 评价摘要正确计算平均分、分布、高频标签、共识度
- [ ] 协作编辑器支持 2 人同时编辑同一假设的不同字段，无冲突，版本同步正常
- [ ] 协作编辑器支持冲突检测：当两人同时修改同一字段时，正确提示冲突并提供手动解决界面
- [ ] 协作编辑器操作历史正确记录最近 50 条操作，显示操作者、时间、字段
- [ ] 讨论区支持发送消息和 @ 提及，消息轮询间隔 5s，延迟可接受
- [ ] 协作会话支持创建、加入、归档、合并，合并后内容正确写入主版本
- [ ] 所有协作 API 有适当的权限校验（只能编辑自己参与的会话）
- [ ] 协作功能在 50s Edge Function 超时限制内正常运行

【预期产出】：
- `src/types/collaboration.ts` — 协作类型定义
- `src/components/collaboration/MatchCenter.tsx` — 兴趣匹配中心
- `src/components/collaboration/ReviewPlaza.tsx` — 假设评价广场
- `src/components/collaboration/CollaborativeEditor.tsx` — 协作编辑器
- `src/components/collaboration/SessionManager.tsx` — 会话管理
- `src/components/collaboration/DiscussionPanel.tsx` — 讨论面板
- `src/components/collaboration/ConflictResolver.tsx` — 冲突解决组件
- `src/components/collaboration/StarRating.tsx` — 星级评分组件
- `src/utils/collaboration/ot.ts` — 简化 OT 算法
- `src/utils/collaboration/matchCalculator.ts` — 匹配度计算
- `src/hooks/useCollaboration.ts` — 协作状态管理 hook
- `edge-functions/api/collaboration/matches.js` — 匹配 API
- `edge-functions/api/collaboration/reviews.js` — 评价 API
- `edge-functions/api/collaboration/sessions.js` — 会话 API
- `edge-functions/api/collaboration/operations.js` — 编辑操作 API
- `src/services/collaborationService.ts` — 前端协作服务封装

---

## <a name="phase-6"></a>Phase 6：测试与优化（第11-12周）

> Phase 6 目标：确保系统质量、安全、性能达标，制作比赛交付物，完成部署上线。

---

### <a name="p6-t1"></a>【龙虾角色】：测试工程师 + QA 专家

【龙虾ID】：P6-T1

【任务名称】：测试体系构建 — 单元测试与集成测试

【上下文】：
- 前置完成状态：Phase 1-5 全部完成。前端为 React 18 + TypeScript + Vite；后端为 EdgeOne Edge Functions（JavaScript）；数据存储为 EdgeOne KV Storage。四大核心智能体（文献整合者、假设生成器、实验规划师、评估验证官）通过百炼 API 调用 Qwen 模型。已有组件约 50+ 个，页面 15+ 个，Edge Functions 约 30+ 个。
- 技术约束：
  - 单元测试使用 Vitest（Vite 原生支持，替代 Jest）
  - 前端集成测试使用 Playwright（E2E 测试）
  - Edge Functions 测试使用 Vitest + `miniflare` 或 `wrangler` 模拟 Edge Runtime 环境
  - 百炼 API 调用在测试中使用 Mock（禁止在自动化测试中消耗真实 API 额度）
  - 测试覆盖率目标：核心工具函数 ≥ 80%，组件渲染 ≥ 60%，API 路由 ≥ 70%
  - 测试必须在 CI 中可运行（≤ 10 分钟全部跑完）

【具体指令】：

#### 1. 测试基础设施搭建

**安装依赖**：
```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @playwright/test
npm install -D msw@latest  # Mock Service Worker，用于拦截 API 请求
```

**配置 `vitest.config.ts`**：
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 60,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
      exclude: [
        'node_modules/',
        'src/test/',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
    },
    include: ['src/**/*.test.{ts,tsx}', 'edge-functions/**/*.test.js'],
    exclude: ['node_modules', 'dist', 'playwright/'],
  },
});
```

**配置 `src/test/setup.ts`**：
```typescript
import '@testing-library/jest-dom';
import { server } from './mocks/server';

// 启动 MSW Mock 服务器
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// 全局 mock window.matchMedia（用于响应式测试）
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
```

**配置 `playwright.config.ts`**：
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './playwright',
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
});
```

#### 2. 单元测试编写（Vitest）

**A. 工具函数测试（`src/utils/**/*.test.ts`）**

测试覆盖率目标：≥ 90%

- `src/utils/knowledgeGraph/graphOperations.test.ts`：
  - 测试图遍历算法（BFS/DFS）
  - 测试最短路径发现
  - 测试环检测（用于验证证据链）
  - 测试节点/边的增删改查
  - 测试图序列化/反序列化
  
- `src/utils/collaboration/ot.test.ts`：
  - 测试冲突检测（不同字段无冲突、同一字段 replace 冲突）
  - 测试 applyOperation（insert/delete/replace/reorder）
  - 测试版本号递增
  - 测试边界条件（空数组操作、越界位置）

- `src/utils/validation/inputValidators.test.ts`：
  - 测试邮箱验证、密码强度、URL 验证、科学术语过滤
  - 测试 XSS 检测函数（各种 payload）
  - 测试 SQL 注入检测
  - 测试百炼 API Key 格式验证

- `src/utils/formatters/scientificFormatters.test.ts`：
  - 测试引用格式转换（APA / GB/T 7714）
  - 测试数值格式化（科学计数法、有效数字）
  - 测试日期格式化（ISO 8601 转换）

- `src/utils/collaboration/matchCalculator.test.ts`：
  - 测试 Jaccard 相似度计算
  - 测试加权余弦相似度
  - 测试边界条件（空标签、全相同标签、全不同标签）
  - 测试匹配度归一化（0-1 范围）

**B. 服务层测试（`src/services/**/*.test.ts`）**

测试覆盖率目标：≥ 80%

- `src/services/bailianService.test.ts`：
  - Mock 百炼 API 响应，测试 chat completion 调用
  - 测试模型映射（reasoning/general/coding/multimodal/longcontext）
  - 测试错误重试（网络超时、429 限流、500 服务器错误）
  - 测试流式输出处理（SSE 解析）
  - 测试 Token 消耗统计

- `src/services/avatarService.test.ts`：
  - Mock 后端 API，测试画像创建/更新/读取
  - 测试记忆存储/检索
  - 测试情绪检测（Mock 返回各种情绪状态）
  - 测试个性化输出（输入相同文本，不同用户画像返回不同输出）

- `src/services/agentOrchestrator.test.ts`：
  - 测试四大 Agent 的调用顺序（文献 → 假设 → 实验 → 评估）
  - 测试迭代循环（人工反馈后重新触发假设生成）
  - 测试异常处理（某个 Agent 失败后的降级策略）
  - 测试会话状态管理（创建/更新/读取/删除）

- `src/services/fusionService.test.ts`：
  - 测试桥接发现 API 调用
  - 测试假设迁移 API 调用
  - 测试机会发现 API 调用
  - 测试结果缓存（避免重复调用）

- `src/services/collaborationService.test.ts`：
  - 测试匹配获取/刷新/响应
  - 测试评价提交/获取/点赞
  - 测试会话创建/加入/操作提交/快照获取
  - 测试合并操作

**C. 组件单元测试（`src/components/**/*.test.tsx`）**

测试覆盖率目标：≥ 60%

- `src/components/avatar/AvatarPanel.test.tsx`：
  - 测试默认折叠状态（显示圆形头像）
  - 测试点击展开（显示聊天面板）
  - 测试快速操作按钮点击
  - 测试情绪状态 emoji 显示

- `src/components/hypothesis/HypothesisGenerator.test.tsx`：
  - 测试输入框渲染和输入
  - 测试生成按钮点击（Mock API 调用）
  - 测试假设卡片列表渲染
  - 测试假设选择交互
  - 测试加载状态显示

- `src/components/research/LiteratureReview.test.tsx`：
  - 测试文献列表渲染
  - 测试筛选功能（按年份/相关性）
  - 测试证据图谱渲染（Mock D3/Canvas）
  - 测试导出功能

- `src/components/visualization/PosterGenerator.test.tsx`：
  - 测试模板选择器渲染
  - 测试实时编辑功能（输入标题后海报预览更新）
  - 测试导出按钮（Mock html-to-image）

- `src/components/knowledgeGraph/KnowledgeGraphViewer.test.tsx`：
  - 测试图谱渲染（Mock D3）
  - 测试节点点击事件
  - 测试缩放/拖拽交互
  - 测试搜索高亮

- `src/components/collaboration/CollaborativeEditor.test.tsx`：
  - 测试字段渲染和编辑
  - 测试操作提交（Mock API）
  - 测试冲突提示显示（模拟版本不一致）
  - 测试参与者列表显示

**D. Mock 数据与 Mock Server**

创建 `src/test/mocks/handlers.ts`（MSW handlers）：

```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  // 百炼 API Mock
  http.post('/api/bailian/chat', async () => {
    return HttpResponse.json({
      output: { text: 'Mock 的 AI 回复内容' },
      usage: { input_tokens: 100, output_tokens: 50 },
    });
  }),
  
  // 用户系统 Mock
  http.post('/api/auth/login', () => {
    return HttpResponse.json({ token: 'mock-jwt-token', user: { id: 'test-user', name: '测试用户' } });
  }),
  
  // 假设生成 API Mock
  http.post('/api/agents/hypothesis', () => {
    return HttpResponse.json({
      hypotheses: [
        { id: 'h1', title: 'Mock 假设 1', description: '这是测试假设', confidence: 0.85 },
        { id: 'h2', title: 'Mock 假设 2', description: '这是测试假设 2', confidence: 0.72 },
      ],
    });
  }),
  
  // 文献检索 API Mock
  http.post('/api/agents/literature', () => {
    return HttpResponse.json({
      papers: [
        { id: 'p1', title: 'Mock Paper 1', authors: ['Author A'], year: 2024, relevance: 0.95 },
      ],
      gaps: ['Mock 知识缺口'],
    });
  }),
  
  // 更多 handlers... 覆盖所有 Edge Functions API
];
```

创建 `src/test/fixtures/` 目录，包含：
- `mockUser.ts` — 测试用户数据
- `mockHypothesis.ts` — 测试假设数据
- `mockPapers.ts` — 测试文献数据
- `mockKnowledgeGraph.ts` — 测试图谱数据
- `mockAgentResponses.ts` — 测试 Agent 响应数据

#### 3. 集成测试 / E2E 测试（Playwright）

**测试文件**：`playwright/tests/`

**A. 核心用户流程测试（`coreFlow.spec.ts`）**

测试完整的科研闭环流程：

```typescript
// playwright/tests/coreFlow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('核心科研闭环流程', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.fill('[data-testid="login-email"]', 'test@example.com');
    await page.fill('[data-testid="login-password"]', 'Test123456');
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL('/dashboard');
  });

  test('完整科研流程：问题输入 → 文献综述 → 假设生成 → 实验设计 → 评估', async ({ page }) => {
    // 1. 输入科学问题
    await page.goto('/research/question');
    await page.fill('[data-testid="question-input"]', '太阳耀斑的磁场触发机制是什么？');
    await page.click('[data-testid="analyze-question"]');
    await page.waitForSelector('[data-testid="question-analysis-result"]', { timeout: 10000 });
    
    // 验证问题解析结果
    await expect(page.locator('[data-testid="question-type"]')).toContainText('因果');
    await expect(page.locator('[data-testid="domain"]')).toContainText('太阳物理');
    
    // 2. 生成文献综述
    await page.click('[data-testid="proceed-to-literature"]');
    await page.waitForURL('/research/literature');
    await page.click('[data-testid="generate-review"]');
    await page.waitForSelector('[data-testid="literature-review-content"]', { timeout: 15000 });
    
    // 验证文献列表和知识缺口
    await expect(page.locator('[data-testid="paper-count"]')).toHaveText(/\d+ 篇文献/);
    await expect(page.locator('[data-testid="knowledge-gaps"]')).toBeVisible();
    
    // 3. 生成假设
    await page.click('[data-testid="proceed-to-hypothesis"]');
    await page.waitForURL('/research/hypothesis');
    await page.click('[data-testid="generate-hypotheses"]');
    await page.waitForSelector('[data-testid="hypothesis-card"]', { timeout: 15000 });
    
    // 验证假设卡片
    const hypothesisCards = page.locator('[data-testid="hypothesis-card"]');
    await expect(hypothesisCards).toHaveCount(3, { timeout: 15000 });
    
    // 选择第一个假设
    await page.click('[data-testid="hypothesis-card"]:first-child [data-testid="select-hypothesis"]');
    
    // 4. 设计实验
    await page.click('[data-testid="proceed-to-plan"]');
    await page.waitForURL('/research/plan');
    await page.click('[data-testid="generate-plan"]');
    await page.waitForSelector('[data-testid="experiment-plan"]', { timeout: 15000 });
    
    // 验证实验计划包含步骤
    await expect(page.locator('[data-testid="experiment-step"]').first()).toBeVisible();
    
    // 5. 评估
    await page.click('[data-testid="proceed-to-evaluate"]');
    await page.waitForURL('/research/evaluate');
    await page.waitForSelector('[data-testid="evaluation-report"]', { timeout: 10000 });
    
    // 验证评估报告
    await expect(page.locator('[data-testid="evaluation-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="improvement-suggestions"]')).toBeVisible();
  });
});
```

**B. 四大 Agent 核心流程测试（`agentFlows.spec.ts`）**

```typescript
// playwright/tests/agentFlows.spec.ts
import { test, expect } from '@playwright/test';

test.describe('四大 Agent 核心流程', () => {
  test('文献整合者 Agent：输入查询 → 返回文献列表和知识缺口', async ({ page }) => {
    await page.goto('/research/literature');
    await page.fill('[data-testid="query-input"]', 'solar flare magnetic reconnection');
    await page.click('[data-testid="search-literature"]');
    
    // 等待加载完成
    await page.waitForSelector('[data-testid="literature-results"]', { timeout: 15000 });
    
    // 验证文献列表
    const papers = page.locator('[data-testid="paper-item"]');
    await expect(papers).toHaveCount.greaterThan(0);
    
    // 验证知识缺口
    await expect(page.locator('[data-testid="knowledge-gap"]')).toBeVisible();
    
    // 验证证据图谱渲染
    await expect(page.locator('[data-testid="evidence-graph"]')).toBeVisible();
  });

  test('假设生成器 Agent：基于知识缺口生成候选假设', async ({ page }) => {
    await page.goto('/research/hypothesis');
    
    // 先模拟已有知识缺口（通过直接设置 URL 参数或 Mock）
    await page.goto('/research/hypothesis?gaps=磁场重联机制不明确,能量释放过程缺乏观测约束');
    await page.click('[data-testid="generate-from-gaps"]');
    
    await page.waitForSelector('[data-testid="hypothesis-list"]', { timeout: 15000 });
    
    // 验证假设数量（3-5 个）
    const hypotheses = page.locator('[data-testid="hypothesis-item"]');
    await expect(hypotheses).toHaveCount.greaterThanOrEqual(3);
    await expect(hypotheses).toHaveCount.lessThanOrEqual(5);
    
    // 验证每个假设包含必要字段
    for (const hypothesis of await hypotheses.all()) {
      await expect(hypothesis.locator('[data-testid="hypothesis-title"]')).toBeVisible();
      await expect(hypothesis.locator('[data-testid="hypothesis-prediction"]')).toBeVisible();
      await expect(hypothesis.locator('[data-testid="hypothesis-verifiability"]')).toBeVisible();
    }
  });

  test('实验规划师 Agent：生成包含代码的实验方案', async ({ page }) => {
    await page.goto('/research/plan');
    await page.goto('/research/plan?hypothesisId=mock-h1');
    await page.click('[data-testid="generate-experiment"]');
    
    await page.waitForSelector('[data-testid="experiment-plan"]', { timeout: 15000 });
    
    // 验证实验步骤
    await expect(page.locator('[data-testid="experiment-step"]').first()).toBeVisible();
    
    // 验证代码生成（如果有）
    const codeBlock = page.locator('[data-testid="generated-code"]');
    if (await codeBlock.isVisible()) {
      await expect(codeBlock).toContainText('python'); // 或 R / MATLAB
    }
    
    // 验证时间线/甘特图
    await expect(page.locator('[data-testid="timeline-chart"]')).toBeVisible();
  });

  test('评估验证官 Agent：评估假设质量并给出修正建议', async ({ page }) => {
    await page.goto('/research/evaluate');
    await page.goto('/research/evaluate?hypothesisId=mock-h1');
    await page.click('[data-testid="evaluate-hypothesis"]');
    
    await page.waitForSelector('[data-testid="evaluation-report"]', { timeout: 15000 });
    
    // 验证评分维度
    await expect(page.locator('[data-testid="score-novelty"]')).toBeVisible();
    await expect(page.locator('[data-testid="score-verifiability"]')).toBeVisible();
    await expect(page.locator('[data-testid="score-logicality"]')).toBeVisible();
    await expect(page.locator('[data-testid="score-evidence"]')).toBeVisible();
    
    // 验证修正建议
    await expect(page.locator('[data-testid="improvement-suggestion"]').first()).toBeVisible();
    
    // 验证迭代按钮
    await expect(page.locator('[data-testid="iterate-hypothesis"]')).toBeEnabled();
  });
});
```

**C. 拓展功能测试（`advancedFeatures.spec.ts`）**

```typescript
// playwright/tests/advancedFeatures.spec.ts
test.describe('Phase 5 拓展功能', () => {
  test('AI 数字分身：设置用户画像后，Agent 回复语气变化', async ({ page }) => {
    await page.goto('/avatar/profile');
    
    // 完成画像设置
    await page.selectOption('[data-testid="expertise-level"]', 'phd');
    await page.fill('[data-testid="research-field"]', '太阳物理');
    await page.click('[data-testid="save-profile"]');
    
    // 进入假设生成，检查 Agent 回复是否包含博士级别的专业术语
    await page.goto('/research/hypothesis');
    await page.click('[data-testid="generate-hypotheses"]');
    await page.waitForSelector('[data-testid="hypothesis-card"]', { timeout: 15000 });
    
    const firstHypothesis = page.locator('[data-testid="hypothesis-card"]').first();
    await expect(firstHypothesis).toContainText(/磁场/); // 或更复杂的验证
  });

  test('科学传播可视化：生成科普海报并导出', async ({ page }) => {
    await page.goto('/visualization/poster');
    
    // 选择假设内容
    await page.fill('[data-testid="content-input"]', '太阳耀斑是由磁场能量突然释放引起的剧烈爆发现象。');
    await page.selectOption('[data-testid="poster-style"]', 'popular');
    await page.click('[data-testid="generate-poster"]');
    
    await page.waitForSelector('[data-testid="poster-preview"]', { timeout: 10000 });
    
    // 验证海报预览可见
    await expect(page.locator('[data-testid="poster-preview"]')).toBeVisible();
    
    // 导出按钮
    await page.click('[data-testid="export-poster"]');
    // 验证下载（Playwright 可以监听下载事件）
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-poster"]');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/);
  });

  test('科研协作：提交假设评价并查看摘要', async ({ page }) => {
    await page.goto('/collaboration/reviews/mock-h1');
    
    // 提交评价
    await page.click('[data-testid="star-4"]'); // 4 星
    await page.fill('[data-testid="review-comment"]', '这个假设很有创新性，但实验设计需要更多细节。');
    await page.selectOption('[data-testid="review-type"]', 'novelty');
    await page.click('[data-testid="submit-review"]');
    
    // 验证评价出现在列表中
    await page.waitForSelector('[data-testid="review-card"]', { timeout: 5000 });
    await expect(page.locator('[data-testid="review-card"]').first()).toContainText('创新性');
    
    // 验证评价摘要更新
    await page.waitForTimeout(2000); // 等待摘要计算
    await expect(page.locator('[data-testid="average-score"]')).toContainText('4');
  });
});
```

**D. 安全与边界测试（`security.spec.ts`）**

```typescript
// playwright/tests/security.spec.ts
test.describe('安全与边界测试', () => {
  test('XSS 防护：输入包含脚本标签的内容，输出应被转义', async ({ page }) => {
    await page.goto('/research/question');
    await page.fill('[data-testid="question-input"]', '<script>alert("xss")</script>太阳耀斑');
    await page.click('[data-testid="analyze-question"]');
    
    // 检查页面中是否存在未转义的 script 标签
    const html = await page.content();
    expect(html).not.toContain('<script>alert("xss")</script>');
    // 应该被转义为实体或过滤掉
  });

  test('API Key 保护：前端网络请求中不应包含百炼 API Key', async ({ page }) => {
    await page.goto('/dashboard');
    
    // 拦截所有请求，检查是否包含 API Key 特征
    page.on('request', request => {
      const url = request.url();
      const headers = request.headers();
      const postData = request.postData() || '';
      
      // 检查是否直接调用 dashscope.aliyuncs.com
      expect(url).not.toContain('dashscope.aliyuncs.com');
      
      // 检查请求体中是否包含 sk- 开头的 API Key
      expect(postData).not.toMatch(/sk-[a-zA-Z0-9]{32,}/);
    });
    
    // 触发一些 API 调用
    await page.click('[data-testid="generate-hypotheses"]');
    await page.waitForTimeout(5000);
  });

  test('权限校验：未登录用户访问受保护页面应重定向到登录', async ({ page }) => {
    await page.goto('/research/hypothesis');
    await page.waitForURL('/login', { timeout: 5000 });
    expect(page.url()).toContain('/login');
  });

  test('输入校验：超长输入应被截断或拒绝', async ({ page }) => {
    await page.goto('/research/question');
    const longInput = 'a'.repeat(10000);
    await page.fill('[data-testid="question-input"]', longInput);
    await page.click('[data-testid="analyze-question"]');
    
    // 应显示错误提示或自动截断
    await expect(page.locator('[data-testid="input-error"]')).toBeVisible();
  });
});
```

**E. 响应式与兼容性测试（`responsive.spec.ts`）**

```typescript
// playwright/tests/responsive.spec.ts
test.describe('响应式与兼容性', () => {
  test('移动端：科研流程在 375px 宽度下可完成', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/research/question');
    
    // 验证输入框可见且可输入
    await page.fill('[data-testid="question-input"]', '太阳耀斑机制');
    await page.click('[data-testid="analyze-question"]');
    
    await page.waitForSelector('[data-testid="question-analysis-result"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="question-type"]')).toBeVisible();
  });

  test('暗黑模式：切换后知识图谱颜色正确变化', async ({ page }) => {
    await page.goto('/knowledge/graph');
    await page.click('[data-testid="dark-mode-toggle"]');
    
    // 检查 body 是否有 dark class
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // 检查图谱背景色是否变暗（通过 CSS 计算或截图对比）
    const graphContainer = page.locator('[data-testid="knowledge-graph"]');
    const bgColor = await graphContainer.evaluate(el => window.getComputedStyle(el).backgroundColor);
    expect(bgColor).toContain('rgb(10, 37, 64)'); // 或暗黑模式下的背景色
  });
});
```

#### 4. Edge Functions 测试

创建 `edge-functions/tests/` 目录，使用 Vitest 测试：

```typescript
// edge-functions/tests/auth.test.js
import { describe, it, expect, vi } from 'vitest';
import { handleAuth } from '../api/auth.js';

// Mock KV Storage
const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

const mockEnv = { KV_STORAGE: mockKV, JWT_SECRET: 'test-secret' };

describe('Auth Edge Function', () => {
  it('应正确验证 JWT Token', async () => {
    mockKV.get.mockResolvedValueOnce(JSON.stringify({ userId: 'test', password: 'hashed' }));
    
    const request = new Request('https://example.com/api/auth/verify', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer valid-jwt' },
    });
    
    const response = await handleAuth(request, mockEnv);
    expect(response.status).toBe(200);
  });
  
  it('应拒绝无效 Token', async () => {
    const request = new Request('https://example.com/api/auth/verify', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer invalid' },
    });
    
    const response = await handleAuth(request, mockEnv);
    expect(response.status).toBe(401);
  });
});
```

```typescript
// edge-functions/tests/bailianProxy.test.js
import { describe, it, expect, vi } from 'vitest';
import { handleBailianChat } from '../api/bailian/chat.js';

describe('百炼 API 代理', () => {
  it('应正确转发请求并隐藏 API Key', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ output: { text: 'AI 回复' } }),
    });
    
    const request = new Request('https://example.com/api/bailian/chat', {
      method: 'POST',
      body: JSON.stringify({ model: 'qwen-plus', messages: [{ role: 'user', content: 'Hello' }] }),
    });
    
    const mockEnv = { BAILIAN_API_KEY: 'sk-secret-key' };
    const response = await handleBailianChat(request, mockEnv);
    const data = await response.json();
    
    expect(data.output.text).toBe('AI 回复');
    
    // 验证 fetch 被调用时 headers 中包含正确的 API Key
    const fetchCall = global.fetch.mock.calls[0];
    expect(fetchCall[1].headers['Authorization']).toContain('sk-secret-key');
    
    // 验证响应中不包含 API Key
    expect(JSON.stringify(data)).not.toContain('sk-secret-key');
  });
  
  it('应处理模型错误并返回友好错误信息', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ code: 'Throttling', message: 'Rate limit exceeded' }),
    });
    
    const request = new Request('https://example.com/api/bailian/chat', {
      method: 'POST',
      body: JSON.stringify({ model: 'qwen-plus', messages: [] }),
    });
    
    const response = await handleBailianChat(request, { BAILIAN_API_KEY: 'sk-test' });
    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error).toContain('请求过于频繁');
  });
});
```

#### 5. 测试数据属性（data-testid）规范

为确保 Playwright 测试可维护，要求所有交互组件添加 `data-testid`：

```typescript
// 示例：HypothesisCard.tsx 中的 data-testid 规范
<Card data-testid="hypothesis-card" data-hypothesis-id={hypothesis.id}>
  <CardHeader data-testid="hypothesis-header">
    <CardTitle data-testid="hypothesis-title">{hypothesis.title}</CardTitle>
  </CardHeader>
  <CardContent data-testid="hypothesis-content">
    <p data-testid="hypothesis-description">{hypothesis.description}</p>
    <Badge data-testid="hypothesis-verifiability">{hypothesis.verifiability}</Badge>
    <div data-testid="hypothesis-prediction">{hypothesis.prediction}</div>
  </CardContent>
  <CardFooter data-testid="hypothesis-footer">
    <Button data-testid="select-hypothesis">选择此假设</Button>
    <Button data-testid="evaluate-hypothesis">评估</Button>
  </CardFooter>
</Card>
```

创建 `TESTING_GUIDE.md` 文档，列出所有 `data-testid` 的命名规范和使用说明。

【验收标准】：
- [ ] Vitest 配置文件正确，支持 jsdom 环境和 React Testing Library
- [ ] MSW Mock Server 正确拦截所有 API 请求，测试不消耗真实百炼 API 额度
- [ ] 工具函数测试覆盖 ≥ 90%，全部通过
- [ ] 服务层测试覆盖 ≥ 80%，全部通过
- [ ] 组件单元测试覆盖 ≥ 60%，全部通过
- [ ] Playwright 核心流程测试（`coreFlow.spec.ts`）通过，完整运行时间 ≤ 5 分钟
- [ ] 四大 Agent 核心流程测试（`agentFlows.spec.ts`）全部通过，覆盖文献检索/假设生成/实验设计/评估验证
- [ ] 安全测试（XSS/API Key 保护/权限校验）全部通过
- [ ] 响应式测试通过 375px 移动端和 1920px 桌面端
- [ ] 暗黑模式切换测试通过
- [ ] Edge Functions 单元测试通过 Mock KV 和 Mock fetch 完成
- [ ] 所有测试在 CI 流水线中自动运行（≤ 10 分钟）
- [ ] 测试文档 `TESTING_GUIDE.md` 完整，包含 data-testid 规范

【预期产出】：
- `vitest.config.ts` — Vitest 配置
- `playwright.config.ts` — Playwright 配置
- `src/test/setup.ts` — 测试环境设置
- `src/test/mocks/server.ts` — MSW Mock Server
- `src/test/mocks/handlers.ts` — 请求 handlers
- `src/test/fixtures/*.ts` — 测试数据
- `src/utils/**/*.test.ts` — 工具函数测试（10+ 文件）
- `src/services/**/*.test.ts` — 服务层测试（6+ 文件）
- `src/components/**/*.test.tsx` — 组件测试（15+ 文件）
- `playwright/tests/coreFlow.spec.ts` — 核心流程 E2E 测试
- `playwright/tests/agentFlows.spec.ts` — 四大 Agent 流程测试
- `playwright/tests/advancedFeatures.spec.ts` — 拓展功能测试
- `playwright/tests/security.spec.ts` — 安全测试
- `playwright/tests/responsive.spec.ts` — 响应式测试
- `edge-functions/tests/*.test.js` — Edge Functions 测试（5+ 文件）
- `TESTING_GUIDE.md` — 测试指南与 data-testid 规范
- `.github/workflows/test.yml` — CI 测试流水线

---

### <a name="p6-t2"></a>【龙虾角色】：性能优化工程师

【龙虾ID】：P6-T2

【任务名称】：性能优化 — 响应速度、并发处理、懒加载

【上下文】：
- 前置完成状态：Phase 1-5 全部完成，Phase 6-T1 测试体系已建立。系统包含约 50+ 组件、15+ 页面、30+ Edge Functions。前端使用 React 18 + Vite，构建产物约为 2-3MB（未优化状态）。百炼 API 调用平均响应时间 3-8s（Qwen-Max 思维链模式可达 15s+）。Edge Functions 单次执行时间上限 50s。
- 技术约束：
  - EdgeOne Pages 静态资源通过 CDN 分发，但 Edge Functions 无 CDN 缓存
  - EdgeOne KV Storage 读取延迟约 50-200ms，写入延迟约 100-300ms
  - 百炼 API 有速率限制（QPS 限制），需实现队列和缓存
  - 目标性能指标：首屏加载 ≤ 2s（3G 网络）、交互响应 ≤ 100ms、API 响应 ≤ 500ms（不含百炼调用）、百炼调用超时 30s

【具体指令】：

#### 1. 前端性能优化

**A. 代码分割与懒加载**

```typescript
// 路由级懒加载：src/App.tsx
import { lazy, Suspense } from 'react';

const ResearchQuestion = lazy(() => import('./pages/research/QuestionPage'));
const ResearchLiterature = lazy(() => import('./pages/research/LiteraturePage'));
const ResearchHypothesis = lazy(() => import('./pages/research/HypothesisPage'));
const ResearchPlan = lazy(() => import('./pages/research/PlanPage'));
const ResearchIterate = lazy(() => import('./pages/research/IteratePage'));
const KnowledgeGraph = lazy(() => import('./pages/knowledge/GraphPage'));
const AstroData = lazy(() => import('./pages/data/AstroDataPage'));
const FusionMap = lazy(() => import('./pages/fusion/DisciplineMapPage'));
const AvatarMemories = lazy(() => import('./pages/avatar/MemoryTimelinePage'));
const CollaborationEditor = lazy(() => import('./pages/collaboration/EditorPage'));

// 非首屏组件懒加载
const PosterGenerator = lazy(() => import('./components/visualization/PosterGenerator'));
const GraphicalAbstract = lazy(() => import('./components/visualization/GraphicalAbstractGenerator'));
const AnimatedDemo = lazy(() => import('./components/visualization/AnimatedDemo'));

// 使用 React.lazy + Suspense + 自定义 Loading 组件
<Suspense fallback={<PageSkeleton />}>
  <Routes>
    <Route path="/research/question" element={<ResearchQuestion />} />
    <Route path="/research/literature" element={<ResearchLiterature />} />
    {/* ... */}
  </Routes>
</Suspense>
```

**配置 Vite 代码分割**：

```typescript
// vite.config.ts 中增加 build 配置
export default defineConfig({
  // ... existing config
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', 'class-variance-authority', 'clsx', 'tailwind-merge'],
          'chart-vendor': ['echarts', 'd3'],
          'animation-vendor': ['framer-motion'],
          'utils-vendor': ['lodash-es', 'dayjs', 'zod'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
    // 开启 gzip/brotli 压缩（EdgeOne CDN 自动支持）
  },
});
```

**B. 组件级优化**

```typescript
// src/components/optimization/MemoizedHypothesisCard.tsx
import { memo, useMemo } from 'react';

// 使用 React.memo 避免不必要的重渲染
export const MemoizedHypothesisCard = memo(HypothesisCard, (prev, next) => {
  return prev.hypothesis.id === next.hypothesis.id && 
         prev.hypothesis.version === next.hypothesis.version;
});

// 使用 useMemo 缓存复杂计算
function HypothesisList({ hypotheses, filter }) {
  const filteredHypotheses = useMemo(() => {
    return hypotheses.filter(h => {
      // 复杂过滤逻辑
      return h.score >= filter.minScore && h.domain.includes(filter.domain);
    }).sort((a, b) => b.score - a.score);
  }, [hypotheses, filter]);
  
  return (
    <div>
      {filteredHypotheses.map(h => (
        <MemoizedHypothesisCard key={h.id} hypothesis={h} />
      ))}
    </div>
  );
}
```

**C. 图片/资源优化**

```typescript
// 使用 Vite 的 import.meta.glob 按需加载图标
const iconImports = import.meta.glob('./assets/icons/*.svg', { eager: false });

// 海报模板等大图使用 WebP 格式 + 懒加载
<img 
  src="template-preview.webp" 
  loading="lazy" 
  decoding="async"
  width={1080}
  height={1920}
  alt="海报模板预览"
/>
```

**D. 虚拟列表（长列表优化）**

```typescript
// src/components/optimization/VirtualPaperList.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualPaperList({ papers }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: papers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // 每项估计高度 120px
    overscan: 5,
  });
  
  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <PaperCard paper={papers[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**E. 状态管理优化**

使用 Zustand 或 Context + useReducer 替代全局 Context 的频繁更新：

```typescript
// src/stores/agentStore.ts — 使用 Zustand 创建轻量级状态库
import { create } from 'zustand';

interface AgentState {
  currentSession: Session | null;
  messages: Message[];
  isLoading: boolean;
  setSession: (session: Session) => void;
  addMessage: (message: Message) => void;
  setLoading: (loading: boolean) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  currentSession: null,
  messages: [],
  isLoading: false,
  setSession: (session) => set({ currentSession: session }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setLoading: (loading) => set({ isLoading: loading }),
}));
```

#### 2. 后端性能优化（Edge Functions）

**A. API 响应缓存**

```javascript
// edge-functions/utils/cache.js
// 使用 EdgeOne 的 Cache API 或自定义内存缓存（注意 Edge Function 无状态，每次调用可能在新实例上）

// 策略：对不频繁变化的数据使用 KV 缓存 + TTL
async function cachedFetch(key, fetchFn, ttl = 3600) {
  const cached = await KV_STORAGE.get(`cache:${key}`);
  if (cached) {
    return JSON.parse(cached);
  }
  
  const result = await fetchFn();
  await KV_STORAGE.put(`cache:${key}`, JSON.stringify(result), { expirationTtl: ttl });
  return result;
}

// 使用示例：学科配置不常变化，缓存 24 小时
const disciplines = await cachedFetch('disciplines', () => getDisciplinesFromConfig(), 86400);
```

**B. 百炼 API 调用优化**

```javascript
// edge-functions/utils/bailianQueue.js
// 实现请求队列，避免并发调用触发限流
class BailianQueue {
  constructor(maxConcurrent = 3, intervalMs = 1000) {
    this.queue = [];
    this.running = 0;
    this.maxConcurrent = maxConcurrent;
    this.intervalMs = intervalMs;
  }
  
  async enqueue(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFn, resolve, reject });
      this.processQueue();
    });
  }
  
  async processQueue() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) return;
    
    this.running++;
    const { requestFn, resolve, reject } = this.queue.shift();
    
    try {
      const result = await requestFn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      setTimeout(() => this.processQueue(), this.intervalMs);
    }
  }
}

export const bailianQueue = new BailianQueue(3, 1000);
```

**C. 流式输出优化**

```javascript
// edge-functions/api/bailian/chat.js — 流式响应减少首字节时间（TTFB）
export async function handleBailianChat(request, env) {
  const { model, messages, stream = true } = await request.json();
  
  if (stream) {
    // 使用 TransformStream 实现 SSE 流式输出
    const encoder = new TextEncoder();
    const stream = new TransformStream({
      start(controller) {
        // 立即发送连接建立消息，减少 TTFB
        controller.enqueue(encoder.encode('data: {"status":"connected"}\n\n'));
      },
      async transform(chunk, controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      },
    });
    
    // 异步调用百炼 API，将结果写入 stream
    fetchBailianStream(model, messages, env).then(async (response) => {
      const reader = response.body.getReader();
      const writer = stream.writable.getWriter();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
      await writer.close();
    });
    
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }
  
  // 非流式模式...
}
```

**D. 数据库查询优化（KV Storage）**

```javascript
// edge-functions/utils/kvOptimizer.js
// 批量读取减少 KV 调用次数
async function batchGet(keys, batchSize = 16) {
  const results = {};
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(key => KV_STORAGE.get(key).catch(() => null))
    );
    batch.forEach((key, index) => {
      results[key] = batchResults[index];
    });
  }
  return results;
}

// 预读策略：提前读取可能需要的关联数据
async function prefetchRelatedData(entityId, depth = 1) {
  if (depth === 0) return {};
  
  const entity = await KV_STORAGE.get(`kg:node:${entityId}`);
  if (!entity) return {};
  
  const edges = await KV_STORAGE.list({ prefix: `kg:edge:${entityId}:` });
  const relatedIds = edges.keys.map(k => k.name.split(':').pop());
  
  const relatedData = await batchGet(relatedIds.map(id => `kg:node:${id}`));
  
  return { entity, related: relatedData };
}
```

**E. 并发处理优化**

```javascript
// edge-functions/api/agents/orchestrate.js
// 智能体编排中，文献检索和知识图谱查询可以并行执行
async function orchestratePhase1(query, domain) {
  const [literatureResult, graphResult] = await Promise.allSettled([
    callLiteratureAgent(query, domain),
    queryKnowledgeGraph(query, domain),
  ]);
  
  // 即使其中一个失败，也能继续
  const literature = literatureResult.status === 'fulfilled' ? literatureResult.value : null;
  const graph = graphResult.status === 'fulfilled' ? graphResult.value : null;
  
  if (!literature && !graph) {
    throw new Error('Phase 1 failed: both literature and graph queries failed');
  }
  
  return { literature, graph, partial: !literature || !graph };
}
```

#### 3. 性能监控与指标

```typescript
// src/utils/performance/monitor.ts
// 使用 Web Performance API 监控关键指标

export function measureCoreWebVitals() {
  // LCP (Largest Contentful Paint)
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    console.log('LCP:', lastEntry.startTime);
    // 发送到监控（如 Edge Function 日志或第三方服务）
    reportMetric('LCP', lastEntry.startTime);
  }).observe({ entryTypes: ['largest-contentful-paint'] });
  
  // FID (First Input Delay)
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const delay = entry.processingStart - entry.startTime;
      console.log('FID:', delay);
      reportMetric('FID', delay);
    }
  }).observe({ entryTypes: ['first-input'] });
  
  // CLS (Cumulative Layout Shift)
  let cls = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) {
        cls += entry.value;
      }
    }
    console.log('CLS:', cls);
    reportMetric('CLS', cls);
  }).observe({ entryTypes: ['layout-shift'] });
}

// 自定义 API 性能监控
export function measureApiPerformance(apiName: string, duration: number, success: boolean) {
  reportMetric(`api_${apiName}`, duration, { success });
}

function reportMetric(name: string, value: number, tags?: Record<string, string>) {
  // 发送到 Edge Function 进行聚合
  fetch('/api/metrics', {
    method: 'POST',
    body: JSON.stringify({ name, value, tags, timestamp: Date.now() }),
    keepalive: true,
  }).catch(() => {}); // 静默失败，不影响用户体验
}
```

**Edge Function 性能日志**：

```javascript
// edge-functions/utils/performance.js
export function withPerformanceLog(handler) {
  return async (request, env, ctx) => {
    const start = Date.now();
    const url = new URL(request.url);
    
    try {
      const response = await handler(request, env, ctx);
      const duration = Date.now() - start;
      
      // 记录性能日志（console.log 在 EdgeOne 中会被收集）
      console.log(JSON.stringify({
        type: 'performance',
        path: url.pathname,
        method: request.method,
        duration,
        status: response.status,
        timestamp: new Date().toISOString(),
      }));
      
      // 添加响应头
      response.headers.set('X-Response-Time', `${duration}ms`);
      return response;
    } catch (error) {
      const duration = Date.now() - start;
      console.log(JSON.stringify({
        type: 'error',
        path: url.pathname,
        duration,
        error: error.message,
        timestamp: new Date().toISOString(),
      }));
      throw error;
    }
  };
}

// 使用：export default withPerformanceLog(handleBailianChat);
```

#### 4. 性能预算与测试

创建 `performance-budget.json`：

```json
{
  "budgets": [
    { "path": "/*", "resource": "script", "budget": 300000 },
    { "path": "/*", "resource": "total", "budget": 1000000 },
    { "path": "/research/*", "resource": "script", "budget": 500000 },
    { "path": "/knowledge/*", "resource": "script", "budget": 600000 },
    { "metric": "LCP", "budget": 2500 },
    { "metric": "FID", "budget": 100 },
    { "metric": "CLS", "budget": 0.1 },
    { "metric": "TTFB", "budget": 600 }
  ]
}
```

**Lighthouse CI 配置**：

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [push, pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - run: npm install -g @lhci/cli
      - run: lhci autorun --config=lighthouserc.js
```

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run preview',
      startServerReadyPattern: 'Local:',
      url: ['http://localhost:4173/', 'http://localhost:4173/research/question'],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.85 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
      },
    },
  },
};
```

【验收标准】：
- [ ] 首屏加载时间（LCP）≤ 2.5s（桌面端）/ ≤ 4s（3G 移动端）
- [ ] 首次交互延迟（FID）≤ 100ms
- [ ] 累积布局偏移（CLS）≤ 0.1
- [ ] 所有路由级组件使用 React.lazy 懒加载，首屏 JS 包 ≤ 300KB（gzip 后）
- [ ] Vite 构建产物中 vendor 包正确分割（react/ui/chart/animation/utils 分离）
- [ ] 百炼 API 请求使用队列，并发限制为 3，间隔 1s，不触发 429 限流
- [ ] 流式输出（SSE）首字节时间（TTFB）≤ 500ms
- [ ] KV Storage 批量读取实现，减少 API 调用次数 ≥ 50%（多实体查询场景）
- [ ] 长列表（文献列表 > 50 条）使用虚拟列表，滚动帧率 ≥ 55fps
- [ ] 前端状态管理使用 Zustand，避免不必要的重渲染，React DevTools Profiler 显示无冗余渲染
- [ ] Lighthouse 性能评分 ≥ 85，可访问性 ≥ 90，最佳实践 ≥ 90，SEO ≥ 90
- [ ] 所有 Edge Functions 响应头包含 `X-Response-Time`，便于监控
- [ ] 静态资源通过 CDN 分发，Cache-Control 头设置合理（JS/CSS 1年，图片 1个月）
- [ ] 百炼 API 调用结果缓存：相同 Prompt 缓存 1 小时，减少重复调用

【预期产出】：
- `vite.config.ts`（更新）— 代码分割配置
- `src/App.tsx`（更新）— 路由懒加载
- `src/components/optimization/Memoized*.tsx` — 记忆化组件
- `src/components/optimization/VirtualPaperList.tsx` — 虚拟列表
- `src/components/optimization/PageSkeleton.tsx` — 页面骨架屏
- `src/stores/agentStore.ts` — Zustand 状态库
- `edge-functions/utils/cache.js` — 缓存工具
- `edge-functions/utils/bailianQueue.js` — 百炼请求队列
- `edge-functions/utils/kvOptimizer.js` — KV 优化工具
- `edge-functions/utils/performance.js` — 性能监控包装器
- `src/utils/performance/monitor.ts` — 前端性能监控
- `performance-budget.json` — 性能预算
- `lighthouserc.js` — Lighthouse CI 配置
- `.github/workflows/lighthouse.yml` — Lighthouse CI 流水线
- `PERFORMANCE_REPORT.md` — 性能优化报告

---

### <a name="p6-t3"></a>【龙虾角色】：安全工程师

【龙虾ID】：P6-T3

【任务名称】：安全加固 — API Key 保护、输入校验、XSS 防护

【上下文】：
- 前置完成状态：Phase 1-5 全部完成，系统包含用户注册/登录、文件上传（海报导出）、富文本输入（假设编辑、评论）、百炼 API 代理、Edge Functions 30+ 个。前端使用 React 18 + Vite，后端使用 EdgeOne Edge Functions + KV Storage。部署在 EdgeOne Pages（公有环境）。
- 技术约束：
  - EdgeOne Pages 为静态托管 + 无服务器函数，无传统服务器端防火墙，依赖 CDN WAF
  - Edge Functions 无持久文件系统，无传统 session 存储，依赖 JWT + KV
  - 百炼 API Key 必须绝对保密，泄露 = 直接经济损失 + 模型滥用风险
  - 比赛评委可能进行安全测试（XSS 尝试、SQL 注入尝试、权限绕过）
  - 所有用户输入（科学问题、假设文本、评论、搜索词）都可能被恶意构造

【具体指令】：

#### 1. API Key 保护（最高优先级）

**A. 环境变量管理**

```bash
# .env.example（提交到仓库，不包含真实值）
BAILIAN_API_KEY=your-bailian-api-key-here
BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/api/v1
JWT_SECRET=your-jwt-secret-min-32-chars
ENCRYPTION_KEY=your-encryption-key-here
```

```bash
# .env.local（不提交到仓库，在 .gitignore 中）
BAILIAN_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
```

**`.gitignore` 必须包含**：
```
.env.local
.env.*.local
*.pem
*.key
```

**B. Edge Function 代理层（唯一出口）**

```javascript
// edge-functions/api/bailian/chat.js — 百炼 API 代理
// 绝对禁止：前端直接调用 dashscope.aliyuncs.com
// 绝对禁止：在响应中返回 API Key 的任何部分
// 绝对禁止：在错误日志中输出 API Key

export async function handleBailianChat(request, env) {
  // 1. 认证校验（必须登录）
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: '未授权' }), { status: 401 });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = await verifyJWT(token, env.JWT_SECRET);
  if (!user) {
    return new Response(JSON.stringify({ error: '无效的认证' }), { status: 401 });
  }
  
  // 2. 速率限制（每用户每分钟最多 10 次调用）
  const rateLimitKey = `rate_limit:bailian:${user.userId}`;
  const currentCount = await KV_STORAGE.get(rateLimitKey);
  if (currentCount && parseInt(currentCount) >= 10) {
    return new Response(JSON.stringify({ error: '请求过于频繁，请稍后再试' }), { status: 429 });
  }
  await KV_STORAGE.put(rateLimitKey, (parseInt(currentCount || '0') + 1).toString(), { expirationTtl: 60 });
  
  // 3. 请求体校验（防止超大请求）
  const contentLength = request.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength) > 1024 * 1024) { // 1MB 限制
    return new Response(JSON.stringify({ error: '请求体过大' }), { status: 413 });
  }
  
  const body = await request.json();
  
  // 4. 输入消毒（校验 messages 格式）
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length > 50) {
    return new Response(JSON.stringify({ error: '无效的消息格式' }), { status: 400 });
  }
  
  for (const msg of body.messages) {
    if (!msg.role || !['user', 'assistant', 'system'].includes(msg.role)) {
      return new Response(JSON.stringify({ error: '无效的消息角色' }), { status: 400 });
    }
    if (!msg.content || typeof msg.content !== 'string' || msg.content.length > 10000) {
      return new Response(JSON.stringify({ error: '消息内容无效或过长' }), { status: 400 });
    }
  }
  
  // 5. 模型白名单（只允许调用预配置模型）
  const allowedModels = [
    'qwen-max-latest', 'qwen-plus-latest', 'qwen-coder-latest', 
    'qwen-vl-max-latest', 'qwen-long-latest'
  ];
  if (!allowedModels.includes(body.model)) {
    return new Response(JSON.stringify({ error: '不允许的模型' }), { status: 400 });
  }
  
  // 6. 调用百炼 API（Key 仅在服务端使用）
  try {
    const response = await fetch(`${env.BAILIAN_BASE_URL}/services/aigc/text-generation/generation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.BAILIAN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: body.model,
        input: { messages: body.messages },
        parameters: {
          max_tokens: Math.min(body.max_tokens || 2000, 4000), // 限制 max_tokens
          temperature: Math.min(Math.max(body.temperature || 0.7, 0), 1), // 限制 temperature 范围
        },
      }),
    });
    
    // 7. 响应过滤（确保不泄露 API Key）
    const responseData = await response.json();
    const safeResponse = {
      output: responseData.output,
      usage: responseData.usage,
      request_id: responseData.request_id,
    };
    
    return new Response(JSON.stringify(safeResponse), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // 8. 错误日志中隐藏 Key 的任何部分
    console.error('Bailian API error:', error.message.replace(/sk-[a-zA-Z0-9]+/g, '[REDACTED]'));
    return new Response(JSON.stringify({ error: 'AI 服务暂时不可用' }), { status: 502 });
  }
}
```

**C. Key 轮换机制**

```javascript
// edge-functions/utils/keyRotation.js
// 支持多个 API Key 轮询，避免单 Key 限流，同时提供降级能力

class KeyRotation {
  constructor(keys) {
    this.keys = keys.split(',').map(k => k.trim());
    this.currentIndex = 0;
  }
  
  getCurrentKey() {
    return this.keys[this.currentIndex];
  }
  
  rotate() {
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
  }
  
  async callWithRotation(requestFn) {
    const attempts = this.keys.length;
    for (let i = 0; i < attempts; i++) {
      try {
        const key = this.getCurrentKey();
        const result = await requestFn(key);
        return result;
      } catch (error) {
        if (error.status === 429 || error.status === 401) {
          this.rotate();
          continue;
        }
        throw error;
      }
    }
    throw new Error('All API keys exhausted');
  }
}
```

#### 2. 输入校验与消毒（全链路）

**A. 前端输入校验**

```typescript
// src/utils/validation/schemas.ts — 使用 Zod 定义所有输入校验规则
import { z } from 'zod';

export const QuestionSchema = z.object({
  question: z.string()
    .min(5, '问题至少 5 个字符')
    .max(500, '问题最多 500 个字符')
    .regex(/^[^<>]*$/, '问题不能包含 HTML 标签')
    .transform(val => val.trim()),
  domain: z.enum(['astronomy', 'physics', 'biology', 'chemistry', 'geography', 'computer'])
    .optional(),
});

export const HypothesisSchema = z.object({
  title: z.string().min(5).max(200).regex(/^[^<>]*$/),
  description: z.string().min(20).max(2000).regex(/^[^<>]*$/),
  background: z.string().max(1000).optional(),
  prediction: z.string().max(1000).optional(),
  verificationMethod: z.string().max(1000).optional(),
});

export const ReviewSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().max(500).regex(/^[^<>]*$/),
  reviewType: z.enum(['novelty', 'feasibility', 'logic', 'significance', 'overall']),
});

export const UserProfileSchema = z.object({
  researchField: z.array(z.string().max(50)).max(10),
  expertiseLevel: z.enum(['undergraduate', 'master', 'phd', 'professor', 'industry']),
  preferredLanguage: z.enum(['zh', 'en', 'mixed']),
  bio: z.string().max(500).optional(),
});

export const SearchQuerySchema = z.object({
  query: z.string().min(1).max(200).regex(/^[\w\s\u4e00-\u9fa5\-.,?]+$/), // 只允许字母数字汉字空格和常用标点
  maxResults: z.number().int().min(1).max(50).default(10),
});
```

```typescript
// src/utils/validation/validateInput.ts — 统一校验入口
import { ZodSchema } from 'zod';

export function validateInput<T>(schema: ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`) };
}

// 使用：所有表单提交前必须调用
const result = validateInput(QuestionSchema, formData);
if (!result.success) {
  showErrors(result.errors);
  return;
}
```

**B. 后端输入校验（重复校验，不信任前端）**

```javascript
// edge-functions/utils/validator.js — 后端校验中间件
import { z } from 'zod';

export function validateBody(schema) {
  return async (request, env, next) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: '无效的 JSON 请求体' }), { status: 400 });
    }
    
    const result = schema.safeParse(body);
    if (!result.success) {
      return new Response(JSON.stringify({ 
        error: '输入校验失败', 
        details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      }), { status: 400 });
    }
    
    // 将校验后的数据附加到 request 对象
    request.validatedBody = result.data;
    return next(request, env);
  };
}

// 使用：在路由中
// handleBailianChat = compose(validateBody(ChatRequestSchema), handleBailianChatLogic)
```

**C. XSS 防护**

```typescript
// src/utils/sanitization/xssSanitizer.ts — 前端消毒
import DOMPurify from 'dompurify';

export function sanitizeHTML(input: string): string {
  if (typeof window === 'undefined') return input; // SSR 安全
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
  });
}

export function sanitizePlainText(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/&/g, '&amp;');
}

// 使用策略：
// 1. 用户输入的文本（问题、假设、评论）→ 使用 sanitizePlainText 存储和传输
// 2. AI 生成的文本（假设描述、实验步骤）→ 使用 sanitizeHTML 渲染（允许简单格式）
// 3. 搜索框输入 → 使用 sanitizePlainText
```

```javascript
// edge-functions/utils/sanitization.js — 后端消毒（Node.js 环境用 he 或自实现）
export function sanitizeText(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/&/g, '&amp;')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, ''); // 过滤事件处理器
}

// 所有从 KV 读取后展示给用户的数据都要经过此函数
export function sanitizeResponseData(data) {
  if (typeof data === 'string') return sanitizeText(data);
  if (Array.isArray(data)) return data.map(sanitizeResponseData);
  if (typeof data === 'object' && data !== null) {
    const sanitized = {};
    for (const key of Object.keys(data)) {
      sanitized[key] = sanitizeResponseData(data[key]);
    }
    return sanitized;
  }
  return data;
}
```

**D. CSRF 防护**

```javascript
// edge-functions/utils/csrf.js
// Edge Functions 使用 SameSite=Strict Cookie + 自定义 CSRF Token

export function generateCSRFToken() {
  return crypto.randomUUID();
}

export function validateCSRF(request, env) {
  const csrfHeader = request.headers.get('X-CSRF-Token');
  const csrfCookie = getCookie(request, 'csrf_token');
  
  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
    return false;
  }
  return true;
}

// 在 Edge Function 中：
// if (!validateCSRF(request, env)) {
//   return new Response(JSON.stringify({ error: 'CSRF 验证失败' }), { status: 403 });
// }
```

**E. 内容安全策略（CSP）**

```javascript
// edge-functions/utils/securityHeaders.js
export function addSecurityHeaders(response) {
  response.headers.set('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " + // React 需要 unsafe-inline 和 unsafe-eval
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob: https://*.alicdn.com; " +
    "connect-src 'self' https://dashscope.aliyuncs.com; " + // 仅允许百炼 API（通过代理）
    "font-src 'self' data:; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self';"
  );
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return response;
}
```

#### 3. 权限与访问控制

```javascript
// edge-functions/utils/auth.js — 权限校验中间件
export function requireAuth(roles = []) {
  return async (request, env, next) => {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: '需要登录' }), { status: 401 });
    }
    
    const user = await verifyJWT(token, env.JWT_SECRET);
    if (!user) {
      return new Response(JSON.stringify({ error: '无效的登录状态' }), { status: 401 });
    }
    
    if (roles.length > 0 && !roles.includes(user.role)) {
      return new Response(JSON.stringify({ error: '权限不足' }), { status: 403 });
    }
    
    request.user = user;
    return next(request, env);
  };
}

export function requireOwnership(getResourceOwner) {
  return async (request, env, next) => {
    const ownerId = await getResourceOwner(request, env);
    if (ownerId !== request.user.userId) {
      return new Response(JSON.stringify({ error: '无权访问此资源' }), { status: 403 });
    }
    return next(request, env);
  };
}

// 使用示例：
// handleDeleteHypothesis = compose(
//   requireAuth(),
//   requireOwnership(async (req) => {
//     const hypothesis = await KV.get(`hypothesis:${req.params.id}`);
//     return hypothesis?.userId;
//   }),
//   handleDeleteHypothesisLogic
// );
```

#### 4. 安全审计清单

创建 `SECURITY_CHECKLIST.md`：

```markdown
# 安全审计清单

## API Key 安全
- [ ] API Key 仅存储在环境变量和 KV Storage（加密）中
- [ ] 前端代码中不硬编码任何 Key 或 URL
- [ ] 响应中不返回 API Key 的任何部分（包括截断版）
- [ ] 错误日志中 API Key 被替换为 [REDACTED]
- [ ] 仓库 .gitignore 包含所有 .env 文件
- [ ] 支持 API Key 轮换（多 Key 配置）

## 输入校验
- [ ] 所有用户输入经过 Zod 校验（前端 + 后端）
- [ ] 字符串长度限制（最小/最大）
- [ ] 禁止 HTML 标签（除允许的富文本标签）
- [ ] 禁止 javascript: 协议和事件处理器
- [ ] 搜索框只允许字母数字汉字和常用标点
- [ ] 文件上传限制类型和大小（如有）

## XSS 防护
- [ ] 用户输入使用 sanitizePlainText 存储
- [ ] AI 输出使用 DOMPurify 渲染（白名单标签）
- [ ] CSP 头正确设置（default-src 'self'）
- [ ] 所有动态渲染的内容经过消毒

## CSRF 防护
- [ ] 状态变更请求使用 POST/PUT/DELETE
- [ ] 包含 CSRF Token 校验
- [ ] Cookie 设置 SameSite=Strict

## 认证与授权
- [ ] JWT 使用 HS256 或 RS256，Secret 长度 ≥ 32 字符
- [ ] JWT 设置合理过期时间（access: 15min, refresh: 7days）
- [ ] 所有受保护路由校验 JWT
- [ ] 资源操作校验所有权（只能删自己的数据）
- [ ] 角色权限检查（管理员/普通用户）

## 速率限制
- [ ] 百炼 API 每用户每分钟 ≤ 10 次
- [ ] 登录接口每 IP 每分钟 ≤ 5 次
- [ ] 注册接口每 IP 每小时 ≤ 3 次
- [ ] 通用 API 每 IP 每分钟 ≤ 60 次

## 数据保护
- [ ] KV 中的敏感数据（用户密码）使用 bcrypt 哈希
- [ ] 用户密码最小长度 8 位，包含大小写+数字
- [ ] 用户资料中的邮箱/手机号脱敏展示（匹配中心）
- [ ] 备份数据加密存储

## 依赖安全
- [ ] npm audit 无高危漏洞（npm audit --audit-level=high）
- [ ] 依赖定期更新（每周检查）
- [ ] 不使用已废弃的依赖
```

【验收标准】：
- [ ] 百炼 API Key 不暴露在前端代码、网络请求、响应体、错误日志中（使用 Playwright 拦截所有请求验证）
- [ ] 所有 Edge Functions 的百炼 API 调用均经过认证校验（JWT）和速率限制
- [ ] Zod 校验覆盖所有用户输入接口（100% 的 POST/PUT 请求体）
- [ ] XSS 测试：输入 `<script>alert('xss')</script>` 和 `javascript:alert(1)` 等 payload，输出均被正确转义或过滤
- [ ] CSP 头正确设置，报告-only 模式运行 1 周后无违规报告
- [ ] CSRF Token 在所有状态变更请求中有效
- [ ] 权限校验：用户 A 无法删除/修改用户 B 的假设、评价、会话（通过 Playwright 测试验证）
- [ ] 速率限制有效：连续 11 次百炼 API 调用，第 11 次返回 429
- [ ] 密码使用 bcrypt 哈希存储，明文密码不出现在任何地方
- [ ] `npm audit` 无 High 或 Critical 级别漏洞
- [ ] 安全审计清单 `SECURITY_CHECKLIST.md` 所有项勾选
- [ ] 渗透测试报告：模拟常见攻击（XSS、CSRF、越权、敏感信息泄露）均无法成功

【预期产出】：
- `edge-functions/api/bailian/chat.js`（更新）— 安全代理层
- `edge-functions/utils/keyRotation.js` — Key 轮换工具
- `edge-functions/utils/validator.js` — 后端校验中间件
- `edge-functions/utils/sanitization.js` — 后端消毒工具
- `edge-functions/utils/csrf.js` — CSRF 防护
- `edge-functions/utils/securityHeaders.js` — 安全响应头
- `edge-functions/utils/auth.js`（更新）— 权限中间件
- `src/utils/validation/schemas.ts` — Zod 校验 Schema
- `src/utils/validation/validateInput.ts` — 前端校验入口
- `src/utils/sanitization/xssSanitizer.ts` — XSS 消毒
- `src/utils/sanitization/htmlSanitizer.ts` — HTML 富文本消毒
- `SECURITY_CHECKLIST.md` — 安全审计清单
- `SECURITY_REPORT.md` — 安全加固报告（包含渗透测试结果）
- `.env.example` — 环境变量模板（不含真实值）
- `.github/workflows/security.yml` — 安全扫描 CI（npm audit + 依赖检查）

---

### <a name="p6-t4"></a>【龙虾角色】：视频制作导演 + 脚本编剧

【龙虾ID】：P6-T4

【任务名称】：演示视频制作 — 脚本与录制指南

【上下文】：
- 前置完成状态：Phase 1-5 全部完成，系统功能完整。需要在 ≤ 10 分钟内展示完整闭环。比赛要求演示视频展示项目的核心功能、创新点和实际效果。视频将上传至 B 站/腾讯视频等平台，比赛评审时在线观看。
- 技术约束：
  - 视频时长 ≤ 10 分钟（严格限制，超时可能影响评分）
  - 分辨率 ≥ 1080p，帧率 ≥ 30fps
  - 需要中英文字幕（挑战杯可能有国际评委）
  - 视频格式：MP4（H.264 编码，确保兼容性）
  - 不需要真人出镜，以屏幕录制 + 旁白为主
  - 背景音乐需使用免版权音乐（YouTube Audio Library / 爱给网）

【具体指令】：

#### 1. 分镜脚本（精确到秒）

```markdown
# 《AI Scientist Hub：国产大模型驱动的科研智能平台》
# 演示视频分镜脚本 | 总时长：9 分 30 秒 | 分辨率：1920x1080

---

## 开场（0:00 - 0:45）

### 镜头 1：开场动画（0:00 - 0:15）
- 画面：黑屏渐显，粒子效果汇聚成 Logo（AI Scientist Hub 标志）
- 字幕：AI Scientist Hub
- 旁白："在科学研究中，提出一个好的假设，往往比验证它更难。"
- 音效：科技感电子音效（crescendo）
- 制作：使用 After Effects 或 Premiere Pro 制作 15 秒 Logo 动画
- 素材：使用项目 Logo SVG + 粒子特效预设

### 镜头 2：痛点引入（0:15 - 0:45）
- 画面：分屏展示，左侧为传统科研流程（大量文献堆积、手写笔记、Excel 表格），右侧为研究者困惑表情（使用 stock footage 或插画）
- 字幕：痛点关键词（"文献浩瀚" / "假设难提" / "实验难设计" / "跨学科壁垒"）
- 旁白："面对浩瀚的学术文献，研究者常常陷入'信息过载'。如何快速整合知识、发现研究空白、生成可验证的假设？这成为了 AI for Science 时代最核心的挑战。"
- 转场：故障风转场（glitch effect）
- 制作：使用项目截图 + 动画效果，或使用 Canva 制作插画

---

## 核心功能展示（0:45 - 7:30）

### 镜头 3：项目概览（0:45 - 1:15）
- 画面：平台首页（/dashboard），展示整体布局（左侧导航、中间工作区、右侧 AI 助手）
- 字幕："AI Scientist Hub — 基于千问（Qwen）系列模型的多智能体科研平台"
- 旁白："AI Scientist Hub，基于阿里云千问系列大模型，构建了一个多智能体协作的科研智能平台。它集文献整合、假设生成、实验设计、评估验证于一体。"
- 操作：鼠标悬停各导航项，展示页面切换
- 制作：屏幕录制（OBS / Camtasia / ScreenFlow），鼠标高亮 + 点击波纹效果
- 注意：录制前确保所有数据为演示数据（mock data），界面整洁无测试错误

### 镜头 4：科学问题理解（1:15 - 2:00）
- 画面：进入 /research/question 页面
- 操作：
  1. 在输入框中输入："太阳耀斑的磁场触发机制是什么？"（打字速度正常，不要过快）
  2. 点击"分析问题"按钮
  3. 等待分析结果（约 3-5 秒，如实际更长可剪辑等待时间）
  4. 展示结果：问题类型（因果）、学科分类（太阳物理）、关键实体（磁场/耀斑/重联）、相似问题推荐、可行性评估
- 字幕："Step 1: 科学问题理解 — 将自然语言转化为结构化研究对象"
- 旁白："第一步，科学问题理解引擎。用户输入一个自然语言问题，系统通过 Qwen 模型自动解析问题类型、提取关键实体、评估研究可行性，并推荐相似的研究方向。"
- 转场：平滑过渡（cross dissolve）
- 制作：录制时确保加载状态（loading spinner）清晰可见，体现 AI 正在工作

### 镜头 5：智能文献综述（2:00 - 2:50）
- 画面：进入 /research/literature 页面，已携带上一步的问题
- 操作：
  1. 点击"生成文献综述"按钮
  2. 展示加载进度（文献检索中 → 证据提取中 → 知识缺口识别中）
  3. 展示结果：文献列表（10 篇相关论文，含标题/作者/年份/相关性）、证据图谱（D3.js 力导向图，节点为论文，边为引用关系）、知识缺口列表（3-5 条）
  4. 鼠标悬停某篇文献，展示摘要 tooltip
  5. 点击"查看证据图谱"，展示全屏图谱，拖拽节点
- 字幕："Step 2: 智能文献综述 — 自动检索、整合、发现知识缺口"
- 旁白："第二步，文献整合者 Agent。系统自动检索多源数据库，提取关键证据，构建证据图谱，并精准识别知识缺口。这些缺口，正是新假设诞生的土壤。"
- 制作：如果证据图谱渲染较慢，可提前加载好后切换窗口录制，或后期剪辑掉等待时间

### 镜头 6：科学假设生成与评估（2:50 - 4:00）
- 画面：进入 /research/hypothesis 页面，已携带知识缺口
- 操作：
  1. 点击"基于知识缺口生成假设"按钮
  2. 展示加载动画（思维链可视化：问题 → 文献 → 缺口 → 候选假设）
  3. 展示结果：3 个候选假设卡片，每个包含：标题 / 背景 / 前提 / 预测 / 验证方法 / 创新性评分 / 可验证性评分
  4. 点击第一个假设卡片，展开详情：假设树（假设 → 子假设 → 预测）
  5. 点击"评估此假设"，展示评估结果（创新性 4.5/5、可验证性 4.2/5、逻辑性 4.8/5、证据支持度 3.9/5）
  6. 展示风险分析：可能的反例和证伪路径
- 字幕："Step 3: 假设生成与评估 — 基于知识缺口生成可验证假设"
- 旁白："第三步，假设生成器 Agent。基于识别的知识缺口，Qwen-Max 模型通过深度推理生成 3-5 个候选假设。每个假设都包含完整的背景、前提、预测和验证方法。评估验证官 Agent 从创新性、可验证性、逻辑一致性、证据支持度四个维度进行多维度评估。"
- 制作：思维链加载动画可后期用 After Effects 制作，增强视觉效果

### 镜头 7：研究计划与实验设计（4:00 - 5:00）
- 画面：进入 /research/plan 页面，选择已评估的假设
- 操作：
  1. 点击"生成研究计划"按钮
  2. 展示结果：研究目标分解（3 个子目标）、实验方案（步骤 1-5）、数据收集规划、统计方法推荐、代码生成（Python 代码块，高亮显示）
  3. 点击"运行模拟"按钮，展示代码执行结果（图表/数值）
  4. 展示甘特图：时间线展示各任务安排
  5. 展示资源需求估算
- 字幕："Step 4: 实验规划 — 将假设转化为可执行研究计划"
- 旁白："第四步，实验规划师 Agent。系统自动将假设分解为可操作的研究目标，设计实验方案，生成模拟代码，并规划任务时间线。研究者可以直接运行模拟，快速验证假设的可行性。"
- 制作：代码块确保语法高亮正确，代码执行结果需提前准备（如果实际运行慢可预生成结果）

### 镜头 8：多轮迭代优化（5:00 - 5:45）
- 画面：在 /research/iterate 页面
- 操作：
  1. 展示用户反馈输入框，输入："请考虑磁场重联的非对称性特征"
  2. 点击"提交反馈并迭代"按钮
  3. 展示迭代过程：旧假设 → 反馈 → 新假设（diff 视图，高亮修改部分）
  4. 展示版本对比：V1 和 V2 的并排对比
  5. 展示评估分数变化：V1 总分 17.4/20 → V2 总分 18.9/20
- 字幕："Step 5: 迭代优化 — 人工反馈驱动的假设持续进化"
- 旁白："科研是迭代的过程。系统支持研究者通过自然语言反馈，驱动假设的持续优化。每次迭代都保留版本历史，方便回溯和对比。"
- 制作：diff 视图需确保高亮颜色明显（红=删除，绿=新增）

### 镜头 9：知识图谱展示（5:45 - 6:15）
- 画面：进入 /knowledge/graph 页面
- 操作：
  1. 展示天文知识图谱：力导向图，节点为恒星/黑洞/耀斑/磁场等，边为观测/因果/演化关系
  2. 鼠标拖拽节点，图谱动态调整
  3. 搜索"太阳耀斑"，节点高亮，关联边发光
  4. 点击"太阳耀斑"节点，展示属性面板（定义/观测设备/相关方法/关联假设）
  5. 点击"发现路径"，展示从"太阳耀斑"到"引力波"的知识路径（3 跳）
- 字幕："知识图谱 — 可查询、可推理的天文领域知识网络"
- 旁白："平台构建了天文领域的知识图谱，将天体、概念、方法、设备等实体关联起来。研究者可以通过图谱发现隐藏的知识路径，为跨学科创新提供灵感。"
- 制作：图谱需提前加载好，确保渲染流畅，节点数量适中（50-100 个节点）

### 镜头 10：Phase 5 拓展功能（6:15 - 7:30）
- 画面：快速展示 4 个拓展功能（每个约 15-20 秒）

**10a. AI 数字分身（6:15 - 6:35）**
- 画面：展示数字分身面板，设置用户画像（博士/太阳物理），然后展示 Agent 回复的语气变化
- 旁白："AI 数字分身，持续学习用户的研究偏好和习惯，提供个性化的科研助手体验。"
- 操作：快速切换 2 个不同用户的 Agent 回复，展示差异

**10b. 科学传播可视化（6:35 - 6:55）**
- 画面：进入 /visualization/poster，输入假设，生成科普海报，切换模板，导出 PNG
- 旁白："科学传播可视化，将复杂科研成果转化为科普海报、图文摘要和动态演示。"
- 操作：快速生成海报，切换模板，导出

**10c. 跨学科融合（6:55 - 7:15）**
- 画面：进入 /fusion/migrate，展示假设从天文学迁移到物理学的 diff 视图
- 旁白："跨学科融合引擎，发现学科间的桥接关系，支持假设的跨域迁移。"
- 操作：展示迁移过程，雷达图评估

**10d. 科研协作（7:15 - 7:30）**
- 画面：进入 /collaboration/reviews，展示假设评价广场，然后快速切换到协作编辑器
- 旁白："科研协作网络，支持兴趣匹配、假设众评和多人协作编辑。"
- 操作：展示评价和协作编辑界面
- 转场：快速切换使用 jump cut，配合快节奏背景音乐

---

## 结尾（7:30 - 9:30）

### 镜头 11：技术架构（7:30 - 8:00）
- 画面：展示系统架构图（React 前端 → Edge Functions → 百炼平台 → Qwen 模型 → KV Storage），动画展示数据流向
- 字幕："技术架构：React + EdgeOne + 阿里云百炼 + Qwen 系列模型"
- 旁白："技术架构上，前端采用 React 18 + TypeScript + Vite，后端使用 EdgeOne Edge Functions 构建安全代理层，AI 能力全面接入阿里云百炼平台的千问系列大模型。"
- 制作：使用 Figma 或 Keynote 制作架构图，导出为动画序列

### 镜头 12：创新点总结（8:00 - 8:30）
- 画面：4 个创新点卡片依次出现（1. 多智能体协作闭环 / 2. 可验证性评估机制 / 3. 天文数据深度融合 / 4. 科学传播可视化）
- 字幕："四大创新点"
- 旁白："本项目的四大创新点：首创多智能体协作的科研闭环、首创科学假设的可验证性评估机制、首创国家天文数据的 AI 深度融合、首创面向多受众的科学传播可视化。"
- 制作：使用 Figma 制作卡片，使用 After Effects 制作入场动画

### 镜头 13：应用场景与社会价值（8:30 - 9:00）
- 画面：3 个应用场景画面（高校研究生使用 / 天文台研究员使用 / 科普工作者使用）
- 字幕："应用场景：高校科研 / 天文台研究 / 科普传播"
- 旁白："应用场景覆盖高校科研训练、天文台研究辅助、以及科学传播普及。我们的愿景是让每一位研究者都能拥有 AI 驱动的科研助手，加速科学发现的进程。"
- 制作：使用项目截图 + 场景描述文字，或使用 stock footage

### 镜头 14：结尾呼吁（9:00 - 9:30）
- 画面：平台首页 + 项目信息（GitHub 仓库 / 在线演示地址 / 团队信息）
- 字幕："AI Scientist Hub — 让 AI 成为科学家的得力伙伴"
- 旁白："AI Scientist Hub，基于国产开源大模型的科研智能平台。让 AI 成为科学家的得力伙伴。"
- 音效：音乐渐强后 fade out
- 制作：Logo + 网址 + 二维码（指向演示网站），停留 10 秒方便评委记录

---

## 制作规格

### 录制环境
- 浏览器：Chrome 最新版，窗口尺寸 1920x1080
- 录制工具：OBS Studio（推荐，免费）或 Camtasia
- 鼠标高亮：使用 OBS 插件或后期添加鼠标光圈效果
- 系统设置：隐藏 Dock/任务栏，桌面背景为纯色（#0A2540 或纯白），关闭所有通知
- 演示数据：使用精心准备的演示数据集（假设、文献、图谱），确保数据真实且界面美观

### 后期制作
- 剪辑工具：DaVinci Resolve（免费）或 Premiere Pro
- 字幕：使用剪映或 ArcTime Pro 制作 SRT 字幕（中文+英文双语）
- 背景音乐：
  - 开场：科技感氛围音乐（如 "The Complex" by Kevin MacLeod，CC-BY）
  - 功能展示：轻快电子乐（如 "Tech Live" 类，无歌词）
  - 结尾：激励感音乐（如 "Epic" 类，fade out）
- 音量：旁白 -6dB，音乐 -20dB（确保旁白清晰）
- 转场：功能间使用平滑过渡，拓展功能间使用 jump cut（快节奏）
- 导出设置：H.264，1920x1080，30fps，比特率 8-12Mbps，MP4 格式

### 旁白录制
- 使用麦克风：推荐 USB 电容麦（如 Blue Yeti）或手机耳机麦（安静环境下）
- 录音环境：安静房间，关闭空调/风扇，使用被子搭建简易隔音棚
- 语速：中文 180-220 字/分钟，确保清晰
- 每段旁白录制 3 遍，选择最佳版本
- 如音质不佳，使用 Adobe Podcast（在线）或 Audacity 降噪

### 演示数据准备（录制前必做）
- 注册 2-3 个测试用户，设置不同画像（本科生/博士生/教授）
- 预生成 5-10 个高质量假设，确保假设文本科学且界面美观
- 预生成文献综述（包含真实论文数据，或逼真的 Mock 数据）
- 知识图谱预加载 50-100 个节点，布局美观
- 准备 2-3 个拓展功能的数据（海报文案、迁移假设、评价记录）
- 所有页面在录制前刷新，确保无缓存错误、无加载失败
```

#### 2. 录制检查清单

```markdown
# 录制前检查清单

## 环境准备
- [ ] 浏览器：Chrome 最新版，无痕模式（无插件干扰）
- [ ] 窗口尺寸：1920x1080，缩放 100%
- [ ] 桌面背景：纯色，无图标
- [ ] 系统通知：全部关闭（Mac: 勿扰模式 / Windows: 专注助手）
- [ ] 网络：稳定 Wi-Fi，百炼 API 可正常访问
- [ ] 时间：演示数据中的日期统一为近期

## 数据准备
- [ ] 测试用户：已注册 3 个用户（本科生、博士生、教授）
- [ ] 用户画像：已设置不同偏好，数字分身有差异化表现
- [ ] 科学问题：已准备 3 个（太阳耀斑/黑洞/引力波）
- [ ] 文献综述：已预生成，包含 10 篇真实或逼真论文
- [ ] 假设列表：已预生成 5 个高质量假设，评估分数合理
- [ ] 实验计划：已预生成，包含代码和执行结果
- [ ] 知识图谱：已预加载，节点布局美观，搜索"太阳耀斑"有结果
- [ ] 海报数据：已预生成，4 种模板均可正常渲染
- [ ] 跨学科迁移：已准备天文→物理的迁移案例
- [ ] 协作评价：已预生成 3-5 条评价，评价摘要有数据

## 录制过程
- [ ] 每段录制 2-3 遍，选择最佳版本
- [ ] 鼠标移动平滑，不要快速晃动
- [ ] 点击时稍作停顿，让观众看清操作
- [ ] 加载等待时间：超过 3 秒可后期剪辑加速
- [ ] 出错时不要慌，暂停后重新录制该段
- [ ] 录制过程中不要发出键盘敲击声（使用静音键盘或后期降噪）

## 后期制作
- [ ] 所有片段按脚本顺序排列
- [ ] 旁白与画面同步（误差 < 0.5 秒）
- [ ] 字幕时间轴准确，无错别字
- [ ] 背景音乐音量不盖过旁白
- [ ] 导出文件大小 < 500MB（方便上传）
- [ ] 最终检查：播放一遍，确认无黑屏、无卡顿、无音画不同步
```

【验收标准】：
- [ ] 视频时长严格 ≤ 10 分钟（9:00-9:30 为佳）
- [ ] 分辨率 1920x1080，帧率 30fps，格式 MP4
- [ ] 包含完整科研闭环展示（问题 → 文献 → 假设 → 实验 → 评估 → 迭代）
- [ ] 包含四大核心 Agent 的功能展示（每个 Agent 至少 30 秒）
- [ ] 包含 Phase 5 拓展功能展示（每个拓展功能至少 15 秒）
- [ ] 包含技术架构和创新点总结
- [ ] 旁白清晰、语速适中、无背景噪音
- [ ] 中英文字幕准确（英文字幕可机器翻译后人工校对）
- [ ] 背景音乐音量适中，不干扰旁白
- [ ] 视频文件大小 ≤ 500MB
- [ ] 可在 B 站/腾讯视频正常上传和播放
- [ ] 分镜脚本和录制检查清单已保存为文档

【预期产出】：
- `docs/video/SCRIPT.md` — 完整分镜脚本（本文档）
- `docs/video/RECORDING_CHECKLIST.md` — 录制检查清单
- `docs/video/NARRATION.txt` — 旁白文本（纯文本，方便录制）
- `docs/video/ASSETS/` — 素材清单（图片/音频/字体）
- `docs/video/DEMO_DATA_PREP.md` — 演示数据准备指南
- `video/AI-Scientist-Hub-Demo.mp4` — 最终演示视频（≤ 500MB）
- `video/AI-Scientist-Hub-Demo.srt` — 中英双语字幕文件

---

### <a name="p6-t5"></a>【龙虾角色】：技术文档工程师 + 学术写作专家

【龙虾ID】：P6-T5

【任务名称】：技术方案文档 — 20 页 PDF 详细结构与内容

【上下文】：
- 前置完成状态：Phase 1-5 全部完成，系统功能完整。比赛要求提交技术方案文档（PDF，≤ 20 页），用于评审专家了解项目的技术深度、创新性和实现质量。项目基于 React + EdgeOne + 百炼 Qwen，面向"挑战杯揭榜挂帅"XH-202619 赛道一（科学问题）。
- 技术约束：
  - 页数严格 ≤ 20 页（A4 尺寸，正文页数，不含封面/附录）
  - 格式：PDF，字体清晰，图表高分辨率
  - 内容：技术深度优先，兼顾商业/社会价值
  - 需要包含系统架构图、流程图、数据模型图、评估结果等
  - 引用需规范（GB/T 7714 或 APA 格式）
  - 语言：中文为主，技术术语可保留英文

【具体指令】：

#### 1. 文档结构规划（20 页精确分配）

```markdown
# 技术方案文档结构

## 封面 + 目录（1 页，不计入正文）
- 项目名称：AI Scientist Hub：基于国产开源大模型的科研智能平台
- 参赛赛道：挑战杯"揭榜挂帅"XH-202619 赛道一：科学问题 — 方向一
- 团队信息：团队名称、成员、指导教师、学校
- 日期：2026 年 7 月

## 1. 项目概述（1 页）
- 1.1 项目背景（0.3 页）
  - AI for Science 的发展趋势
  - 国产大模型的战略意义（Qwen 系列）
  - 传统科研模式的痛点（信息过载、假设生成困难、实验设计耗时）
- 1.2 项目目标（0.3 页）
  - 构建"问题理解 → 文献整合 → 假设生成 → 实验设计 → 评估验证 → 迭代优化"闭环
  - 面向 Science 125 个前沿科学问题
- 1.3 核心创新（0.4 页）
  - 多智能体协作（4 个 Agent 闭环）
  - 可验证性评估机制
  - 天文数据深度融合
  - 科学传播可视化

## 2. 系统架构（2 页）
- 2.1 总体架构（1 页）
  - 架构图：React 前端 → EdgeOne Edge Functions → 百炼平台 → Qwen 模型 → KV Storage
  - 分层说明：展示层 / 应用层 / AI 层 / 数据层
  - 部署方案：EdgeOne Pages 全球 CDN + Edge Functions 无服务器
- 2.2 多智能体协作架构（1 页）
  - 4 个 Agent 的职责定义和协作流程图
  - 编排器（Orchestrator）设计：状态机驱动、支持迭代循环
  - 消息总线：Agent 间通信机制
  - 工具调用（MCP/Function Calling）：Agent 可调用的工具集

## 3. 核心设计（4 页）
- 3.1 文献整合者 Agent（1 页）
  - 职责：检索、解析、整合多源文献，构建证据链
  - 调用模型：Qwen-Plus + RAG
  - 技术实现：多源检索（arXiv/SPIE/ADS/知网）→ 相关性排序 → 关键信息提取 → 知识缺口识别
  - 数据流图：输入查询 → 检索 → 筛选 → 提取 → 整合 → 输出综述
- 3.2 假设生成器 Agent（1 页）
  - 职责：基于知识缺口生成候选假设，评估可验证性
  - 调用模型：Qwen-Max + 思维链（enable_thinking）
  - 技术实现：知识缺口分析 → 类比推理 → 候选假设生成 → 创新性评估 → 可验证性评估 → 结构化输出
  - 假设结构：背景 / 前提 / 预测 / 验证方法 / 风险分析
  - 假设版本管理：多轮迭代、版本对比、diff 视图
- 3.3 实验规划师 Agent（1 页）
  - 职责：设计验证实验、生成代码、规划任务流程
  - 调用模型：Qwen-Coder + 工具调用
  - 技术实现：目标分解 → 实验步骤设计 → 对照组/变量控制 → 数据收集规划 → 统计方法推荐 → 代码生成 → 甘特图生成
  - 代码生成：Python / R / MATLAB 代码，支持在线运行模拟
- 3.4 评估验证官 Agent（1 页）
  - 职责：评估假设质量、检测偏差、提出修正建议
  - 调用模型：Qwen-Max + 反思机制
  - 评估维度：创新性(0-5) / 可验证性(0-5) / 逻辑一致性(0-5) / 证据支持度(0-5)
  - 偏差检测：确认偏差、幸存者偏差、因果混淆
  - 迭代机制：人工反馈 → 重新生成 → 版本对比
- 3.5 智能体编排机制（跨 3.1-3.4 小节）
  - 编排器状态机：idle → literature → hypothesis → experiment → evaluate → iterate → complete
  - 异常处理：Agent 失败降级、超时重试、部分结果返回
  - 缓存策略：相同查询结果缓存 1 小时

## 4. 模型与算法（3 页）
- 4.1 Qwen 系列模型选型（0.8 页）
  - 模型矩阵：Qwen-Max（复杂推理）、Qwen-Plus（通用任务）、Qwen-Coder（代码生成）、Qwen-VL（多模态）、Qwen-Long（长文本）
  - 模型选择策略：任务类型 → 模型映射 → 参数配置（temperature/max_tokens/enable_thinking）
  - 百炼平台接入：API 代理、安全转发、速率限制
- 4.2 RAG 检索增强（0.7 页）
  - 知识库构建：天文领域文档、论文摘要、百科数据
  - 检索策略：向量检索（简化版，使用关键词 + 语义相似度）+ 重排序
  - 上下文注入：检索结果 → system prompt 拼接 → Qwen 生成
- 4.3 思维链（CoT）与反思机制（0.8 页）
  - CoT 实现：Qwen-Max enable_thinking 参数，展示推理过程
  - 反思机制：评估 Agent 的 self-critique 设计，生成改进建议
  - 多轮对话管理：对话历史压缩、关键信息提取
- 4.4 工具调用（MCP）实现（0.7 页）
  - 工具定义：搜索 arXiv / 查询天文数据库 / 运行模拟 / 可视化数据 / 评估假设
  - 工具注册：JSON Schema 定义 → 百炼平台 function calling
  - 工具执行：Edge Function 安全代理 → 外部 API 调用 → 结果返回

## 5. 数据与知识（2 页）
- 5.1 天文数据集成（1 页）
  - 数据来源：国家天文科学数据中心（JW-SSD / JW-FD / TESS）
  - 数据接入：REST API 代理 → 数据缓存 → 预处理（清洗/归一化/特征提取）
  - 数据类型：太阳黑子时序 / 耀斑事件 / 光变曲线 / 能谱数据
  - 多模态融合：图像 + 时序 + 光谱 → 统一特征表示
- 5.2 知识图谱构建（1 页）
  - 实体类型：天体对象 / 物理概念 / 观测设备 / 科学方法 / 数据产品 / 研究机构
  - 关系类型：观测 / 因果 / 分类 / 方法 / 数据 / 演化
  - 构建流程：实体抽取（Qwen-NER）→ 关系抽取 → 图谱存储（KV Storage）→ 可视化（D3.js）
  - 推理能力：路径发现、知识缺口检测、证据链构建

## 6. 实验与验证（3 页）
- 6.1 测试案例设计（1 页）
  - 测试数据集：Science 125 问题中的 5 个天文相关问题
  - 测试指标：假设质量（人工评审 1-5 分）、生成时间、迭代次数
  - 测试方法：对照组（无 AI 辅助的研究者）vs 实验组（使用 AI Scientist Hub）
- 6.2 假设质量评估结果（1 页）
  - 表格：5 个测试问题的假设质量评分（创新性/可验证性/逻辑性/证据支持度）
  - 柱状图：各维度平均得分对比（基线方法 vs 本系统）
  - 案例展示：1 个高质量假设的完整展示（问题 → 文献 → 假设 → 评估）
- 6.3 多轮迭代优化展示（0.5 页）
  - 迭代曲线：V1 → V2 → V3 的评估分数变化
  - 用户反馈驱动改进的具体案例
- 6.4 与基线方法对比（0.5 页）
  - 对比对象：ChatGPT-4（通用对话）/ 传统文献管理工具（Zotero）
  - 对比维度：假设生成质量 / 文献整合效率 / 实验设计完整性 / 迭代便利性
  - 结论：本系统在假设生成和实验设计维度显著优于基线

## 7. 创新点与拓展（2 页）
- 7.1 多智能体协作创新（0.5 页）
  - 4 个 Agent 的专业化分工 vs 单体大模型的通用对话
  - 状态机驱动的编排机制，支持迭代和异常处理
- 7.2 可验证性评估机制（0.5 页）
  - 首创的假设多维评估体系（创新性/可验证性/逻辑性/证据）
  - 偏差检测和反例识别
- 7.3 天文数据深度融合（0.5 页）
  - 国家天文科学数据中心数据接入
  - 多模态数据融合（图像/时序/光谱）
- 7.4 科学传播可视化拓展（0.5 页）
  - 科普海报生成、图文摘要、动态演示
  - 多受众适配（专家/研究生/高中生/公众）

## 8. 应用前景与总结（1 页）
- 8.1 应用场景（0.5 页）
  - 高校科研训练：帮助研究生快速入门新领域
  - 天文台研究辅助：整合多源数据，加速发现
  - 科学传播普及：将科研成果转化为科普内容
- 8.2 社会价值（0.3 页）
  - 提升科研效率，降低创新门槛
  - 促进国产大模型在科学领域的应用
  - 推动科学知识的民主化传播
- 8.3 未来展望（0.2 页）
  - 扩展更多学科领域（生物/化学/材料）
  - 接入更多科学数据源（国家科学数据中心）
  - 构建开放科研协作生态

## 9. 附录（1 页，不计入正文页数）
- 9.1 技术栈清单
- 9.2 API 文档链接
- 9.3 代码仓库链接（GitHub）
- 9.4 演示视频链接
- 9.5 在线演示地址
- 9.6 团队成员分工
```

#### 2. 图表制作要求

```markdown
# 图表制作规范

## 系统架构图
- 工具：Figma / Draw.io / Lucidchart
- 尺寸：1920x1080（方便缩放）
- 风格：扁平化，与项目设计系统一致（#0A2540 / #00D4AA / #FFFFFF）
- 包含：前端层（React/Vite/Tailwind）→ 网关层（Edge Functions/认证/路由）→ AI 层（百炼/Qwen）→ 数据层（KV/图谱）
- 箭头：数据流向，标注协议（HTTP/JSON/SSE）
- 导出：PNG 或 SVG，分辨率 300dpi

## 多智能体协作流程图
- 工具：Figma / Draw.io
- 风格：泳道图或流程图
- 包含：4 个 Agent 的泳道，每个泳道内的处理步骤，Agent 间的消息传递
- 标注：每个步骤的输入/输出、调用模型、处理时间（预估）
- 颜色：文献 Agent 蓝 / 假设 Agent 绿 / 实验 Agent 橙 / 评估 Agent 紫

## 数据模型图
- 工具：dbdiagram.io / Figma
- 包含：实体类型（节点）和关系类型（边）
- 示例：太阳（节点）→ 观测（边）→ TESS（节点）→ 产生（边）→ 光变曲线（节点）
- 样式：节点圆角矩形，边带箭头和标签

## 评估结果图表
- 工具：ECharts / Python matplotlib（导出高分辨率 PNG）
- 类型：柱状图（对比得分）、雷达图（多维度评估）、折线图（迭代改进曲线）
- 配色：与项目主色调一致
- 标注：图例、坐标轴标签、数据标签
- 分辨率：300dpi，适合打印

## 截图
- 尺寸：1920x1080 或 1440x900
- 内容：关键页面截图（问题理解/文献综述/假设生成/实验设计/知识图谱/海报生成）
- 处理：去除敏感信息（测试账号、API Key 提示），添加 subtle 阴影效果
- 标注：用红色箭头或高亮框标注关键区域
```

#### 3. 内容编写指南

```markdown
# 内容编写风格指南

## 语言风格
- 使用学术/技术报告风格，避免口语化
- 技术术语首次出现给出英文和中文对照
- 段落长度：3-5 句，每段一个核心观点
- 使用主动语态（"系统实现了..."而非"...被系统实现"）

## 数据与引用
- 所有技术参数需准确（如 Qwen-Max 的上下文长度、百炼 API 的速率限制）
- 引用论文使用 GB/T 7714 格式：
  [1] 作者. 题名[J]. 刊名, 年, 卷(期): 起止页码.
  [2] 作者. 书名[M]. 出版地: 出版者, 出版年.
- 引用网页使用：作者. 题名[EB/OL]. 网址, 访问日期.

## 关键数据（需准确填写）
- Qwen-Max 上下文长度：128K tokens（确认最新版本）
- Qwen-Plus 上下文长度：128K tokens
- Qwen-Coder 上下文长度：128K tokens
- 百炼平台 API 地址：https://dashscope.aliyuncs.com/api/v1
- 国家天文科学数据中心：www.nadc.cas.cn
- EdgeOne Pages 静态资源缓存：全球 CDN 边缘节点
- Edge Functions 执行时间：50s CPU 时间上限
- KV Storage 单值上限：2MB
- 系统测试覆盖率：单元测试 ≥ 80%，组件测试 ≥ 60%

## 排版规范
- 字体：中文使用宋体或思源宋体（Noto Serif SC），英文使用 Times New Roman
- 标题：一级标题 18pt 黑体，二级 14pt 黑体，三级 12pt 黑体
- 正文：10.5pt 宋体，行距 1.5 倍
- 页边距：上下 2.54cm，左右 3.17cm
- 页码：底部居中，从正文开始编号
- 图表：图号和图题在图下方，表号和表题在表上方
- 代码：使用等宽字体（Consolas / Courier New），字号 9pt，浅灰背景
```

#### 4. 文档生成流程

```markdown
# 生成流程

## 阶段 1：内容编写（Markdown）
1. 使用 Markdown 编写所有章节内容（`docs/tech-spec/*.md`）
2. 每个章节独立文件，方便并行编辑
3. 使用标准 Markdown 语法，表格、代码块、列表等

## 阶段 2：图表制作
1. 使用 Figma 制作所有架构图和流程图，导出 PNG/SVG
2. 使用 ECharts 或 Python matplotlib 制作数据图表，导出高分辨率 PNG
3. 使用项目截图工具获取界面截图，裁剪到关键区域
4. 所有图表放入 `docs/tech-spec/assets/`

## 阶段 3：排版转换（Markdown → Word → PDF）
1. 使用 Markdown 合并工具合并所有章节为单个 `tech-spec.md`
2. 使用 pandoc 或 Typora 转换为 Word 文档：
   pandoc tech-spec.md -o tech-spec.docx --reference-doc=template.docx
3. 在 Word 中精细调整排版：字体、行距、页边距、图表位置
4. 导出为 PDF（使用"打印为 PDF"确保字体嵌入正确）
5. 使用 Adobe Acrobat 或 PDF 工具检查：
   - 文件大小 ≤ 10MB
   - 所有字体已嵌入
   - 图表分辨率 ≥ 300dpi
   - 无空白页或截断页
   - 目录页码正确

## 阶段 4：质量检查
- 检查拼写和语法错误（使用 Word 拼写检查 + 人工校对）
- 检查所有图表编号和引用是否匹配
- 检查页码和目录是否一致
- 检查所有超链接是否可访问（GitHub/演示地址）
- 请 2 位以上非团队成员阅读，提出修改意见
```

【验收标准】：
- [ ] 文档总页数 ≤ 20 页（正文），不含封面/附录
- [ ] 文档格式为 PDF，A4 尺寸，字体清晰，排版专业
- [ ] 包含所有要求章节（1-9 章），每章内容充实
- [ ] 系统架构图、多智能体流程图、数据模型图、评估结果图表均清晰可读
- [ ] 技术参数准确（Qwen 模型规格、百炼 API 限制、EdgeOne 限制等）
- [ ] 引用格式规范（GB/T 7714 或 APA），引用 ≥ 10 篇文献
- [ ] 包含至少 3 个系统截图（关键页面），截图经过美化处理
- [ ] 包含评估数据（假设质量评分、迭代改进曲线、基线对比）
- [ ] 文档文件大小 ≤ 10MB
- [ ] 所有超链接（GitHub、演示地址、API 文档）可正常访问
- [ ] 文档通过拼写和语法检查，无错别字
- [ ] 目录页码正确，图表编号连续
- [ ] 附录包含完整的技术栈清单和团队分工

【预期产出】：
- `docs/tech-spec/01-overview.md` — 项目概述
- `docs/tech-spec/02-architecture.md` — 系统架构
- `docs/tech-spec/03-core-design.md` — 核心设计（文献/假设/实验/评估/编排）
- `docs/tech-spec/04-model-algorithm.md` — 模型与算法
- `docs/tech-spec/05-data-knowledge.md` — 数据与知识
- `docs/tech-spec/06-experiment.md` — 实验与验证
- `docs/tech-spec/07-innovation.md` — 创新点与拓展
- `docs/tech-spec/08-prospect.md` — 应用前景与总结
- `docs/tech-spec/09-appendix.md` — 附录
- `docs/tech-spec/assets/architecture.png` — 系统架构图
- `docs/tech-spec/assets/agent-flow.png` — 多智能体流程图
- `docs/tech-spec/assets/data-model.png` — 数据模型图
- `docs/tech-spec/assets/evaluation-chart.png` — 评估结果图表
- `docs/tech-spec/assets/screenshot-*.png` — 系统截图（5+ 张）
- `docs/tech-spec/template.docx` — Word 模板（字体/样式预定义）
- `docs/tech-spec/tech-spec.md` — 合并后的完整 Markdown
- `docs/tech-spec/tech-spec.docx` — Word 版本（排版调整）
- `docs/tech-spec/tech-spec.pdf` — 最终 PDF 文件（≤ 20 页，≤ 10MB）
- `docs/tech-spec/REFERENCES.md` — 引用文献列表

---

### <a name="p6-t6"></a>【龙虾角色】：DevOps 工程师 + 部署专家

【龙虾ID】：P6-T6

【任务名称】：部署上线 — EdgeOne Pages + CI/CD 流水线

【上下文】：
- 前置完成状态：Phase 1-5 全部完成，Phase 6-T1 测试通过，T2 性能优化完成，T3 安全加固完成，T4 视频制作完成，T5 技术文档完成。项目需要部署到生产环境，供比赛评审在线访问。现有仓库在 GitHub（https://github.com/zixilee666-svg/Academic-Web）。
- 技术约束：
  - 部署平台：EdgeOne Pages（腾讯云 EdgeOne 静态托管 + Edge Functions）
  - EdgeOne Pages 限制：单文件大小 ≤ 25MB，总文件数 ≤ 10,000，KV Storage 单值 ≤ 2MB
  - Edge Functions 限制：单次执行 50s CPU 时间，内存 128MB，冷启动时间影响首响
  - CI/CD 使用 GitHub Actions（与 EdgeOne 集成）
  - 生产环境需使用生产级百炼 API Key（与开发环境分离）
  - 需要配置自定义域名（可选，使用 EdgeOne 默认域名也可）

【具体指令】：

#### 1. 环境配置

**A. 环境分离**

```bash
# 环境配置
# .env.development（本地开发，不提交）
VITE_API_BASE_URL=http://localhost:5173/api
BAILIAN_API_KEY=sk-dev-key
BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/api/v1
JWT_SECRET=dev-secret-min-32-chars

# .env.production（生产环境，配置在 EdgeOne 控制台）
VITE_API_BASE_URL=/api
BAILIAN_API_KEY=sk-prod-key
BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/api/v1
JWT_SECRET=prod-secret-min-32-chars
ENCRYPTION_KEY=prod-encryption-key
```

```typescript
// src/config/env.ts — 环境配置管理
export const ENV = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '/api',
  NODE_ENV: import.meta.env.MODE,
  IS_PRODUCTION: import.meta.env.PROD,
  VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
};

// 开发环境显示调试信息
export const DEBUG = !ENV.IS_PRODUCTION;
```

**B. EdgeOne 控制台配置**

```markdown
# EdgeOne Pages 配置清单

## 1. 创建项目
- 登录 EdgeOne 控制台 → Pages → 创建项目
- 选择 GitHub 仓库：zixilee666-svg/Academic-Web
- 分支：main（或 production）
- 构建命令：npm run build
- 输出目录：dist
- 根目录：/（项目根目录）

## 2. 环境变量配置（Production）
在 EdgeOne Pages 项目设置 → 环境变量中配置：
- BAILIAN_API_KEY = sk-prod-xxxxxxxx（生产 Key）
- BAILIAN_BASE_URL = https://dashscope.aliyuncs.com/api/v1
- JWT_SECRET = <随机生成的 32 字符以上字符串>
- ENCRYPTION_KEY = <随机生成的 16 字符以上字符串>
- NODE_ENV = production

注意：环境变量在 EdgeOne Pages 中自动注入到 Edge Functions 的 env 参数中

## 3. KV Storage 配置
- 创建 KV Storage 命名空间：ai-scientist-hub-prod
- 绑定到 Pages 项目：设置 → KV Storage → 绑定命名空间
- KV 名称在 Edge Functions 中通过 env.KV_STORAGE 访问

## 4. Edge Functions 配置
- 确保所有 Edge Functions 在 `edge-functions/` 目录中
- 路由映射：EdgeOne Pages 自动根据文件路径映射 API 路由
- 自定义路由：在 `edge-functions/_routes.json` 中定义（如需要）

## 5. 自定义域名（可选）
- 在 EdgeOne 控制台 → 域名管理 → 添加自定义域名
- 如：ai-scientist-hub.example.com
- 配置 DNS CNAME 记录指向 EdgeOne Pages 提供的域名
- 等待 SSL 证书自动签发（通常 5-10 分钟）

## 6. 缓存策略
- 静态资源（JS/CSS/图片）：EdgeOne CDN 自动缓存，Cache-Control 1 年
- API 响应（/api/*）：不缓存（Cache-Control: no-cache）
- 例外：GET /api/fusion/disciplines 可缓存 1 小时（数据不常变化）
```

#### 2. CI/CD 流水线（GitHub Actions）

```yaml
# .github/workflows/deploy.yml
name: Deploy to EdgeOne Pages

on:
  push:
    branches: [main, production]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run lint
        run: npm run lint

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          CI: true

      - name: Run security audit
        run: npm audit --audit-level=high
        continue-on-error: false

      - name: Build
        run: npm run build
        env:
          VITE_API_BASE_URL: /api

      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist

  deploy:
    needs: test
    if: github.ref == 'refs/heads/production'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build for production
        run: npm run build
        env:
          VITE_API_BASE_URL: /api
          NODE_ENV: production

      - name: Deploy to EdgeOne Pages
        uses: tencent-cloud/edgeone-pages-deploy-action@v1
        with:
          api-token: ${{ secrets.EDGEONE_API_TOKEN }}
          project-id: ${{ secrets.EDGEONE_PROJECT_ID }}
          dist-dir: ./dist
          edge-functions-dir: ./edge-functions

      - name: Notify deployment
        run: |
          echo "Deployed to EdgeOne Pages"
          echo "Production URL: https://ai-scientist-hub.pages.dev"
```

```yaml
# .github/workflows/lighthouse.yml（性能监控，独立流水线）
name: Lighthouse CI

on:
  schedule:
    - cron: '0 0 * * 1' # 每周一运行
  workflow_dispatch:

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun --config=lighthouserc.js
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

#### 3. 构建脚本优化

```json
// package.json 脚本更新
{
  "scripts": {
    "dev": "vite --host",
    "build": "tsc && vite build",
    "build:prod": "NODE_ENV=production tsc && vite build",
    "preview": "vite preview",
    "test:unit": "vitest",
    "test:unit:ci": "vitest --run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint . --ext ts,tsx --fix",
    "type-check": "tsc --noEmit",
    "audit": "npm audit --audit-level=high",
    "deploy:staging": "npm run build && edgeone deploy --env=staging",
    "deploy:prod": "npm run build && edgeone deploy --env=production"
  }
}
```

#### 4. 部署前检查清单

```markdown
# 生产部署检查清单

## 代码检查
- [ ] 所有 `console.log` 已移除（或替换为生产级日志）
- [ ] 所有 `debugger` 语句已移除
- [ ] 所有 TODO/FIXME 已处理或创建 issue
- [ ] 代码通过 ESLint 检查（0 warnings）
- [ ] TypeScript 类型检查通过（tsc --noEmit）
- [ ] 所有测试通过（单元测试 + E2E 测试）
- [ ] `npm audit` 无 High/Critical 漏洞

## 配置检查
- [ ] 环境变量在 EdgeOne 控制台正确配置
- [ ] 生产 API Key 与开发 Key 不同
- [ ] JWT_SECRET 长度 ≥ 32 字符，随机生成
- [ ] KV Storage 命名空间已绑定
- [ ] Edge Functions 路由正确映射
- [ ] 自定义域名 DNS 配置正确（如使用）

## 功能检查（部署后验证）
- [ ] 首页正常加载，无 404/500 错误
- [ ] 用户注册/登录/登出正常
- [ ] 百炼 API 代理正常（测试一个简单对话）
- [ ] 四大 Agent 核心流程可完成（完整走一遍）
- [ ] 知识图谱正常渲染
- [ ] 海报生成和导出正常
- [ ] 跨学科迁移功能正常
- [ ] 协作评价功能正常
- [ ] 数字分身面板正常显示
- [ ] 移动端访问正常（用手机测试）
- [ ] 暗黑模式切换正常

## 性能检查
- [ ] Lighthouse 性能评分 ≥ 85
- [ ] 首屏加载时间 ≤ 2.5s（使用 Chrome DevTools Network 面板）
- [ ] 百炼 API 响应时间正常（3-8s）
- [ ] 静态资源通过 CDN 缓存（Response Headers 中有 CF-Cache-Status: HIT）

## 安全检查
- [ ] HTTPS 强制启用（EdgeOne 自动）
- [ ] CSP 头正确设置
- [ ] X-Frame-Options: DENY
- [ ] 前端网络请求中无 API Key（DevTools Network 面板检查）
- [ ] 未登录用户无法访问受保护页面（自动跳转登录）
- [ ] 速率限制有效（快速刷新 10 次以上，应触发限制）

## 备份与回滚
- [ ] 数据库/ KV 数据已备份（导出关键数据）
- [ ] 回滚方案就绪（上一版本 Git tag 已打）
- [ ] 监控告警配置（如有）
```

#### 5. 部署验证脚本

```bash
#!/bin/bash
# scripts/deploy-verify.sh — 部署后验证脚本

BASE_URL="https://ai-scientist-hub.pages.dev"

echo "=== 部署验证 ==="

# 1. 首页检查
echo "1. 检查首页..."
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/" | grep -q "200" && echo "✓ 首页正常" || echo "✗ 首页异常"

# 2. API 检查
echo "2. 检查 API..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")
if [ "$STATUS" = "200" ]; then
  echo "✓ API 健康检查正常"
else
  echo "✗ API 健康检查异常: $STATUS"
fi

# 3. 静态资源检查
echo "3. 检查静态资源..."
JS_FILE=$(curl -s "$BASE_URL/" | grep -o 'assets/index-[^"]*\.js' | head -1)
if [ -n "$JS_FILE" ]; then
  JS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/$JS_FILE")
  if [ "$JS_STATUS" = "200" ]; then
    echo "✓ JS 资源正常: $JS_FILE"
  else
    echo "✗ JS 资源异常: $JS_STATUS"
  fi
else
  echo "✗ 未找到 JS 资源"
fi

# 4. HTTPS 检查
echo "4. 检查 HTTPS..."
curl -s -I "$BASE_URL" | grep -q "HTTP/2" && echo "✓ HTTP/2 启用" || echo "✗ HTTP/2 未启用"

# 5. 安全头检查
echo "5. 检查安全头..."
HEADERS=$(curl -s -I "$BASE_URL")
echo "$HEADERS" | grep -q "strict-transport-security" && echo "✓ HSTS 启用" || echo "✗ HSTS 未启用"
echo "$HEADERS" | grep -q "content-security-policy" && echo "✓ CSP 启用" || echo "✗ CSP 未启用"

echo "=== 验证完成 ==="
```

#### 6. 监控与日志

```javascript
// edge-functions/api/health.js — 健康检查端点
export async function handleHealth(request, env) {
  const checks = {
    timestamp: new Date().toISOString(),
    version: env.APP_VERSION || '1.0.0',
    env: env.NODE_ENV || 'unknown',
    kv: false,
    bailian: false,
  };
  
  // 检查 KV Storage
  try {
    await env.KV_STORAGE.get('health:check');
    checks.kv = true;
  } catch {
    checks.kv = false;
  }
  
  // 检查百炼 API（轻量 ping）
  try {
    const response = await fetch(env.BAILIAN_BASE_URL + '/models', {
      headers: { 'Authorization': `Bearer ${env.BAILIAN_API_KEY}` },
    });
    checks.bailian = response.ok;
  } catch {
    checks.bailian = false;
  }
  
  const allHealthy = checks.kv && checks.bailian;
  
  return new Response(JSON.stringify(checks), {
    status: allHealthy ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

```yaml
# .github/workflows/monitor.yml — 定期监控
name: Health Monitor

on:
  schedule:
    - cron: '*/30 * * * *' # 每 30 分钟检查一次

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - name: Check health
        run: |
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://ai-scientist-hub.pages.dev/api/health")
          if [ "$STATUS" != "200" ]; then
            echo "Health check failed: $STATUS"
            exit 1
          fi
          echo "Health check passed"
```

【验收标准】：
- [ ] 生产环境成功部署到 EdgeOne Pages，可公开访问
- [ ] 自定义域名（或 EdgeOne 默认域名）可正常访问，HTTPS 自动启用
- [ ] 首页、所有页面、所有 API 端点无 404/500 错误
- [ ] 完整科研闭环可在生产环境完成（从问题输入到迭代优化）
- [ ] 四大 Agent 核心流程在生产环境可正常调用 Qwen 模型
- [ ] 前端静态资源通过 CDN 缓存，二次加载速度 ≤ 1s
- [ ] 移动端访问正常（响应式布局正确，触摸交互可用）
- [ ] 部署检查清单所有项已勾选
- [ ] 部署验证脚本运行通过（`scripts/deploy-verify.sh`）
- [ ] 健康检查端点 `/api/health` 返回 200，包含 KV 和百炼状态
- [ ] GitHub Actions CI/CD 流水线配置完成，push 到 production 分支自动触发部署
- [ ] CI 流水线包含：lint → test → build → security audit → deploy
- [ ] 生产环境使用独立的百炼 API Key（与开发环境分离）
- [ ] 环境变量在 EdgeOne 控制台配置，不暴露在代码中
- [ ] KV Storage 命名空间已绑定，数据可正常读写
- [ ] 回滚方案就绪（Git tag + EdgeOne 版本历史）
- [ ] 部署文档 `DEPLOYMENT_GUIDE.md` 完整，团队成员可按文档独立部署

【预期产出】：
- `.github/workflows/deploy.yml` — 部署流水线
- `.github/workflows/test.yml` — 测试流水线（或合并到 deploy.yml）
- `.github/workflows/lighthouse.yml` — 性能监控流水线
- `.github/workflows/monitor.yml` — 健康监控流水线
- `scripts/deploy-verify.sh` — 部署验证脚本
- `edge-functions/api/health.js` — 健康检查端点
- `src/config/env.ts` — 环境配置管理
- `.env.example` — 环境变量模板（不含真实值）
- `DEPLOYMENT_GUIDE.md` — 部署指南（详细步骤）
- `DEPLOYMENT_CHECKLIST.md` — 部署检查清单
- `ROLLBACK_GUIDE.md` — 回滚指南
- `MONITORING_GUIDE.md` — 监控与告警指南
- `CNAME`（可选）— 自定义域名配置
- `edge-functions/_routes.json`（可选）— 自定义路由配置

---

## 附录：Phase 5-6 龙虾复现提示词总表

| 龙虾ID | 角色 | 任务 | 周次 | 依赖 |
|--------|------|------|------|------|
| P5-T1 | 前端全栈 + AI 交互 | AI 数字分身系统 | 第 9 周 | Phase 1-4 |
| P5-T2 | 前端可视化 + 创意 | 科学传播可视化 | 第 9 周 | Phase 1-4 |
| P5-T3 | AI 算法 + 图谱 | 跨学科融合引擎 | 第 10 周 | Phase 4 图谱 |
| P5-T4 | 后端 + 协作设计 | 科研协作网络 | 第 10 周 | Phase 1-4 |
| P6-T1 | 测试 + QA | 测试体系构建 | 第 11 周 | Phase 1-5 |
| P6-T2 | 性能优化 | 性能优化 | 第 11 周 | Phase 1-5 |
| P6-T3 | 安全工程师 | 安全加固 | 第 11 周 | Phase 1-5 |
| P6-T4 | 视频导演 + 编剧 | 演示视频制作 | 第 12 周 | Phase 1-5 |
| P6-T5 | 技术文档 + 学术 | 技术方案文档 | 第 12 周 | Phase 1-5 |
| P6-T6 | DevOps + 部署 | 部署上线 | 第 12 周 | Phase 1-5 + T1-T3 |

---

*本龙虾复现提示词集由 AI-Scientist Hub 项目团队编制*
*版本：v1.0 | 日期：2026 年 7 月 12 日*
*适用比赛：挑战杯"揭榜挂帅"XH-202619*
