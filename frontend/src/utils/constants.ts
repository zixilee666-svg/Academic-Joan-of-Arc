import type { AgentInfo } from '../types';

export const AGENTS: AgentInfo[] = [
  {
    type: 'literature',
    name: 'Literature Integrator',
    nameCn: '文献整合者',
    model: 'Qwen-Plus · 百炼',
    description: '检索、解析、整合多源文献，构建证据链，识别知识缺口',
    icon: 'BookOpen',
    color: '#3B82F6',
  },
  {
    type: 'hypothesis',
    name: 'Hypothesis Generator',
    nameCn: '假设生成器',
    model: 'Qwen-Max · 百炼',
    description: '基于知识缺口生成候选假设，评估创新性与可验证性',
    icon: 'Lightbulb',
    color: '#F59E0B',
  },
  {
    type: 'experiment',
    name: 'Experiment Planner',
    nameCn: '实验规划师',
    model: 'Qwen-Plus · 百炼',
    description: '设计实验方案、生成验证代码、规划任务流程',
    icon: 'FlaskConical',
    color: '#10B981',
  },
  {
    type: 'evaluation',
    name: 'Evaluation Validator',
    nameCn: '评估验证官',
    model: 'Qwen-Max · 百炼',
    description: '评估假设质量、检测偏差、提出修正建议',
    icon: 'ShieldCheck',
    color: '#8B5CF6',
  },
];

export const STAGES = [
  { key: 'question', label: '问题理解', labelEn: 'Question', icon: 'Search' },
  { key: 'literature', label: '文献综述', labelEn: 'Literature', icon: 'BookOpen' },
  { key: 'hypothesis', label: '假设生成', labelEn: 'Hypothesis', icon: 'Lightbulb' },
  { key: 'experiment', label: '实验设计', labelEn: 'Experiment', icon: 'FlaskConical' },
  { key: 'evaluation', label: '评估迭代', labelEn: 'Evaluation', icon: 'ShieldCheck' },
] as const;

export const DOMAINS = [
  '天文物理',
  '粒子物理',
  '生物医学',
  '材料科学',
  '环境科学',
  '计算机科学',
  '社会科学',
  '经济学',
];

// 本地Ollama模型映射（全内嵌架构，零外部API）
export const MODEL_MAP: Record<string, string> = {
  reasoning: 'Qwen2.5-14B (深度推理)',
  general: 'Qwen2.5-7B (通用任务)',
  coding: 'Qwen2.5-Coder-7B (代码生成)',
  multimodal: 'Qwen2.5-VL-7B (多模态)',
};
