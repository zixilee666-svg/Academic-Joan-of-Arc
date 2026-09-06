import { useState, useEffect } from 'react';
import { bailianAPI, researchAPI } from '../services/api';
import { useResearchStore } from '../stores';
import type { ResearchProject } from '../types';
import ProjectSelector from '../components/ProjectSelector';
import {
  Lightbulb,
  Loader2,
  Send,
  Star,
  TrendingUp,
  Shield,
  Database,
  Wrench,
  AlertTriangle,
  ChevronRight,
  Check,
  BarChart3,
  BookOpen,
  Edit3,
  X,
  Save,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface HypothesisCard {
  id: string;
  title: string;
  description: string;
  scores: { innovation: number; verifiability: number; theoretical: number; dataSupport: number; practicality: number; overall: number };
  status: 'draft' | 'reviewed' | 'approved';
  rationale?: string;
  validation?: string;
}

const MOCK_HYPOTHESES: HypothesisCard[] = [
  {
    id: 'h1',
    title: '多波段磁场拓扑融合预测假说',
    description: '通过融合光球层磁场拓扑参数与色球层极紫外辐射特征，构建多波段融合特征空间，可显著提升太阳耀斑预测准确率和提前预警时间。',
    scores: { innovation: 4.2, verifiability: 4.8, theoretical: 4.0, dataSupport: 3.8, practicality: 4.5, overall: 4.26 },
    status: 'reviewed',
    rationale: '基于磁流体力学理论，磁场拓扑参数与耀斑能量释放存在物理因果关联',
    validation: '构建CNN-LSTM混合模型，使用JW-SSD数据集进行5折交叉验证',
  },
  {
    id: 'h2',
    title: '光变曲线异常模式与耀斑触发因果关联假说',
    description: 'TESS光变曲线中特定的异常模式是耀斑能量积累的可观测前兆信号，与后续耀斑爆发存在因果关联。',
    scores: { innovation: 4.5, verifiability: 4.2, theoretical: 3.5, dataSupport: 3.2, practicality: 3.8, overall: 3.84 },
    status: 'reviewed',
    rationale: '恒星耀斑与太阳耀斑具有物理相似性，光变前兆信号具有普适性',
    validation: '统计TESS光变曲线中异常模式与后续耀斑事件的时间关联性',
  },
  {
    id: 'h3',
    title: '跨活动区磁场演化传播假说',
    description: '相邻活动区之间的磁场演化存在时空传播效应，一个活动区的磁场重组可触发邻近活动区的耀斑爆发。',
    scores: { innovation: 4.7, verifiability: 3.5, theoretical: 4.0, dataSupport: 3.0, practicality: 3.5, overall: 3.74 },
    status: 'draft',
    rationale: '磁流体力学波动可在活动区之间传播，引发级联效应',
    validation: '分析SDO/HMI全日面磁场数据中活动区间的时空关联',
  },
];

const DIMENSIONS = ['创新性', '可验证性', '理论基础', '数据支持', '实用性'];

export default function HypothesisPage() {
  const [selectedProject, setSelectedProject] = useState<ResearchProject | null>(null);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [hypotheses, setHypotheses] = useState<HypothesisCard[]>([]);
  const [selectedHypotheses, setSelectedHypotheses] = useState<Set<string>>(new Set(['h1']));
  const [activeView, setActiveView] = useState<'cards' | 'comparison' | 'detail'>('cards');
  const [selectedHyp, setSelectedHyp] = useState<HypothesisCard | null>(null);
  const [editingHyp, setEditingHyp] = useState<HypothesisCard | null>(null);
  const { setHypothesisResult } = useResearchStore();

  // When project selected, load existing data
  useEffect(() => {
    if (selectedProject) {
      setQuery(selectedProject.question || '');
      // Load existing hypothesis result from project
      if (selectedProject.id) {
        researchAPI.getProject(selectedProject.id)
          .then((res) => {
            const proj = res.data;
            if (proj?.stages?.hypothesis?.status === 'completed' && proj.stages.hypothesis.result) {
              const hypResult = proj.stages.hypothesis.result;
              if (hypResult.hypotheses) {
                setHypotheses(hypResult.hypotheses);
              }
            }
          })
          .catch(() => {});
      }
    }
  }, [selectedProject]);

  const handleGenerate = () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setResult('');

    const messages = [
      { role: 'system' as const, content: '你是假设生成器智能体。请基于科学问题生成3个候选假设，每个包含：标题、核心观点、理论依据、验证方案、五维度评分（1-5分）。使用Markdown格式。' },
      { role: 'user' as const, content: query },
    ];

    let content = '';
    bailianAPI.chatStream(
      { model: 'reasoning', messages, temperature: 0.8 },
      (chunk) => { content += chunk; setResult(content); },
      () => {
        setLoading(false);
        setHypotheses(MOCK_HYPOTHESES);
        setHypothesisResult({ hypotheses: MOCK_HYPOTHESES, comparison: null, recommendations: [] });
      },
      (error) => { setResult(`生成出错：${error}`); setLoading(false); }
    );
  };

  const toggleHypothesis = (id: string) => {
    setSelectedHypotheses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveEdit = (edited: HypothesisCard) => {
    setHypotheses((prev) => prev.map((h) => h.id === edited.id ? edited : h));
    if (selectedHyp?.id === edited.id) setSelectedHyp(edited);
    setEditingHyp(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="kicker mb-3">假设生成 / HYPOTHESIS</p>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/20">
            <Lightbulb className="w-6 h-6 text-amber-400" />
          </div>
          假设生成与评估
        </h1>
        <p className="text-gray-400 mt-2 ml-11">AI生成候选科学假设，多维度评估创新性与可验证性</p>
      </div>

      {/* Project Selector */}
      <ProjectSelector
        selectedProject={selectedProject}
        onSelect={setSelectedProject}
        stageLabel="假设生成"
      />

      {/* Show content only after project selected */}
      {selectedProject ? (
        <>
          {/* Project Info Card */}
          <div className="card-lab bg-amber-500/5 border-amber-500/20">
            <div className="flex items-center gap-3">
              <Lightbulb className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-white">{selectedProject.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{selectedProject.domain} · {selectedProject.question}</p>
              </div>
            </div>
          </div>

          {/* Input */}
          <div className="card-lab">
            <div className="flex gap-3">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="输入科学问题或知识缺口描述..."
                className="input-field flex-1 min-h-[80px] resize-none"
                rows={2}
              />
              <button onClick={handleGenerate} disabled={loading || !query.trim()} className="btn-primary self-end flex items-center gap-2 h-10">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
                生成假设
              </button>
            </div>
          </div>

          {/* AI streaming result */}
          {(result || loading) && (
            <div className="card-lab">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <h3 className="font-medium text-white">AI 实时生成结果</h3>
                <span className="badge badge-info mono text-[10px]">qwen-max · 百炼</span>
                {loading && <Loader2 className="w-4 h-4 animate-spin text-primary-400 ml-auto" />}
              </div>
              {result ? (
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> 正在调用推理引擎生成假设...
                </p>
              )}
            </div>
          )}

          {/* View Toggle */}
          <div className="flex gap-2">
            {[
              { key: 'cards', label: '候选假设', icon: Lightbulb },
              { key: 'comparison', label: '对比分析', icon: BarChart3 },
              { key: 'detail', label: '详细信息', icon: ChevronRight },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveView(tab.key as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeView === tab.key
                    ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
                    : 'bg-deep-card text-gray-400 border border-deep-border'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Cards View */}
          {activeView === 'cards' && (
            hypotheses.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {hypotheses.map((hyp) => (
                  <div
                    key={hyp.id}
                    className={`card-lab-hover cursor-pointer relative ${
                      selectedHypotheses.has(hyp.id) ? 'ring-2 ring-primary-500/50' : ''
                    }`}
                    onClick={() => { toggleHypothesis(hyp.id); setSelectedHyp(hyp); }}
                  >
                    {selectedHypotheses.has(hyp.id) && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                    {/* Edit button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingHyp(hyp); }}
                      className="absolute top-3 left-3 w-7 h-7 rounded-lg bg-deep-dark/80 hover:bg-primary-500/20 flex items-center justify-center transition-colors"
                      title="编辑假设"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-gray-400 hover:text-primary-400" />
                    </button>
                    <div className="flex items-center gap-2 mb-3 mt-6">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        hyp.id === 'h1' ? 'bg-blue-500/20' : hyp.id === 'h2' ? 'bg-emerald-500/20' : 'bg-purple-500/20'
                      }`}>
                        <Lightbulb className={`w-4 h-4 ${
                          hyp.id === 'h1' ? 'text-blue-400' : hyp.id === 'h2' ? 'text-emerald-400' : 'text-purple-400'
                        }`} />
                      </div>
                      <span className={`badge ${hyp.status === 'approved' ? 'badge-success' : hyp.status === 'reviewed' ? 'badge-info' : 'badge-warning'}`}>
                        {hyp.status === 'approved' ? '已通过' : hyp.status === 'reviewed' ? '已评审' : '草稿'}
                      </span>
                    </div>
                    <h3 className="font-medium text-white mb-2">{hyp.title}</h3>
                    <p className="text-sm text-gray-400 line-clamp-3 mb-4">{hyp.description}</p>

                    {/* Scores */}
                    <div className="space-y-2">
                      {[
                        { label: '创新性', value: hyp.scores.innovation, icon: Star, color: 'text-amber-400' },
                        { label: '可验证性', value: hyp.scores.verifiability, icon: Shield, color: 'text-emerald-400' },
                        { label: '理论基础', value: hyp.scores.theoretical, icon: BookOpen, color: 'text-blue-400' },
                        { label: '数据支持', value: hyp.scores.dataSupport, icon: Database, color: 'text-purple-400' },
                        { label: '实用性', value: hyp.scores.practicality, icon: Wrench, color: 'text-rose-400' },
                      ].map((s) => (
                        <div key={s.label} className="flex items-center gap-2">
                          <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                          <span className="text-xs text-gray-400 w-16">{s.label}</span>
                          <div className="flex-1 h-1.5 bg-deep-dark rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(s.value / 5) * 100}%`, backgroundColor: 'currentColor', color: s.color.replace('text-', '') }}></div>
                          </div>
                          <span className="text-xs text-gray-300 w-8 text-right">{s.value.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-3 border-t border-deep-border flex items-center justify-between">
                      <span className="text-lg font-bold gradient-text">{hyp.scores.overall.toFixed(2)}</span>
                      <span className="text-xs text-gray-500">综合评分</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card-lab flex items-center justify-center h-48 text-gray-500">
                <div className="text-center">
                  <Lightbulb className="w-10 h-10 mx-auto mb-2 text-deep-border" />
                  <p>点击"生成假设"开始生成候选假设</p>
                </div>
              </div>
            )
          )}

          {/* Comparison View */}
          {activeView === 'comparison' && (
            hypotheses.length > 0 ? (
              <div className="card-lab">
                <h3 className="font-medium text-white mb-6">多维度对比分析</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-deep-border">
                        <th className="text-left py-3 px-4 text-sm text-gray-400 font-medium">评估维度</th>
                        {hypotheses.map((h) => (
                          <th key={h.id} className="text-center py-3 px-4 text-sm text-gray-400 font-medium">{h.title.slice(0, 10)}...</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DIMENSIONS.map((dim, i) => (
                        <tr key={dim} className="border-b border-deep-border/50">
                          <td className="py-3 px-4 text-sm text-gray-300">{dim}</td>
                          {hypotheses.map((h) => {
                            const vals = [h.scores.innovation, h.scores.verifiability, h.scores.theoretical, h.scores.dataSupport, h.scores.practicality];
                            const maxVal = Math.max(...vals);
                            const isMax = vals[i] === maxVal;
                            return (
                              <td key={h.id} className="py-3 px-4 text-center">
                                <span className={`text-sm font-medium ${isMax ? 'text-emerald-400' : 'text-gray-300'}`}>
                                  {vals[i].toFixed(1)}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr className="bg-primary-500/5">
                        <td className="py-3 px-4 text-sm font-medium text-primary-400">综合评分</td>
                        {hypotheses.map((h) => (
                          <td key={h.id} className="py-3 px-4 text-center">
                            <span className="text-lg font-bold gradient-text">{h.scores.overall.toFixed(2)}</span>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 p-4 bg-primary-500/10 border border-primary-500/20 rounded-lg">
                  <h4 className="text-sm font-medium text-primary-400 mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    推荐排序
                  </h4>
                  <ol className="space-y-2 text-sm text-gray-300">
                    {[...hypotheses]
                      .sort((a, b) => b.scores.overall - a.scores.overall)
                      .map((h, i) => (
                        <li key={h.id} className="flex items-start gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            i === 0 ? 'bg-emerald-500/20 text-emerald-400' : i === 1 ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-gray-400'
                          }`}>{i + 1}</span>
                          <span><strong className="text-white">{h.title.slice(0, 15)}...</strong> - 综合评分 {h.scores.overall.toFixed(2)}</span>
                        </li>
                      ))
                    }
                  </ol>
                </div>
              </div>
            ) : (
              <div className="card-lab flex items-center justify-center h-48 text-gray-500">
                <div className="text-center">
                  <BarChart3 className="w-10 h-10 mx-auto mb-2 text-deep-border" />
                  <p>生成假设后可查看对比分析</p>
                </div>
              </div>
            )
          )}

          {/* Detail View */}
          {activeView === 'detail' && selectedHyp && (
            <div className="card-lab">
              <h3 className="text-lg font-semibold text-white mb-4">{selectedHyp.title}</h3>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">核心观点</h4>
                  <p className="text-sm text-gray-400 leading-relaxed">{selectedHyp.description}</p>
                </div>
                {selectedHyp.rationale && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-2">理论依据</h4>
                    <p className="text-sm text-gray-400 leading-relaxed">{selectedHyp.rationale}</p>
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">验证方案</h4>
                  <div className="bg-deep-dark rounded-lg p-4 text-sm text-gray-400">
                    {selectedHyp.validation || '待补充验证方案'}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    风险因素
                  </h4>
                  <ul className="space-y-2">
                    {['数据样本的充分性可能影响模型泛化', '多源数据融合的对齐精度需特别注意', '特征维度增加可能带来过拟合风险'].map((risk, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0"></span>
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeView === 'detail' && !selectedHyp && (
            <div className="card-lab flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <Lightbulb className="w-12 h-12 mx-auto mb-3 text-deep-border" />
                <p>点击假设卡片查看详情</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="card-lab flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <Lightbulb className="w-12 h-12 mx-auto mb-3 text-deep-border" />
            <p>请先选择一个研究项目</p>
            <p className="text-xs text-gray-600 mt-1">选择项目后将自动填充研究问题</p>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingHyp && (
        <EditHypothesisModal
          hypothesis={editingHyp}
          onSave={handleSaveEdit}
          onClose={() => setEditingHyp(null)}
        />
      )}
    </div>
  );
}

// Edit Modal Component
function EditHypothesisModal({ hypothesis, onSave, onClose }: {
  hypothesis: HypothesisCard;
  onSave: (h: HypothesisCard) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(hypothesis.title);
  const [description, setDescription] = useState(hypothesis.description);
  const [rationale, setRationale] = useState(hypothesis.rationale || '');
  const [validation, setValidation] = useState(hypothesis.validation || '');
  const [scores, setScores] = useState(hypothesis.scores);

  const handleScoreChange = (key: string, value: number) => {
    const newScores = { ...scores, [key]: value };
    const vals = [newScores.innovation, newScores.verifiability, newScores.theoretical, newScores.dataSupport, newScores.practicality];
    newScores.overall = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
    setScores(newScores);
  };

  const handleSave = () => {
    onSave({ ...hypothesis, title, description, rationale, validation, scores });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-deep-card border border-deep-border rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-primary-400" />
            编辑候选假设
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-300 mb-1 block">标题</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field w-full" />
          </div>
          <div>
            <label className="text-sm text-gray-300 mb-1 block">描述</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input-field w-full min-h-[80px] resize-none" rows={3} />
          </div>
          <div>
            <label className="text-sm text-gray-300 mb-1 block">理论依据</label>
            <textarea value={rationale} onChange={(e) => setRationale(e.target.value)} className="input-field w-full min-h-[60px] resize-none" rows={2} />
          </div>
          <div>
            <label className="text-sm text-gray-300 mb-1 block">验证方案</label>
            <textarea value={validation} onChange={(e) => setValidation(e.target.value)} className="input-field w-full min-h-[60px] resize-none" rows={2} />
          </div>

          <div>
            <label className="text-sm text-gray-300 mb-2 block">评分（0-5）</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'innovation', label: '创新性' },
                { key: 'verifiability', label: '可验证性' },
                { key: 'theoretical', label: '理论基础' },
                { key: 'dataSupport', label: '数据支持' },
                { key: 'practicality', label: '实用性' },
              ].map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-16">{s.label}</span>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={(scores as any)[s.key]}
                    onChange={(e) => handleScoreChange(s.key, parseFloat(e.target.value) || 0)}
                    className="input-field w-20 text-center text-sm"
                  />
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-16">综合</span>
                <span className="text-sm font-bold gradient-text">{scores.overall.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">取消</button>
          <button onClick={handleSave} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Save className="w-4 h-4" />
            保存修改
          </button>
        </div>
      </div>
    </div>
  );
}
