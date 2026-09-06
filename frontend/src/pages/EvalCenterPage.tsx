import { useEffect, useState, useCallback } from 'react';
import {
  FlaskConical, TestTube2, ShieldCheck, Trophy, RefreshCcw,
  TrendingUp, AlertTriangle, Sparkles, Play, FileText, GitBranch, Wand2,
} from 'lucide-react';
import { pipelineAPI } from '../services/api';
import EngineBadge from '../components/EngineBadge';

interface SplitInfo {
  count: number;
  levels: { A: number; B: number; C: number };
  q_numbers: number[];
}
interface SplitsData {
  assigned: number;
  splits: { train: SplitInfo; test: SplitInfo; val: SplitInfo };
  seed: number;
}
interface EvalSummary {
  n_runs: number;
  mean: number | null;
  min: number | null;
  ge95: number;
  ge90: number;
  per_split: Record<string, { n: number; mean: number | null; min: number | null; ge95: number }>;
  weakest_dims: Record<string, number>;
}
interface PerQuestion {
  run_id: number;
  q_number: number | null;
  split: string | null;
  total: number;
  scores: Record<string, number>;
}
interface IterItem {
  iteration_no: number;
  stage: string;
  findings: string;
  changes: string;
  metrics_before: Record<string, unknown>;
  metrics_after: Record<string, unknown>;
}
interface SkillItem {
  code: string;
  name: string;
  module: string;
  trigger: string;
  summary: string;
}

const MODULE_LABELS: Record<string, string> = {
  m1_question: 'M1 问题理解',
  m2_evidence: 'M2 知识整合',
  m3_hypothesis: 'M3 假设生成',
  m5_plan: 'M5 研究计划',
};

const DIM_LABELS: Record<string, string> = {
  traceability: 'D1 假设溯源',
  evidence_quality: 'D2 证据质量',
  falsifiability: 'D3 可证伪性',
  plan_completeness: 'D4 计划完整性',
  iteration: 'D5 自迭代留痕',
  compliance: 'D6 合规性',
};
const DIM_MAX: Record<string, number> = {
  traceability: 20, evidence_quality: 20, falsifiability: 20,
  plan_completeness: 20, iteration: 10, compliance: 10,
};
const SPLIT_META = [
  { key: 'train', label: '训练集', icon: FlaskConical, color: 'from-blue-500 to-cyan-500',
    desc: '驱动六环节自我辩证完善' },
  { key: 'test', label: '测试集', icon: TestTube2, color: 'from-amber-500 to-orange-500',
    desc: '持续完善 · 不用于最终判定' },
  { key: 'val', label: '验证集', icon: ShieldCheck, color: 'from-emerald-500 to-teal-500',
    desc: '闭环确认 · 最终判定' },
] as const;

function scoreColor(v: number, max: number) {
  const r = v / max;
  if (r >= 0.95) return 'text-emerald-400';
  if (r >= 0.85) return 'text-blue-400';
  if (r >= 0.7) return 'text-amber-400';
  return 'text-red-400';
}

