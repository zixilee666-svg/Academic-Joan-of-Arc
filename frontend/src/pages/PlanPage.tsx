import { useState, useEffect } from 'react';
import { bailianAPI, researchAPI } from '../services/api';
import { useResearchStore } from '../stores';
import type { ExperimentVariable, ExperimentStep, GanttTask, RiskItem, ResearchProject } from '../types';
import ProjectSelector from '../components/ProjectSelector';
import {
  FlaskConical,
  Loader2,
  Table,
  ListOrdered,
  Code,
  Calendar,
  AlertTriangle,
  Copy,
  Check,
  HardDrive,
  Clock,
  DollarSign,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MOCK_VARIABLES: ExperimentVariable[] = [
  { type: 'independent', name: '特征融合方式', definition: '输入特征的波段组合策略', range: '单波段/双波段/多波段' },
  { type: 'independent', name: '模型架构', definition: '深度学习模型的网络结构', range: 'CNN/LSTM/CNN-LSTM/Transformer' },
  { type: 'dependent', name: 'TSS评分', definition: 'True Skill Statistic', range: '0-1' },
  { type: 'dependent', name: '预警提前时间', definition: '从预警到爆发的时间', range: '0-48h' },
  { type: 'control', name: '预测时间窗口', definition: '模型预测的未来时间范围', range: '24h' },
  { type: 'control', name: '训练数据集', definition: 'JW-SSD 2010-2024', range: '固定' },
];

const MOCK_STEPS: ExperimentStep[] = [
  { order: 1, name: '数据收集与预处理', description: '下载JW-SSD、JW-FD数据，清洗缺失值，统一时间戳', duration: '2周', deliverable: '标准化数据集' },
  { order: 2, name: '特征工程', description: '提取磁场拓扑参数，构建多波段特征矩阵', duration: '2周', deliverable: '特征矩阵' },
  { order: 3, name: '基线模型训练', description: '训练CNN/LSTM/CNN-LSTM/Transformer基线', duration: '2周', deliverable: '4个基线模型' },
  { order: 4, name: '融合模型训练', description: '多波段特征训练，引入注意力机制', duration: '3周', deliverable: '融合模型' },
  { order: 5, name: '评估与对比', description: '计算TSS/HSS等指标，统计显著性检验', duration: '1周', deliverable: '评估报告' },
  { order: 6, name: '可解释性分析', description: 'Grad-CAM/SHAP分析模型决策依据', duration: '1周', deliverable: '解释性报告' },
  { order: 7, name: '论文撰写', description: '整理实验结果，撰写学术论文', duration: '2周', deliverable: '论文初稿' },
];

const MOCK_GANTT: GanttTask[] = [
  { id: 't1', name: '数据预处理', start: 0, duration: 14, dependencies: [] },
  { id: 't2', name: '特征工程', start: 14, duration: 14, dependencies: ['t1'] },
  { id: 't3', name: '基线训练', start: 28, duration: 14, dependencies: ['t2'] },
  { id: 't4', name: '融合训练', start: 42, duration: 21, dependencies: ['t3'] },
  { id: 't5', name: '评估对比', start: 63, duration: 7, dependencies: ['t4'] },
  { id: 't6', name: '可解释性', start: 70, duration: 7, dependencies: ['t5'] },
  { id: 't7', name: '论文撰写', start: 77, duration: 14, dependencies: ['t6'] },
];

const MOCK_RISKS: RiskItem[] = [
  { risk: '多波段数据时间对齐精度不足', probability: 'medium', impact: 'high', mitigation: '插值+时间窗口匹配' },
  { risk: 'X级耀斑样本过少', probability: 'high', impact: 'high', mitigation: 'SMOTE+代价敏感学习' },
  { risk: '模型过拟合', probability: 'medium', impact: 'medium', mitigation: 'Dropout+早停+交叉验证' },
  { risk: 'GPU算力不足', probability: 'low', impact: 'medium', mitigation: '本地GPU或云端弹性算力' },
];

const MOCK_CODE = `import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.metrics import confusion_matrix
from sklearn.preprocessing import StandardScaler

# Academic Joan of Arc - 实验代码框架

def load_data(data_dir='data/'):
    hmi_data = pd.read_csv(f'{data_dir}jw_ssd_hmi.csv')
    aia_data = pd.read_csv(f'{data_dir}jw_ssd_aia.csv')
    flare_labels = pd.read_csv(f'{data_dir}flare_labels.csv')
    merged = pd.merge_asof(
        hmi_data.sort_values('timestamp'),
        aia_data.sort_values('timestamp'),
        on='timestamp',
        tolerance=pd.Timedelta('30min'),
    )
    return merged

class CNNLSTMModel(nn.Module):
    def __init__(self, input_dim=8, hidden_dim=128):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv1d(input_dim, 64, 3, padding=1),
            nn.ReLU(),
            nn.Conv1d(64, 128, 3, padding=1),
            nn.ReLU(),
        )
        self.lstm = nn.LSTM(128, hidden_dim, batch_first=True,
                           bidirectional=True)
        self.classifier = nn.Linear(hidden_dim * 2, 2)

    def forward(self, x):
        cnn_out = self.cnn(x.permute(0, 2, 1))
        cnn_out = cnn_out.permute(0, 2, 1)
        lstm_out, _ = self.lstm(cnn_out)
        return self.classifier(lstm_out[:, -1, :])

def compute_tss(y_true, y_pred):
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
    return tp/(tp+fn) + tn/(tn+fp) - 1

if __name__ == '__main__':
    print("加载数据...")
    df = load_data()
    print(f"数据集: {len(df)} 样本")
    model = CNNLSTMModel()
    print(f"模型参数量: {sum(p.numel() for p in model.parameters()):,}")
    print("训练完成！")`;

export default function PlanPage() {
  const [selectedProject, setSelectedProject] = useState<ResearchProject | null>(null);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'variables' | 'steps' | 'gantt' | 'code' | 'risks'>('variables');
  const [copied, setCopied] = useState(false);
  const { setExperimentResult } = useResearchStore();

  // When project selected, pre-fill query and load existing data
  useEffect(() => {
    if (selectedProject) {
      // Pre-fill with hypothesis or question
      const input = selectedProject.hypothesis?.title
        ? `${selectedProject.hypothesis.title}: ${selectedProject.hypothesis.description}`
        : selectedProject.question || '';
      setQuery(input);

      // Load existing experiment result
      if (selectedProject.id) {
        researchAPI.getProject(selectedProject.id)
          .then((res) => {
            const proj = res.data;
            if (proj?.stages?.experiment?.status === 'completed' && proj.stages.experiment.result) {
              const expResult = proj.stages.experiment.result;
              if (expResult.objective) setResult(expResult.objective);
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
      { role: 'system' as const, content: '你是实验规划师智能体。请设计完整的验证实验方案，包含：变量定义表、实验步骤、Python代码框架、甘特图任务规划、资源估算、风险评估。使用Markdown格式。' },
      { role: 'user' as const, content: query },
    ];

    let content = '';
    bailianAPI.chatStream(
      { model: 'coding', messages, temperature: 0.3 },
      (chunk) => { content += chunk; setResult(content); },
      () => {
        setLoading(false);
        setExperimentResult({
          objective: '',
          variables: MOCK_VARIABLES,
          steps: MOCK_STEPS,
          code: MOCK_CODE,
          gantt: MOCK_GANTT,
          resources: { compute: 'NVIDIA A100 GPU', storage: '约60GB', time: '11周', cost: '约700元' },
          risks: MOCK_RISKS,
        });
      },
      (error) => { setResult(`生成出错：${error}`); setLoading(false); }
    );
  };

  const copyCode = () => {
    navigator.clipboard.writeText(MOCK_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalDuration = Math.max(...MOCK_GANTT.map((t) => t.start + t.duration));

  return (
    <div className="space-y-6">
      <div>
        <p className="kicker mb-3">研究计划 / EXPERIMENT</p>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/20">
            <FlaskConical className="w-6 h-6 text-purple-400" />
          </div>
          研究计划与实验设计
        </h1>
        <p className="text-gray-400 mt-2 ml-11">实验方案设计、代码生成、任务甘特图、资源估算</p>
      </div>

      {/* Project Selector */}
      <ProjectSelector
        selectedProject={selectedProject}
        onSelect={setSelectedProject}
        stageLabel="研究计划"
      />

      {/* Show content only after project selected */}
      {selectedProject ? (
        <>
          {/* Project Info Card */}
          <div className="card-lab bg-purple-500/5 border-purple-500/20">
            <div className="flex items-center gap-3">
              <FlaskConical className="w-5 h-5 text-purple-400" />
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
                placeholder="输入待验证的假设或研究目标..."
                className="input-field flex-1 min-h-[80px] resize-none"
                rows={2}
              />
              <button onClick={handleGenerate} disabled={loading || !query.trim()} className="btn-primary self-end flex items-center gap-2 h-10">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                生成方案
              </button>
            </div>
          </div>

          {/* AI streaming result */}
          {(result || loading) && (
            <div className="card-lab">
              <div className="flex items-center gap-2 mb-3">
                <FlaskConical className="w-4 h-4 text-purple-400" />
                <h3 className="font-medium text-white">AI 实时生成方案</h3>
                <span className="badge badge-info mono text-[10px]">qwen-coder-plus · 百炼</span>
                {loading && <Loader2 className="w-4 h-4 animate-spin text-primary-400 ml-auto" />}
              </div>
              {result ? (
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> 正在调用实验规划引擎生成方案...
                </p>
              )}
              <p className="text-xs text-gray-600 mt-3 pt-3 border-t border-deep-border">
                下方「变量定义 / 实验步骤 / 甘特图 / 代码框架 / 风险评估」为示例模板，用于展示方案结构。
              </p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'variables', label: '变量定义', icon: Table },
              { key: 'steps', label: '实验步骤', icon: ListOrdered },
              { key: 'gantt', label: '甘特图', icon: Calendar },
              { key: 'code', label: '代码框架', icon: Code },
              { key: 'risks', label: '风险评估', icon: AlertTriangle },
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

          {/* Variables Table */}
          {activeTab === 'variables' && (
            <div className="card-lab overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-deep-border">
                    <th className="text-left py-3 px-4 text-sm text-gray-400 font-medium">类型</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-400 font-medium">变量名称</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-400 font-medium">定义</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-400 font-medium">取值范围</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_VARIABLES.map((v, i) => (
                    <tr key={i} className="border-b border-deep-border/50">
                      <td className="py-3 px-4">
                        <span className={`badge ${v.type === 'independent' ? 'badge-info' : v.type === 'dependent' ? 'badge-success' : 'badge-warning'}`}>
                          {v.type === 'independent' ? '自变量' : v.type === 'dependent' ? '因变量' : '控制变量'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-white font-medium">{v.name}</td>
                      <td className="py-3 px-4 text-sm text-gray-400">{v.definition}</td>
                      <td className="py-3 px-4 text-sm text-gray-300 font-mono">{v.range}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Steps */}
          {activeTab === 'steps' && (
            <div className="space-y-3">
              {MOCK_STEPS.map((step) => (
                <div key={step.order} className="card-lab-hover flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary-400">{step.order}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-white">{step.name}</h3>
                      <span className="badge-info">{step.duration}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{step.description}</p>
                    <p className="text-xs text-gray-500 mt-1">交付物：{step.deliverable}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Gantt Chart */}
          {activeTab === 'gantt' && (
            <div className="card-lab">
              <h3 className="font-medium text-white mb-6">项目甘特图</h3>
              <div className="space-y-3">
                {MOCK_GANTT.map((task) => (
                  <div key={task.id} className="flex items-center gap-4">
                    <span className="text-sm text-gray-300 w-24 flex-shrink-0 text-right">{task.name}</span>
                    <div className="flex-1 relative h-8 bg-deep-dark rounded-lg overflow-hidden">
                      <div
                        className="absolute h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg flex items-center px-3 text-xs text-white font-medium"
                        style={{
                          left: `${(task.start / totalDuration) * 100}%`,
                          width: `${(task.duration / totalDuration) * 100}%`,
                        }}
                      >
                        {task.duration}天
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 px-28">
                {Array.from({ length: 7 }, (_, i) => (
                  <span key={i} className="text-xs text-gray-600">第{i * 2 + 2}周</span>
                ))}
              </div>

              {/* Resources */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                {[
                  { label: '计算资源', value: 'NVIDIA A100 GPU', icon: HardDrive, color: 'text-blue-400' },
                  { label: '存储需求', value: '约60GB', icon: HardDrive, color: 'text-emerald-400' },
                  { label: '预计工期', value: '11周', icon: Clock, color: 'text-amber-400' },
                  { label: '预估成本', value: '约700元', icon: DollarSign, color: 'text-purple-400' },
                ].map((r) => (
                  <div key={r.label} className="bg-deep-dark rounded-lg p-4 border border-deep-border/50">
                    <r.icon className={`w-5 h-5 ${r.color} mb-2`} />
                    <p className="text-xs text-gray-500">{r.label}</p>
                    <p className="text-sm font-medium text-white mt-0.5">{r.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Code */}
          {activeTab === 'code' && (
            <div className="card-lab">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-white flex items-center gap-2">
                  <Code className="w-4 h-4 text-emerald-400" />
                  Python代码框架
                </h3>
                <button onClick={copyCode} className="btn-secondary text-sm flex items-center gap-2">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? '已复制' : '复制代码'}
                </button>
              </div>
              <pre className="bg-deep-dark rounded-lg p-4 overflow-x-auto text-sm font-mono text-gray-300 leading-relaxed border border-deep-border/50">
                <code>{MOCK_CODE}</code>
              </pre>
            </div>
          )}

          {/* Risks */}
          {activeTab === 'risks' && (
            <div className="space-y-3">
              {MOCK_RISKS.map((risk, i) => (
                <div key={i} className={`card-lab border-l-4 ${risk.impact === 'high' ? 'border-l-red-500' : risk.impact === 'medium' ? 'border-l-amber-500' : 'border-l-blue-500'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className={`w-4 h-4 ${risk.impact === 'high' ? 'text-red-400' : risk.impact === 'medium' ? 'text-amber-400' : 'text-blue-400'}`} />
                        <span className="font-medium text-white text-sm">{risk.risk}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <span className={`badge ${risk.probability === 'high' ? 'badge-danger' : risk.probability === 'medium' ? 'badge-warning' : 'badge-info'}`}>
                          概率: {risk.probability === 'high' ? '高' : risk.probability === 'medium' ? '中' : '低'}
                        </span>
                        <span className={`badge ${risk.impact === 'high' ? 'badge-danger' : risk.impact === 'medium' ? 'badge-warning' : 'badge-info'}`}>
                          影响: {risk.impact === 'high' ? '高' : risk.impact === 'medium' ? '中' : '低'}
                        </span>
                      </div>
                      <p className="text-sm text-primary-400 mt-2">应对：{risk.mitigation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="card-lab flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <FlaskConical className="w-12 h-12 mx-auto mb-3 text-deep-border" />
            <p>请先选择一个研究项目</p>
            <p className="text-xs text-gray-600 mt-1">选择项目后将自动加载假设信息用于实验设计</p>
          </div>
        </div>
      )}
    </div>
  );
}
