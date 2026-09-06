/**
 * AI-Scientist Hub - 自包含服务器 (Electron内置)
 * 同时提供后端API和前端静态文件服务
 * 端口: 3100 (独立端口，不与开发环境冲突)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// 加载项目根 .env（含 BAILIAN_API_KEY），使桌面版脱离 Mock 模式
const PROJECT_ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');
try {
  require('dotenv').config({ path: ENV_PATH });
} catch (e) {
  console.warn('[env] dotenv 加载失败（将仅用进程环境变量）:', e.message);
}

const APP_PORT = 3100;

// 安全：使用环境变量或生成随机密钥，禁止硬编码
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');

const app = express();

// CORS 仅允许本地访问（Electron应用）
app.use(cors({
  origin: ['http://127.0.0.1:' + APP_PORT, 'http://localhost:' + APP_PORT],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// 安全：请求日志（基础审计）
app.use((req, _res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ============================================================
// In-memory storage (Electron打包版使用内存存储)
// 注意：生产环境建议迁移到SQLite
// ============================================================
const storage = {
  users: new Map(),
  sessions: new Map(),
  projects: new Map(),
};

// 安全：密码使用简单哈希（Electron演示版，生产环境应使用bcrypt）
function hashPassword(password) {
  return crypto.createHmac('sha256', JWT_SECRET).update(password).digest('hex');
}

function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

// 默认用户（演示账号）
const defaultUsers = [
  { id: 'demo-admin', username: 'admin', password: 'Admin@2026!', name: '管理员', role: 'admin' },
  { id: 'demo-user', username: 'researcher', password: 'Research@2026!', name: '研究员', role: 'user' },
];
for (const user of defaultUsers) {
  storage.users.set(user.username, { ...user, password: hashPassword(user.password) });
}

// ============================================================
// Auth middleware
// ============================================================
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.userId || !decoded.username) {
      return res.status(401).json({ error: '认证令牌格式无效' });
    }
    req.userId = decoded.userId;
    req.username = decoded.username;
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? '认证令牌已过期' : '认证令牌无效';
    return res.status(401).json({ error: message });
  }
}

// ============================================================
// Auth routes
// ============================================================
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  if (username.length > 30 || password.length > 128) {
    return res.status(400).json({ error: '输入过长' });
  }

  const user = storage.users.get(username);
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
});

app.post('/api/auth/register', (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ error: '请填写完整信息' });
  }
  if (typeof username !== 'string' || typeof password !== 'string' || typeof name !== 'string') {
    return res.status(400).json({ error: '参数类型错误' });
  }
  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({ error: '用户名长度3-30位' });
  }
  if (password.length < 6 || password.length > 128) {
    return res.status(400).json({ error: '密码长度6-128位' });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: '用户名只能包含字母、数字和下划线' });
  }

  if (storage.users.has(username)) {
    return res.status(409).json({ error: '用户名已存在' });
  }
  const user = {
    id: `user-${Date.now()}`,
    username,
    password: hashPassword(password),
    name: name.slice(0, 50),
    role: 'user',
  };
  storage.users.set(username, user);
  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = storage.users.get(req.username);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ id: user.id, username: user.username, name: user.name, role: user.role });
});

// ============================================================
// Bailian AI proxy
// ============================================================
const BAILIAN_CONFIG = {
  baseURL: process.env.BAILIAN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: process.env.BAILIAN_API_KEY || process.env.DASHSCOPE_API_KEY || '',
  models: {
    reasoning: process.env.BAILIAN_MODEL_REASONING || 'qwen-max',
    general: process.env.BAILIAN_MODEL_GENERAL || 'qwen-plus',
    coding: process.env.BAILIAN_MODEL_CODING || 'qwen-coder-plus',
  },
};

function generateMockResponse(input, model) {
  const lower = (input || '').toLowerCase();
  if (lower.includes('文献') || lower.includes('literature')) {
    return JSON.stringify({
      papers: [
        { id: 'paper-1', title: 'Deep Learning for Solar Flare Prediction', authors: ['Zhang et al.'], year: 2024, journal: 'Space Weather', relevance: 0.95, keywords: ['flare','deep learning'] },
        { id: 'paper-2', title: 'Magnetic Shear Angle and Flare Intensity', authors: ['Wang & Liu'], year: 2023, journal: 'ApJ', relevance: 0.92, keywords: ['shear'] },
      ],
      evidence: [
        { id: 'ev-1', claim: '磁场梯度>0.5 G/km的活动区爆发M级以上耀斑概率73%', supportingPapers: ['paper-1'], confidence: 0.85 },
      ],
      gaps: [
        { id: 'gap-1', description: '缺乏多波段统一特征工程框架', severity: 'high' },
      ],
      summary: '当前太阳耀斑预测研究已从传统统计方法发展到深度学习阶段，但仍存在多波段融合不足等关键知识缺口。',
    });
  }
  if (lower.includes('假设') || lower.includes('hypothesis')) {
    return JSON.stringify({
      hypotheses: [
        { id: 'hyp-1', title: '多波段磁场拓扑融合预测假说', description: '融合光球层磁场参数与色球层极紫外特征', rationale: '多波段数据包含互补物理信息', scores: { innovation: 4.2, verifiability: 4.8, theoretical: 4.0, dataSupport: 3.8, practicality: 4.5, overall: 4.26 }, validation: { method: 'CNN-LSTM混合模型', datasets: ['JW-SSD'], expectedResults: 'TSS≥0.85', timeline: '7周' }, risks: ['时间对齐精度'], references: ['Zhang 2024'], version: 1, status: 'reviewed' },
      ],
      comparison: { dimensions: ['创新性','可验证性','理论基础','数据支持','实用性'], scores: [[4.2,4.8,4.0,3.8,4.5]], ranking: [0] },
      recommendations: ['优先验证假设1'],
    });
  }
  if (lower.includes('实验') || lower.includes('experiment') || lower.includes('计划')) {
    return JSON.stringify({
      objective: '验证多波段磁场拓扑融合对太阳耀斑预测准确率的提升效果',
      variables: [
        { type: 'independent', name: '特征融合方式', definition: '波段组合策略', range: '单/双/多波段' },
        { type: 'dependent', name: 'TSS评分', definition: 'True Skill Statistic', range: '0-1' },
      ],
      steps: [
        { order: 1, name: '数据预处理', description: '清洗JW-SSD数据', duration: '2周', deliverable: '标准化数据集' },
        { order: 2, name: '模型训练', description: '训练CNN-LSTM模型', duration: '3周', deliverable: '训练好的模型' },
      ],
      code: 'import torch\n# CNN-LSTM实验代码',
      gantt: [{ id: 't1', name: '数据预处理', start: 0, duration: 14, dependencies: [] }],
      resources: { compute: 'GPU', storage: '50GB', time: '10周', cost: '500元' },
      risks: [{ risk: '样本不平衡', probability: 'high', impact: 'high', mitigation: 'Focal Loss' }],
    });
  }
  if (lower.includes('评估') || lower.includes('evaluat')) {
    return JSON.stringify({
      scores: [
        { dimension: '创新性', score: 4.2, maxScore: 5, rationale: '多波段融合方法具有明确创新价值' },
        { dimension: '可验证性', score: 4.8, maxScore: 5, rationale: '公开数据集可直接验证' },
      ],
      overallScore: 4.26,
      strengths: ['实际应用价值明确', '实验设计严谨'],
      weaknesses: ['X级样本不足', '缺乏SOTA对比'],
      suggestions: ['使用Focal Loss', '补充对比实验'],
      counterExamples: ['Chen 2022发现多波段融合有时降低准确率'],
      biasCheck: { confirmationBias: { level: 'medium', description: '倾向强调融合优势' }, availabilityBias: { level: 'low', description: '引用全面' }, anchoringBias: { level: 'medium', description: '锚定于单一基线' }, overallRisk: 'medium' },
    });
  }
  return '## AI Scientist 分析结果\n\n基于您的输入，我已进行初步分析。建议从多波段数据融合角度切入，结合深度学习与传统物理模型。';
}

app.post('/api/bailian/chat', authMiddleware, async (req, res) => {
  const { model: modelKey = 'general', messages, temperature = 0.7, max_tokens = 4096 } = req.body;
  const model = BAILIAN_CONFIG.models[modelKey] || BAILIAN_CONFIG.models.general;

  if (!BAILIAN_CONFIG.apiKey) {
    const lastMsg = Array.isArray(messages) ? messages[messages.length - 1]?.content || '' : '';
    return res.json({
      id: `mock-${Date.now()}`, model,
      choices: [{ index: 0, message: { role: 'assistant', content: generateMockResponse(lastMsg, model) }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
    });
  }

  try {
    const response = await fetch(`${BAILIAN_CONFIG.baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${BAILIAN_CONFIG.apiKey}` },
      body: JSON.stringify({ model, messages, temperature, max_tokens, stream: false }),
    });
    const result = await response.json();
    res.json(result);
  } catch (err) {
    console.error('Bailian chat error:', err);
    res.status(500).json({ error: 'AI服务调用失败' });
  }
});

app.post('/api/bailian/chat/stream', authMiddleware, async (req, res) => {
  const { model: modelKey = 'general', messages, temperature = 0.7 } = req.body;
  const model = BAILIAN_CONFIG.models[modelKey] || BAILIAN_CONFIG.models.general;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (!BAILIAN_CONFIG.apiKey) {
    const lastMsg = Array.isArray(messages) ? messages[messages.length - 1]?.content || '' : '';
    const mockContent = generateMockResponse(lastMsg, model);
    const chunks = mockContent.split(/(?<=\s)/);
    for (const chunk of chunks) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk + ' ' } }] })}\n\n`);
      await new Promise(r => setTimeout(r, 20));
    }
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  try {
    const response = await fetch(`${BAILIAN_CONFIG.baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${BAILIAN_CONFIG.apiKey}` },
      body: JSON.stringify({ model, messages, temperature, stream: true }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      let detail = errText.slice(0, 300);
      try { const j = JSON.parse(errText); detail = (j.error && (j.error.message || j.error.code)) || detail; } catch {}
      const msg = `⚠️ 模型调用失败（HTTP ${response.status}，模型 ${model}）：${detail}`;
      console.error('[stream]', msg);
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: msg } }] })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }
    const reader = response.body?.getReader();
    if (!reader) { res.write('data: [DONE]\n\n'); return res.end(); }
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          res.write(`data: ${data === '[DONE]' ? '[DONE]' : data}\n\n`);
        }
      }
    }
    res.end();
  } catch {
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// ============================================================
// Research sessions
// ============================================================
app.post('/api/research/sessions', authMiddleware, (req, res) => {
  const { title, domain = '天文物理', question, depth = 'standard' } = req.body;
  if (!title || !question) {
    return res.status(400).json({ error: '标题和问题不能为空' });
  }
  const sessionId = uuidv4();
  const session = {
    id: sessionId, userId: req.userId, title, domain, question, depth,
    status: 'created', currentStage: 'question',
    stages: { question: { status: 'pending' }, literature: { status: 'pending' }, hypothesis: { status: 'pending' }, experiment: { status: 'pending' }, evaluation: { status: 'pending' } },
    agents: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  storage.sessions.set(sessionId, session);
  res.status(201).json(session);
});

app.get('/api/research/sessions', authMiddleware, (req, res) => {
  const sessions = Array.from(storage.sessions.values())
    .filter(s => s.userId === req.userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(sessions);
});

app.get('/api/research/sessions/:id', authMiddleware, (req, res) => {
  const session = storage.sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: '会话不存在' });
  if (session.userId !== req.userId) return res.status(403).json({ error: '无权访问' });
  res.json(session);
});

app.delete('/api/research/sessions/:id', authMiddleware, (req, res) => {
  const session = storage.sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: '会话不存在' });
  if (session.userId !== req.userId) return res.status(403).json({ error: '无权访问' });
  storage.sessions.delete(req.params.id);
  res.json({ message: '已删除' });
});

app.post('/api/research/run-agent-stream', authMiddleware, async (req, res) => {
  const { stage, input } = req.body;
  if (!stage || !input) {
    return res.status(400).json({ error: 'stage和input不能为空' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  const outputs = {
    question: '## 问题解析\n\n### 科学问题分类\n该问题属于**太阳物理**领域。\n\n### 可行性评估\n- 数据可得性: 92%\n- 方法成熟度: 78%\n- 创新空间: 85%\n- 应用价值: 90%',
    literature: '## 文献检索\n\n检索到 **23篇** 相关文献，**8篇** 高度相关。\n\n### 核心文献\n1. Zhang et al. (2024) - TSS=0.87\n2. Wang & Liu (2023) - r=0.78',
    hypothesis: '## 候选假设\n\n### 假设1：多波段磁场拓扑融合\n创新性: 4.2/5 | 可验证性: 4.8/5\n\n### 假设2：光变曲线异常模式\n创新性: 4.5/5 | 可验证性: 4.2/5',
    experiment: '## 实验方案\n\n- 4种模型架构对比\n- 3种特征融合方式\n- 预期TSS ≥ 0.85',
    evaluation: '## 评估报告\n\n- 假设1: 4.26/5 (推荐)\n- 假设2: 3.84/5\n- 假设3: 3.74/5',
  };

  const output = outputs[stage] || '分析完成。';
  const chunks = output.split(/(?<=[\n。！？])/);

  res.write(`data: ${JSON.stringify({ type: 'stage_start', stage })}\n\n`);
  for (const chunk of chunks) {
    res.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
    await new Promise(r => setTimeout(r, 30 + Math.random() * 50));
  }
  res.write(`data: ${JSON.stringify({ type: 'stage_complete', stage, result: { content: output } })}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
});

app.get('/api/research/stats', authMiddleware, (req, res) => {
  const sessions = Array.from(storage.sessions.values()).filter(s => s.userId === req.userId);
  res.json({
    sessionCount: sessions.length,
    completedCount: sessions.filter(s => s.status === 'completed').length,
    projectCount: 0,
  });
});

// ============================================================
// 真实文献检索（Crossref）—— 保证文献可溯源、带真实 DOI
// ============================================================
function stripJats(s) {
  if (!s) return '';
  return String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatCrossrefAuthor(a) {
  if (!a) return '';
  if (a.name) return String(a.name).trim();
  const fam = (a.family || '').trim();
  const giv = (a.given || '').trim();
  return [fam, giv].filter(Boolean).join(' ');
}

app.post('/api/research/literature', authMiddleware, async (req, res) => {
  const { query, rows = 8, fromYear } = req.body || {};
  if (!query || !String(query).trim()) {
    return res.status(400).json({ error: '检索式不能为空' });
  }
  const n = Math.max(1, Math.min(20, parseInt(rows, 10) || 8));
  const params = new URLSearchParams({
    query: String(query).trim(),
    rows: String(n),
    select: 'DOI,title,author,issued,container-title,abstract,URL,type,score,is-referenced-by-count',
    'mailto': 'ai-scientist-hub@example.org',
  });
  if (fromYear) params.set('filter', `from-pub-date:${parseInt(fromYear, 10)}-01-01`);

  const url = `https://api.crossref.org/works?${params.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AI-Scientist-Hub/3.0 (mailto:ai-scientist-hub@example.org)' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      return res.status(502).json({ error: `Crossref 返回 HTTP ${response.status}`, papers: [], source: 'crossref' });
    }
    const data = await response.json();
    const items = (data && data.message && data.message.items) || [];
    const maxScore = items.reduce((m, it) => Math.max(m, Number(it.score) || 0), 0) || 1;

    const papers = items
      .filter(it => it && it.DOI)
      .map((it, idx) => {
        const titleArr = it.title || [];
        const journalArr = it['container-title'] || [];
        const year = (it.issued && it.issued['date-parts'] && it.issued['date-parts'][0] && it.issued['date-parts'][0][0]) || null;
        const rawScore = Number(it.score) || 0;
        const relevance = rawScore > 0 ? Math.round((rawScore / maxScore) * 100) / 100 : Math.round((1 - idx / Math.max(items.length, 1)) * 100) / 100;
        const authors = (it.author || []).map(formatCrossrefAuthor).filter(Boolean).slice(0, 8);
        return {
          id: `cr-${idx + 1}-${it.DOI.replace(/[^a-z0-9]+/gi, '_').slice(0, 24)}`,
          title: stripJats(titleArr[0]) || '(无标题)',
          authors,
          year: year || 0,
          journal: stripJats(journalArr[0]) || (it.type ? String(it.type) : ''),
          doi: it.DOI,
          url: `https://doi.org/${it.DOI}`,
          abstract: stripJats(it.abstract || '').slice(0, 1200),
          relevance,
          citations: it['is-referenced-by-count'] || 0,
          keywords: [],
          source: 'Crossref',
        };
      });

    res.json({
      success: true,
      source: 'crossref',
      query: String(query).trim(),
      total: (data && data.message && data.message['total-results']) || papers.length,
      papers,
    });
  } catch (err) {
    clearTimeout(timer);
    const msg = err && err.name === 'AbortError' ? 'Crossref 请求超时（20s）' : (err && err.message) || '文献检索失败';
    console.error('[literature]', msg);
    res.status(502).json({ error: msg, papers: [], source: 'crossref' });
  }
});

// ============================================================
// 引导式研究向导：项目落盘持久化 + 分步编排 + 论文生成 + Word 导出
// ============================================================
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output');

function ensureDir(dir) {
  try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch (e) { console.error('[fs] mkdir失败', dir, e.message); }
}

// 启动时从磁盘恢复项目
function loadProjectsFromDisk() {
  try {
    ensureDir(DATA_DIR);
    if (fs.existsSync(PROJECTS_FILE)) {
      const arr = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
      if (Array.isArray(arr)) for (const p of arr) if (p && p.id) storage.projects.set(p.id, p);
      console.log(`[projects] 已从磁盘恢复 ${arr.length} 个项目`);
    }
  } catch (e) { console.error('[projects] 加载失败:', e.message); }
}

// 原子写盘（tmp + rename）
function saveProjectsToDisk() {
  try {
    ensureDir(DATA_DIR);
    const arr = Array.from(storage.projects.values());
    const tmp = PROJECTS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(arr, null, 2), 'utf-8');
    fs.renameSync(tmp, PROJECTS_FILE);
  } catch (e) { console.error('[projects] 保存失败:', e.message); }
}
loadProjectsFromDisk();

// —— 健壮的 JSON 提取（服务端，与前端 parseAI 对齐）——
function extractJSONServer(text) {
  if (!text) return null;
  let s = String(text).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const fb = s.search(/[{[]/);
  if (fb === -1) return null;
  s = s.slice(fb);
  const lb = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (lb !== -1) s = s.slice(0, lb + 1);
  return s;
}
// 修复 LLM 常见的非法 JSON：字符串值内部出现未转义的原始换行/制表符
function repairJSONControlChars(str) {
  let out = '';
  let inStr = false;
  let escaped = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (escaped) { out += ch; escaped = false; continue; }
      if (ch === '\\') { out += ch; escaped = true; continue; }
      if (ch === '"') { inStr = false; out += ch; continue; }
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') { out += '\\r'; continue; }
      if (ch === '\t') { out += '\\t'; continue; }
      out += ch;
    } else {
      if (ch === '"') { inStr = true; out += ch; continue; }
      out += ch;
    }
  }
  return out;
}
function safeParseServer(text) {
  const c = extractJSONServer(text);
  if (!c) return null;
  const repaired = repairJSONControlChars(c);
  const stripTrailing = (s) => s.replace(/,\s*([}\]])/g, '$1');
  const candidates = [c, repaired, stripTrailing(c), stripTrailing(repaired)];
  for (const a of candidates) {
    try { return JSON.parse(a); } catch { /* try next */ }
  }
  return null;
}

