import {
  LayoutDashboard,
  Brain,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Atom,
  Database,
  Network,
  BarChart3,
  Settings,
  ListChecks,
  GitBranch,
  Trophy,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EngineBadge from './EngineBadge';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  userName: string;
  userRole: string;
  onLogout: () => void;
  currentPath: string;
}

const NAV_ITEMS = [
  { path: '/dashboard', label: '工作台', icon: LayoutDashboard, index: '00', section: '主控台' },
  { path: '/ai-hub', label: '学术贞德', icon: Brain, index: '01', section: '主控台' },
  { path: '/pipeline/new', label: '新问题实验室', icon: Sparkles, index: '02', section: '六环节流水线' },
  { path: '/pipeline/questions', label: '125题总控台', icon: ListChecks, index: '03', section: '六环节流水线' },
  { path: '/pipeline/workbench', label: '迭代工作台', icon: GitBranch, index: '04', section: '六环节流水线' },
  { path: '/pipeline/eval', label: '评测中心', icon: Trophy, index: '05', section: '六环节流水线' },
  { path: '/data/astronomy', label: '天文数据', icon: Database, index: '06', section: '数据与知识' },
  { path: '/knowledge/graph', label: '知识图谱', icon: Network, index: '07', section: '数据与知识' },
  { path: '/visualization/dashboard', label: '数据大屏', icon: BarChart3, index: '08', section: '数据与知识' },
  { path: '/settings', label: '系统设置', icon: Settings, index: '09', section: '系统' },
];

export default function Sidebar({ isOpen, onToggle, userName, userRole, onLogout, currentPath }: SidebarProps) {
  const navigate = useNavigate();
  let lastSection = '';
  return (
    <aside
      className={`${
        isOpen ? 'w-64' : 'w-20'
      } bg-deep-blue/95 backdrop-blur-xl border-r border-deep-border flex flex-col transition-all duration-300 relative`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-deep-border">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-deep-cyan flex items-center justify-center flex-shrink-0 shadow-glow-cyan">
            <Atom className="w-6 h-6 text-white" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-validate-400 ring-2 ring-deep-blue animate-pulse-dot" />
          </div>
          {isOpen && (
            <div className="overflow-hidden">
              <h1 className="text-base font-bold text-white whitespace-nowrap leading-tight">Academic Joan of Arc</h1>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary-400/70 whitespace-nowrap">AI科研智能平台</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const showSection = item.section !== lastSection;
          lastSection = item.section;
          const isActive =
            currentPath === item.path ||
            (item.path !== '/dashboard' && currentPath.startsWith(item.path));
          return (
            <div key={item.path}>
              {showSection && isOpen && (
                <p className="kicker mt-3 mb-2 text-primary-400/60 first:mt-0">{item.section}</p>
              )}
              <button
                onClick={() => navigate(item.path)}
                className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                  isActive
                    ? 'bg-primary-600/15 text-primary-300 border border-primary-500/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r bg-primary-400 shadow-glow-blue" />
                )}
                {!isOpen && isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r bg-primary-400 shadow-glow-blue" />
                )}
                <item.icon
                  className={`w-5 h-5 flex-shrink-0 ${
                    isActive ? 'text-primary-400' : 'text-gray-500 group-hover:text-gray-300'
                  }`}
                />
                {isOpen && (
                  <>
                    <span className="mono text-[10px] text-gray-600 w-5">{item.index}</span>
                    <span className="text-sm font-medium whitespace-nowrap flex-1">{item.label}</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </nav>

      {/* User section */}
      {isOpen && (
        <div className="p-4 border-t border-deep-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-deep-cyan flex items-center justify-center text-white text-sm font-bold">
              {userName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">{userName}</p>
              <p className="text-xs text-gray-500">{userRole === 'admin' ? '管理员' : '研究员'}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
          <div className="mt-3 flex items-center justify-between px-1">
            <span className="mono text-[10px] text-gray-600">v3.2 · 六环节真实推理</span>
            <EngineBadge compact />
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 bg-deep-border rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-primary-600 transition-colors border border-deep-blue"
      >
        {isOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>
    </aside>
  );
}
