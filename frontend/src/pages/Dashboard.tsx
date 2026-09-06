import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { researchAPI } from '../services/api';
import type { ResearchProject } from '../types';
import {
  Brain, Search, BookOpen, Lightbulb, FlaskConical, RefreshCcw,
  TrendingUp, FileText, Activity, Clock, Plus, ArrowRight, Sparkles,
  BarChart3, Database, Zap, Cpu, Network, Loader2, FolderOpen,
  ListChecks, GitBranch, Trophy,
} from 'lucide-react';

const QUICK_ACTIONS = [
  { label: '新问题实验室', icon: Sparkles, path: '/pipeline/new', color: 'from-cyan-500 to-primary-600', desc: '任意科学问题 → 六环节自迭代' },
  { label: '125题总控台', icon: ListChecks, path: '/pipeline/questions', color: 'from-primary-500 to-deep-cyan', desc: '赛道一·方向1A 全量运行' },
  { label: '迭代工作台', icon: GitBranch, path: '/pipeline/workbench', color: 'from-cyan-500 to-blue-600', desc: '六环节自迭代 · 版本对比' },
  { label: '评测中心', icon: Trophy, path: '/pipeline/eval', color: 'from-amber-500 to-orange-500', desc: '三分自评 · 辩证迭代留痕' },
  { label: '学术贞德', icon: Brain, path: '/ai-hub', color: 'from-primary-500 to-deep-cyan', desc: '多智能体协作' },
  { label: '数据大屏', icon: BarChart3, path: '/visualization/dashboard', color: 'from-purple-500 to-violet-600', desc: '系统运行状态总览' },
];

const STAGE_LABELS: Record<string, string> = {
  question: '问题理解',
  literature: '文献综述',
  hypothesis: '假设生成',
  experiment: '实验设计',
  evaluation: '评估迭代',
  paper: '论文生成',
};

const STATUS_LABELS: Record<string, string> = {
  active: '进行中',
  completed: '已完成',
  archived: '已归档',
};