// —— 非流式调用百炼（服务端编排用）——
async function callBailian(modelKey, messages, { temperature = 0.7, max_tokens = 6000 } = {}) {
  const model = BAILIAN_CONFIG.models[modelKey] || BAILIAN_CONFIG.models.general;
  if (!BAILIAN_CONFIG.apiKey) {
    const last = Array.isArray(messages) ? messages[messages.length - 1]?.content || '' : '';
    return { text: generateMockResponse(last, model), mock: true, model };
  }
  const resp = await fetch(`${BAILIAN_CONFIG.baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${BAILIAN_CONFIG.apiKey}` },
    body: JSON.stringify({ model, messages, temperature, max_tokens, stream: false }),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    let detail = t.slice(0, 200);
    try { const j = JSON.parse(t); detail = (j.error && (j.error.message || j.error.code)) || detail; } catch { /* keep */ }
    throw new Error(`模型调用失败（HTTP ${resp.status}，${model}）：${detail}`);
  }
  const j = await resp.json();
  const text = j?.choices?.[0]?.message?.content || '';
  return { text, mock: false, model };
}

// —— Crossref 真实文献检索（供向导复用）——
async function crossrefSearch(query, rows = 8) {
  const n = Math.max(1, Math.min(20, parseInt(rows, 10) || 8));
  const params = new URLSearchParams({
    query: String(query).trim(),
    rows: String(n),
    select: 'DOI,title,author,issued,container-title,abstract,URL,type,score,is-referenced-by-count',
    'mailto': 'ai-scientist-hub@example.org',
  });
  const url = `https://api.crossref.org/works?${params.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'AI-Scientist-Hub/3.0 (mailto:ai-scientist-hub@example.org)' }, signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) return [];
    const data = await resp.json();
    const items = data?.message?.items || [];
    const maxScore = items.reduce((m, it) => Math.max(m, Number(it.score) || 0), 0) || 1;
    return items.filter(it => it && it.DOI).map((it, idx) => {
      const year = it.issued?.['date-parts']?.[0]?.[0] || 0;
      const rawScore = Number(it.score) || 0;
      const relevance = rawScore > 0 ? Math.round((rawScore / maxScore) * 100) / 100 : Math.round((1 - idx / Math.max(items.length, 1)) * 100) / 100;
      const authors = (it.author || []).map(a => a?.name ? String(a.name).trim() : [a?.family, a?.given].filter(Boolean).join(' ')).filter(Boolean).slice(0, 8);
      return {
        id: `cr-${idx + 1}-${it.DOI.replace(/[^a-z0-9]+/gi, '_').slice(0, 24)}`,
        title: stripJats((it.title || [])[0]) || '(无标题)',
        authors, year,
        journal: stripJats((it['container-title'] || [])[0]) || (it.type ? String(it.type) : ''),
        doi: it.DOI, url: `https://doi.org/${it.DOI}`,
        abstract: stripJats(it.abstract || '').slice(0, 1200),
        relevance, citations: it['is-referenced-by-count'] || 0, keywords: [], source: 'Crossref',
      };
    });
  } catch (e) {
    clearTimeout(timer);
    console.error('[crossrefSearch]', e.message);
    return [];
  }
}

