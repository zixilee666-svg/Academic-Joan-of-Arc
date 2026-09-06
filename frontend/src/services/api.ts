import axios from 'axios';
import type { ResearchSession, ResearchProject } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // LLM推理可能较慢，120秒超时
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Auth API ───
export const authAPI = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  register: (username: string, password: string, name: string) =>
    api.post('/auth/register', { username, password, name }),
  getMe: () => api.get('/auth/me'),
};

// ─── LLM API（百炼/Ollama双引擎推理，兼容OpenAI格式）───
export const llmAPI = {
  chat: (data: {
    model?: string;
    messages: { role: string; content: string }[];
    temperature?: number;
    stream?: boolean;
  }) => api.post('/chat', data),

  chatStream: (
    data: {
      model?: string;
      messages: { role: string; content: string }[];
      temperature?: number;
    },
    onChunk: (text: string) => void,
    onDone: () => void,
    onError: (error: string) => void
  ) => {
    const token = localStorage.getItem('token');
    fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ...data, stream: true }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader');
        const decoder = new TextDecoder();
        let buffer = '';

        const read = () => {
          reader.read().then(({ done, value }) => {
            if (done) {
              onDone();
              return;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const payload = line.slice(6);
                if (payload === '[DONE]') {
                  onDone();
                  return;
                }
                try {
                  const parsed = JSON.parse(payload);
                  const content = parsed.choices?.[0]?.delta?.content || '';
                  if (content) onChunk(content);
                } catch {
                  // Skip invalid JSON
                }
              }
            }
            read();
          });
        };
        read();
      })
      .catch((err) => onError(err.message));
  },
};

// 保留旧名称兼容（页面中引用bailianAPI的地方）
export const bailianAPI = llmAPI;

// ─── Research API ───
export const researchAPI = {
  // Sessions
  createSession: (data: { title: string; domain: string; question: string; depth?: string }) =>
    api.post('/research/session', data),
  getSessions: () => api.get('/research/sessions'),
  getSession: (id: string) => api.get(`/research/session/${id}`),
  deleteSession: (id: string) => api.delete(`/research/session/${id}`),

  // Hypothesis generation
  generateHypothesis: (data: {
    question: string;
    literature_summary?: string;
    knowledge_gaps?: string[];
    model?: string;
  }) => api.post('/research/hypothesis', data),

  // Run agents (multi-agent orchestration)
  runAgent: (data: { sessionId: string; stage: string; input: string; context?: any }) =>
    api.post('/research/run-agent', data),

  runAgentStream: (
    data: { sessionId: string; stage: string; input: string; context?: any },
    onChunk: (text: string) => void,
    onDone: (result: any) => void,
    onError: (error: string) => void
  ) => {
    const token = localStorage.getItem('token');
    fetch('/api/research/run-agent-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader');
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';

        const read = () => {
          reader.read().then(({ done, value }) => {
            if (done) {
              onDone({ content: fullContent });
              return;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const payload = line.slice(6);
                if (payload === '[DONE]') {
                  onDone({ content: fullContent });
                  return;
                }
                try {
                  const parsed = JSON.parse(payload);
                  if (parsed.type === 'content') {
                    fullContent += parsed.content;
                    onChunk(parsed.content);
                  } else if (parsed.type === 'stage_complete') {
                    onDone(parsed.result);
                  } else if (parsed.type === 'error') {
                    onError(parsed.error);
                  }
                } catch {
                  // Skip
                }
              }
            }
            read();
          });
        };
        read();
      })
      .catch((err) => onError(err.message));
  },

  // Projects
  createProject: (data: any) => api.post('/research/projects', data),
  getProjects: () => api.get('/research/projects'),
  getProject: (id: string) => api.get(`/research/projects/${id}`),
  updateProject: (id: string, data: any) => api.put(`/research/projects/${id}`, data),
  deleteProject: (id: string) => api.delete(`/research/projects/${id}`),

  // Wizard step
  wizardStep: (data: { projectId: string; stage: string; input?: string; context?: any; journalFormat?: string; extraReferences?: any[] }) =>
    api.post('/research/wizard/step', data),

  // Paper search (Crossref + OpenAlex)
  paperSearch: (data: { query: string; limit?: number; source?: string }) =>
    api.post('/research/paper/search', data),

  // Journal formats
  getJournalFormats: () => api.get('/research/journal-formats'),

  // Export DOCX
  exportDocx: (data: { projectId: string }) =>
    api.post('/research/export-docx', data, { responseType: 'blob' }),
};