export default function EvalCenterPage() {
  const [splits, setSplits] = useState<SplitsData | null>(null);
  const [summary, setSummary] = useState<EvalSummary | null>(null);
  const [perQ, setPerQ] = useState<PerQuestion[]>([]);
  const [log, setLog] = useState<IterItem[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const [s, e, l, sk] = await Promise.all([
        pipelineAPI.getSplits(),
        pipelineAPI.evalBatch(),
        pipelineAPI.getIterationLog(),
        pipelineAPI.getSkills().catch(() => ({ data: { skills: [] } })),
      ]);
      setSplits(s.data);
      setSummary(e.data.summary);
      setPerQ(e.data.per_question || []);
      setLog(l.data.iterations || []);
      setSkills(sk.data.skills || []);
    } catch (ex) {
      setErr(String(ex));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400" /> 评测中心
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            125题三分（训练 {splits?.splits.train.count ?? '-'} / 测试 {splits?.splits.test.count ?? '-'} / 验证 {splits?.splits.val.count ?? '-'}）·
            六维百分制自评 · 自我辩证迭代留痕
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EngineBadge compact />
          <button onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600/20 border border-primary-500/30 text-primary-300 hover:bg-primary-600/30 transition-colors text-sm">
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 刷新
          </button>
        </div>
      </div>

      {err && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {err}
        </div>
      )}

      {/* 三分卡片 */}
      <div className="grid grid-cols-3 gap-4">
        {SPLIT_META.map((m) => {
          const info = splits?.splits[m.key];
          return (
            <div key={m.key} className="rounded-xl bg-deep-blue/60 border border-deep-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${m.color} flex items-center justify-center`}>
                  <m.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold">{m.label}</p>
                  <p className="text-xs text-gray-500">{m.desc}</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-white mb-2">{info?.count ?? '-'}</p>
              <div className="flex gap-3 text-xs">
                {(['A', 'B', 'C'] as const).map((lv) => (
                  <span key={lv} className="text-gray-400">
                    <span className="mono text-primary-400">{lv}</span> {info?.levels[lv] ?? 0}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                {info?.q_numbers.map((n) => (
                  <span key={n} className="mono text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">{n}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 评分总览 */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl bg-deep-blue/60 border border-deep-border p-5">
            <p className="text-xs text-gray-500 mb-1">已评运行 / 平均分</p>
            <p className="text-3xl font-bold text-white">
              {summary.mean ?? '—'}
              <span className="text-sm text-gray-500 ml-2">({summary.n_runs} 次)</span>
            </p>
          </div>
          <div className="rounded-xl bg-deep-blue/60 border border-deep-border p-5">
            <p className="text-xs text-gray-500 mb-1">≥95 达标 / ≥90</p>
            <p className="text-3xl font-bold text-emerald-400">
              {summary.ge95}<span className="text-lg text-gray-500"> / {summary.ge90}</span>
            </p>
          </div>
          <div className="rounded-xl bg-deep-blue/60 border border-deep-border p-5">
            <p className="text-xs text-gray-500 mb-1">最低分</p>
            <p className="text-3xl font-bold text-amber-400">{summary.min ?? '—'}</p>
          </div>
          <div className="rounded-xl bg-deep-blue/60 border border-deep-border p-5">
            <p className="text-xs text-gray-500 mb-1">辩证迭代轮数</p>
            <p className="text-3xl font-bold text-primary-400">{log.length}</p>
          </div>
        </div>
      )}

      {/* 维度平均得分率 */}
      {summary && Object.keys(summary.weakest_dims || {}).length > 0 && (
        <div className="rounded-xl bg-deep-blue/60 border border-deep-border p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary-400" /> 六维平均得分率（诊断最弱环节）
          </h2>
          <div className="space-y-2">
            {Object.entries(summary.weakest_dims).map(([k, v]) => (
              <div key={k} className="flex items-center gap-3">
                <span className="w-32 text-xs text-gray-400 shrink-0">{DIM_LABELS[k] || k}</span>
                <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-deep-cyan"
                    style={{ width: `${Math.min(v * 100, 100)}%` }} />
                </div>
                <span className={`mono text-xs w-12 text-right ${scoreColor(v, 1)}`}>
                  {(v * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 逐题得分表 */}
      {perQ.length > 0 && (
        <div className="rounded-xl bg-deep-blue/60 border border-deep-border p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" /> 逐题得分（按总分升序，最弱者在前）
          </h2>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-deep-blue">
                <tr className="text-xs text-gray-500 border-b border-deep-border">
                  <th className="text-left p-2">题号</th>
                  <th className="text-left p-2">分组</th>
                  <th className="text-right p-2">总分</th>
                  {Object.keys(DIM_LABELS).map((k) => (
                    <th key={k} className="text-right p-2" title={DIM_LABELS[k]}>
                      {DIM_LABELS[k].split(' ')[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perQ.map((q) => (
                  <tr key={q.run_id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-2 mono text-primary-300">#{q.q_number ?? '-'}</td>
                    <td className="p-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        q.split === 'train' ? 'bg-blue-500/15 text-blue-300' :
                        q.split === 'test' ? 'bg-amber-500/15 text-amber-300' :
                        q.split === 'val' ? 'bg-emerald-500/15 text-emerald-300' :
                        'bg-white/5 text-gray-500'}`}>
                        {q.split === 'train' ? '训练' : q.split === 'test' ? '测试' : q.split === 'val' ? '验证' : '—'}
                      </span>
                    </td>
                    <td className={`p-2 text-right font-bold ${q.total >= 95 ? 'text-emerald-400' : q.total >= 85 ? 'text-blue-400' : 'text-amber-400'}`}>
                      {q.total}
                    </td>
                    {Object.keys(DIM_LABELS).map((k) => (
                      <td key={k} className={`p-2 text-right mono text-xs ${scoreColor(q.scores[k] ?? 0, DIM_MAX[k])}`}>
                        {(q.scores[k] ?? 0).toFixed(1)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 迭代日志 */}
      <div className="rounded-xl bg-deep-blue/60 border border-deep-border p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-primary-400" /> 自我辩证迭代日志（发现问题 → 修复 → 前后对照）
        </h2>
        {log.length === 0 ? (
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <FileText className="w-4 h-4" /> 暂无迭代记录——训练集诊断后自动记录于此。
          </p>
        ) : (
          <div className="space-y-3">
            {log.map((it) => (
              <div key={it.iteration_no} className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="mono text-xs px-2 py-0.5 rounded bg-primary-600/20 text-primary-300">
                    迭代 #{it.iteration_no}
                  </span>
                  <span className="text-xs text-gray-500">阶段: {it.stage}</span>
                </div>
                <p className="text-sm text-gray-300 mb-1"><span className="text-amber-400">诊断：</span>{it.findings}</p>
                <p className="text-sm text-gray-300 mb-2"><span className="text-emerald-400">修复：</span>{it.changes}</p>
                {(Object.keys(it.metrics_before || {}).length > 0) && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {Object.entries(it.metrics_before).map(([k, v]) => (
                      <span key={k} className="mono px-2 py-0.5 rounded bg-white/5 text-gray-400">
                        {k}: {String(v)} → <span className="text-emerald-400">{String((it.metrics_after || {})[k] ?? '?')}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 科研技能库 */}
      {skills.length > 0 && (
        <div className="rounded-xl bg-deep-blue/60 border border-deep-border p-5">
          <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-deep-cyan" /> 科研技能库（OpenAI Skills 范式）
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            可组合提示词技能，按需注入六环节各阶段提示词，零额外调用深化智能体推理质量
          </p>
          <div className="grid grid-cols-2 gap-3">
            {skills.map((sk) => (
              <div key={sk.code} className="p-3.5 rounded-lg bg-white/5 border border-white/10 hover:border-primary-500/30 transition-colors">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="mono text-xs px-1.5 py-0.5 rounded bg-deep-cyan/15 text-deep-cyan font-semibold">{sk.code}</span>
                  <span className="text-sm text-white font-medium">{sk.name}</span>
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-primary-600/15 text-primary-400 whitespace-nowrap">
                    {MODULE_LABELS[sk.module] || sk.module}
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed mb-1.5">{sk.summary}</p>
                <p className="text-[11px] text-gray-600">触发：{sk.trigger}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-600 text-center flex items-center justify-center gap-1">
        <Play className="w-3 h-3" /> 评分口径：六维百分制（溯源/证据/可证伪/计划/迭代/合规）· 规则化可复现 ·
        训练驱动辩证、测试持续完善、验证闭环确认
      </p>
    </div>
  );
}