const STAGE_ORDER = ['question', 'literature', 'hypothesis', 'experiment', 'evaluation', 'paper'];
function nextStageOf(stage) {
  const i = STAGE_ORDER.indexOf(stage);
  return i >= 0 && i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1] : null;
}
const STAGE_CN = { question: '问题理解', literature: '文献综述', hypothesis: '假设生成', experiment: '实验设计', evaluation: '评估迭代', paper: '论文生成' };

function stageContextText(project) {
  const s = project.stages || {};
  const parts = [`科学问题：${project.question}`];
  if (project.domain) parts.push(`学科领域：${project.domain}`);
  if (s.question?.result?.analysis) parts.push(`【问题理解】\n${String(s.question.result.analysis).slice(0, 1500)}`);
  if (s.literature?.result) {
    const p = s.literature.result.papers || [];
    parts.push(`【文献综述】共 ${p.length} 篇真实文献（含DOI）：\n${p.slice(0, 10).map(x => `- ${x.title} (${x.year}) DOI:${x.doi}`).join('\n')}${s.literature.result.summary ? `\n综述：${String(s.literature.result.summary).slice(0, 1200)}` : ''}${(s.literature.result.gaps || []).length ? `\n知识缺口：${s.literature.result.gaps.map(g => g.description).join('；')}` : ''}`);
  }
  if (s.hypothesis?.result?.hypotheses) {
    parts.push(`【候选假设】\n${s.hypothesis.result.hypotheses.map((h, i) => `${i + 1}. ${h.title}（综合 ${h.scores?.overall ?? '-'}）\n   ${h.description || ''}${h.references?.length ? '\n   参考DOI: ' + h.references.join('; ') : ''}`).join('\n')}`);
  }
  if (s.experiment?.result) parts.push(`【实验方案】目标：${s.experiment.result.objective || ''}\n步骤：${(s.experiment.result.steps || []).map(x => x.name).join(' → ')}`);
  if (s.evaluation?.result) parts.push(`【评估迭代】综合评分：${s.evaluation.result.overallScore ?? '-'}\n优点：${(s.evaluation.result.strengths || []).join('；')}\n不足：${(s.evaluation.result.weaknesses || []).join('；')}`);
  // 历史决策链（供参考，最新决策由 latestDecisionDirective 单独突出）
  const dec = project.decisions || [];
  if (dec.length > 1) parts.push(`【历史决策链】\n${dec.slice(0, -1).map(d => `- ${STAGE_CN[d.stage] || d.stage}: ${d.selectedLabel || ''}${d.customText ? ' | 补充：' + d.customText : ''}`).join('\n')}`);
  return parts.join('\n\n');
}

