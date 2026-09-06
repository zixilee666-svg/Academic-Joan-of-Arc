import { useEffect, useState } from 'react';
import { settingsAPI } from '../services/api';
import {
  Settings as SettingsIcon,
  Cloud,
  Server,
  KeyRound,
  Save,
  PlugZap,
  Activity,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Palette,
  Cpu,
  Heart,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';

interface EngineConfig {
  provider: string;
  api_key_masked: string;
  api_key_set: boolean;
  model_reasoning: string;
  model_general: string;
  model_coding: string;
  model_multimodal: string;
  ollama_host: string;
  env_file: string;
}

interface Health {
  status?: string;
  ready?: boolean;
  provider?: string;
  model?: string;
  error?: string;
  [k: string]: any;
}

interface Preferences {
  theme: string;
  preferred_model: string;
  research_interests: string;
}

interface TestResult {
  success: boolean;
  status: string;
  provider?: string;
  model?: string;
  latency_ms?: number;
  sample_reply?: string;
  error?: string;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<EngineConfig | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [version, setVersion] = useState('');
  const [prefs, setPrefs] = useState<Preferences>({ theme: 'dark', preferred_model: 'qwen-plus', research_interests: '' });

  // 表单状态
  const [provider, setProvider] = useState('bailian');
  const [apiKey, setApiKey] = useState('');           // 新输入的明文 Key（留空=不修改）
  const [showKey, setShowKey] = useState(false);
  const [modelReasoning, setModelReasoning] = useState('qwen-max');
  const [modelGeneral, setModelGeneral] = useState('qwen-plus');
  const [modelCoding, setModelCoding] = useState('qwen-plus');
  const [modelMultimodal, setModelMultimodal] = useState('qwen-vl-max');
  const [ollamaHost, setOllamaHost] = useState('http://localhost:11434');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const flash = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cfgRes, prefRes] = await Promise.all([
        settingsAPI.getConfig(),
        settingsAPI.getPreferences(),
      ]);
      const cfg = cfgRes.data.config as EngineConfig;
      setConfig(cfg);
      setHealth(cfgRes.data.health);
      setVersion(cfgRes.data.version || '');
      setProvider(cfg.provider);
      setModelReasoning(cfg.model_reasoning);
      setModelGeneral(cfg.model_general);
      setModelCoding(cfg.model_coding);
      setModelMultimodal(cfg.model_multimodal);
      setOllamaHost(cfg.ollama_host);
      const p = prefRes.data.preferences as Preferences;
      setPrefs(p);
    } catch (e: any) {
      flash('err', `加载配置失败：${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const payload: any = {
        provider,
        model_reasoning: modelReasoning,
        model_general: modelGeneral,
        model_coding: modelCoding,
        model_multimodal: modelMultimodal,
        ollama_host: ollamaHost,
      };
      if (apiKey.trim()) payload.api_key = apiKey.trim();
      const res = await settingsAPI.updateConfig(payload);
      if (res.data.success) {
        flash('ok', `已保存并热生效：${res.data.updated_keys?.join(', ') || '无变更'}`);
        setApiKey('');
        await loadAll();
      } else {
        flash('err', '保存失败');
      }
    } catch (e: any) {
      flash('err', `保存失败：${e?.response?.data?.detail || e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const body: any = { provider };
      if (apiKey.trim()) body.api_key = apiKey.trim();
      const res = await settingsAPI.testConnection(body);
      setTestResult(res.data as TestResult);
      if (res.data.success) flash('ok', `连接正常 · ${res.data.latency_ms}ms`);
      else flash('err', '连接失败，请检查配置');
    } catch (e: any) {
      setTestResult({ success: false, status: 'error', error: e?.response?.data?.detail || e?.message || String(e) });
      flash('err', '连接测试异常');
    } finally {
      setTesting(false);
    }
  };

  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    try {
      const res = await settingsAPI.updatePreferences(prefs);
      if (res.data.success) flash('ok', '个人偏好已保存');
    } catch (e: any) {
      flash('err', `偏好保存失败：${e?.message || e}`);
    } finally {
      setSavingPrefs(false);
    }
  };

  const healthOk = health?.ready === true || health?.status === 'healthy' || health?.status === 'ok';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> 加载配置中...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg text-sm ${
            toast.type === 'ok'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
          }`}
        >
          {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div>
        <p className="kicker mb-3">系统设置 / SETTINGS</p>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary-500/20 border border-primary-500/20">
            <SettingsIcon className="w-6 h-6 text-primary-400" />
          </div>
          系统设置
        </h1>
        <p className="text-gray-400 mt-2 ml-11">
          配置推理引擎、API Key 与模型映射；保存后热生效并写回项目 .env，重启后依然保留。
        </p>
      </div>

      {/* 实时状态条 */}
      <div className="card-lab flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${healthOk ? 'text-emerald-400' : 'text-rose-400'}`} />
          <span className="text-sm text-gray-300">引擎状态</span>
          <span className={`badge ${healthOk ? 'badge-success' : 'badge-warning'}`}>
            {healthOk ? '在线' : '离线 / 异常'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Cpu className="w-4 h-4 text-primary-400" />
          当前提供方：<span className="text-gray-200">{config?.provider === 'bailian' ? '阿里云百炼' : '本地 Ollama'}</span>
        </div>
        {config?.api_key_set && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <KeyRound className="w-4 h-4 text-amber-400" />
            API Key：<span className="mono text-gray-300">{config.api_key_masked}</span>
          </div>
        )}
        {version && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Info className="w-4 h-4 text-gray-500" />
            版本：<span className="mono text-gray-300">v{version}</span>
          </div>
        )}
        <button
          onClick={loadAll}
          className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white bg-deep-card border border-deep-border transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> 刷新
        </button>
      </div>

      {/* 推理引擎选择 */}
      <div className="card-lab">
        <h3 className="font-medium text-white mb-4 flex items-center gap-2">
          <Cloud className="w-4 h-4 text-primary-400" /> 推理引擎
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setProvider('bailian')}
            className={`text-left p-4 rounded-xl border transition-all ${
              provider === 'bailian'
                ? 'bg-primary-600/15 border-primary-500/50 ring-2 ring-primary-500/30'
                : 'bg-deep-card border-deep-border hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-primary-500/20 flex items-center justify-center">
                <Cloud className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <p className="text-white font-medium">阿里云百炼 · DashScope</p>
                <p className="text-xs text-gray-500">云端千问系列（竞赛指定引擎）</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">qwen-max 推理 / qwen-plus 通用 / qwen-vl-max 多模态</p>
          </button>

          <button
            onClick={() => setProvider('ollama')}
            className={`text-left p-4 rounded-xl border transition-all ${
              provider === 'ollama'
                ? 'bg-primary-600/15 border-primary-500/50 ring-2 ring-primary-500/30'
                : 'bg-deep-card border-deep-border hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Server className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-medium">本地 Ollama</p>
                <p className="text-xs text-gray-500">离线私有部署（qwen2.5）</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">无需联网，数据完全本地；未连接时自动降级 Mock 演示</p>
          </button>
        </div>
      </div>

      {/* API Key + 模型映射 */}
      {provider === 'bailian' ? (
        <div className="card-lab space-y-5">
          <div>
            <h3 className="font-medium text-white mb-3 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" /> API Key（DashScope）
            </h3>
            <p className="text-xs text-gray-500 mb-2">
              当前已配置：<span className="mono text-gray-300">{config?.api_key_set ? config.api_key_masked : '（未设置）'}</span>
              。留空表示不修改；输入新 Key 后将明文写入 .env 并立即热生效。
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-... （输入新的百炼 API Key，留空则不修改）"
                  className="input-field w-full pr-10 mono"
                />
                <button
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  type="button"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-white mb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary-400" /> 模型映射
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: '推理 / 假设 · reasoning', val: modelReasoning, set: setModelReasoning, hint: 'qwen-max' },
                { label: '通用对话 · general', val: modelGeneral, set: setModelGeneral, hint: 'qwen-plus' },
                { label: '代码 / 实验 · coding', val: modelCoding, set: setModelCoding, hint: 'qwen-plus' },
                { label: '多模态 · multimodal', val: modelMultimodal, set: setModelMultimodal, hint: 'qwen-vl-max' },
              ].map((m) => (
                <div key={m.label}>
                  <label className="text-xs text-gray-400 mb-1 block">{m.label}</label>
                  <input
                    value={m.val}
                    onChange={(e) => m.set(e.target.value)}
                    placeholder={m.hint}
                    className="input-field w-full mono"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="card-lab">
          <h3 className="font-medium text-white mb-3 flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" /> Ollama 服务地址
          </h3>
          <input
            value={ollamaHost}
            onChange={(e) => setOllamaHost(e.target.value)}
            placeholder="http://localhost:11434"
            className="input-field w-full mono"
          />
          <p className="text-xs text-gray-500 mt-2">
            请确保本机已运行 <span className="mono text-gray-300">ollama serve</span> 并已拉取模型
            <span className="mono text-gray-300"> ollama pull qwen2.5:7b</span>。
          </p>
        </div>
      )}

      {/* 连接测试 + 保存 */}
      <div className="card-lab">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleTest}
            disabled={testing}
            className="btn-secondary flex items-center gap-2 h-10 disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
            测试连接
          </button>
          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className="btn-primary flex items-center gap-2 h-10 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            保存配置
          </button>
          {config?.env_file && (
            <span className="text-xs text-gray-500 mono truncate max-w-full">
              .env：{config.env_file}
            </span>
          )}
        </div>

        {testResult && (
          <div
            className={`mt-4 p-4 rounded-lg border ${
              testResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-rose-500/10 border-rose-500/30'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
              <span className={`text-sm font-medium ${testResult.success ? 'text-emerald-300' : 'text-rose-300'}`}>
                {testResult.success ? '连接成功' : '连接失败'}
              </span>
              {testResult.latency_ms != null && (
                <span className="text-xs text-gray-400 mono">延迟 {testResult.latency_ms}ms</span>
              )}
              {testResult.model && (
                <span className="text-xs text-gray-400 mono">模型 {testResult.model}</span>
              )}
            </div>
            {testResult.success && testResult.sample_reply && (
              <p className="text-sm text-gray-300">示例回复：「{testResult.sample_reply}」</p>
            )}
            {!testResult.success && testResult.error && (
              <p className="text-sm text-rose-200 mono break-all">{testResult.error}</p>
            )}
          </div>
        )}
      </div>

      {/* 个人偏好 */}
      <div className="card-lab">
        <h3 className="font-medium text-white mb-4 flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary-400" /> 个人偏好
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">主题</label>
            <select
              value={prefs.theme}
              onChange={(e) => setPrefs({ ...prefs, theme: e.target.value })}
              className="input-field w-full"
            >
              <option value="dark">深色（内置）</option>
              <option value="light">浅色</option>
              <option value="auto">跟随系统</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">偏好模型</label>
            <select
              value={prefs.preferred_model}
              onChange={(e) => setPrefs({ ...prefs, preferred_model: e.target.value })}
              className="input-field w-full"
            >
              <option value="qwen-max">qwen-max（推理最强）</option>
              <option value="qwen-plus">qwen-plus（均衡）</option>
              <option value="qwen-vl-max">qwen-vl-max（多模态）</option>
              <option value="qwen2.5:7b">qwen2.5:7b（本地）</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
              <Heart className="w-3 h-3" /> 研究兴趣
            </label>
            <input
              value={prefs.research_interests}
              onChange={(e) => setPrefs({ ...prefs, research_interests: e.target.value })}
              placeholder="如：太阳耀斑预测、ESG披露"
              className="input-field w-full"
            />
          </div>
        </div>
        <button
          onClick={handleSavePrefs}
          disabled={savingPrefs}
          className="btn-primary mt-4 flex items-center gap-2 h-10 disabled:opacity-50"
        >
          {savingPrefs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          保存偏好
        </button>
      </div>
    </div>
  );
}
