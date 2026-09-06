import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { pipelineAPI } from '../services/api';
import EngineBadge from '../components/EngineBadge';
import {
  Sparkles, Loader2, Play, History, GitBranch, Layers, Lightbulb,
  FileCheck2, RefreshCcw, CheckCircle2, Search, Brain, MessageSquarePlus,
} from 'lucide-react';

interface RunRow {
  id: number;
  question_text: string;
  level: string;
  status: string;
  result_class: string | null;
  current_round: number | null;
  created_at: string;
  n_cards: number;
  eval_total: number | null;
}

/** 六环节阶段映射（pipeline_runs.current_stage → 中文标签） */
const STAGES: { key: string; label: string; icon: any }[] = [
  { key: 'm1_question', label: 'M1 问题理解', icon: Search },
  { key: 'm2_evidence', label: 'M2 知识整合', icon: Layers },
  { key: 'm3_hypothesis', label: 'M3 假设生成', icon: Lightbulb },
  { key: 'm4_verify', label: 'M4 核验筛选', icon: GitBranch },
  { key: 'm5_plan', label: 'M5 研究计划', icon: FileCheck2 },
  { key: 'm6_decide', label: 'M6 反馈决策', icon: RefreshCcw },
];

const EXAMPLES = [
  '脑机接口能否实现人类记忆的数字化备份？',
  '城市热岛效应能否通过材料创新彻底缓解？',
  '大语言模型是否具备真正的因果推理能力？',
];

