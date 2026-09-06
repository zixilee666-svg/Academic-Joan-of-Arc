import { useState, useEffect } from 'react';
import { bailianAPI, researchAPI } from '../services/api';
import { useResearchStore } from '../stores';
import type { Paper, Evidence, KnowledgeGap, ResearchProject } from '../types';
import ProjectSelector from '../components/ProjectSelector';
import {
  BookOpen,
  Search,
  Loader2,
  Send,
  ExternalLink,
  Star,
  AlertCircle,
  Link2,
  Filter,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MOCK_PAPERS: Paper[] = [
  { id: 'p1', title: 'Deep Learning Approaches for Solar Flare Prediction', authors: ['Zhang, W.', 'Li, M.'], year: 2024, journal: 'Space Weather', abstract: 'Comprehensive review of deep learning methods for solar flare prediction.', relevance: 0.95, keywords: ['深度学习', '耀斑预测'] },
  { id: 'p2', title: 'Magnetic Shear Angle as a Predictor of Flare Intensity', authors: ['Wang, J.', 'Liu, Y.'], year: 2023, journal: 'ApJ', abstract: 'Significant correlation between magnetic shear angle and flare intensity.', relevance: 0.92, keywords: ['磁场剪切角', '统计'] },
  { id: 'p3', title: 'Multi-wavelength Data Fusion for Solar Activity', authors: ['Chen, H.', 'Sun, L.'], year: 2023, journal: 'Solar Physics', abstract: 'Multi-wavelength fusion framework for solar activity analysis.', relevance: 0.88, keywords: ['多波段', '数据融合'] },
  { id: 'p4', title: 'TESS Light Curve Anomaly Detection', authors: ['Liu, X.', 'Park, S.'], year: 2024, journal: 'MNRAS', abstract: 'Anomaly detection in TESS light curves for stellar flare studies.', relevance: 0.82, keywords: ['TESS', '异常检测'] },
  { id: 'p5', title: 'Graph Neural Networks for Active Region Modeling', authors: ['Kim, D.', 'Lee, J.'], year: 2024, journal: 'Astronomy & Computing', abstract: 'GNN application for solar active region spatial modeling.', relevance: 0.78, keywords: ['图神经网络', '活动区'] },
];

const MOCK_EVIDENCE: Evidence[] = [
  { id: 'e1', claim: '磁场梯度>0.5 G/km的活动区爆发M级以上耀斑的概率为73%', supportingPapers: ['p1', 'p2'], confidence: 0.85, source: 'JW-SSD 2010-2024' },
  { id: 'e2', claim: 'TESS光变曲线中耀斑前2-6小时可检测到异常增亮信号', supportingPapers: ['p4'], confidence: 0.72, source: 'TESS光变曲线' },
  { id: 'e3', claim: '多波段数据融合可提升预测准确率约15%', supportingPapers: ['p3', 'p1'], confidence: 0.78, source: '交叉验证实验' },
  { id: 'e4', claim: '图神经网络可有效建模活动区之间的磁场传播', supportingPapers: ['p5'], confidence: 0.68, source: 'SDO/HMI数据' },
];

const MOCK_GAPS: KnowledgeGap[] = [
  { id: 'g1', description: '缺乏跨波段的统一特征工程框架', severity: 'high', relatedPapers: ['p1', 'p3'], suggestion: '构建多波段统一特征空间' },
  { id: 'g2', description: 'X级极端耀斑预测能力不足', severity: 'high', relatedPapers: ['p1'], suggestion: '引入代价敏感学习' },
  { id: 'g3', description: '物理机制与数据驱动方法融合不够深入', severity: 'medium', relatedPapers: ['p2', 'p5'], suggestion: '设计物理信息神经网络' },
];

export default function LiteraturePage() {
  const [selectedProject, setSelectedProject] = useState<ResearchProject | null>(null);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<'papers' | 'evidence' | 'gaps' | 'summary'>('papers');
  const { setLiteratureResult } = useResearchStore();

  // When project selected, pre-fill query and load existing data
  useEffect(() => {
    if (selectedProject) {
      setQuery(selectedProject.question || '');
      // Load existing literature result from project
      if (selectedProject.id) {
        researchAPI.getProject(selectedProject.id)
          .then((res) => {
            const proj = res.data;
            if (proj?.stages?.literature?.status === 'completed' && proj.stages.literature.result) {
              const litResult = proj.stages.literature.result;
              if (litResult.summary) setResult(litResult.summary);
            }
          })
          .catch(() => {});
      }
    }
  }, [selectedProject]);

  const handleSearch = () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setResult('');
    setActiveView('summary');

    const messages = [
      { role: 'system' as const, content: '你是文献整合者智能体。请检索相关文献，提取关键证据，识别知识缺口。输出包含：1)核心文献列表 2)关键证据 3)知识缺口 4)综述总结。使用Markdown格式。' },
      { role: 'user' as const, content: query },
    ];

    let content = '';
    bailianAPI.chatStream(
      { model: 'general', messages, temperature: 0.3 },
      (chunk) => { content += chunk; setResult(content); },
      () => {
        setLoading(false);
        setLiteratureResult({ papers: MOCK_PAPERS, evidence: MOCK_EVIDENCE, gaps: MOCK_GAPS, summary: content });
      },
      (error) => { setResult(`检索出错：${error}`); setLoading(false); }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="kicker mb-3">文献综述 / LITERATURE</p>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/20">
            <BookOpen className="w-6 h-6 text-emerald-400" />
          </div>
          智能文献综述
        </h1>
        <p className="text-gray-400 mt-2 ml-11">多源文献检索、关键证据提取、知识缺口识别</p>
      </div>

      {/* Project Selector */}
      <ProjectSelector
        selectedProject={selectedProject}
        onSelect={setSelectedProject}
        stageLabel="文献综述"
      />

      {/* Show content only after project selected */}
      {selectedProject ? (
        <>
          {/* Project Info Card */}
          <div className="card-lab bg-emerald-500/5 border-emerald-500/20">
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-white">{selectedProject.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{selectedProject.domain} · {selectedProject.question}</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="card-lab">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="输入研究主题或科学问题..."
                  className="input-field w-full pl-10"
                />
              </div>
              <button onClick={handleSearch} disabled={loading || !query.trim()} className="btn-primary flex items-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                检索
              </button>
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Filter className="w-3 h-3" /> 数据源：arXiv, ADS, NADC, CNKI</span>
              <span>已索引 2.4M+ 篇文献</span>
            </div>
          </div>

          {/* View Tabs */}
          <div className="flex gap-2">
            {[
              { key: 'papers', label: `文献列表 (${MOCK_PAPERS.length})`, icon: BookOpen },
              { key: 'evidence', label: `证据图谱 (${MOCK_EVIDENCE.length})`, icon: Link2 },
              { key: 'gaps', label: `知识缺口 (${MOCK_GAPS.length})`, icon: AlertCircle },
              { key: 'summary', label: '综述总结', icon: Send },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveView(tab.key as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeView === tab.key
                    ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
                    : 'bg-deep-card text-gray-400 border border-deep-border hover:border-deep-border/80'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {activeView === 'papers' && (
            <div className="space-y-3">
              {MOCK_PAPERS.map((paper) => (
                <div key={paper.id} className="card-lab-hover">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-medium text-white hover:text-primary-400 transition-colors cursor-pointer">{paper.title}</h3>
                      <p className="text-sm text-gray-400 mt-1">{paper.authors.join(', ')} · {paper.year} · {paper.journal}</p>
                      <p className="text-sm text-gray-500 mt-2 line-clamp-2">{paper.abstract}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {paper.keywords.map((kw) => (
                          <span key={kw} className="badge-info">{kw}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span className="text-sm font-medium text-amber-400">{(paper.relevance * 100).toFixed(0)}%</span>
                      </div>
                      <button className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> 详情
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeView === 'evidence' && (
            <div className="space-y-3">
              {MOCK_EVIDENCE.map((ev) => (
                <div key={ev.id} className="card-lab">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      ev.confidence > 0.8 ? 'bg-emerald-500/20' : ev.confidence > 0.7 ? 'bg-amber-500/20' : 'bg-red-500/20'
                    }`}>
                      <Link2 className={`w-4 h-4 ${
                        ev.confidence > 0.8 ? 'text-emerald-400' : ev.confidence > 0.7 ? 'text-amber-400' : 'text-red-400'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-200">{ev.claim}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>置信度: <strong className={ev.confidence > 0.8 ? 'text-emerald-400' : 'text-amber-400'}>{(ev.confidence * 100).toFixed(0)}%</strong></span>
                        <span>来源: {ev.source}</span>
                        <span>支持文献: {ev.supportingPapers.length}篇</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeView === 'gaps' && (
            <div className="space-y-3">
              {MOCK_GAPS.map((gap) => (
                <div key={gap.id} className={`card-lab border-l-4 ${gap.severity === 'high' ? 'border-l-red-500' : 'border-l-amber-500'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className={`w-4 h-4 ${gap.severity === 'high' ? 'text-red-400' : 'text-amber-400'}`} />
                        <span className={`text-xs font-medium ${gap.severity === 'high' ? 'text-red-400' : 'text-amber-400'}`}>
                          {gap.severity === 'high' ? '高优先级' : '中优先级'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-200">{gap.description}</p>
                      <p className="text-xs text-primary-400 mt-2">建议：{gap.suggestion}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeView === 'summary' && (
            <div className="card-lab min-h-[300px]">
              {result ? (
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                </div>
              ) : loading ? (
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> 正在调用文献整合引擎检索...
                </p>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <div className="text-center">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 text-deep-border" />
                    <p>点击"检索"开始文献综述</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="card-lab flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-deep-border" />
            <p>请先选择一个研究项目</p>
            <p className="text-xs text-gray-600 mt-1">选择项目后将自动填充研究问题</p>
          </div>
        </div>
      )}
    </div>
  );
}
