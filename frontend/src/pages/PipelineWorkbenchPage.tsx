import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { pipelineAPI } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import EngineBadge from '../components/EngineBadge';
import {
  GitBranch, Layers, Lightbulb, FileCheck2, History, MessageSquarePlus,
  Loader2, ShieldCheck, ShieldAlert, Network, RefreshCcw, Search, Trophy, Globe,
} from 'lucide-react';

const CLAIM_STYLE: Record<string, { cls: string; label: string }> = {
  fact: { cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', label: '客观事实' },
  literature_interpretation: { cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30', label: '文献解释' },
  model_inference: { cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30', label: '模型推断' },
};

const STATUS_LABEL: Record<string, string> = {
  candidate: '候选', shortlisted: '入围', merged: '合并',
  rejected: '淘汰', needs_revision: '待修订', final: '终版',
};

// 在线学术检索源（真实文献证据）
const ONLINE_SOURCES = new Set(['openalex', 'semantic_scholar', 'crossref']);
const SOURCE_LABEL: Record<string, string> = {
  openalex: 'OpenAlex', semantic_scholar: 'S2', crossref: 'Crossref',
  arxiv: 'arXiv', local_literature: '本地文献', local_kg: '知识图谱',
  local_dataset: '本地数据集', model_generated: '模型生成',
};

const SEVERITY_STYLE: Record<string, string> = {
  high: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  low: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

function tryParse(v: any): any {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return v; }
}

export default function PipelineWorkbenchPage() {
  const [params] = useSearchParams();
  const runId = Number(params.get('run') || 0);
  const [state, setState] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [tab, setTab] = useState<'question' | 'evidence' | 'hypotheses' | 'plan' | 'versions'>('question');
  const [loading, setLoading] = useState(false);
  const [iterating, setIterating] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [msg, setMsg] = useState('');
  const [evaluation, setEvaluation] = useState<any>(null);
  const [evalLoading, setEvalLoading] = useState(false);

  const load = useCallback(async () => {
    if (!runId) return;
    setLoading(true);
    try {
      const [s, v] = await Promise.all([
        pipelineAPI.getRun(runId),
        pipelineAPI.getVersions(runId),
      ]);
      setState(s.data);
      setVersions(v.data.versions || []);
    } catch (e: any) {
      setMsg('加载失败：' + (e?.response?.data?.detail || e?.message));
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => { load(); }, [load]);

  // 六维自评（单题即时评分，展示"方案评分"自迭代证据）
  const runEval = async () => {
    setEvalLoading(true);
    try {
      const { data } = await pipelineAPI.evalRun(runId);
      setEvaluation(data);
    } catch (e: any) {
      setMsg('自评失败：' + (e?.response?.data?.detail || e?.message));
    } finally {
      setEvalLoading(false);
    }
  };

  const iterateWithFeedback = async () => {
    setIterating(true);
    setMsg('⏳ 自迭代运行中（补料→修订→评审→计划→决策门）…');
    try {
      const { data } = await pipelineAPI.iterate({
        run_id: runId,
        max_rounds: 3,
        human_feedback: feedback.trim() || undefined,
      });
      const last = data.result?.rounds?.slice(-1)[0];
      setMsg(`✅ 迭代完成：最终决策 ${data.result?.final_decision}${last ? `（R${last.round}: ${last.decision_reason}）` : ''}`);
      setFeedback('');
      load();
    } catch (e: any) {
      setMsg('❌ 迭代失败：' + (e?.response?.data?.detail || e?.message));
    } finally {
      setIterating(false);
    }
  };

  if (!runId) {
    return (
      <div className="p-8 text-gray-400">
        未指定运行。请从 <a className="text-primary-400 hover:underline" href="/pipeline/questions">125题总控台</a> 选题运行。
      </div>
    );
  }

  const run = state?.run;
  const rounds = versions;

  return (
    <div className="p-6 space-y-5">
      {/* 头部：运行概要 */}
      <div className="bg-deep-card border border-deep-border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="kicker text-primary-400/70 mb-1 flex items-center gap-2 flex-wrap">
              <span>RUN #{runId} · {run?.level}级 · {run?.status} · R{run?.current_round}</span>
              {!run?.question_id && (
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px]">自由新问题</span>
              )}
            </p>
            <h1 className="text-lg font-bold text-white leading-snug">{run?.question_text}</h1>
            {run?.final_summary && <p className="text-sm text-gray-400 mt-2">{run.final_summary}</p>}
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <EngineBadge compact />
            <div className="flex items-center gap-2">
              <button
                onClick={runEval}
                disabled={evalLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary-500/30 bg-primary-600/10 text-primary-300 hover:bg-primary-600/25 disabled:opacity-50 text-xs"
                title="六维自评：溯源/证据/可证伪/计划/迭代/合规"
              >
                {evalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trophy className="w-3.5 h-3.5" />} 六维自评
              </button>
              <button
                onClick={load}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-deep-border text-gray-400 hover:bg-white/5 text-xs"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> 刷新
              </button>
            </div>
          </div>
        </div>

        {/* 六维自评结果条 */}
        {evaluation && (
          <div className="mt-4 bg-white/[0.03] border border-deep-border rounded-lg p-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-gray-400">六维自评总分</span>
              <span className={`mono text-xl font-bold ${evaluation.total >= 95 ? 'text-validate-300' : evaluation.total >= 90 ? 'text-primary-300' : 'text-signal-300'}`}>
                {Number(evaluation.total || 0).toFixed(1)}
              </span>
              <span className="text-[10px] text-gray-600">/100</span>
              {evaluation.scores && (
                <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                  {Object.entries(evaluation.scores).map(([k, v]: [string, any]) => (
                    <span key={k} className="mono text-[10px] px-2 py-0.5 rounded bg-white/5 border border-deep-border text-gray-400"
                      title={`${k}: ${v}`}>
                      {({ traceability: '溯源', evidence_quality: '证据', falsifiability: '可证伪', plan_completeness: '计划', iteration: '迭代', compliance: '合规' } as Record<string, string>)[k] || k} {v}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 迭代轨迹（决策门时间线） */}
        {rounds.length > 0 && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {rounds.map((rd) => (
              <div
                key={rd.round}
                className={`px-3 py-1.5 rounded-lg border text-xs ${
                  rd.decision === 'pass'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : rd.decision === 'revise_hypothesis'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : rd.decision === 'supplement_evidence'
                    ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                    : 'bg-gray-500/10 border-gray-500/30 text-gray-400'
                }`}
                title={rd.decision_reason}
              >
                R{rd.round} → {rd.decision}
                {rd.snapshot?.best_score !== undefined && (
                  <span className="mono ml-1.5 opacity-70">best={rd.snapshot.best_score}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 人工反馈 + 继续迭代 */}
      <div className="bg-deep-card border border-deep-border rounded-xl p-4 flex gap-3">
        <input
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="人工反馈（可选）：例如「H-01 的证据链缺少对冲突证据 E-0003 的回应，请修订」"
          className="flex-1 bg-white/5 border border-deep-border rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-primary-500/50"
        />
        <button
          onClick={iterateWithFeedback}
          disabled={iterating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-sm"
        >
          {iterating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquarePlus className="w-4 h-4" />}
          注入反馈并继续迭代
        </button>
      </div>

      {msg && (
        <div className="bg-primary-600/10 border border-primary-500/30 rounded-lg px-4 py-2.5 text-sm text-primary-300">{msg}</div>
      )}

      {/* 标签页 */}
      <div className="flex gap-1.5 flex-wrap">
        {([
          ['question', '问题理解', Search, state?.gaps?.length],
          ['evidence', '证据卡片', Layers, state?.cards?.length],
          ['hypotheses', '假设树', GitBranch, state?.hypotheses?.length],
          ['plan', '研究计划', FileCheck2, state?.plans?.length],
          ['versions', '版本对比', History, rounds.length],
        ] as const).map(([key, label, Icon, count]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors ${
              tab === key
                ? 'bg-primary-600/15 border-primary-500/40 text-primary-300'
                : 'border-deep-border text-gray-400 hover:bg-white/5'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
            {count !== undefined && <span className="mono text-xs opacity-60">{count}</span>}
          </button>
        ))}
      </div>

      {/* ── 问题理解（M1：降维拆解 + 知识缺口） ── */}
      {tab === 'question' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 左：结构化拆解 */}
          <div className="bg-deep-card border border-deep-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-primary-400" />
              <span className="text-sm text-white font-semibold">M1 结构化拆解</span>
              {run?.level === 'C' && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300">宏大基础型 · 已强制降维</span>
              )}
            </div>
            {(() => {
              const dec = tryParse(run?.decomposition) || {};
              const subqs = dec.subquestions || [];
              const objs = dec.objects || [];
              return (
                <>
                  {dec.is_grand !== undefined && (
                    <p className="text-xs text-gray-400">
                      <span className="text-gray-500">降维判定：</span>
                      {dec.is_grand ? '是宏大问题，已拆解为可检验子问题' : '非宏大问题，直接结构化解析'}
                    </p>
                  )}
                  {subqs.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-500">子问题拆解（{subqs.length}）：</p>
                      {subqs.map((sq: any, i: number) => (
                        <p key={i} className="text-sm text-gray-300 flex gap-2">
                          <span className="mono text-[10px] text-primary-400/60 flex-shrink-0 pt-0.5">SQ-{i + 1}</span>
                          {typeof sq === 'string' ? sq : sq.question || sq.text || JSON.stringify(sq)}
                        </p>
                      ))}
                    </div>
                  )}
                  {objs.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">核心研究对象：</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {objs.map((o: any, i: number) => (
                          <span key={i} className="text-xs px-2 py-1 rounded bg-white/5 border border-deep-border text-gray-300">
                            {typeof o === 'string' ? o : o.name || JSON.stringify(o)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {!subqs.length && !objs.length && dec.is_grand === undefined && (
                    <p className="text-xs text-gray-600">拆解详情未随运行状态返回，知识缺口见右侧 →</p>
                  )}
                </>
              );
            })()}
          </div>

          {/* 右：知识缺口清单 */}
          <div className="bg-deep-card border border-deep-border rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-white font-semibold">知识缺口（{state?.gaps?.length || 0}）</span>
              <span className="text-[10px] text-gray-600">假设溯源的锚点 · 证据卡按缺口覆盖</span>
            </div>
            {(state?.gaps || []).map((g: any) => (
              <div key={g.id || g.g_code} className="bg-white/[0.03] border border-deep-border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="mono text-xs text-cyan-400">{g.g_code}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SEVERITY_STYLE[g.severity] || SEVERITY_STYLE.medium}`}>
                    {g.severity === 'high' ? '高优先' : g.severity === 'low' ? '低' : '中'}
                  </span>
                  {g.status && <span className="mono text-[10px] text-gray-600">{g.status}</span>}
                  {g.parent_subquestion && <span className="text-[10px] text-gray-600 truncate">↳ {g.parent_subquestion}</span>}
                </div>
                <p className="text-sm text-gray-300">{g.statement}</p>
              </div>
            ))}
            {(!state?.gaps?.length) && <p className="text-gray-500 text-sm py-6 text-center">暂无缺口记录</p>}
          </div>
        </div>
      )}

      {/* ── 证据卡片 ── */}
      {tab === 'evidence' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {(state?.cards || []).map((c: any) => {
            const ct = CLAIM_STYLE[c.claim_type] || CLAIM_STYLE.model_inference;
            return (
              <div key={c.id} className="bg-deep-card border border-deep-border rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="mono text-xs text-gray-500">{c.e_code}</span>
                  <span className={`px-2 py-0.5 rounded text-xs border ${ct.cls}`}>{ct.label}</span>
                  {ONLINE_SOURCES.has(c.source_type) ? (
                    <span className="flex items-center gap-1 mono text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300"
                      title="在线学术检索真实文献（OpenAlex / Semantic Scholar / Crossref）">
                      <Globe className="w-3 h-3" /> {SOURCE_LABEL[c.source_type] || c.source_type}
                    </span>
                  ) : (
                    <span className="mono text-[10px] text-gray-600">{SOURCE_LABEL[c.source_type] || c.source_type} · R{c.retrieval_round}</span>
                  )}
                  {c.verified ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                      <ShieldCheck className="w-3 h-3" /> DOI已核验
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-gray-500">
                      <ShieldAlert className="w-3 h-3" /> 未核验
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-200">{c.claim}</p>
                {c.quote && <p className="text-xs text-gray-500 italic border-l-2 border-deep-border pl-2">“{c.quote}”</p>}
                {c.source_url ? (
                  <a href={c.source_url} target="_blank" rel="noreferrer"
                    className="text-[11px] text-primary-400 hover:underline block truncate" title={c.source_url}>
                    {c.citation || c.source_url}
                  </a>
                ) : (
                  <p className="text-[11px] text-gray-500">{c.citation}</p>
                )}
                <div className="flex items-center gap-3 mono text-[10px] text-gray-500">
                  <span>置信度 {c.confidence}</span>
                  <span>相关度 {c.relevance}</span>
                  <span>支撑 {tryParse(c.supports_gaps)?.join?.(',') || c.supports_gaps}</span>
                  {c.conflict_with && <span className="text-rose-400">⚔ 冲突: {c.conflict_with}</span>}
                </div>
              </div>
            );
          })}
          {(!state?.cards?.length) && <p className="text-gray-500 text-sm py-8 text-center w-full">暂无证据卡片</p>}
        </div>
      )}

      {/* ── 假设树（七要素卡片） ── */}
      {tab === 'hypotheses' && (
        <div className="space-y-3">
          {(state?.hypotheses || []).map((h: any) => {
            const scores = tryParse(h.scores)?.scores;
            return (
              <div key={h.id} className="bg-deep-card border border-deep-border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <span className="mono text-sm text-white font-semibold">
                    {h.h_code} <span className="text-gray-500">v{h.version}</span>
                  </span>
                  {h.tree_depth > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-cyan-400 border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                      <GitBranch className="w-3 h-3" /> 树深 {h.tree_depth}（修订自父版本）
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded border ${
                    h.status === 'shortlisted' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : h.status === 'rejected' ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    : h.status === 'needs_revision' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                  }`}>{STATUS_LABEL[h.status] || h.status}</span>
                  {h.overall_score > 0 && (
                    <span className="mono text-xs text-primary-300 ml-auto">综合分 {h.overall_score}</span>
                  )}
                </div>

                {/* 要素1 陈述 */}
                <p className="text-sm text-gray-200"><span className="text-gray-500">① 陈述：</span>{h.statement}</p>

                {/* 要素2 依据 */}
                <div className="text-xs text-gray-400 space-y-1">
                  <p><span className="text-gray-500">② 形成依据：</span>{tryParse(h.basis)?.reasoning_chain}</p>
                  <p className="mono text-[10px]">
                    <span className="text-emerald-400">③ 支持 {tryParse(h.supporting_evidence)?.join(', ') || '无'}</span>
                    <span className="mx-2 text-gray-600">|</span>
                    <span className="text-rose-400">④ 反对 {tryParse(h.counter_evidence)?.join(', ') || '无'}</span>
                  </p>
                  <p><span className="text-gray-500">⑤ 可检验预测：</span>{h.testable_prediction}</p>
                  <p><span className="text-gray-500">⑥ 证伪标准：</span>{h.falsification_criteria}</p>
                  <p><span className="text-gray-500">⑦ 替代解释：</span>{tryParse(h.alternative_explanations)?.join('；') || '无'}</p>
                </div>

                {/* 六维评分 */}
                {scores && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {Object.entries(scores).map(([k, v]) => (
                      <span key={k} className="mono text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-deep-border">
                        {k.replace('evidence_consistency', '证据一致').replace('citation_check', '引用核验')
                          .replace('testability', '可检验性').replace('relevance', '相关性')
                          .replace('duplication', '区分度').replace('novelty_plausibility', '新颖性')} {String(v)}
                      </span>
                    ))}
                  </div>
                )}
                {h.decision_note && <p className="text-[11px] text-gray-500">取舍备注：{h.decision_note}</p>}
              </div>
            );
          })}
          {(!state?.hypotheses?.length) && <p className="text-gray-500 text-sm py-8 text-center">暂无假设</p>}
        </div>
      )}

      {/* ── 研究计划 ── */}
      {tab === 'plan' && (
        <div className="space-y-4">
          {(state?.plans || []).map((p: any) => {
            const fe = tryParse(p.feasibility_report);
            return (
              <div key={p.id} className="bg-deep-card border border-deep-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <FileCheck2 className="w-4 h-4 text-primary-400" />
                  <span className="text-sm text-white font-semibold">R{p.round} 研究计划</span>
                  {fe?.verdict && (
                    <span className={`text-xs px-2 py-0.5 rounded border ${
                      fe.verdict === 'executable' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`}>可执行性：{fe.verdict}</span>
                  )}
                </div>
                <div className="prose prose-invert prose-sm max-w-none text-gray-300">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{p.content_md || '（计划为空）'}</ReactMarkdown>
                </div>
              </div>
            );
          })}
          {(!state?.plans?.length) && <p className="text-gray-500 text-sm py-8 text-center">暂无研究计划</p>}
        </div>
      )}

      {/* ── 版本对比 ── */}
      {tab === 'versions' && (
        <div className="space-y-3">
          {/* 轮次对照表（方案评分版本比较） */}
          {rounds.length > 1 && (
            <div className="bg-deep-card border border-deep-border rounded-xl p-4 overflow-x-auto">
              <p className="text-sm text-white font-semibold mb-3 flex items-center gap-2">
                <History className="w-4 h-4 text-primary-400" /> 轮次对照表 · 自迭代提升轨迹
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-deep-border text-gray-500">
                    <th className="text-left px-2 py-2 font-medium">轮次</th>
                    <th className="text-left px-2 py-2 font-medium">证据卡</th>
                    <th className="text-left px-2 py-2 font-medium">本轮新增</th>
                    <th className="text-left px-2 py-2 font-medium">最优假设分</th>
                    <th className="text-left px-2 py-2 font-medium">入围数</th>
                    <th className="text-left px-2 py-2 font-medium">计划可执行性</th>
                    <th className="text-left px-2 py-2 font-medium">决策</th>
                  </tr>
                </thead>
                <tbody>
                  {rounds.map((rd, i) => {
                    const prev = i > 0 ? rounds[i - 1] : null;
                    const dScore = prev
                      ? (rd.snapshot?.best_score || 0) - (prev.snapshot?.best_score || 0)
                      : null;
                    return (
                      <tr key={rd.round} className="border-b border-deep-border/40">
                        <td className="px-2 py-2 mono text-gray-300">R{rd.round}</td>
                        <td className="px-2 py-2 mono text-gray-400">{rd.snapshot?.evidence_total ?? '—'}</td>
                        <td className="px-2 py-2 mono text-cyan-400">+{rd.snapshot?.evidence_new_this_round ?? 0}</td>
                        <td className="px-2 py-2 mono">
                          <span className="text-primary-300">{rd.snapshot?.best_score ?? '—'}</span>
                          {dScore !== null && Math.abs(dScore) > 0.001 && (
                            <span className={`ml-1.5 ${dScore > 0 ? 'text-validate-400' : 'text-signal-400'}`}>
                              ({dScore > 0 ? '↑' : '↓'}{Math.abs(dScore).toFixed(3)})
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 mono text-gray-400">{rd.snapshot?.shortlisted?.length ?? 0}</td>
                        <td className="px-2 py-2 text-gray-400">{rd.snapshot?.feasibility_verdict || '—'}</td>
                        <td className="px-2 py-2">
                          <span className={`px-1.5 py-0.5 rounded border ${
                            rd.decision === 'pass' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : rd.decision === 'revise_hypothesis' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : rd.decision === 'supplement_evidence' ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                            : 'bg-gray-500/10 border-gray-500/30 text-gray-400'
                          }`}>{rd.decision}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {rounds.map((rd, i) => (
            <div key={rd.round} className="bg-deep-card border border-deep-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <History className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-white font-semibold">第 {rd.round} 轮快照</span>
                <span className="text-xs px-2 py-0.5 rounded bg-primary-600/15 border border-primary-500/30 text-primary-300">{rd.decision}</span>
              </div>
              <p className="text-xs text-gray-400 mb-1"><span className="text-gray-500">决策依据：</span>{rd.decision_reason}</p>
              <p className="text-xs text-gray-400">
                <span className="text-gray-500">与上轮差异：</span>
                {rd.diff_note || (i === 0 ? '首轮：建立证据基线与候选假设树。' : '—')}
              </p>
              {rd.snapshot?.hypotheses && (
                <div className="mt-2 space-y-1">
                  {rd.snapshot.hypotheses.map((h: any) => (
                    <div key={h.h_code} className="flex items-center gap-2 text-xs text-gray-400 mono">
                      <span className="text-gray-500">{h.h_code} v{h.version}</span>
                      <span className="text-primary-300">score={h.overall_score}</span>
                      <span className="truncate flex-1 text-gray-500">{h.statement?.slice(0, 60)}…</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {rounds.length === 0 && <p className="text-gray-500 text-sm py-8 text-center">暂无轮次快照</p>}
        </div>
      )}
    </div>
  );
}