/** 从最近一次研究者决策生成醒目的指令块，放在 user message 最前面 */
function latestDecisionDirective(project) {
  const dec = project.decisions || [];
  if (!dec.length) return '';
  const last = dec[dec.length - 1];
  const stageName = STAGE_CN[last.stage] || last.stage;
  const lines = ['═══════════════════════════════════════'];
  lines.push('⚠ 研究者指令（必须严格遵循，优先级最高）');
  lines.push('═══════════════════════════════════════');
  if (last.selectedLabel) lines.push(`▶ 选定方向：${last.selectedLabel}`);
  // 找到该选项的 description 作为补充
  const prevStage = project.stages?.[last.stage];
  const matchedOpt = (prevStage?.options || []).find(o => o.id === last.selectedOptionId);
  if (matchedOpt?.description) lines.push(`▶ 方向说明：${matchedOpt.description}`);
  if (last.customText) lines.push(`▶ 研究者补充要求：${last.customText}`);
  lines.push('');
  lines.push('↑↑↑ 请你在本阶段的输出中充分体现上述研究者选择，将其作为核心约束。↑↑↑');
  return lines.join('\n');
}

function literatureListForPrompt(papers) {
  return papers.slice(0, 12).map((p, i) => `${i + 1}. [id=${p.id}] ${p.title} | ${(p.authors || []).slice(0, 3).join(', ')} | ${p.year} | ${p.journal} | DOI: ${p.doi}${p.abstract ? ' | 摘要: ' + p.abstract.slice(0, 220) : ''}`).join('\n');
}

const JSON_ONLY = '只输出一个合法的 JSON 对象，不要输出任何解释性文字或 Markdown 代码围栏，数值字段必须是数字。';
const DECISION_RULE = '重要：用户消息中会出现「 研究者指令」区块，这是研究者在上一阶段结束时作出的选择与补充要求。你必须将其作为最高优先级约束，在本阶段的全部输出中严格体现和遵循该选择。如果研究者指定了方向，你的假设/方案/评估必须围绕该方向展开，不得忽略或偏离。';

// 各阶段特定的选项生成规则（options 字段应反映本阶段的核心决策点）
const STAGE_OPTION_RULES = {
  question: 'options：2-4 个研究切入点或角度，每项 {"id":字符串,"label":研究角度标题,"description":一句话说明该角度的侧重点}。例如：["理论机制分析","实证检验","政策建议","跨学科视角"]。',
  literature: 'options：2-4 个文献综述的深化方向，每项 {"id":字符串,"label":方向标题,"description":一句话说明}。应基于已识别的知识缺口提出，例如：["聚焦某细分领域","补充某方法论文献","拓展跨学科文献","追踪最新进展"]。',
  hypothesis: 'options：必须基于已生成的 3 个假设提出选择建议，每项 {"id":字符串,"label":假设选择或组合,"description":一句话说明理由}。例如：["选择 H1（最具创新性）","选择 H2（最可验证）","H1+H2 组合","进一步细化 H3"]。',
  experiment: 'options：2-4 个实验设计的调整方向，每项 {"id":字符串,"label":调整方向,"description":一句话说明}。例如：["简化实验流程","增加对照组","扩大样本量","调整测量指标"]。',
  evaluation: 'options：2-4 个评估后的修正方向，每项 {"id":字符串,"label":修正方向,"description":一句话说明}。例如：["加强理论基础","改进验证方法","补充数据来源","调整研究范围"]。',
  paper: 'options：2-4 个论文修改方向，每项 {"id":字符串,"label":修改方向,"description":一句话说明}。例如：["强化引言部分","补充讨论章节","优化图表呈现","精简篇幅"]。',
};

const ADVICE_RULES = '同时在 JSON 顶层附加两个字段：advice（字符串，Markdown，面向研究者的本步小结与下一步建议，2-4句）；options（数组，2-4 个本阶段的核心决策选项，具体格式见下方各阶段规则）。';

// 期刊写作格式模板（嵌入论文生成 prompt）
const JOURNAL_FORMATS = {
  cssci: {
    name: 'CSSCI（中文社科核心）',
    desc: '适用于《图书情报工作》《管理世界》《中国社会科学》等CSSCI来源期刊',
    rules: `【CSSCI格式规范】
结构：标题→结构化摘要（目的/方法/结果/结论，200-300字）→关键词（3-5个）→正文（引言→文献综述→理论框架与研究假设→研究设计→实证分析→结论与讨论）→参考文献
摘要：必须结构化，分"目的""方法""结果""结论"四部分，各部分1-2句
正文：一级标题用"1""2"…，二级用"1.1""1.2"…；表格用三线表（顶线、栏目线、底线）；图用清晰标注
引用：顺序编码制，正文用上标数字[1][2]标注，参考文献按出现顺序排列
参考文献格式：GB/T 7714-2015，如：[1] 作者. 题名[J]. 刊名, 年, 卷(期): 起止页码.
篇幅：正文一般8000-15000字，参考文献≥20条`,
  },
  apa7: {
    name: 'APA 7th（心理学/教育学/社科国际）',
    desc: '适用于American Psychological Association系列期刊及多数国际社科期刊',
    rules: `【APA第7版格式规范】
结构：Title Page→Abstract（150-250字，单段非结构化）→Keywords→Body（Introduction→Method→Results→Discussion）→References
Method子节：Participants / Materials / Procedure / Design（按研究类型调整）
Results：报告效应量(Cohen's d, η²)、置信区间、精确p值（如p = .032而非p < .05）
引用：正文用(Author, Year)或Author (Year)格式；3+作者首次即用et al.
参考文献：Author-Date制，按字母排序，DOI格式为https://doi.org/xxxxx
表格：APA格式（顶线、表头下线、底线，无竖线）；图用高分辨率`,
  },
  ieee: {
    name: 'IEEE（工程/计算机/信息技术）',
    desc: '适用于IEEE Transactions系列及工程类国际期刊',
    rules: `【IEEE格式规范】
结构：Title→Abstract（150-250词）→Index Terms→I. Introduction→II. Related Work→III. Methodology→IV. Experiments and Results→V. Discussion→VI. Conclusion→References
引用：编号制，正文用方括号[1][2]标注，参考文献按出现顺序编号
参考文献格式：[1] A. B. Author, "Title of paper," in Abbrev. Title of Conf., City of Conf., Abbrev. State, Country, year, pp. xxx-xxx. doi: xxx
公式：居中编号，右端括号编号如(1)(2)
算法：用algorithm环境，含caption、输入输出、步骤
图表：图在正文首次提及后尽量靠近；表用三线式`,
  },
  nature: {
    name: 'Nature/Science（顶刊通用格式）',
    desc: '适用于Nature/Science/Cell等顶刊及其子刊的写作风格',
    rules: `【Nature/Science格式规范】
结构：Title→Abstract/Introduction（合并，首段宽背景→逐步聚焦到具体问题）→Results→Methods（放正文后部或Supplementary）→Discussion→Data Availability→Code Availability→References
摘要：首句用加粗标题"Article"或"Letter"后跟冒号，然后1-2段
标题：简洁有力，≤20词，避免缩写
引用：Author-Date制，(Author et al., Year)
参考文献：编号期刊名缩写（如Nature, Science, Proc. Natl Acad. Sci. USA）
数据/代码：必须声明数据和代码的可用性，提供存储库链接
图表：高质量彩色图，建议矢量格式；每个图有详细图注`,
  },
};

