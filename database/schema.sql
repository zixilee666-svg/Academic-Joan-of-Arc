-- ═══════════════════════════════════════════════════════════════
-- AI-Scientist Hub — SQLite 数据库 Schema
-- 全内嵌架构：单一SQLite文件存储全部数据
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. 用户表 ───
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    avatar TEXT,
    research_field TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── 2. 研究会话表 ───
CREATE TABLE IF NOT EXISTS research_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    question TEXT NOT NULL,
    domain TEXT DEFAULT 'astronomy',
    status TEXT CHECK(status IN ('pending','running','paused','completed','archived')) DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    current_agent TEXT,
    final_report TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── 3. 文献表（支持预填充和用户上传）───
CREATE TABLE IF NOT EXISTS literature (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    arxiv_id TEXT,
    doi TEXT,
    title TEXT NOT NULL,
    authors TEXT,
    abstract TEXT,
    published_date DATE,
    category TEXT,  -- astro-ph.SR / astro-ph.EP / physics.space-ph 等
    pdf_path TEXT,
    -- 向量嵌入：128维float32序列化为BLOB
    embedding BLOB,
    -- 嵌入模型版本（便于后续更新）
    embed_model TEXT DEFAULT 'bge-small-zh-v1.5',
    citations INTEGER DEFAULT 0,
    -- 1=预打包数据，0=用户上传
    is_preloaded INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 文献全文检索索引（SQLite FTS5，独立表）
CREATE VIRTUAL TABLE IF NOT EXISTS literature_fts USING fts5(
    title, abstract, authors,
    content='',
    content_rowid='rowid'
);

-- ─── 4. 知识图谱节点表 ───
CREATE TABLE IF NOT EXISTS kg_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    -- 天体对象/物理概念/观测设备/科学方法/数据产品/研究机构
    type TEXT CHECK(type IN ('天体对象','物理概念','观测设备','科学方法','数据产品','研究机构')),
    -- JSON格式存储额外属性
    properties TEXT,
    embedding BLOB,
    source TEXT DEFAULT 'seed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── 5. 知识图谱关系表 ───
CREATE TABLE IF NOT EXISTS kg_edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
    target_id INTEGER NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
    -- 观测关系/因果关系/分类关系/方法关系/数据关系/演化关系
    relation_type TEXT CHECK(relation_type IN ('观测关系','因果关系','分类关系','方法关系','数据关系','演化关系')),
    confidence REAL DEFAULT 1.0 CHECK(confidence >= 0 AND confidence <= 1),
    evidence TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 关系索引（加速路径查询）
CREATE INDEX IF NOT EXISTS idx_kg_edges_source ON kg_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_target ON kg_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_type ON kg_edges(relation_type);

-- ─── 6. 天文数据表（预填充公开数据集）───
CREATE TABLE IF NOT EXISTS astro_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- JW-SSD / JW-FD / TESS / SIMULATED
    data_source TEXT CHECK(data_source IN ('JW-SSD','JW-FD','TESS','SIMULATED')),
    obs_time TIMESTAMP,
    -- 太阳活动区编号
    noaa_number TEXT,
    -- 磁场类型（α/β/γ/β-γ）
    magnetic_type TEXT,
    -- 剪切角（度）
    shear_angle REAL,
    -- 缠绕度
    twist_degree REAL,
    -- 磁梯度
    magnetic_gradient REAL,
    -- 爆发等级（A/B/C/M/X）
    flare_class TEXT,
    -- 原始数据文件路径
    raw_data_path TEXT,
    -- JSON元数据
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 天文数据索引
CREATE INDEX IF NOT EXISTS idx_astro_source ON astro_data(data_source);
CREATE INDEX IF NOT EXISTS idx_astro_time ON astro_data(obs_time);
CREATE INDEX IF NOT EXISTS idx_astro_flare ON astro_data(flare_class);

-- ─── 7. 假设表 ───
CREATE TABLE IF NOT EXISTS hypotheses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
    -- 版本号（支持迭代）
    version INTEGER DEFAULT 1,
    -- 假设陈述
    statement TEXT NOT NULL,
    -- 多维度评分（0-1）
    novelty_score REAL CHECK(novelty_score >= 0 AND novelty_score <= 1),
    verifiability_score REAL,
    evidence_score REAL,
    logic_consistency REAL,
    overall_score REAL,
    -- 创新性/可行性/证据支持的雷达图数据（JSON数组）
    radar_data TEXT,
    -- draft / review / accepted / rejected
    status TEXT DEFAULT 'draft',
    -- 生成Agent名称
    generated_by TEXT,
    -- 用户反馈
    user_feedback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── 8. 研究计划表 ───
CREATE TABLE IF NOT EXISTS research_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
    hypothesis_id INTEGER REFERENCES hypotheses(id),
    -- 计划内容（Markdown格式）
    content TEXT,
    -- 实验方案（JSON）
    experiment_design TEXT,
    -- 甘特图数据（JSON）
    gantt_data TEXT,
    -- Python代码
    generated_code TEXT,
    -- 风险评估矩阵（JSON）
    risk_matrix TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── 9. Agent执行日志表（用于调试和展示）───
CREATE TABLE IF NOT EXISTS agent_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER REFERENCES research_sessions(id) ON DELETE SET NULL,
    agent_name TEXT NOT NULL,
    action TEXT NOT NULL,
    -- 输入摘要
    input_summary TEXT,
    -- 输出摘要
    output_summary TEXT,
    -- 执行耗时（毫秒）
    latency_ms INTEGER,
    -- 使用的模型
    model_used TEXT,
    -- 提示词Token数
    prompt_tokens INTEGER,
    -- 输出Token数
    completion_tokens INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent日志索引
CREATE INDEX IF NOT EXISTS idx_agent_logs_session ON agent_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent ON agent_logs(agent_name);

-- ─── 10. 用户设置表 ───
CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    -- 偏好模型
    preferred_model TEXT DEFAULT 'qwen2.5:7b',
    -- 主题 dark / light / auto
    theme TEXT DEFAULT 'auto',
    -- 研究偏好领域
    research_interests TEXT,
    -- 其他配置JSON
    config_json TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── 11. 系统统计表（用于数据大屏）───
CREATE TABLE IF NOT EXISTS system_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stat_date DATE UNIQUE,
    session_count INTEGER DEFAULT 0,
    hypothesis_count INTEGER DEFAULT 0,
    model_calls INTEGER DEFAULT 0,
    avg_latency_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── 初始化触发器：自动更新 updated_at ───
CREATE TRIGGER IF NOT EXISTS update_research_sessions_timestamp
AFTER UPDATE ON research_sessions
BEGIN
    UPDATE research_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ─── 插入默认统计记录（今日）───
INSERT OR IGNORE INTO system_stats (stat_date, session_count, hypothesis_count, model_calls, avg_latency_ms)
VALUES (DATE('now'), 0, 0, 0, 0);