// ─── Literature API ───
export const literatureAPI = {
  search: (q: string, topK: number = 10) =>
    api.get('/literature/search', { params: { q, top_k: topK } }),
};

// ─── Astronomy Data API ───
export const astroAPI = {
  getData: (params?: { source?: string; flare_class?: string; limit?: number }) =>
    api.get('/astro/data', { params }),
};

// ─── Knowledge Graph API ───
export const knowledgeAPI = {
  getGraph: (params?: { node_type?: string; limit?: number }) =>
    api.get('/knowledge/graph', { params }),
  getPaths: (sourceId: number, targetId: number) =>
    api.get('/knowledge/paths', { params: { source_id: sourceId, target_id: targetId } }),
};

// ─── Dashboard / Stats API ───
export const statsAPI = {
  getDashboard: () => api.get('/stats/dashboard'),
};

// ─── Settings API（推理引擎配置 / 连接测试 / 用户偏好）───
export interface ConfigUpdatePayload {
  provider?: 'bailian' | 'ollama';
  api_key?: string;
  model_reasoning?: string;
  model_general?: string;
  model_coding?: string;
  model_multimodal?: string;
  ollama_host?: string;
}

export interface PreferencesPayload {
  theme?: string;
  preferred_model?: string;
  research_interests?: string;
}

export const settingsAPI = {
  getConfig: () => api.get('/settings/config'),
  updateConfig: (data: ConfigUpdatePayload) => api.put('/settings/config', data),
  testConnection: (data: { provider?: string; api_key?: string } = {}) =>
    api.post('/settings/test-connection', data),
  getPreferences: () => api.get('/settings/preferences'),
  updatePreferences: (data: PreferencesPayload) => api.put('/settings/preferences', data),
};

// ─── Pipeline V2 API（六环节自迭代流水线 · 赛道一方向1A）───
export const pipelineAPI = {
  // 125题题库（可按级别/领域筛选）
  getQuestions: (params?: { level?: string; domain?: string }) =>
    api.get('/v2/questions', { params }),

  // 创建运行并执行首轮（自动迭代至决策门判定）；question 支持自由新问题，level 可选 A/B/C（C触发强制降维）
  createRun: (data: { question?: string; q_number?: number; max_rounds?: number; level?: 'A' | 'B' | 'C' }) =>
    api.post('/v2/run', data, { timeout: 600000 }),

  // 历史运行列表（kind=custom 仅自由新问题 / bank 仅题库题）
  listRuns: (params?: { kind?: 'custom' | 'bank'; limit?: number }) =>
    api.get('/v2/runs', { params }),

  // 继续迭代（可附人工反馈）
  iterate: (data: { run_id: number; max_rounds?: number; human_feedback?: string }) =>
    api.post('/v2/iterate', data, { timeout: 600000 }),

  // 运行完整状态
  getRun: (runId: number) => api.get(`/v2/runs/${runId}`),

  // 版本对比（各轮快照与diff）
  getVersions: (runId: number) => api.get(`/v2/runs/${runId}/versions`),

  // 批量运行125题
  startBatch: (data?: { levels?: string[]; q_numbers?: number[]; concurrency?: number; force?: boolean; split?: string; level_rounds?: Record<string, number> }) =>
    api.post('/v2/batch', data || {}),
  batchStatus: () => api.get('/v2/batch/status'),
  batchReport: (batchId?: number) =>
    api.get('/v2/batch/report', { params: batchId ? { batch_id: batchId } : {} }),

  // ─── 三分法 / 自评 / 迭代日志 ───
  getSplits: () => api.get('/v2/splits'),
  reshuffleSplits: (seed: number) => api.post('/v2/splits/reshuffle', { seed }),
  sampleSplit: (split: string, n: number, seed?: number) =>
    api.get('/v2/splits/sample', { params: { split, n, seed: seed ?? 42 } }),
  evalRun: (runId: number) => api.post(`/v2/eval/run/${runId}`),
  evalBatch: (params?: { batch_id?: number; split?: string }) =>
    api.get('/v2/eval/batch', { params }),
  getIterationLog: () => api.get('/v2/iteration-log'),
  addIterationLog: (data: {
    iteration_no: number; stage?: string; findings?: string; changes?: string;
    metrics_before?: Record<string, unknown>; metrics_after?: Record<string, unknown>;
  }) => api.post('/v2/iteration-log', data),

  // ─── 科研技能库（OpenAI Skills 范式）───
  getSkills: () => api.get('/v2/skills'),
  getSkillDetail: (code: string) => api.get(`/v2/skills/${code}`),
};

// ─── Health Check ───
export const healthAPI = {
  check: () => axios.get('/health'),
};

export default api;
