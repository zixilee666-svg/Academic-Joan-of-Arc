-- ═══════════════════════════════════════════════════════════════
-- AI-Scientist Hub v2 — 六环节自迭代流水线数据层（赛道一·方向1A）
-- 对应《赛道一-方向1A-提交要求及模板》：
--   M1 问题理解 / M2 知识整合(证据卡片) / M3 候选假设(七要素+树搜索)
--   M4 核验筛选 / M5 研究计划(五环节) / M6 反馈编排(版本快照)
-- 所有表使用 CREATE TABLE IF NOT EXISTS，可对既有库重复执行（迁移安全）
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. 官方125题题库 ───
-- 来源：SJTU × Science《125个科学问题：探索与发现》(2021)
-- 分级：A=收敛可检验型 / B=数据方法驱动型 / C=宏大基础型(需降维拆解)
CREATE TABLE IF NOT EXISTS questions_125 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    q_number INTEGER UNIQUE NOT NULL,          -- 官方编号 1-125
    domain TEXT NOT NULL,                       -- 学科领域
    level TEXT NOT NULL CHECK(level IN ('A','B','C')),
    question_zh TEXT NOT NULL,                  -- 中文原文
    question_en TEXT DEFAULT '',                -- 英文原文（如可得）
    strategy_note TEXT DEFAULT '',              -- 本系统处理策略说明
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── 2. 流水线运行记录（一道题的一次完整运行）───
CREATE TABLE IF NOT EXISTS pipeline_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER REFERENCES questions_125(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,                -- 问题原文（自定义题亦可）
    level TEXT DEFAULT 'A',                     -- 题目分级
    status TEXT DEFAULT 'running'
        CHECK(status IN ('pending','running','completed','partial','failed','needs_human')),
    current_stage TEXT DEFAULT 'm1_question',   -- m1..m6
    current_round INTEGER DEFAULT 1,            -- 当前迭代轮次
    decomposition TEXT,                         -- C级题降维拆解说明（JSON）
    final_summary TEXT,                         -- 终版摘要
    result_class TEXT DEFAULT ''
        CHECK(result_class IN ('','full','partial','insufficient_evidence','needs_human','failed')),
    error_detail TEXT DEFAULT '',
    token_usage INTEGER DEFAULT 0,              -- 累计token
    batch_run_id INTEGER DEFAULT 0,             -- 所属批量运行批次（0=单题交互）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_runs_question ON pipeline_runs(question_id);
CREATE INDEX IF NOT EXISTS idx_runs_batch ON pipeline_runs(batch_run_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON pipeline_runs(status);

-- ─── 3. 证据卡片（M2 知识整合 · 全系统溯源基石）───
-- claim_type 三分类：fact=客观事实 / literature_interpretation=文献解释 / model_inference=模型推断
CREATE TABLE IF NOT EXISTS evidence_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    e_code TEXT NOT NULL,                       -- E-0001 形式，供假设挂接引用
    source_type TEXT NOT NULL
        CHECK(source_type IN ('openalex','semantic_scholar','crossref','arxiv','local_literature','local_kg','local_dataset','model_generated')),
    citation TEXT NOT NULL,                     -- 作者,标题,年份,DOI/ID
    source_url TEXT DEFAULT '',
    claim_type TEXT NOT NULL DEFAULT 'literature_interpretation'
        CHECK(claim_type IN ('fact','literature_interpretation','model_inference')),
    claim TEXT NOT NULL,                        -- 证据主张（一句）
    quote TEXT DEFAULT '',                      -- 原文关键句摘录
    relevance REAL DEFAULT 0.5,                 -- 与问题的相关度 0-1
    confidence REAL DEFAULT 0.5,                -- 置信度 0-1
    supports_gaps TEXT DEFAULT '[]',            -- 支撑的知识缺口 G-ID 列表(JSON)
    conflict_with TEXT DEFAULT '',              -- 与之冲突的证据 E-code（冲突对）
    retrieval_round INTEGER DEFAULT 1,          -- 第几轮检索获得（补料轮次）
    verified INTEGER DEFAULT 0,                 -- 1=来源真实性已核验
    verify_note TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(run_id, e_code)
);
CREATE INDEX IF NOT EXISTS idx_evidence_run ON evidence_cards(run_id);

-- ─── 4. 知识缺口（M1 输出，作为假设生成锚点）───
CREATE TABLE IF NOT EXISTS knowledge_gaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    g_code TEXT NOT NULL,                       -- G-01 形式
    statement TEXT NOT NULL,                    -- 缺口陈述（含对象/变量/边界）
    severity TEXT DEFAULT 'medium' CHECK(severity IN ('high','medium','low')),
    parent_subquestion TEXT DEFAULT '',         -- 来自哪个降维子问题（C级题）
    status TEXT DEFAULT 'open' CHECK(status IN ('open','addressed','unaddressable')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(run_id, g_code)
);

-- ─── 5. 候选假设七要素（M3 输出 · 假设树节点）───
CREATE TABLE IF NOT EXISTS hypotheses_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    round INTEGER DEFAULT 1,                    -- 迭代轮次
    h_code TEXT NOT NULL,                       -- H-01 形式
    version INTEGER DEFAULT 1,                  -- 同一假设的修订版本
    parent_id INTEGER REFERENCES hypotheses_v2(id) ON DELETE SET NULL, -- 树搜索父节点
    tree_depth INTEGER DEFAULT 0,
    gap_id TEXT DEFAULT '',                     -- 挂接的知识缺口 G-code
    statement TEXT NOT NULL,                    -- 要素1：核心陈述（可证伪命题）
    basis TEXT DEFAULT '{}',                    -- 要素2：形成依据（推理链+引用）JSON
    supporting_evidence TEXT DEFAULT '[]',      -- 要素3：支持证据 E-code 列表 JSON
    counter_evidence TEXT DEFAULT '[]',         -- 要素4：反对证据/冲突证据 JSON
    testable_prediction TEXT DEFAULT '',        -- 要素5：可检验预测
    falsification_criteria TEXT DEFAULT '',     -- 要素6：证伪标准
    alternative_explanations TEXT DEFAULT '[]', -- 要素7：替代解释 JSON
    uncertainty_level TEXT DEFAULT 'medium' CHECK(uncertainty_level IN ('high','medium','low')),
    uncertainty_sources TEXT DEFAULT '[]',      -- 不确定性来源 JSON
    revision_note TEXT DEFAULT '',              -- 修订/批判说明（质疑→修补对应关系，P17版本比较数据源）
    -- M4 六维核验结果（JSON：relevance/evidence_consistency/citation_check/
    --   testability/duplication/entry_score + 各维说明）
    scores TEXT DEFAULT '{}',
    overall_score REAL DEFAULT 0,
    status TEXT DEFAULT 'candidate'
        CHECK(status IN ('candidate','shortlisted','merged','rejected','needs_revision','final')),
    decision_note TEXT DEFAULT '',              -- 取舍理由（为何选此而非彼）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(run_id, round, h_code, version)
);
CREATE INDEX IF NOT EXISTS idx_hyp_run ON hypotheses_v2(run_id);
CREATE INDEX IF NOT EXISTS idx_hyp_status ON hypotheses_v2(status);

