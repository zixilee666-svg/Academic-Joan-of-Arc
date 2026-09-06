import { useEffect, useState } from 'react';
import { Menu, Bell, Search, Moon, Sun, Activity } from 'lucide-react';
import { useUIStore } from '../stores';
import { useLocation } from 'react-router-dom';

interface NavbarProps {
  onMenuClick: () => void;
}

const PATH_LABELS: Record<string, string> = {
  '/dashboard': '工作台',
  '/ai-hub': '学术贞德',
  '/pipeline/new': '新问题实验室',
  '/pipeline/questions': '125题总控台',
  '/pipeline/workbench': '迭代工作台',
  '/pipeline/eval': '评测中心',
  '/data/astronomy': '天文数据',
  '/knowledge/graph': '知识图谱',
  '/visualization/dashboard': '数据大屏',
  '/settings': '系统设置',
};

export default function Navbar({ onMenuClick }: NavbarProps) {
  const { theme, setTheme } = useUIStore();
  const location = useLocation();
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      setClock(`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const label = PATH_LABELS[location.pathname] || '科研工作台';

  return (
    <header className="h-16 bg-deep-blue/60 backdrop-blur-xl border-b border-deep-border flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:flex items-center gap-2 text-sm">
          <span className="mono text-gray-500">AJOA</span>
          <span className="text-gray-600">/</span>
          <span className="text-gray-200 font-medium">{label}</span>
        </div>
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="搜索研究、文献、假设..."
            className="bg-deep-dark/70 border border-deep-border rounded-lg pl-10 pr-16 py-2 text-sm text-gray-200 placeholder-gray-500 w-80 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 mono text-[10px] text-gray-500 border border-deep-border rounded px-1.5 py-0.5">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-deep-dark/60 border border-deep-border">
          <Activity className="w-3.5 h-3.5 text-validate-400 animate-pulse-dot" />
          <span className="mono text-[11px] text-gray-400">{clock}</span>
          <span className="w-px h-3.5 bg-deep-border" />
          <span className="mono text-[11px] text-primary-400">SYS·NOMINAL</span>
        </div>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-signal-500 rounded-full shadow-glow-signal"></span>
        </button>
        <div className="h-8 w-px bg-deep-border mx-1"></div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-deep-cyan flex items-center justify-center text-white text-xs font-bold">
            R
          </div>
          <span className="text-sm text-gray-300 hidden sm:block">研究员</span>
        </div>
      </div>
    </header>
  );
}