// 为某一阶段构造 messages
function buildStageMessages(stage, project, papers, journalFormat, extraReferences) {
  const ctx = stageContextText(project);
  const directive = latestDecisionDirective(project);
  // 有决策时，user message 以指令块开头
  const directivePrefix = directive ? directive + '\n\n' : '';

  if (stage === 'question') {
    return {
      modelKey: 'general', temperature: 0.5,
      messages: [
        { role: 'system', content: '你是"问题理解"智能体。对研究者提出的科学问题进行深入、结构化的多维度分析。你需要从多个维度全面评估该问题，并给出具体示例帮助研究者理解每个维度的含义。' + JSON_ONLY + '输出结构：{"analysis"(Markdown字符串，≥300字的问题深度解析与推荐研究路径，需引用该领域的关键概念、经典理论和代表性学者),"entities"[实体字符串数组，每个实体用"名称(类型)"格式，类型包括：概念/机制/方法/场景/变量，如"ESG信息披露(概念)","逆向选择(机制)","双重差分法(方法)"],"classification"(学科分类字符串，精确到二级学科，如"管理学·供应链管理"或"计算机科学·自然语言处理"),"similarTopics"[{"topic":相似研究主题,"reference":代表性文献或学者,"year":年份}]（2-4个，帮助研究者了解相关研究方向）,"feasibility":{"dataAvailability","methodMaturity","innovationSpace","applicationValue"}(各为0-100的数字。数据可得性：公开数据集/数据库的可获得性，如CSMAR/Wind/公开问卷等；方法成熟度：该领域已有研究方法的完善程度；创新空间：尚未被充分探索的方面；应用价值：研究成果对实践的指导意义),' + '"advice","options"}。' + ADVICE_RULES + STAGE_OPTION_RULES.question },
        { role: 'user', content: `科学问题：${project.question}${project.domain ? '\n学科领域：' + project.domain : ''}` },
      ],
    };
  }
  if (stage === 'literature') {
    return {
      modelKey: 'general', temperature: 0.4,
      messages: [
        { role: 'system', content: '你是"文献整合者"智能体。下面提供来自 Crossref 的真实文献（含真实 DOI），请仅基于这些真实文献提炼证据、识别知识缺口并撰写综述，禁止编造未出现的文献或 DOI。' + JSON_ONLY + '输出结构：{"evidence":[{"id","claim","supportingPapers"[文献id数组],"confidence"(0-1数字),"source"}],"gaps":[{"id","description","severity"("high"|"medium"|"low"),"relatedPapers"[文献id数组],"suggestion"}],"summary"(Markdown综述),' + '"advice","options"}。' + ADVICE_RULES + STAGE_OPTION_RULES.literature },
        { role: 'user', content: `${directivePrefix}科学问题：${project.question}\n\n真实文献列表（含DOI）：\n${literatureListForPrompt(papers || [])}` },
      ],
    };
  }
  if (stage === 'hypothesis') {
    const papers = project.stages?.literature?.result?.papers || [];
    const litCtx = papers.length ? `\n\n可引用的真实文献（含DOI，请在 references 中引用其 DOI，不得编造）：\n${literatureListForPrompt(papers)}` : '';
    return {
      modelKey: 'reasoning', temperature: 0.8,
      messages: [
        { role: 'system', content: '你是"假设生成器"智能体。基于科学问题、文献证据与研究者的选择，生成 3 个候选科学假设。' + DECISION_RULE + JSON_ONLY + '输出结构：{"hypotheses":[{"id","title","description","rationale","scores":{"innovation","verifiability","theoretical","dataSupport","practicality","overall"}(每项0-5数字),"validation":{"method","datasets"[数组],"expectedResults","timeline"},"risks"[数组],"references"[数组，每项只填该文献的 DOI 字符串本身（形如 10.1234/xxxx），严禁填写 id 编号如 cr-1-...，不得编造],"version":1,"status":"draft"}],"recommendations"[数组],' + '"advice","options"}。' + ADVICE_RULES + STAGE_OPTION_RULES.hypothesis },
        { role: 'user', content: `${directivePrefix}${ctx}${litCtx}` },
      ],
    };
  }
  if (stage === 'experiment') {
    return {
      modelKey: 'coding', temperature: 0.3,
      messages: [
        { role: 'system', content: '你是"实验规划师"智能体。针对综合评分最高（或研究者选定）的假设设计完整验证实验。' + DECISION_RULE + JSON_ONLY + '输出结构：{"objective","variables":[{"type"("independent"|"dependent"|"control"),"name","definition","range"}],"steps":[{"order"(数字),"name","description","duration","deliverable"}],"code"(可运行Python框架字符串，用\\n换行),"gantt":[{"id","name","start"(天,数字),"duration"(天,数字),"dependencies"[数组]}],"resources":{"compute","storage","time","cost"},"risks":[{"risk","probability"("low"|"medium"|"high"),"impact"("low"|"medium"|"high"),"mitigation"}],' + '"advice","options"}。' + ADVICE_RULES + STAGE_OPTION_RULES.experiment },
        { role: 'user', content: `${directivePrefix}${ctx}` },
      ],
    };
  }
  if (stage === 'evaluation') {
    return {
      modelKey: 'reasoning', temperature: 0.5,
      messages: [
        { role: 'system', content: '你是"评估验证官"智能体。评估候选假设质量、检测认知偏差、寻找反例并提出修正建议。' + DECISION_RULE + JSON_ONLY + '输出结构：{"scores":[{"dimension","score"(0-5数字),"maxScore":5,"rationale"}](覆盖 创新性/可验证性/理论基础/数据支持/实用性),"overallScore"(0-5数字),"strengths"[],"weaknesses":[],"suggestions":[],"counterExamples":[],"biasCheck":{"confirmationBias":{"level","description"},"availabilityBias":{"level","description"},"anchoringBias":{"level","description"},"overallRisk"("low"|"medium"|"high")},' + '"advice","options"}。' + ADVICE_RULES + STAGE_OPTION_RULES.evaluation },
        { role: 'user', content: `${directivePrefix}${ctx}` },
      ],
    };
  }
  if (stage === 'paper') {
    const fmt = JOURNAL_FORMATS[journalFormat] || JOURNAL_FORMATS.cssci;
    const extraRefs = (extraReferences || []).length
      ? `\n\n研究者额外指定的参考文献（必须引用）：\n${extraReferences.map((r, i) => `${i + 1}. ${r.title} | ${r.authors || ''} | ${r.year || ''} | DOI: ${r.doi || '无'}`).join('\n')}`
      : '';
    return {
      modelKey: 'reasoning', temperature: 0.6, max_tokens: 8000,
      messages: [
        { role: 'system', content: `你是资深学术论文撰写智能体，拥有丰富的高水平期刊发表经验。基于整个研究流程的真实产出，撰写一篇结构完整、论证严密、格式规范的学术论文。

${fmt.rules}

【论文质量要求——必须严格遵守】
1. 结构完整：严格遵循所选期刊格式的IMRaD结构（Introduction-Methods-Results-and-Discussion），每个章节内容充实
2. 摘要规范：按格式要求撰写（结构化或非结构化），摘要须包含研究目的、方法、主要发现和结论
3. 引言写法：采用"倒三角"结构——从宏观研究背景逐步聚焦到具体研究问题，明确阐述研究空白(gap)和本研究的创新点(contribution)
4. 文献综述：批判性分析而非简单罗列，按主题/流派/时间线组织，明确指出已有研究的不足和本研究的定位
5. 理论框架：清晰阐述理论基础（如信号理论、委托代理理论、资源基础观等），画出概念模型或提出分析框架
6. 研究假设：每个假设有充分的理论推演过程，明确自变量、因变量、调节/中介变量的关系和方向
7. 研究设计：详细描述数据来源（具体数据库名称、时间跨度）、样本选择标准、变量定义与测量方式、模型设定
8. 结果分析：包含描述性统计、相关性分析、主回归/主实验结果、稳健性检验（至少2种方法）、异质性分析
9. 讨论深入：将发现与文献对比（支持/矛盾），阐述理论贡献和实践启示，明确指出局限性并提出未来研究方向
10. 深度引用：正文中必须频繁引用真实文献（全文至少20处引用），每个重要论断都需文献支撑
11. 数据真实：所有引用的文献必须来自前面研究步骤中的真实DOI，严禁编造任何文献或DOI
12. 图表丰富：至少包含2个表格（如变量定义表、描述性统计表、回归结果表）和1个图（如研究框架图、趋势图）
13. 语言规范：使用学术化书面语，避免口语化表达，段落之间逻辑连贯，每段首句为该段主题句
14. 篇幅充实：正文不少于6000字（不含参考文献），每个主要章节至少500字` + JSON_ONLY + '输出结构：{"title"(论文标题字符串，简洁有力),"markdown"(完整论文Markdown字符串，严格遵循上述格式和质量要求),"figures"[数组，每个元素为论文中应包含的图表规范：{"type"("bar"|"line"|"scatter"|"pie"|"heatmap"),"title"(图表标题),"description"(图表说明),"data"({"labels"[字符串数组],"datasets"[{"label"(系列名),"data"[数字数组]}]}),"xLabel","yLabel"}]（至少3个图表规范，覆盖研究框架、数据分布、主要结果）,' + '"advice","options"}。' + ADVICE_RULES + STAGE_OPTION_RULES.paper },
        { role: 'user', content: `${directivePrefix}${ctx}\n\n所选期刊格式：${fmt.name}\n\n真实文献（含DOI，必须在论文中引用）：\n${literatureListForPrompt((project.stages?.literature?.result?.papers || papers || []).slice(0, 15))}${extraRefs}\n\n请严格按照上述格式规范和质量要求撰写完整学术论文。` },
      ],
    };
  }
  return { modelKey: 'general', temperature: 0.7, messages: [{ role: 'user', content: ctx }] };
}