export default function NewQuestionPage() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [level, setLevel] = useState<'A' | 'B' | 'C'>('B');
  const [maxRounds, setMaxRounds] = useState(3);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [doneRun, setDoneRun] = useState<{ run_id: number; decision: string; summary: string } | null>(null);
  const [history, setHistory] = useState<RunRow[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const stageTimerRef = useRef<any>(null);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const { data } = await pipelineAPI.listRuns({ kind: 'custom', limit: 30 });
      setHistory(data.runs || []);
    } catch { /* 静默：历史加载失败不阻塞提问 */ }
    finally { setHistLoading(false); }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => () => { if (stageTimerRef.current) clearInterval(stageTimerRef.current); }, []);

  const submit = async () => {
    const q = question.trim();
    if (!q) { setErr('请先输入科学问题'); return; }
    if (q.length < 6) { setErr('问题太短了，请描述一个完整的科学问题（≥6字）'); return; }
    setErr(''); setMsg(''); setDoneRun(null); setRunning(true);
    setStage('m1_question');
    // createRun 为同步等待（后端跑完全部迭代才返回，超时10分钟）。
    // 期间用本地定时器推进六环节流程条动画，完成后以真实结果校准。
    stageTimerRef.current = setInterval(() => {
      setStage((s) => {
        const i = STAGES.findIndex((x) => x.key === s);
        return STAGES[Math.min(i + 1, STAGES.length - 1)].key;
      });
    }, 9000);
    try {
      const { data } = await pipelineAPI.createRun({ question: q, level, max_rounds: maxRounds });
      const result = data.result || {};
      const lastRound = (result.rounds || []).slice(-1)[0];
      setDoneRun({
        run_id: data.run_id,
        decision: result.final_decision || lastRound?.decision || '?',
        summary: data.state?.run?.final_summary || lastRound?.decision_reason || '',
      });
      setStage('');
      setMsg(`✅ 六环节自迭代完成（${(result.rounds || []).length} 轮）→ 最终决策：${result.final_decision}`);
      loadHistory();
    } catch (e: any) {
      setErr('❌ 运行失败：' + (e?.response?.data?.detail || e?.message || e));
      setStage('');
    } finally {
      setRunning(false);
      if (stageTimerRef.current) { clearInterval(stageTimerRef.current); stageTimerRef.current = null; }
    }
  };

  const curStageIdx = STAGES.findIndex((s) => s.key === stage);

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* 头部 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary-400" />
            新问题实验室
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            输入任意科学问题 → 六环节自迭代流水线（问题理解—知识整合—候选假设生成—证据梳理—研究计划输出—反馈修正）
          </p>
        </div>
        <EngineBadge />
      </div>

      {/* 提问卡片 */}
      <div className="bg-deep-card border border-deep-border rounded-xl p-5 space-y-4">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={running}
          rows={3}
          placeholder="例如：睡眠剥夺如何影响免疫系统的记忆T细胞生成？"
          className="w-full bg-white/5 border border-deep-border rounded-lg px-4 py-3 text-sm text-gray-200 outline-none focus:border-primary-500/50 resize-y disabled:opacity-50"
        />

        <div className="flex items-center gap-3 flex-wrap">
          {/* 级别选择 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">问题分级:</span>
            {(['A', 'B', 'C'] as const).map((lv) => (
              <button
                key={lv}
                onClick={() => setLevel(lv)}
                disabled={running}
                title={lv === 'A' ? 'A 收敛可检验' : lv === 'B' ? 'B 数据方法驱动' : 'C 宏大基础型（自动降维拆解为子问题）'}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors disabled:opacity-50 ${
                  level === lv
                    ? 'bg-primary-600/20 border-primary-500/40 text-primary-300'
                    : 'border-deep-border text-gray-400 hover:bg-white/5'
                }`}
              >
                {lv}级{lv === 'C' ? '·降维' : ''}
              </button>
            ))}
          </div>
          <div className="h-5 w-px bg-deep-border" />
          {/* 迭代轮数 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">最大迭代轮数:</span>
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setMaxRounds(n)}
                disabled={running}
                className={`px-3 py-1.5 rounded-lg text-xs border mono transition-colors disabled:opacity-50 ${
                  maxRounds === n
                    ? 'bg-primary-600/20 border-primary-500/40 text-primary-300'
                    : 'border-deep-border text-gray-400 hover:bg-white/5'
                }`}
              >
                {n}轮
              </button>
            ))}
          </div>
          <div className="ml-auto">
            <button
              onClick={submit}
              disabled={running || !question.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-sm font-medium transition-colors shadow-glow-blue"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? '六环节运行中…' : '启动六环节自迭代'}
            </button>
          </div>
        </div>

        {/* 示例问题 */}
        {!running && !doneRun && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-600">试试:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setQuestion(ex)}
                className="text-xs px-3 py-1.5 rounded-lg border border-deep-border text-gray-400 hover:text-primary-300 hover:border-primary-500/40 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 运行中：六环节流程条 */}
      {running && (
        <div className="bg-deep-card border border-deep-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-sm text-gray-300">真实引擎推理中（千问 · 每轮含在线文献检索，全程约 2~5 分钟）</span>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {STAGES.map((s, i) => {
              const done = curStageIdx > i;
              const active = curStageIdx === i;
              return (
                <div key={s.key} className="flex items-center gap-1 flex-shrink-0">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${
                    active
                      ? 'bg-primary-600/20 border-primary-500/50 text-primary-300 shadow-glow-blue'
                      : done
                      ? 'bg-validate-500/10 border-validate-500/30 text-validate-300'
                      : 'border-deep-border text-gray-600'
                  }`}>
                    {active ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : done ? <CheckCircle2 className="w-3.5 h-3.5" />
                      : <s.icon className="w-3.5 h-3.5" />}
                    {s.label}
                  </div>
                  {i < STAGES.length - 1 && <span className="text-gray-700 text-xs">→</span>}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            多轮自迭代：每轮经「证据补料 → 假设修订 → 魔鬼代言人批判复核 → 决策门（pass / revise / supplement / stop）」，R1 达标也须先经一轮批判复核方可通过（自我辩证铁律）。
          </p>
        </div>
      )}

      {err && (
        <div className="bg-signal-500/10 border border-signal-500/30 rounded-lg px-4 py-2.5 text-sm text-signal-300">{err}</div>
      )}
      {msg && !err && (
        <div className="bg-validate-500/10 border border-validate-500/30 rounded-lg px-4 py-2.5 text-sm text-validate-300 flex items-center justify-between gap-3 flex-wrap">
          <span>{msg}</span>
          {doneRun && (
            <button
              onClick={() => navigate(`/pipeline/workbench?run=${doneRun.run_id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs"
            >
              <GitBranch className="w-3.5 h-3.5" /> 进入迭代工作台查看完整结果
            </button>
          )}
        </div>
      )}

      {/* 完成摘要 */}
      {doneRun && (
        <div className="bg-deep-card border border-validate-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <CheckCircle2 className="w-4 h-4 text-validate-400" />
            <span className="text-sm text-white font-semibold">运行完成 · RUN #{doneRun.run_id}</span>
            <span className={`text-xs px-2 py-0.5 rounded border ${
              doneRun.decision === 'pass'
                ? 'bg-validate-500/15 text-validate-300 border-validate-500/30'
                : 'bg-signal-500/15 text-signal-300 border-signal-500/30'
            }`}>决策: {doneRun.decision}</span>
          </div>
          {doneRun.summary && <p className="text-xs text-gray-400">{doneRun.summary}</p>}
          <p className="text-[11px] text-gray-600 mt-2 flex items-center gap-1">
            <MessageSquarePlus className="w-3 h-3" />
            工作台内可注入人工反馈继续迭代、对比各轮版本、导出证据链与假设树
          </p>
        </div>
      )}

      {/* 历史新问题 */}
      <div className="bg-deep-card border border-deep-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-gray-500" /> 我的新问题（{history.length}）
          </h2>
          <button onClick={loadHistory} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300">
            <RefreshCcw className={`w-3.5 h-3.5 ${histLoading ? 'animate-spin' : ''}`} /> 刷新
          </button>
        </div>
        {history.length === 0 && !histLoading && (
          <p className="text-xs text-gray-600 py-4 text-center">暂无历史运行。输入问题并启动六环节自迭代后，运行记录会出现在这里。</p>
        )}
        <div className="space-y-2">
          {history.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(`/pipeline/workbench?run=${r.id}`)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-deep-border hover:border-primary-500/40 hover:bg-white/[0.03] transition-colors text-left group"
            >
              <span className="mono text-[10px] text-gray-600 w-14 flex-shrink-0">#{r.id} · {r.level}级</span>
              <span className="text-sm text-gray-300 truncate flex-1 group-hover:text-white">{r.question_text}</span>
              <span className="mono text-[10px] text-gray-600 flex-shrink-0">{r.n_cards}证据 · R{r.current_round || 0}</span>
              {r.eval_total != null && (
                <span className="mono text-xs text-primary-300 flex-shrink-0">{r.eval_total}分</span>
              )}
              <span className={`text-xs flex-shrink-0 ${
                r.status === 'completed' ? 'text-validate-400'
                : r.status === 'running' ? 'text-cyan-400'
                : r.status === 'failed' ? 'text-signal-400' : 'text-gray-500'
              }`}>
                {r.status === 'completed' ? (r.result_class === 'full' ? '完整收敛' : '部分收敛')
                 : r.status === 'running' ? '运行中' : r.status === 'failed' ? '失败' : r.status}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