-- ─── 6. 研究计划五环节（M5 输出）───
CREATE TABLE IF NOT EXISTS plans_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    round INTEGER DEFAULT 1,
    hypothesis_ids TEXT DEFAULT '[]',           -- 本计划所验证的假设 H-code 列表 JSON
    predictions TEXT DEFAULT '[]',              -- 环节1：待验证预测清单 JSON
    resources TEXT DEFAULT '[]',                -- 环节2：数据/资料/条件（含已具备/待获取）JSON
    steps TEXT DEFAULT '[]',                    -- 环节3：研究步骤与分析方法 JSON
    outcome_table TEXT DEFAULT '[]',            -- 环节4：不同结果分别支持/反对什么 JSON
    stop_conditions TEXT DEFAULT '[]',          -- 环节5：停止/回退/补证据条件 JSON
    feasibility_report TEXT DEFAULT '{}',       -- 可执行性检查报告 JSON
    content_md TEXT DEFAULT '',                 -- 整合后的计划全文（Markdown）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_plan_run ON plans_v2(run_id);

-- ─── 7. 迭代轮次快照（M6 版本管理 · 版本比较的数据源）───
CREATE TABLE IF NOT EXISTS iteration_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    round INTEGER NOT NULL,
    snapshot TEXT NOT NULL,                     -- 该轮完整状态快照（证据/假设/计划/评分摘要）JSON
    scores_summary TEXT DEFAULT '{}',           -- 该轮评分汇总
    decision TEXT DEFAULT '',                   -- 决策门输出：pass/revise_hypothesis/supplement_evidence/stop
    decision_reason TEXT DEFAULT '',
    diff_note TEXT DEFAULT '',                  -- 与上一轮差异摘要（供P17版本对比）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(run_id, round)
);
CREATE INDEX IF NOT EXISTS idx_round_run ON iteration_rounds(run_id);

-- ─── 8. 反馈条目（自动评估反馈 + 人工反馈注入）───
CREATE TABLE IF NOT EXISTS feedback_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    round INTEGER DEFAULT 1,
    fb_type TEXT NOT NULL CHECK(fb_type IN ('auto_eval','auto_verify','human','supplement_evidence')),
    target_module TEXT DEFAULT 'm3_hypothesis', -- 反馈路由目标环节
    content TEXT NOT NULL,
    applied INTEGER DEFAULT 0,                  -- 是否已被下一轮采纳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fb_run ON feedback_entries(run_id);