// —— Projects CRUD（磁盘持久化）——
app.get('/api/research/projects', authMiddleware, (req, res) => {
  const list = Array.from(storage.projects.values())
    .filter(p => p.userId === req.userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map(p => ({
      id: p.id, title: p.title, domain: p.domain, question: p.question, status: p.status,
      currentStage: p.currentStage, createdAt: p.createdAt, updatedAt: p.updatedAt,
      completedStages: STAGE_ORDER.filter(s => p.stages?.[s]?.status === 'completed'),
      hasPaper: !!p.stages?.paper?.result?.markdown,
    }));
  res.json(list);
});

app.post('/api/research/projects', authMiddleware, (req, res) => {
  const { title, domain = '', question, depth = 'standard' } = req.body || {};
  if (!question || !String(question).trim()) return res.status(400).json({ error: '科学问题不能为空' });
  const now = new Date().toISOString();
  const id = uuidv4();
  const project = {
    id, userId: req.userId,
    title: (title && String(title).trim()) || String(question).slice(0, 30),
    domain, question: String(question).trim(), depth,
    status: 'active', currentStage: 'question',
    stages: Object.fromEntries(STAGE_ORDER.map(s => [s, { status: 'pending', result: null, advice: '', options: [] }])),
    decisions: [], createdAt: now, updatedAt: now,
  };
  storage.projects.set(id, project);
  saveProjectsToDisk();
  res.status(201).json(project);
});

app.get('/api/research/projects/:id', authMiddleware, (req, res) => {
  const p = storage.projects.get(req.params.id);
  if (!p) return res.status(404).json({ error: '项目不存在' });
  if (p.userId !== req.userId) return res.status(403).json({ error: '无权访问' });
  res.json(p);
});

app.put('/api/research/projects/:id', authMiddleware, (req, res) => {
  const p = storage.projects.get(req.params.id);
  if (!p) return res.status(404).json({ error: '项目不存在' });
  if (p.userId !== req.userId) return res.status(403).json({ error: '无权访问' });
  const { title, domain, status, decision } = req.body || {};
  if (title != null) p.title = String(title);
  if (domain != null) p.domain = String(domain);
  if (status != null) p.status = String(status);
  if (decision && decision.stage) p.decisions.push({ ...decision, at: new Date().toISOString() });
  p.updatedAt = new Date().toISOString();
  saveProjectsToDisk();
  res.json(p);
});

app.delete('/api/research/projects/:id', authMiddleware, (req, res) => {
  const p = storage.projects.get(req.params.id);
  if (!p) return res.status(404).json({ error: '项目不存在' });
  if (p.userId !== req.userId) return res.status(403).json({ error: '无权访问' });
  storage.projects.delete(req.params.id);
  saveProjectsToDisk();
  res.json({ message: '已删除' });
});

// —— 向导：运行单个阶段，返回结构化结果 + 建议 + 选项，并写入项目 ——
app.post('/api/research/wizard/step', authMiddleware, async (req, res) => {
  const { projectId, stage, decision, regenerate, journalFormat, extraReferences } = req.body || {};
  const project = storage.projects.get(projectId);
  if (!project) return res.status(404).json({ error: '项目不存在，请先创建项目' });
  if (project.userId !== req.userId) return res.status(403).json({ error: '无权访问' });
  if (!STAGE_ORDER.includes(stage)) return res.status(400).json({ error: '未知阶段: ' + stage });

  if (decision && decision.stage) project.decisions.push({ ...decision, at: new Date().toISOString() });
  project.stages[stage] = project.stages[stage] || { status: 'pending', result: null, advice: '', options: [] };
  project.stages[stage].status = 'running';
  // regenerate 模式：保持 currentStage 不变，不推进
  if (!regenerate) project.currentStage = stage;

  try {
    let papers = null;
    if (stage === 'literature') {
      papers = await crossrefSearch(project.question, 8);
    }
    const spec = buildStageMessages(stage, project, papers, journalFormat, extraReferences);
    const { text, mock } = await callBailian(spec.modelKey, spec.messages, { temperature: spec.temperature, max_tokens: spec.max_tokens || 6000 });
    const parsed = safeParseServer(text) || {};

    let result;
    if (stage === 'question') {
      result = { analysis: parsed.analysis || text, entities: parsed.entities || [], classification: parsed.classification || '', feasibility: parsed.feasibility || {} };
    } else if (stage === 'literature') {
      result = { papers: papers || [], evidence: parsed.evidence || [], gaps: parsed.gaps || [], summary: parsed.summary || (papers?.length ? '' : '未检索到真实文献（可能网络受限），请检查网络或改用英文检索式。') };
    } else if (stage === 'hypothesis') {
      const hyps = (parsed.hypotheses || []).map((h, i) => ({ ...h, id: h.id || `hyp-${i + 1}`, sourceQuestion: project.question, sourceStage: 'hypothesis', generatedAt: new Date().toISOString() }));
      result = { hypotheses: hyps, recommendations: parsed.recommendations || [], comparison: null };
    } else if (stage === 'paper') {
      result = { title: parsed.title || project.title, markdown: parsed.markdown || text, figures: Array.isArray(parsed.figures) ? parsed.figures : [] };
    } else {
      result = parsed; // experiment / evaluation 直接存解析后的结构化对象
    }

    project.stages[stage] = {
      status: 'completed', result,
      advice: parsed.advice || '', options: Array.isArray(parsed.options) ? parsed.options : [],
      updatedAt: new Date().toISOString(), mock: !!mock,
      // 记录重新生成次数，方便前端展示
      rerunCount: (project.stages[stage]?.rerunCount || 0) + (regenerate ? 1 : 0),
    };
    // 非 regenerate 模式才推进到下一阶段
    if (!regenerate) {
      const next = nextStageOf(stage);
      project.currentStage = next || 'paper';
      if (stage === 'paper') project.status = 'completed';
    }
    project.updatedAt = new Date().toISOString();
    saveProjectsToDisk();

    res.json({
      success: true, projectId, stage, result,
      advice: project.stages[stage].advice,
      options: project.stages[stage].options,
      nextStage: nextStageOf(stage),
      mock: !!mock,
      regenerated: !!regenerate,
      rerunCount: project.stages[stage].rerunCount || 0,
    });
  } catch (e) {
    project.stages[stage].status = 'failed';
    project.stages[stage].error = e.message;
    saveProjectsToDisk();
    console.error('[wizard/step]', stage, e.message);
    res.status(500).json({ error: e.message, stage });
  }
});

// —— 论文导出为 Word (.docx) ——
async function markdownToDocxBuffer(markdown, fallbackTitle) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
  const lines = String(markdown || '').split(/\r?\n/);
  const children = [];
  const inlineRuns = (text) => {
    const runs = [];
    const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
    for (const part of parts) {
      if (!part) continue;
      if (/^\*\*[^*]+\*\*$/.test(part)) runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
      else runs.push(new TextRun({ text: part.replace(/`/g, '') }));
    }
    return runs.length ? runs : [new TextRun({ text: String(text) })];
  };
  let firstHeadingDone = false;
  for (let raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const txt = h[2].replace(/\*\*/g, '');
      if (level === 1 && !firstHeadingDone) {
        firstHeadingDone = true;
        children.push(new Paragraph({ text: txt, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 240 } }));
      } else {
        const map = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_1, 3: HeadingLevel.HEADING_2, 4: HeadingLevel.HEADING_3, 5: HeadingLevel.HEADING_4, 6: HeadingLevel.HEADING_5 };
        children.push(new Paragraph({ text: txt, heading: map[level] || HeadingLevel.HEADING_3, spacing: { before: 160, after: 80 } }));
      }
      continue;
    }
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) { children.push(new Paragraph({ children: inlineRuns(bullet[1]), bullet: { level: 0 } })); continue; }
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (numbered) { children.push(new Paragraph({ children: inlineRuns(numbered[1]) })); continue; }
    children.push(new Paragraph({ children: inlineRuns(line), spacing: { after: 120 } }));
  }
  if (!children.length) children.push(new Paragraph({ text: fallbackTitle || '（空文档）' }));
  const doc = new Document({ sections: [{ properties: {}, children }] });
  return await Packer.toBuffer(doc);
}

app.post('/api/research/paper/export-docx', authMiddleware, async (req, res) => {
  const { projectId, markdown, title } = req.body || {};
  let md = markdown, docTitle = title;
  if (projectId) {
    const p = storage.projects.get(projectId);
    if (!p) return res.status(404).json({ error: '项目不存在' });
    if (p.userId !== req.userId) return res.status(403).json({ error: '无权访问' });
    md = md || p.stages?.paper?.result?.markdown;
    docTitle = docTitle || p.stages?.paper?.result?.title || p.title;
  }
  if (!md || !String(md).trim()) return res.status(400).json({ error: '没有可导出的论文内容，请先生成论文' });
  try {
    ensureDir(OUTPUT_DIR);
    const buf = await markdownToDocxBuffer(md, docTitle);
    const safe = String(docTitle || 'research-paper').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
    const filename = `${safe}.docx`;
    const full = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(full, buf);
    res.json({ success: true, filename, path: full, size: buf.length });
  } catch (e) {
    console.error('[export-docx]', e.message);
    res.status(500).json({ error: 'Word 导出失败: ' + e.message });
  }
});

// —— 参考文献检索（Crossref + OpenAlex 双源）——
app.post('/api/research/paper/search', authMiddleware, async (req, res) => {
  const { query, limit = 10, fromYear, source = 'crossref' } = req.body || {};
  if (!query || !String(query).trim()) return res.status(400).json({ error: '请输入检索关键词' });
  try {
    let papers = [];
    // Crossref
    if (source === 'crossref' || source === 'all') {
      const params = new URLSearchParams({ query: query.trim(), rows: String(Math.min(limit, 20)), select: 'DOI,title,author,published-print,container-title,abstract,is-referenced-by-count' });
      if (fromYear) params.set('filter', `from-pub-year:${fromYear}`);
      const r = await fetch(`https://api.crossref.org/works?${params}`, { headers: { 'User-Agent': 'AI-Scientist-Hub/1.0 (mailto:research@local)' } });
      if (r.ok) {
        const d = await r.json();
        const items = d.message?.items || [];
        papers.push(...items.map((item, i) => ({
          id: `cr-${Date.now()}-${i}`,
          title: (item.title || [''])[0] || '',
          authors: (item.author || []).map(a => `${a.given || ''} ${a.family || ''}`.trim()).filter(Boolean),
          year: item['published-print']?.['date-parts']?.[0]?.[0] || null,
          journal: (item['container-title'] || [''])[0] || '',
          doi: item.DOI || '',
          abstract: item.abstract ? item.abstract.replace(/<[^>]+>/g, '').slice(0, 500) : '',
          citations: item['is-referenced-by-count'] || 0,
          source: 'Crossref',
        })));
      }
    }
    // OpenAlex (free, no auth needed)
    if (source === 'openalex' || source === 'all') {
      const r2 = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(query.trim())}&per_page=${Math.min(limit, 20)}&mailto=research@local`, { headers: { 'User-Agent': 'AI-Scientist-Hub/1.0' } });
      if (r2.ok) {
        const d2 = await r2.json();
        const results = d2.results || [];
        papers.push(...results.map((w, i) => ({
          id: `oa-${Date.now()}-${i}`,
          title: w.title || '',
          authors: (w.authorships || []).map(a => a.author?.display_name).filter(Boolean).slice(0, 5),
          year: w.publication_year || null,
          journal: w.primary_location?.source?.display_name || '',
          doi: (w.doi || '').replace('https://doi.org/', ''),
          abstract: '',
          citations: w.cited_by_count || 0,
          source: 'OpenAlex',
        })));
      }
    }
    // 按引用数排序
    papers.sort((a, b) => (b.citations || 0) - (a.citations || 0));
    res.json({ success: true, papers: papers.slice(0, limit), total: papers.length, source });
  } catch (e) {
    console.error('[paper/search]', e.message);
    res.status(500).json({ error: '检索失败: ' + e.message });
  }
});

// —— 期刊格式列表 ——
app.get('/api/research/journal-formats', authMiddleware, (req, res) => {
  const list = Object.entries(JOURNAL_FORMATS).map(([key, fmt]) => ({
    id: key, name: fmt.name, description: fmt.desc,
  }));
  res.json(list);
});

// ============================================================
// Settings（推理引擎配置 / 连接测试 / 用户偏好）
// ============================================================
const preferencesStore = new Map(); // username -> { theme, preferred_model, research_interests }

function maskKey(key) {
  if (!key) return '';
  if (key.length <= 12) return key.slice(0, 3) + '****';
  return `${key.slice(0, 6)}${'*'.repeat(8)}${key.slice(-4)}`;
}

// 将配置写回项目根 .env（备份 + 原子替换）
function writeEnvFile(updates) {
  const allowed = ['BAILIAN_API_KEY', 'DASHSCOPE_API_KEY', 'BAILIAN_BASE_URL',
    'BAILIAN_MODEL_REASONING', 'BAILIAN_MODEL_GENERAL', 'BAILIAN_MODEL_CODING'];
  const entries = Object.entries(updates).filter(([k, v]) => allowed.includes(k) && v != null);
  if (entries.length === 0) return null;

  let lines = [];
  if (fs.existsSync(ENV_PATH)) {
    // 备份到工作区
    try {
      const backupDir = path.join(require('os').homedir(), '.qoderworkcn', 'workspace');
      fs.mkdirSync(backupDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      fs.copyFileSync(ENV_PATH, path.join(backupDir, `.env.electron.backup_${ts}`));
    } catch (e) {
      console.warn('[env] 备份失败（继续写入）:', e.message);
    }
    lines = fs.readFileSync(ENV_PATH, 'utf-8').split(/\r?\n/);
  } else {
    lines = ['# AI-Scientist Hub (Electron桌面版) 环境配置（由设置页生成）'];
  }

  const remaining = new Map(entries);
  const out = lines.map((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (m && remaining.has(m[1])) {
      const v = remaining.get(m[1]);
      remaining.delete(m[1]);
      return `${m[1]}=${v}`;
    }
    return line;
  });
  if (remaining.size) {
    if (out.length && out[out.length - 1].trim() !== '') out.push('');
    out.push('# ─── 由设置页更新 ───');
    for (const [k, v] of remaining) out.push(`${k}=${v}`);
  }

  const tmp = ENV_PATH + '.tmp';
  fs.writeFileSync(tmp, out.join('\n'), 'utf-8');
  fs.renameSync(tmp, ENV_PATH); // 原子替换
  console.log('[env] .env 已更新:', entries.map(([k]) => k).join(', '));
  return ENV_PATH;
}

app.get('/api/settings/config', authMiddleware, (_req, res) => {
  res.json({
    success: true,
    config: {
      provider: 'bailian',
      api_key_masked: maskKey(BAILIAN_CONFIG.apiKey),
      api_key_set: !!BAILIAN_CONFIG.apiKey,
      base_url: BAILIAN_CONFIG.baseURL,
      model_reasoning: BAILIAN_CONFIG.models.reasoning,
      model_general: BAILIAN_CONFIG.models.general,
      model_coding: BAILIAN_CONFIG.models.coding,
      env_file: ENV_PATH,
    },
    mode: BAILIAN_CONFIG.apiKey ? 'live' : 'mock',
    version: '3.0.0',
  });
});

app.put('/api/settings/config', authMiddleware, (req, res) => {
  const { api_key, model_reasoning, model_general, model_coding, base_url } = req.body || {};
  const envUpdates = {};

  if (api_key && typeof api_key === 'string') {
    BAILIAN_CONFIG.apiKey = api_key.trim();      // 热生效
    process.env.BAILIAN_API_KEY = BAILIAN_CONFIG.apiKey;
    process.env.DASHSCOPE_API_KEY = BAILIAN_CONFIG.apiKey;
    envUpdates.BAILIAN_API_KEY = BAILIAN_CONFIG.apiKey;
    envUpdates.DASHSCOPE_API_KEY = BAILIAN_CONFIG.apiKey;
  }
  if (model_reasoning) { BAILIAN_CONFIG.models.reasoning = model_reasoning; process.env.BAILIAN_MODEL_REASONING = model_reasoning; envUpdates.BAILIAN_MODEL_REASONING = model_reasoning; }
  if (model_general) { BAILIAN_CONFIG.models.general = model_general; process.env.BAILIAN_MODEL_GENERAL = model_general; envUpdates.BAILIAN_MODEL_GENERAL = model_general; }
  if (model_coding) { BAILIAN_CONFIG.models.coding = model_coding; process.env.BAILIAN_MODEL_CODING = model_coding; envUpdates.BAILIAN_MODEL_CODING = model_coding; }
  if (base_url) { BAILIAN_CONFIG.baseURL = base_url; process.env.BAILIAN_BASE_URL = base_url; envUpdates.BAILIAN_BASE_URL = base_url; }

  const envPath = writeEnvFile(envUpdates);
  res.json({
    success: true,
    message: '配置已保存并热生效',
    updated_keys: Object.keys(envUpdates),
    env_file: envPath,
    mode: BAILIAN_CONFIG.apiKey ? 'live' : 'mock',
    api_key_masked: maskKey(BAILIAN_CONFIG.apiKey),
  });
});

app.post('/api/settings/test-connection', authMiddleware, async (req, res) => {
  const { api_key, base_url } = req.body || {};
  const key = (api_key && api_key.trim()) || BAILIAN_CONFIG.apiKey;
  const url = base_url || BAILIAN_CONFIG.baseURL;
  const model = BAILIAN_CONFIG.models.general;

  if (!key) {
    return res.json({ success: false, status: 'error', provider: 'bailian', error: '未配置 API Key，当前为 Mock 模式' });
  }
  const t0 = Date.now();
  try {
    const response = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: '请回复两个字：就绪' }], temperature: 0.1, max_tokens: 16, stream: false }),
    });
    const latency = Date.now() - t0;
    if (!response.ok) {
      const text = await response.text();
      return res.json({ success: false, status: 'error', provider: 'bailian', model, latency_ms: latency, error: `HTTP ${response.status}: ${text.slice(0, 200)}` });
    }
    const result = await response.json();
    const sample = (result?.choices?.[0]?.message?.content || '').trim().slice(0, 60);
    res.json({ success: true, status: 'healthy', provider: 'bailian', model: result?.model || model, latency_ms: latency, sample_reply: sample });
  } catch (err) {
    res.json({ success: false, status: 'error', provider: 'bailian', model, latency_ms: Date.now() - t0, error: String(err.message || err).slice(0, 300) });
  }
});

app.get('/api/settings/preferences', authMiddleware, (req, res) => {
  const p = preferencesStore.get(req.username) || { theme: 'dark', preferred_model: 'qwen-plus', research_interests: '' };
  res.json({ success: true, preferences: p });
});

app.put('/api/settings/preferences', authMiddleware, (req, res) => {
  const { theme, preferred_model, research_interests } = req.body || {};
  const cur = preferencesStore.get(req.username) || { theme: 'dark', preferred_model: 'qwen-plus', research_interests: '' };
  const next = {
    theme: theme != null ? theme : cur.theme,
    preferred_model: preferred_model != null ? preferred_model : cur.preferred_model,
    research_interests: research_interests != null ? research_interests : cur.research_interests,
  };
  preferencesStore.set(req.username, next);
  res.json({ success: true, message: '偏好已保存', preferences: next });
});

// ============================================================
// Health check
// ============================================================
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'AI-Scientist Hub Desktop',
    version: '3.0.0',
    port: APP_PORT,
    timestamp: new Date().toISOString(),
    bailianConfigured: !!BAILIAN_CONFIG.apiKey,
    mode: BAILIAN_CONFIG.apiKey ? 'live' : 'mock',
    models: { ...BAILIAN_CONFIG.models },
  });
});

// Serve frontend static files
app.use(express.static(FRONTEND_DIST));
app.get('*', (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Start server
const server = app.listen(APP_PORT, '127.0.0.1', () => {
  console.log(`\n============================================`);
  console.log(`  AI-Scientist Hub v3.0 已启动！`);
  console.log(`  访问地址: http://127.0.0.1:${APP_PORT}`);
  console.log(`  演示账号: admin / Admin@2026!`);
  console.log(`  推理模式: ${BAILIAN_CONFIG.apiKey ? 'live（百炼已配置）' : 'mock（未配置 BAILIAN_API_KEY）'}`);
  console.log(`============================================\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const newPort = APP_PORT + 1;
    console.log(`端口 ${APP_PORT} 已被占用，尝试端口 ${newPort}...`);
    app.listen(newPort, '127.0.0.1', () => {
      console.log(`AI-Scientist Hub 已启动在端口 ${newPort}`);
    });
  }
});

module.exports = { app, server };
