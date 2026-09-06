-- ═══════════════════════════════════════════════════════════════
-- AI-Scientist Hub v3 — 训练/测试/验证三分 + 自评分 + 迭代日志
-- 对应老板指令（2026-09-05）：
--   1) 125题随机三分（训练/测试/验证），分层抽样保持 A/B/C 级别比例
--   2) 训练集驱动六环节自我辩证完善；测试集持续完善；验证集闭环确认
--   3) 全量125题终验自评，<95 分则继续迭代
-- 所有表 CREATE TABLE IF NOT EXISTS，幂等可重复执行
-- ═══════════════════════════════════════════════════════════════

-- ─── 9. 题目三分（训练/测试/验证）───
CREATE TABLE IF NOT EXISTS question_splits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    q_number INTEGER UNIQUE NOT NULL REFERENCES questions_125(q_number) ON DELETE CASCADE,
    split TEXT NOT NULL CHECK(split IN ('train','test','val')),
    level TEXT NOT NULL,                          -- 冗余级别，便于分层统计
    seed INTEGER NOT NULL DEFAULT 42,             -- 划分随机种子（可复现）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_split ON question_splits(split);

-- ─── 10. 单次运行评分（自评分器输出）───
CREATE TABLE IF NOT EXISTS run_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    q_number INTEGER,
    split TEXT DEFAULT '',                        -- 该题所属分组
    batch_run_id INTEGER,                         -- 所属批次
    scores TEXT NOT NULL DEFAULT '{}',            -- 六维分项得分 JSON
    total REAL NOT NULL DEFAULT 0,                -- 总分（0-100）
    details TEXT DEFAULT '{}',                    -- 扣分明细与证据指标 JSON
    evaluator_version TEXT DEFAULT 'v1',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_eval_run ON run_evaluations(run_id);
CREATE INDEX IF NOT EXISTS idx_eval_batch ON run_evaluations(batch_run_id);

-- ─── 11. 迭代日志（自我辩证留痕：每轮「发现问题→修复→对照」）───
CREATE TABLE IF NOT EXISTS iteration_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    iteration_no INTEGER NOT NULL,                -- 第几轮自我辩证迭代
    stage TEXT NOT NULL DEFAULT 'train'
        CHECK(stage IN ('train','test','val','final')),
    findings TEXT DEFAULT '',                     -- 发现的问题（诊断）
    changes TEXT DEFAULT '',                      -- 采取的修复（辩证结论）
    metrics_before TEXT DEFAULT '{}',             -- 修复前指标 JSON
    metrics_after TEXT DEFAULT '{}',              -- 修复后指标 JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
