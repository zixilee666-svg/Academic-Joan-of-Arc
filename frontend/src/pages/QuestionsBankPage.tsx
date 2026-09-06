import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { pipelineAPI } from '../services/api';
import EngineBadge from '../components/EngineBadge';
import {
  ListChecks, Play, Rocket, FileText, RefreshCcw, Loader2,
  CheckCircle2, XCircle, Clock, FlaskConical, Filter,
} from 'lucide-react';

interface QuestionRow {
  id: number;
  q_number: number;
  domain: string;
  level: 'A' | 'B' | 'C';
  question_zh: string;
  strategy_note: string;
  split?: 'train' | 'test' | 'val' | null;
  last_run: { run_id: number; status: string; result_class: string; rounds: number } | null;
}

const LEVEL_STYLE: Record<string, string> = {
  A: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  B: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  C: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};

const SPLIT_STYLE: Record<string, { cls: string; label: string }> = {
  train: { cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30', label: '训练' },
  test: { cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30', label: '测试' },
  val: { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', label: '验证' },
};

const STATUS_STYLE: Record<string, { cls: string; label: string }> = {
  completed: { cls: 'text-emerald-400', label: '已完成' },
  partial: { cls: 'text-amber-400', label: '部分收敛' },
  running: { cls: 'text-cyan-400', label: '运行中' },
  failed: { cls: 'text-rose-400', label: '失败' },
  needs_human: { cls: 'text-purple-400', label: '需人工' },
};

export default function QuestionsBankPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [domainFilter, setDomainFilter] = useState<string>('');
  const [splitFilter, setSplitFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [runningQ, setRunningQ] = useState<number | null>(null);
  const [batchState, setBatchState] = useState<any>(null);
  const [batchStarting, setBatchStarting] = useState(false);
  const [msg, setMsg] = useState('');
  const pollRef = useRef<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (levelFilter) params.level = levelFilter;
      if (domainFilter) params.domain = domainFilter;
      const { data } = await pipelineAPI.getQuestions(params);
      setQuestions(data.questions || []);
    } catch (e: any) {
      setMsg('题库加载失败：' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [levelFilter, domainFilter]);

  useEffect(() => { load(); }, [load]);

  // 前端侧按三分过滤（后端返回全量）
  const visibleQuestions = splitFilter
    ? questions.filter((q) => q.split === splitFilter)
    : questions;

  // 批量状态轮询
  const pollBatch = useCallback(async () => {
    try {
      const { data } = await pipelineAPI.batchStatus();
      setBatchState(data);
      if (data.running && !pollRef.current) {
        pollRef.current = setInterval(async () => {
          const r = await pipelineAPI.batchStatus();
          setBatchState(r.data);
          if (!r.data.running && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            load();
          }
        }, 5000);
      }
    } catch { /* ignore */ }
  }, [load]);

  useEffect(() => { pollBatch(); return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, [pollBatch]);

  const runSingle = async (q: QuestionRow) => {
    setRunningQ(q.q_number);
    setMsg(`▶ 题 ${q.q_number} 已提交运行（六环节自迭代，需数十秒至数分钟）…`);
    try {
      const { data } = await pipelineAPI.createRun({ q_number: q.q_number, max_rounds: 2 });
      setMsg(`✅ 题 ${q.q_number} 运行完成 → 决策: ${data.result?.final_decision || '?'}`);
      navigate(`/pipeline/workbench?run=${data.run_id}`);
    } catch (e: any) {
      setMsg(`❌ 题 ${q.q_number} 运行失败：` + (e?.response?.data?.detail || e?.message));
    } finally {
      setRunningQ(null);
      load();
    }
  };

  const startBatch = async () => {
    setBatchStarting(true);
    try {
      const payload: any = { concurrency: 3 };
      if (levelFilter) payload.levels = [levelFilter];
      const { data } = await pipelineAPI.startBatch(payload);
      setMsg(data.message || '批量任务已启动');
      pollBatch();
    } catch (e: any) {
      setMsg('批量启动失败：' + (e?.response?.data?.detail || e?.message));
    } finally {
      setBatchStarting(false);
    }
  };

  const exportReport = async () => {
    try {
      const { data } = await pipelineAPI.batchReport();
      setMsg(`📄 逐题报告已导出：${data.report_path}`);
    } catch (e: any) {
      setMsg('报告导出失败：' + (e?.message || e));
    }
  };

  const domains = Array.from(new Set(questions.map((q) => q.domain)));
  const splitCounts = {
    train: questions.filter((q) => q.split === 'train').length,
    test: questions.filter((q) => q.split === 'test').length,
    val: questions.filter((q) => q.split === 'val').length,
  };
  const stats = {
    total: visibleQuestions.length,
    done: visibleQuestions.filter((q) => q.last_run && ['completed', 'partial'].includes(q.last_run.status)).length,
    failed: visibleQuestions.filter((q) => q.last_run?.status === 'failed').length,
  };

  return (
    <div className="p-6 space-y-5">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ListChecks className="w-6 h-6 text-primary-400" />
            125题总控台
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            《125个科学问题：探索与发现》全量运行 · A收敛可检验 / B数据方法驱动 / C宏大基础(强制降维)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EngineBadge compact />
          <button
            onClick={exportReport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-deep-border text-gray-300 hover:bg-white/5 text-sm transition-colors"
          >
            <FileText className="w-4 h-4" /> 导出逐题报告
          </button>
          <button
            onClick={startBatch}
            disabled={batchStarting || batchState?.running}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-sm transition-colors"
          >
            {batchStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            批量运行{levelFilter ? `（${levelFilter}级）` : '全量'}
          </button>
        </div>
      </div>

      {/* 批量进度条 */}
      {batchState && (batchState.running || batchState.done > 0) && (
        <div className="bg-deep-card border border-deep-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300 flex items-center gap-2">
              {batchState.running && <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />}
              批量任务 #{batchState.batch_id}：
              {batchState.running ? `正在处理 ${batchState.current}` : '已结束'}
            </span>
            <span className="mono text-xs text-gray-400">
              {batchState.done}/{batchState.total}（失败 {batchState.failed}）
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-deep-cyan transition-all"
              style={{ width: `${batchState.total ? (batchState.done / batchState.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {msg && (
        <div className="bg-primary-600/10 border border-primary-500/30 rounded-lg px-4 py-2.5 text-sm text-primary-300">{msg}</div>
      )}

      {/* 过滤器 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-gray-500" />
          {['', 'A', 'B', 'C'].map((lv) => (
            <button
              key={lv}
              onClick={() => setLevelFilter(lv)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                levelFilter === lv
                  ? 'bg-primary-600/20 border-primary-500/40 text-primary-300'
                  : 'border-deep-border text-gray-400 hover:bg-white/5'
              }`}
            >
              {lv === '' ? `全部 ${questions.length}` : `${lv}级`}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-deep-border" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">分组:</span>
          {[
            { key: '', label: `全部 ${questions.length}` },
            { key: 'train', label: `训练 ${splitCounts.train}` },
            { key: 'test', label: `测试 ${splitCounts.test}` },
            { key: 'val', label: `验证 ${splitCounts.val}` },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setSplitFilter(s.key)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                splitFilter === s.key
                  ? 'bg-primary-600/20 border-primary-500/40 text-primary-300'
                  : 'border-deep-border text-gray-400 hover:bg-white/5'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          className="bg-deep-card border border-deep-border rounded-lg px-3 py-1.5 text-xs text-gray-300 outline-none"
        >
          <option value="">全部领域</option>
          {domains.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300">
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> 刷新
        </button>
        <span className="mono text-xs text-gray-500 ml-auto">
          已运行 {stats.done} · 失败 {stats.failed}
        </span>
      </div>

      {/* 题目表格 */}
      <div className="bg-deep-card border border-deep-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-deep-border text-gray-500 text-xs">
              <th className="text-left px-4 py-3 font-medium w-14">编号</th>
              <th className="text-left px-2 py-3 font-medium w-16">级别</th>
              <th className="text-left px-2 py-3 font-medium w-16">分组</th>
              <th className="text-left px-2 py-3 font-medium w-24">领域</th>
              <th className="text-left px-2 py-3 font-medium">科学问题</th>
              <th className="text-left px-2 py-3 font-medium w-28">运行状态</th>
              <th className="text-right px-4 py-3 font-medium w-32">操作</th>
            </tr>
          </thead>
          <tbody>
            {visibleQuestions.map((q) => {
              const st = q.last_run ? STATUS_STYLE[q.last_run.status] : null;
              const sp = q.split ? SPLIT_STYLE[q.split] : null;
              return (
                <tr key={q.id} className="border-b border-deep-border/50 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 mono text-gray-500">#{q.q_number}</td>
                  <td className="px-2 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs border ${LEVEL_STYLE[q.level]}`}>{q.level}</span>
                  </td>
                  <td className="px-2 py-3">
                    {sp ? (
                      <span className={`px-2 py-0.5 rounded text-xs border ${sp.cls}`}>{sp.label}</span>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-gray-400 text-xs">{q.domain}</td>
                  <td className="px-2 py-3 text-gray-200" title={q.strategy_note}>{q.question_zh}</td>
                  <td className="px-2 py-3">
                    {q.last_run ? (
                      <button
                        onClick={() => navigate(`/pipeline/workbench?run=${q.last_run!.run_id}`)}
                        className={`flex items-center gap-1.5 text-xs ${st?.cls} hover:underline`}
                        title={`run_id=${q.last_run.run_id}，${q.last_run.rounds}轮`}
                      >
                        {q.last_run.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {q.last_run.status === 'failed' && <XCircle className="w-3.5 h-3.5" />}
                        {q.last_run.status === 'running' && <Clock className="w-3.5 h-3.5" />}
                        {st?.label}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-600">未运行</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => runSingle(q)}
                      disabled={runningQ === q.q_number}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600/20 border border-primary-500/30 text-primary-300 hover:bg-primary-600/35 disabled:opacity-50 text-xs transition-colors"
                    >
                      {runningQ === q.q_number
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Play className="w-3.5 h-3.5" />}
                      运行
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && questions.length === 0 && (
          <div className="py-12 text-center text-gray-500 text-sm flex items-center justify-center gap-2">
            <FlaskConical className="w-4 h-4" /> 暂无题目（请确认后端已启动并完成题库播种）
          </div>
        )}
      </div>
    </div>
  );
}
