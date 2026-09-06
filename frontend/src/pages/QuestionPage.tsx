import { useState } from 'react';
import { bailianAPI } from '../services/api';
import { useResearchStore } from '../stores';
import {
  Search,
  Loader2,
  Send,
  Tag,
  Target,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  BookOpen,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const TABS = [
  { key: 'analysis', label: '问题解析', icon: Search },
  { key: 'entities', label: '实体抽取', icon: Tag },
  { key: 'classification', label: '学科分类', icon: BookOpen },
  { key: 'recommendations', label: '相似推荐', icon: Lightbulb },
  { key: 'feasibility', label: '可行性评估', icon: Target },
];

interface ParsedResult {
  analysis: string;
  entities: { name: string; type: string }[];
  classification: string;
  recommendations: { topic: string; reference?: string; year?: string }[];
  feasibility: {
    dataAvailability: number;
    methodMaturity: number;
    innovationSpace: number;
    applicationValue: number;
    overall?: string;
    description?: string;
  };
}

function safeParseJSON(text: string): ParsedResult | null {
  // Strategy 1: direct parse
  try {
    return JSON.parse(text) as ParsedResult;
  } catch { /* continue */ }

  // Strategy 2: extract from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()); } catch { /* continue */ }
  }

  // Strategy 3: find JSON object in text
  const jsonMatch = text.match(/\{[\s\S]*"analysis"[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch { /* continue */ }
  }

  return null;
}

export default function QuestionPage() {
  const [question, setQuestion] = useState('');
  const [activeTab, setActiveTab] = useState('analysis');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedResult | null>(null);
  const { addMessage } = useResearchStore();

  const handleAnalyze = () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setResult('');
    setParsed(null);

    const messages = [
      {
        role: 'system' as const,
        content: `你是Academic Joan of Arc平台的"问题理解引擎"。请对用户提出的科学问题进行深度分析。

你必须返回一个JSON对象（不要包含其他文字），格式如下：
{
  "analysis": "对问题的深度解析与重构，200-400字，使用Markdown格式",
  "entities": [
    {"name": "实体名称", "type": "概念|机制|方法|场景|变量"},
    ...至少5个实体
  ],
  "classification": "学科领域分类结果，例如：天体物理学 > 太阳物理 > 耀斑预测；人工智能 > 深度学习 > 时序预测",
  "recommendations": [
    {"topic": "相似研究问题", "reference": "参考论文或研究方向", "year": "2024"},
    ...至少3个推荐
  ],
  "feasibility": {
    "dataAvailability": 85,
    "methodMaturity": 72,
    "innovationSpace": 88,
    "applicationValue": 92,
    "overall": "可行性高/中/低",
    "description": "综合评估说明"
  }
}

注意：feasibility中的4个评分为0-100的整数。entities中type只能是：概念、机制、方法、场景、变量。`,
      },
      { role: 'user' as const, content: question },
    ];

    let content = '';
    bailianAPI.chatStream(
      { model: 'general', messages, temperature: 0.5 },
      (chunk) => {
        content += chunk;
        setResult(content);
      },
      () => {
        setLoading(false);
        const p = safeParseJSON(content);
        if (p) setParsed(p);
        addMessage({
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: content,
          timestamp: new Date().toISOString(),
        });
      },
      (error) => {
        setResult(`分析出错：${error}`);
        setLoading(false);
      }
    );
  };

  const entityTypeColor: Record<string, string> = {
    '概念': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    '机制': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    '方法': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    '场景': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    '变量': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="kicker mb-3">问题理解 / QUESTION</p>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/20 border border-blue-500/20">
            <Search className="w-6 h-6 text-blue-400" />
          </div>
          问题理解引擎
        </h1>
        <p className="text-gray-400 mt-2 ml-11">输入科学问题，AI将自动解析、分类并评估研究可行性</p>
      </div>

      {/* Input */}
      <div className="card-lab">
        <div className="flex gap-3">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="请输入科学问题，例如：太阳耀斑爆发与磁场拓扑结构变化之间存在怎样的定量关系？如何利用多波段观测数据提升耀斑预测的准确率和提前预警时间？"
            className="input-field flex-1 min-h-[100px] resize-none"
            rows={3}
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !question.trim()}
            className="btn-primary self-end flex items-center gap-2 h-10"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            分析
          </button>
        </div>

        {/* Quick questions */}
        <div className="flex flex-wrap gap-2 mt-3">
          {['太阳耀斑预测机制', 'ESG对企业财务绩效的影响', '大语言模型的幻觉问题', '暗物质探测新方法'].map((q) => (
            <button
              key={q}
              onClick={() => setQuestion(q)}
              className="px-3 py-1 rounded-full bg-deep-border/50 text-xs text-gray-400 hover:text-primary-400 hover:bg-primary-500/10 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-deep-card rounded-xl p-1 border border-deep-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main result */}
        <div className="lg:col-span-2 card-lab min-h-[400px]">
          <h3 className="font-medium text-white mb-4">{TABS.find((t) => t.key === activeTab)?.label}</h3>

          {loading && !result && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-3" />
                <p className="text-gray-400">AI正在分析中...</p>
              </div>
            </div>
          )}

          {/* Tab: 问题解析 */}
          {activeTab === 'analysis' && !loading && (
            parsed?.analysis ? (
              <div className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsed.analysis}</ReactMarkdown>
              </div>
            ) : result ? (
              <div className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <Search className="w-12 h-12 mx-auto mb-3 text-deep-border" />
                  <p>输入科学问题后点击"分析"</p>
                </div>
              </div>
            )
          )}

          {/* Tab: 实体抽取 */}
          {activeTab === 'entities' && !loading && (
            parsed?.entities?.length ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  {parsed.entities.map((entity, i) => (
                    <div
                      key={i}
                      className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 ${
                        entityTypeColor[entity.type] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                      }`}
                    >
                      <span className="text-sm font-medium">{entity.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/20">{entity.type}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-deep-dark rounded-lg border border-deep-border/50">
                  <p className="text-xs text-gray-500">
                    共抽取 <strong className="text-primary-400">{parsed.entities.length}</strong> 个关键实体，
                    涵盖 <strong className="text-primary-400">{new Set(parsed.entities.map(e => e.type)).size}</strong> 种类型
                  </p>
                </div>
              </div>
            ) : result ? (
              <div className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <Tag className="w-12 h-12 mx-auto mb-3 text-deep-border" />
                  <p>输入科学问题后点击"分析"</p>
                </div>
              </div>
            )
          )}

          {/* Tab: 学科分类 */}
          {activeTab === 'classification' && !loading && (
            parsed?.classification ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center p-8">
                  <div className="text-center">
                    <BookOpen className="w-10 h-10 text-primary-400 mx-auto mb-4" />
                    <div className="flex items-center gap-3 text-lg">
                      {parsed.classification.split('>').map((part, i, arr) => (
                        <span key={i} className="flex items-center gap-3">
                          <span className={`px-4 py-2 rounded-lg ${
                            i === arr.length - 1
                              ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30 font-medium'
                              : 'bg-deep-dark text-gray-300 border border-deep-border'
                          }`}>
                            {part.trim()}
                          </span>
                          {i < arr.length - 1 && <span className="text-gray-600">›</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : result ? (
              <div className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 text-deep-border" />
                  <p>输入科学问题后点击"分析"</p>
                </div>
              </div>
            )
          )}

          {/* Tab: 相似推荐 */}
          {activeTab === 'recommendations' && !loading && (
            parsed?.recommendations?.length ? (
              <div className="space-y-3">
                {parsed.recommendations.map((rec, i) => (
                  <div key={i} className="card-lab-hover flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-amber-400">{i + 1}</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-white">{rec.topic}</h4>
                      {rec.reference && (
                        <p className="text-sm text-gray-400 mt-1">{rec.reference}</p>
                      )}
                      {rec.year && (
                        <span className="badge badge-info text-[10px] mt-2">{rec.year}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : result ? (
              <div className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <Lightbulb className="w-12 h-12 mx-auto mb-3 text-deep-border" />
                  <p>输入科学问题后点击"分析"</p>
                </div>
              </div>
            )
          )}

          {/* Tab: 可行性评估 */}
          {activeTab === 'feasibility' && !loading && (
            parsed?.feasibility ? (
              <div className="space-y-4">
                {[
                  { label: '数据可得性', score: parsed.feasibility.dataAvailability, color: 'bg-blue-500' },
                  { label: '方法成熟度', score: parsed.feasibility.methodMaturity, color: 'bg-emerald-500' },
                  { label: '创新空间', score: parsed.feasibility.innovationSpace, color: 'bg-amber-500' },
                  { label: '应用价值', score: parsed.feasibility.applicationValue, color: 'bg-purple-500' },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-300">{item.label}</span>
                      <span className="text-gray-400">{item.score}%</span>
                    </div>
                    <div className="h-2.5 bg-deep-dark rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${item.score}%` }}></div>
                    </div>
                  </div>
                ))}
                {parsed.feasibility.description && (
                  <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-1">
                      <CheckCircle2 className="w-4 h-4" />
                      综合评估：{parsed.feasibility.overall || '可行性高'}
                    </div>
                    <p className="text-xs text-gray-400">{parsed.feasibility.description}</p>
                  </div>
                )}
              </div>
            ) : result ? (
              <div className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <Target className="w-12 h-12 mx-auto mb-3 text-deep-border" />
                  <p>输入科学问题后点击"分析"</p>
                </div>
              </div>
            )
          )}

          {/* Loading state while streaming */}
          {loading && result && (
            <div className="markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <div className="card-lab">
            <h3 className="font-medium text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary-400" />
              可行性评估
            </h3>
            {parsed?.feasibility ? (
              <div className="space-y-4">
                {[
                  { label: '数据可得性', score: parsed.feasibility.dataAvailability, color: 'bg-blue-500' },
                  { label: '方法成熟度', score: parsed.feasibility.methodMaturity, color: 'bg-emerald-500' },
                  { label: '创新空间', score: parsed.feasibility.innovationSpace, color: 'bg-amber-500' },
                  { label: '应用价值', score: parsed.feasibility.applicationValue, color: 'bg-purple-500' },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-300">{item.label}</span>
                      <span className="text-gray-400">{item.score}%</span>
                    </div>
                    <div className="h-2.5 bg-deep-dark rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${item.score}%` }}></div>
                    </div>
                  </div>
                ))}
                <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    综合评估：{parsed.feasibility.overall || '可行性高'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 text-deep-border" />
                <p className="text-xs">分析后显示评估</p>
              </div>
            )}
          </div>

          {parsed?.recommendations?.length ? (
            <div className="card-lab">
              <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                相似推荐
              </h3>
              <ul className="space-y-2">
                {parsed.recommendations.slice(0, 3).map((rec, i) => (
                  <li key={i} className="text-sm text-gray-400 p-2 bg-deep-dark rounded-lg">
                    <p className="text-gray-200 text-xs font-medium">{rec.topic}</p>
                    {rec.reference && <p className="text-[10px] text-gray-500 mt-0.5">{rec.reference}</p>}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="card-lab">
            <h3 className="font-medium text-white mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              风险提示
            </h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0"></span>
                关键样本的充分性可能影响模型泛化
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0"></span>
                多源数据融合的对齐精度需特别注意
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0"></span>
                建议结合领域机制解释，避免纯数据驱动
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