function MolecularNetwork() {
  const nodes = [[40,60],[120,30],[200,72],[70,140],[160,150],[110,200],[212,182]];
  const edges = [[0,1],[1,2],[0,3],[3,4],[1,4],[4,2],[3,5],[4,5],[5,6],[4,6]];
  return (
    <svg viewBox="0 0 260 240" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      {edges.map(([a,b],i)=>(<line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke="rgba(56,189,248,0.35)" strokeWidth={1}/>))}
      {nodes.map(([x,y],i)=>(<g key={i}><circle cx={x} cy={y} r={9} fill="rgba(0,212,170,0.12)"/><circle cx={x} cy={y} r={3.5} fill="#38bdf8" stroke="#00D4AA" strokeWidth={1.5}/></g>))}
    </svg>
  );
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiMode, setApiMode] = useState<'live' | 'mock'>('live');
  const [models, setModels] = useState({ reasoning: 'qwen-max', general: 'qwen-plus', coding: 'qwen-coder-plus' });

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const projectsRes = await researchAPI.getProjects().catch(() => ({ data: [] as ResearchProject[] }));
        if (cancelled) return;
        const projectList = Array.isArray(projectsRes.data) ? projectsRes.data : (projectsRes.data?.projects || []);
        setProjects(projectList);

        // /health（注意：无 /api 前缀，由 FastAPI 根路由提供）为真实/Mock 引擎唯一权威源
        const healthRes = await fetch('/health').then(r => r.ok ? r.json() : null).catch(() => null);
        if (cancelled) return;
        if (healthRes) {
          setApiMode(healthRes.is_mock === true ? 'mock' : 'live');
          if (healthRes.models) setModels(healthRes.models);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, []);

  const totalProjects = projects.length;
  const completedProjects = projects.filter((p) => p.status === 'completed').length;
  const activeProjects = projects.filter((p) => p.status === 'active').length;

  const getStageProgress = useCallback((stage: string): number => {
    const completed = projects.filter((p) => {
      const stages = (p as any).stages;
      return stages && stages[stage] && stages[stage].status === 'completed';
    }).length;
    if (totalProjects === 0) return 0;
    return Math.round((completed / totalProjects) * 100);
  }, [projects, totalProjects]);

  const STATS = [
    { label: '研究项目', value: String(totalProjects), icon: FolderOpen, change: `${activeProjects} 进行中`, tone: 'text-primary-300' },
    { label: '已完成', value: String(completedProjects), icon: FileText, change: `${totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0}% 完成率`, tone: 'text-validate-300' },
    { label: '进行中', value: String(activeProjects), icon: Activity, change: `${totalProjects - completedProjects} 个活跃`, tone: 'text-signal-300' },
    { label: 'API模式', value: apiMode === 'live' ? 'LIVE' : 'MOCK', icon: Zap, change: apiMode === 'live' ? `百炼 · ${models.reasoning}` : '模拟模式', tone: apiMode === 'live' ? 'text-validate-300' : 'text-signal-300' },
  ];

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-600/15 via-deep-cyan/10 to-primary-500/5 border border-primary-500/20 p-8 scanline">
        <div className="absolute inset-0 bg-blueprint opacity-40" />
        <div className="absolute -top-16 -right-10 w-72 h-72 opacity-70 animate-float-slow pointer-events-none"><MolecularNetwork /></div>
        <div className="relative">
          <p className="kicker mb-3">00 / OVERVIEW</p>
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            欢迎回来，{user?.name || '研究员'}
            <Sparkles className="w-6 h-6 text-deep-cyan" />
          </h1>
          <p className="text-gray-400 max-w-2xl text-pretty">
            Academic Joan of Arc 基于千问大模型，为您提供从科学问题理解到假设生成、实验设计、评估迭代的全流程科研智能支持。
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            {[
              { icon: Cpu, text: `MODEL · ${models.reasoning?.toUpperCase() || 'QWEN-MAX'}` },
              { icon: Network, text: 'PIPELINE · 6-STAGE' },
              { icon: Activity, text: `STATUS · ${apiMode === 'live' ? 'LIVE' : 'MOCK'}` },
            ].map((chip) => (
              <span key={chip.text} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-deep-dark/60 border border-deep-border">
                <chip.icon className="w-3.5 h-3.5 text-primary-400" />
                <span className="mono text-[11px] text-gray-300">{chip.text}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <section>
        <p className="kicker mb-4">01 / METRICS</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="card-lab-hover">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-primary-500/10 border border-primary-500/20">
                  <stat.icon className="w-5 h-5 text-primary-400" />
                </div>
                <span className={`mono text-[11px] ${stat.tone}`}>{stat.change}</span>
              </div>
              <p className="mono text-3xl font-bold text-white">{stat.value}</p>
              <p className="text-xs uppercase tracking-wider text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <p className="kicker mb-4">02 / QUICK START</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {QUICK_ACTIONS.map((action) => (
            <button key={action.label} onClick={() => navigate(action.path)} className="card-lab-hover text-left group">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${action.color} flex-shrink-0 shadow-lg`}>
                  <action.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white group-hover:text-primary-300 transition-colors">{action.label}</h3>
                  <p className="text-sm text-gray-400 mt-1">{action.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-primary-400 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Recent Projects */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <p className="kicker">03 / RECENT PROJECTS</p>
          <button onClick={() => navigate('/ai-hub')} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            新建研究
          </button>
        </div>
        {loading ? (
          <div className="card-lab flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
            <span className="ml-2 text-gray-400">加载项目数据...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="card-lab text-center py-12">
            <FolderOpen className="w-10 h-10 mx-auto mb-3 text-gray-600" />
            <p className="text-gray-400">暂无研究项目</p>
            <p className="text-sm text-gray-500 mt-1">点击"新建项目"通过引导式研究创建第一个项目</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.slice(0, 8).map((project) => {
              const stages = (project as any).stages || {};
              const stageOrder = ['question', 'literature', 'hypothesis', 'experiment', 'evaluation', 'paper'];
              const currentStage = stageOrder.find((s) => stages[s]?.status !== 'completed') || 'paper';
              const completedStages = stageOrder.filter((s) => stages[s]?.status === 'completed').length;

              return (
                <div
                  key={project.id}
                  className="card-lab-hover flex items-center justify-between cursor-pointer"
                  onClick={() => navigate(`/wizard/${project.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
                      <FolderOpen className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{project.title}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="mono text-[11px] text-gray-500">{project.domain}</span>
                        {currentStage && (
                          <span className="badge-info">{STAGE_LABELS[currentStage] || currentStage}</span>
                        )}
                        <span className="mono text-[11px] text-gray-500">
                          {completedStages}/{stageOrder.length} 阶段
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`badge ${project.status === 'active' ? 'badge-warning' : project.status === 'completed' ? 'badge-success' : 'badge-info'}`}>
                      {STATUS_LABELS[project.status] || project.status}
                    </span>
                    <span className="mono text-[11px] text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(project.updatedAt || project.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* System Status */}
      <section>
        <p className="kicker mb-4">04 / TELEMETRY</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card-lab">
            <h3 className="font-medium text-white mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-validate-400" />
              系统状态
            </h3>
            <div className="space-y-1">
              {[
                { name: '百炼API', status: apiMode === 'live' ? `已连接 · ${models.reasoning}` : '模拟模式', dot: apiMode === 'live' ? 'bg-validate-400' : 'bg-signal-400', txt: apiMode === 'live' ? 'text-validate-300' : 'text-signal-300' },
                { name: '后端服务', status: '正常 · 端口 3100', dot: 'bg-validate-400', txt: 'text-validate-300' },
                { name: 'SQLite数据库', status: '已连接', dot: 'bg-validate-400', txt: 'text-validate-300' },
                { name: '用户认证', status: '正常', dot: 'bg-validate-400', txt: 'text-validate-300' },
              ].map((item) => (
                <div key={item.name} className="flex items-center justify-between py-2.5 border-b border-deep-border/50 last:border-0">
                  <span className="text-sm text-gray-300">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${item.dot} animate-pulse-dot`}></span>
                    <span className={`mono text-[11px] ${item.txt}`}>{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-lab">
            <h3 className="font-medium text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary-400" />
              研究进度概览
            </h3>
            <div className="space-y-4">
              {[
                { label: '问题理解', stage: 'question', color: 'bg-blue-500' },
                { label: '文献综述', stage: 'literature', color: 'bg-emerald-500' },
                { label: '假设生成', stage: 'hypothesis', color: 'bg-amber-500' },
                { label: '实验设计', stage: 'experiment', color: 'bg-purple-500' },
                { label: '评估迭代', stage: 'evaluation', color: 'bg-rose-500' },
                { label: '论文生成', stage: 'paper', color: 'bg-cyan-500' },
              ].map((item) => {
                const progress = getStageProgress(item.stage);
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-300">{item.label}</span>
                      <span className="mono text-gray-400">{progress}%</span>
                    </div>
                    <div className="h-2 bg-deep-dark rounded-full overflow-hidden border border-deep-border/60">
                      <div className={`h-full ${item.color} rounded-full transition-all duration-1000 relative`} style={{ width: `${progress}%` }}>
                        <span className="absolute inset-0 bg-signal-line opacity-50 animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
