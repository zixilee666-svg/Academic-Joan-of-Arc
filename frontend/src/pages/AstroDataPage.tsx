import { useState, useEffect } from 'react';
import { Database, Filter, Download, Sun, Activity, AlertTriangle } from 'lucide-react';
import { astroAPI } from '../services/api';

interface AstroRecord {
  id: number;
  data_source: string;
  obs_time: string;
  noaa_number: string;
  magnetic_type: string;
  shear_angle: number;
  twist_degree: number;
  magnetic_gradient: number;
  flare_class: string;
}

const FLARE_COLORS: Record<string, string> = {
  X: 'text-red-400 bg-red-500/20 border-red-500/30',
  M: 'text-orange-400 bg-orange-500/20 border-orange-500/30',
  C: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
  B: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
  A: 'text-gray-400 bg-gray-500/20 border-gray-500/30',
};

const MAG_TYPES = ['all', 'alpha', 'beta', 'beta-gamma', 'beta-gamma-delta'];

export default function AstroDataPage() {
  const [data, setData] = useState<AstroRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSource, setFilterSource] = useState('');
  const [filterFlare, setFilterFlare] = useState('');
  const [filterMag, setFilterMag] = useState('all');
  const [sortKey, setSortKey] = useState<'obs_time' | 'shear_angle' | 'flare_class'>('obs_time');

  useEffect(() => {
    loadData();
  }, [filterSource, filterFlare]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 200 };
      if (filterSource) params.source = filterSource;
      if (filterFlare) params.flare_class = filterFlare;
      const res = await astroAPI.getData(params);
      setData(res.data.data || []);
    } catch {
      // 使用Mock数据
      setData(generateMockData());
    }
    setLoading(false);
  };

  const generateMockData = (): AstroRecord[] => {
    const types = ['alpha', 'beta', 'beta-gamma', 'beta-gamma-delta'];
    const flares = ['A', 'B', 'C', 'M', 'X'];
    return Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      data_source: 'JW-SSD',
      obs_time: new Date(2024, 0, 1 + i).toISOString(),
      noaa_number: `AR${13200 + i}`,
      magnetic_type: types[Math.floor(Math.random() * types.length)],
      shear_angle: Math.round((20 + Math.random() * 60) * 100) / 100,
      twist_degree: Math.round((0.2 + Math.random() * 1.5) * 1000) / 1000,
      magnetic_gradient: Math.round((0.01 + Math.random() * 0.05) * 10000) / 10000,
      flare_class: flares[Math.floor(Math.random() * flares.length)],
    }));
  };

  const filtered = data.filter((r) => {
    if (filterMag !== 'all' && r.magnetic_type !== filterMag) return false;
    return true;
  });

  const stats = {
    total: filtered.length,
    xClass: filtered.filter((r) => r.flare_class === 'X').length,
    mClass: filtered.filter((r) => r.flare_class === 'M').length,
    avgShear: filtered.length > 0
      ? (filtered.reduce((s, r) => s + r.shear_angle, 0) / filtered.length).toFixed(1)
      : '0',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="kicker mb-1">DATA EXPLORER</p>
          <h1 className="text-2xl font-bold text-white">天文数据浏览器</h1>
          <p className="text-sm text-gray-400 mt-1">JW-SSD 太阳黑子磁场参数 · 国家天文科学数据中心</p>
        </div>
        <button className="btn-secondary flex items-center gap-2">
          <Download className="w-4 h-4" /> 导出CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-lab">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-primary-400" />
            <span className="text-xs text-gray-400">总记录</span>
          </div>
          <p className="text-2xl font-bold mono text-white">{stats.total}</p>
        </div>
        <div className="card-lab">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-gray-400">X级耀斑</span>
          </div>
          <p className="text-2xl font-bold mono text-red-400">{stats.xClass}</p>
        </div>
        <div className="card-lab">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-gray-400">M级耀斑</span>
          </div>
          <p className="text-2xl font-bold mono text-orange-400">{stats.mClass}</p>
        </div>
        <div className="card-lab">
          <div className="flex items-center gap-2 mb-2">
            <Sun className="w-4 h-4 text-signal-400" />
            <span className="text-xs text-gray-400">平均剪切角</span>
          </div>
          <p className="text-2xl font-bold mono text-signal-400">{stats.avgShear}°</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap items-center gap-4">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={filterMag}
          onChange={(e) => setFilterMag(e.target.value)}
          className="input-field text-sm py-1.5"
        >
          {MAG_TYPES.map((t) => (
            <option key={t} value={t}>{t === 'all' ? '全部磁场类型' : t}</option>
          ))}
        </select>
        <select
          value={filterFlare}
          onChange={(e) => setFilterFlare(e.target.value)}
          className="input-field text-sm py-1.5"
        >
          <option value="">全部耀斑等级</option>
          {['X', 'M', 'C', 'B', 'A'].map((f) => (
            <option key={f} value={f}>{f}级</option>
          ))}
        </select>
        <span className="text-xs text-gray-500 mono">{filtered.length} 条结果</span>
      </div>

      {/* Data Table */}
      <div className="card-lab overflow-hidden p-0">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-deep-blue/95 backdrop-blur-sm">
              <tr className="border-b border-deep-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">时间</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">活动区</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">磁场类型</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">剪切角(°)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">缠绕度</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">磁梯度</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">耀斑</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">加载中...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">暂无数据</td></tr>
              ) : (
                filtered.slice(0, 100).map((row) => (
                  <tr key={row.id} className="border-b border-deep-border/50 hover:bg-primary-500/5 transition-colors">
                    <td className="px-4 py-2.5 mono text-xs text-gray-300">
                      {new Date(row.obs_time).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-2.5 mono text-xs text-primary-300">{row.noaa_number}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-300">{row.magnetic_type}</td>
                    <td className="px-4 py-2.5 text-right mono text-xs text-gray-200">{row.shear_angle}</td>
                    <td className="px-4 py-2.5 text-right mono text-xs text-gray-200">{row.twist_degree}</td>
                    <td className="px-4 py-2.5 text-right mono text-xs text-gray-200">{row.magnetic_gradient}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`badge border ${FLARE_COLORS[row.flare_class] || FLARE_COLORS.A}`}>
                        {row.flare_class}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
