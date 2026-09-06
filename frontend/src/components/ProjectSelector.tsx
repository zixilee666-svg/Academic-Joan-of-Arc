import { useState, useEffect } from 'react';
import { researchAPI } from '../services/api';
import type { ResearchProject } from '../types';
import { FolderOpen, ChevronDown, AlertCircle, Loader2 } from 'lucide-react';

interface Props {
  selectedProject: ResearchProject | null;
  onSelect: (project: ResearchProject) => void;
  stageLabel?: string;
}

export default function ProjectSelector({ selectedProject, onSelect, stageLabel }: Props) {
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    researchAPI.getProjects()
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.projects || [];
        setProjects(list);
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  const stageMap: Record<string, string> = {
    question: '问题理解',
    literature: '文献综述',
    hypothesis: '假设生成',
    experiment: '研究计划',
    evaluation: '迭代优化',
    paper: '论文生成',
  };

  const statusMap: Record<string, string> = {
    active: '进行中',
    completed: '已完成',
    archived: '已归档',
  };

  if (loading) {
    return (
      <div className="card-lab flex items-center gap-3 text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">加载项目列表...</span>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="card-lab flex items-center gap-3 text-gray-500">
        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
        <div>
          <p className="text-sm text-gray-300">暂无研究项目</p>
          <p className="text-xs text-gray-500 mt-0.5">请先在「引导式研究 → 研究向导」中创建项目</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-lab">
      <div className="flex items-center gap-2 mb-2">
        <FolderOpen className="w-4 h-4 text-primary-400" />
        <span className="text-sm font-medium text-white">选择研究项目</span>
        {stageLabel && (
          <span className="badge badge-info text-[10px] ml-auto">{stageLabel}</span>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-deep-dark border border-deep-border hover:border-primary-500/30 transition-colors"
        >
          {selectedProject ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-white">{selectedProject.title}</span>
              <span className="text-xs text-gray-500">|</span>
              <span className="text-xs text-gray-400">{selectedProject.domain}</span>
            </div>
          ) : (
            <span className="text-sm text-gray-500">点击选择项目...</span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute z-50 w-full mt-1 bg-deep-card border border-deep-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => { onSelect(p); setOpen(false); }}
                className={`w-full text-left px-4 py-3 hover:bg-primary-500/10 transition-colors border-b border-deep-border/30 last:border-0 ${
                  selectedProject?.id === p.id ? 'bg-primary-500/10' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{p.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {stageMap[p.status] || statusMap[p.status] || p.status}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1 truncate">{p.question}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedProject && (
        <div className="mt-3 p-3 bg-primary-500/5 border border-primary-500/10 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-primary-400">当前项目</span>
            <span className={`badge ${selectedProject.status === 'active' ? 'badge-success' : selectedProject.status === 'completed' ? 'badge-info' : 'badge-warning'} text-[10px]`}>
              {statusMap[selectedProject.status] || selectedProject.status}
            </span>
          </div>
          <p className="text-xs text-gray-400 line-clamp-2">{selectedProject.question}</p>
        </div>
      )}
    </div>
  );
}
