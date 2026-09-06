import { useState, useEffect } from 'react';
import { bailianAPI, researchAPI } from '../services/api';
import { useResearchStore } from '../stores';
import type { ResearchProject } from '../types';
import ProjectSelector from '../components/ProjectSelector';
import {
  RefreshCcw,
  Loader2,
  Send,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  History,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface VersionEntry {
  version: number;
  date: string;
  score: number;
  changes: string[];
  status: 'approved' | 'reviewed' | 'draft';
}

const MOCK_VERSIONS: VersionEntry[] = [
  { version: 3, date: '2026-07-13', score: 4.41, changes: ['新增X级耀斑专门分析', '补充FusionNet对比实验', '增加物理信息约束'], status: 'approved' },
  { version: 2, date: '2026-07-10', score: 4.26, changes: ['增加多波段融合方案', '完善验证实验设计', '补充风险评估'], status: 'reviewed' },
  { version: 1, date: '2026-07-07', score: 3.85, changes: ['初始假设生成', '基础验证方案'], status: 'reviewed' },
];

const MOCK_EVALUATION = {
  scores: [
    { dimension: '创新性', score: 4.2, maxScore: 5, rationale: '多波段融合方法具有明确创新价值' },
    { dimension: '可验证性', score: 4.8, maxScore: 5, rationale: '公开数据集可直接验证，评估指标明确' },
    { dimension: '理论基础', score: 4.0, maxScore: 5, rationale: '基于磁流体力学理论，但互补性证明不充分' },
    { dimension: '数据支持', score: 3.8, maxScore: 5, rationale: '数据充足但X级样本偏少(<5%)' },
    { dimension: '实用性', score: 4.5, maxScore: 5, rationale: '直接服务空间天气预报需求' },
  ],
  strengths: [
    '研究问题具有明确的实际应用价值',
    '实验设计严谨，包含消融实验和可解释性分析',
    '数据可得性好，研究可复现性高',
  ],
  weaknesses: [
    'X级极端耀斑样本严重不足',
    '多波段数据时间对齐精度可能引入噪声',
    '缺乏与最新SOTA模型的直接对比',
  ],
  suggestions: [
    '增加Focal Loss处理类别不平衡',
    '补充与FusionNet的对比实验',
    '引入物理信息约束作为正则化项',
  ],
  counterExamples: [
    'Chen et al. (2022) 发现多波段融合在某些情况下反而降低预测准确率',
    'Mason & Hoeksema (2010) 指出磁场参数预测能力存在天花板效应(TSS~0.85)',
  ],
  biasCheck: {
    confirmationBias: { level: 'medium' as const, description: '倾向于强调融合优势，未充分讨论负面影响' },
    availabilityBias: { level: 'low' as const, description: '文献引用涵盖最新研究，无明显偏差' },
    anchoringBias: { level: 'medium' as const, description: '预期提升可能锚定于单一基线' },
    overallRisk: 'medium' as const,
  },
};

export default function IteratePage() {
  const [selectedProject, setSelectedProject] = useState<ResearchProject | null>(null);
  const [feedback, setFeedback] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'evaluation' | 'versions' | 'feedback'>('evaluation');
  const { setEvaluationResult } = useResearchStore();

  // When project selected, load existing data
  useEffect(() => {
    if (selectedProject) {
      // Load existing evaluation result
      if (selectedProject.id) {
        researchAPI.getProject(selectedProject.id)
          .then((res) => {
            const proj = res.data;
            if (proj?.stages?.evaluation?.status === 'completed' && proj.stages.evaluation.result) {
              const evalResult = proj.stages.evaluation.result;
              if (evalResult.scores) {
                setEvaluationResult(evalResult);
              }
            }
          })
          .catch(() => {});
      }
    }
  }, [selectedProject]);

  const handleEvaluate = () => {
    setLoading(true);
    setResult('');

    const inputText = feedback
      || (selectedProject?.hypothesis?.title ? `请评估假设"${selectedProject.hypothesis.title}"的质量。` : '')
      || '请评估当前研究假设的质量。';

    const messages = [
      { role: 'system' as const, content: '你是评估验证官智能体。请评估假设质量，检测认知偏差，搜索反例，提出修正建议。输出五维度评分、优缺点、反例、偏差检测和修正建议。' },
      { role: 'user' as const, content: inputText },
    ];

    let content = '';
    bailianAPI.chatStream(
      { model: 'reasoning', messages, temperature: 0.5 },
      (chunk) => { content += chunk; setResult(content); },
      () => {
        setLoading(false);
        setEvaluationResult(MOCK_EVALUATION as any);
      },
      (error) => { setResult(`评估出错：${error}`); setLoading(false); }
    );
  };

  const scoreTrend = MOCK_VERSIONS.map((v) => v.score).reverse();
  const maxScore = 5;

  return (
    <div className="space-y-6">
      <div>
        <p className="kicker mb-3">迭代优化 / ITERATE</p>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/20">
            <RefreshCcw className="w-6 h-6 text-rose-400" />
          </div>
          迭代优化
        </h1>
        <p className="text-gray-400 mt-2 ml-11">评估假设质量、检测偏差、版本对比、反馈循环</p>
      </div>

      {/* Project Selector */}
      <ProjectSelector
        selectedProject={selectedProject}
        onSelect={setSelectedProject}
        stageLabel="迭代优化"
      />

      {/* Show content only after project selected */}
      {selectedProject ? (
        <>
          {/* Project Info Card */}
          <div className="card-lab bg-rose-500/5 border-rose-500/20">
            <div className="flex items-center gap-3">
              <RefreshCcw className="w-5 h-5 text-rose-400" />
              <div>
                <p className="text-sm font-medium text-white">{selectedProject.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{selectedProject.domain} · {selectedProject.question}</p>
              </div>
            </div>
          </div>

          {/* Score Trend */}
          <div className="card-lab">
            <h3 className="font-medium text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              评分趋势
            </h3>
            <div className="flex items-end gap-6 h-32">
              {scoreTrend.map((score, i) => {
                const prevScore = i > 0 ? scoreTrend[i - 1] : score;
                const diff = score - prevScore;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-lg font-bold gradient-text">{score.toFixed(2)}</span>
                      {diff > 0 && <ArrowUp className="w-3 h-3 text-emerald-400" />}
                      {diff < 0 && <ArrowDown className="w-3 h-3 text-red-400" />}
                      {diff === 0 && <Minus className="w-3 h-3 text-gray-500" />}
                    </div>
                    <div className="w-full bg-deep-dark rounded-t-lg relative" style={{ height: '80px' }}>
                      <div
                        className="absolute bottom-0 w-full bg-gradient-to-t from-primary-600 to-primary-400 rounded-t-lg transition-all duration-500"
                        style={{ height: `${(score / maxScore) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500 mt-2">v{MOCK_VERSIONS.length - i}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI evaluation */}
          <div className="card-lab">
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck className="w-4 h-4 text-rose-400" />
              <h3 className="font-medium text-white">AI 实时评估</h3>
              <span className="badge badge-info mono text-[10px]">qwen-max · 百炼</span>
              <button
                onClick={handleEvaluate}
                disabled={loading}
                className="btn-primary ml-auto flex items-center gap-2 h-9 text-sm disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                一键评估假设
              </button>
            </div>
            {result || loading ? (
              result ? (
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> 正在调用评估引擎检测偏差、搜索反例...
                </p>
              )
            ) : (
              <p className="text-sm text-gray-500">点击「一键评估假设」调用后端评估验证官引擎，实时返回五维度评分、认知偏差检测与修正建议。</p>
            )}
            <p className="text-xs text-gray-600 mt-3 pt-3 border-t border-deep-border">
              下方「评估报告 / 版本历史 / 反馈循环」为示例模板，用于展示评估维度与呈现形式。
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {[
              { key: 'evaluation', label: '评估报告', icon: ShieldCheck },
              { key: 'versions', label: '版本历史', icon: History },
              { key: 'feedback', label: '反馈循环', icon: MessageSquare },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === tab.key
                    ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
                    : 'bg-deep-card text-gray-400 border border-deep-border'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Evaluation Report */}
          {activeTab === 'evaluation' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Scores */}
              <div className="card-lab">
                <h3 className="font-medium text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary-400" />
                  多维度评分
                </h3>
                <div className="space-y-4">
                  {MOCK_EVALUATION.scores.map((s) => (
                    <div key={s.dimension}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300">{s.dimension}</span>
                        <span className="text-gray-400">{s.score}/{s.maxScore}</span>
                      </div>
                      <div className="h-2.5 bg-deep-dark rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary-500 to-deep-cyan rounded-full"
                          style={{ width: `${(s.score / s.maxScore) * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{s.rationale}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-deep-border text-center">
                  <span className="text-3xl font-bold gradient-text">
                    {(MOCK_EVALUATION.scores.reduce((a, b) => a + b.score, 0) / MOCK_EVALUATION.scores.length).toFixed(2)}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">综合评分</p>
                </div>
              </div>

              {/* Strengths & Weaknesses */}
              <div className="space-y-4">
                <div className="card-lab">
                  <h3 className="font-medium text-emerald-400 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    优点
                  </h3>
                  <ul className="space-y-2">
                    {MOCK_EVALUATION.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0"></span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="card-lab">
                  <h3 className="font-medium text-red-400 mb-3 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    不足
                  </h3>
                  <ul className="space-y-2">
                    {MOCK_EVALUATION.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0"></span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Bias Check */}
              <div className="card-lab">
                <h3 className="font-medium text-amber-400 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  认知偏差检测
                </h3>
                <div className="space-y-4">
                  {[
                    { name: '确认偏差', ...MOCK_EVALUATION.biasCheck.confirmationBias },
                    { name: '可得性偏差', ...MOCK_EVALUATION.biasCheck.availabilityBias },
                    { name: '锚定偏差', ...MOCK_EVALUATION.biasCheck.anchoringBias },
                  ].map((bias) => (
                    <div key={bias.name} className="flex items-start gap-3">
                      <span className={`badge ${bias.level === 'medium' ? 'badge-warning' : 'badge-success'}`}>
                        {bias.level === 'medium' ? '中' : '低'}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-200">{bias.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{bias.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Counter Examples */}
              <div className="card-lab">
                <h3 className="font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <RefreshCcw className="w-4 h-4 text-purple-400" />
                  反例与证伪
                </h3>
                <ul className="space-y-3">
                  {MOCK_EVALUATION.counterExamples.map((ce, i) => (
                    <li key={i} className="text-sm text-gray-400 p-3 bg-deep-dark rounded-lg border border-deep-border/50">
                      {ce}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <p className="text-sm text-purple-300">
                    <strong>修正建议：</strong>增加"融合失败"的边界条件分析，给出提升范围的置信区间而非点估计。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Version History */}
          {activeTab === 'versions' && (
            <div className="space-y-4">
              {MOCK_VERSIONS.map((v) => (
                <div key={v.version} className="card-lab-hover">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        v.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                        v.status === 'reviewed' ? 'bg-primary-500/20 text-primary-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
                        v{v.version}
                      </div>
                      <div>
                        <p className="font-medium text-white">版本 {v.version}</p>
                        <p className="text-xs text-gray-500">{v.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold gradient-text">{v.score.toFixed(2)}</p>
                      <span className={`badge ${v.status === 'approved' ? 'badge-success' : v.status === 'reviewed' ? 'badge-info' : 'badge-warning'}`}>
                        {v.status === 'approved' ? '已通过' : v.status === 'reviewed' ? '已评审' : '草稿'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {v.changes.map((change, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-400">
                        <ArrowUp className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                        {change}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Feedback */}
          {activeTab === 'feedback' && (
            <div className="space-y-4">
              <div className="card-lab">
                <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary-400" />
                  提交反馈
                </h3>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="输入您的反馈意见，AI将据此优化假设..."
                  className="input-field w-full min-h-[120px] resize-none"
                  rows={4}
                />
                <div className="flex justify-between items-center mt-3">
                  <p className="text-xs text-gray-500">反馈将被纳入下一轮迭代评估</p>
                  <button onClick={handleEvaluate} disabled={loading} className="btn-primary flex items-center gap-2">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    提交并评估
                  </button>
                </div>
              </div>

              {result && (
                <div className="card-lab">
                  <h3 className="font-medium text-white mb-3">AI评估响应</h3>
                  <div className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Suggestions */}
              <div className="card-lab">
                <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  修正建议
                </h3>
                <ol className="space-y-3">
                  {MOCK_EVALUATION.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                      <span className="w-6 h-6 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="card-lab flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <RefreshCcw className="w-12 h-12 mx-auto mb-3 text-deep-border" />
            <p>请先选择一个研究项目</p>
            <p className="text-xs text-gray-600 mt-1">选择项目后将加载已有评估数据进行迭代优化</p>
          </div>
        </div>
      )}
    </div>
  );
}
