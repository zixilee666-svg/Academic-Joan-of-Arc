import { useEffect, useState } from 'react';
import { Cpu, ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react';
import { healthAPI } from '../services/api';

/**
 * 引擎健康状态（/health 权威判定）：
 * - is_mock === false 且 llm.status === 'healthy' → 真实引擎（LIVE）
 * - 否则 → Mock 降级（MOCK），醒目警示
 */
export interface EngineHealth {
  loading: boolean;
  isMock: boolean;
  provider: string;
  platform: string;
  modelReasoning: string;
  checked: boolean;   // 是否已成功获取过 /health
}

let _cache: EngineHealth | null = null;
const _subs = new Set<(h: EngineHealth) => void>();

async function refresh() {
  try {
    const { data } = await healthAPI.check();
    const isMock = data?.is_mock === true || data?.llm?.status !== 'healthy';
    _cache = {
      loading: false,
      isMock,
      provider: data?.provider || '?',
      platform: data?.llm?.platform || '',
      modelReasoning: data?.models?.reasoning || '',
      checked: true,
    };
  } catch {
    _cache = { loading: false, isMock: true, provider: '?', platform: '', modelReasoning: '', checked: false };
  }
  _subs.forEach((fn) => _cache && fn(_cache));
}

export function useEngineHealth(): EngineHealth {
  const [h, setH] = useState<EngineHealth>(
    _cache || { loading: true, isMock: false, provider: '', platform: '', modelReasoning: '', checked: false }
  );
  useEffect(() => {
    _subs.add(setH);
    if (!_cache) refresh();
    else setH(_cache);
    return () => { _subs.delete(setH); };
  }, []);
  return h;
}

/**
 * 引擎标识徽标：绿色=真实引擎（显示提供商+模型），红色=Mock降级警示。
 * compact 模式仅显示圆点+LIVE/MOCK，用于表格行等紧凑场景。
 */
export default function EngineBadge({ compact = false }: { compact?: boolean }) {
  const h = useEngineHealth();

  if (h.loading && !h.checked) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> 引擎检测中
      </span>
    );
  }

  if (h.isMock) {
    return compact ? (
      <span className="inline-flex items-center gap-1 text-[10px] mono text-signal-300" title="引擎降级：当前为 Mock 模拟输出，请检查百炼 API Key / 网络">
        <ShieldAlert className="w-3 h-3" /> MOCK
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-signal-500/40 bg-signal-500/10 text-signal-300 text-xs"
        title="引擎降级：LLM 调用失败回退到 Mock 模拟输出。请到「系统设置」检查百炼 API Key 与连接测试。">
        <ShieldAlert className="w-3.5 h-3.5" />
        Mock 降级 · 非真实推理
      </span>
    );
  }

  return compact ? (
    <span className="inline-flex items-center gap-1 text-[10px] mono text-validate-300"
      title={`真实引擎：${h.provider}${h.modelReasoning ? ' · ' + h.modelReasoning : ''}`}>
      <ShieldCheck className="w-3 h-3" /> LIVE
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-validate-500/40 bg-validate-500/10 text-validate-300 text-xs"
      title={h.platform || '真实推理引擎'}>
      <Cpu className="w-3.5 h-3.5" />
      真实引擎 · {h.provider === 'bailian' ? '阿里云百炼' : h.provider}
      {h.modelReasoning && <span className="mono opacity-70">{h.modelReasoning}</span>}
    </span>
  );
}
