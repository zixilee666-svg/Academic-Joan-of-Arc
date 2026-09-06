import { useState } from 'react';
import { AGENTS, STAGES } from '../utils/constants';
import { bailianAPI } from '../services/api';
import { useResearchStore } from '../stores';
import {
  Brain,
  Send,
  BookOpen,
  Lightbulb,
  FlaskConical,
  ShieldCheck,
  Search,
  Loader2,
  CheckCircle2,
  Clock,
  MessageSquare,
  Sparkles,
  Play,
  ChevronRight,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const AGENT_ICONS: Record<string, any> = {
  literature: BookOpen,
  hypothesis: Lightbulb,
  experiment: FlaskConical,
  evaluation: ShieldCheck,
};

const STAGE_ICONS: Record<string, any> = {
  question: Search,
  literature: BookOpen,
  hypothesis: Lightbulb,
  experiment: FlaskConical,
  evaluation: ShieldCheck,
};

export default function AIHub() {
  const { messages, addMessage, clearMessages, currentStage, setCurrentStage, isRunning, setIsRunning } = useResearchStore();
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set());

  const handleSendMessage = () => {
    if (!input.trim() || isRunning) return;

    const userMsg = {
      id: `msg-${Date.now()}`,
      role: 'user' as const,
      content: input,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);
    setInput('');
    setIsRunning(true);
    setStreamingContent('');

    // Determine which agent to use based on stage
    const stage = currentStage;
    setActiveAgent(stage);

    const modelMap: Record<string, string> = {
      question: 'general',
      literature: 'general',
      hypothesis: 'reasoning',
      experiment: 'coding',
      evaluation: 'reasoning',
    };

    const allMessages = [
      { role: 'system', content: getSystemPrompt(stage) },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: input },
    ];

    let assistantContent = '';

    bailianAPI.chatStream(
      { model: modelMap[stage] || 'general', messages: allMessages, temperature: 0.7 },
      (chunk) => {
        assistantContent += chunk;
        setStreamingContent(assistantContent);
      },
      () => {
        const assistantMsg = {
          id: `msg-${Date.now()}`,
          role: 'assistant' as const,
          content: assistantContent,
          timestamp: new Date().toISOString(),
          agent: stage as any,
        };
        addMessage(assistantMsg);
        setStreamingContent('');
        setIsRunning(false);
        setActiveAgent(null);
        setCompletedStages((prev) => new Set([...prev, stage]));
      },
      (error) => {
        const errorMsg = {
          id: `msg-${Date.now()}`,
          role: 'assistant' as const,
          content: `执行出错：${error}`,
          timestamp: new Date().toISOString(),
        };
        addMessage(errorMsg);
        setIsRunning(false);
        setActiveAgent(null);
      }
    );
  };

  const handleStageClick = (stageKey: string) => {
    setCurrentStage(stageKey);
    setCompletedStages((prev) => new Set([...prev, ...STAGES.slice(0, STAGES.findIndex((s) => s.key === stageKey)).map((s) => s.key)]));
  };

  const handleRunPipeline = () => {
    if (!input.trim() || isRunning) return;
    // Run through all stages sequentially
    const stages = ['question', 'literature', 'hypothesis', 'experiment', 'evaluation'];
    let currentIndex = 0;

    const runNextStage = () => {
      if (currentIndex >= stages.length) {
        setIsRunning(false);
        setActiveAgent(null);
        return;
      }

      const stage = stages[currentIndex];
      setCurrentStage(stage);
      setActiveAgent(stage);

      const modelMap: Record<string, string> = {
        question: 'general',
        literature: 'general',
        hypothesis: 'reasoning',
        experiment: 'coding',
        evaluation: 'reasoning',
      };

      const allMessages = [
        { role: 'system', content: getSystemPrompt(stage) },
        { role: 'user', content: input },
      ];

      let content = '';
      bailianAPI.chatStream(
        { model: modelMap[stage], messages: allMessages, temperature: 0.7 },
        (chunk) => {
          content += chunk;
          setStreamingContent(content);
        },
        () => {
          const msg = {
            id: `msg-${Date.now()}-${stage}`,
            role: 'assistant' as const,
            content: content,
            timestamp: new Date().toISOString(),
            agent: stage as any,
          };
          addMessage(msg);
          setCompletedStages((prev) => new Set([...prev, stage]));
          setStreamingContent('');
          currentIndex++;
          setTimeout(runNextStage, 500);
        },
        (error) => {
          console.error(`${stage} error:`, error);
          currentIndex++;
          setTimeout(runNextStage, 500);
        }
      );
    };

    setIsRunning(true);
    runNextStage();
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Left: Agent Panel */}
      <div className="w-72 flex-shrink-0 space-y-4 overflow-y-auto">
        {/* Stage Pipeline */}
        <div className="card-lab">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Play className="w-4 h-4 text-primary-400" />
            研究流程
          </h3>
          <div className="space-y-2">
            {STAGES.map((stage, idx) => {
              const Icon = STAGE_ICONS[stage.key];
              const isActive = currentStage === stage.key;
              const isCompleted = completedStages.has(stage.key);
              return (
                <button
                  key={stage.key}
                  onClick={() => handleStageClick(stage.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                    isActive
                      ? 'bg-primary-600/20 border border-primary-500/30'
                      : isCompleted
                      ? 'bg-emerald-500/10 border border-emerald-500/20'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isCompleted ? 'bg-emerald-500/20' : isActive ? 'bg-primary-500/20' : 'bg-deep-border'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-primary-400' : 'text-gray-500'}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isActive ? 'text-primary-400' : isCompleted ? 'text-emerald-400' : 'text-gray-400'}`}>
                      {stage.label}
                    </p>
                    <p className="text-xs text-gray-600">{stage.labelEn}</p>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${isActive ? 'text-primary-400' : 'text-gray-600'}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Agent Cards */}
        <div className="card-lab">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Brain className="w-4 h-4 text-deep-cyan" />
            智能体
          </h3>
          <div className="space-y-2">
            {AGENTS.map((agent) => {
              const Icon = AGENT_ICONS[agent.type];
              const isActive = activeAgent === agent.type;
              return (
                <div
                  key={agent.type}
                  className={`p-3 rounded-lg border transition-all ${
                    isActive
                      ? 'border-primary-500/50 bg-primary-500/10'
                      : 'border-deep-border/50 hover:border-deep-border'
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: agent.color + '20' }}>
                      <Icon className="w-4 h-4" style={{ color: agent.color }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-200">{agent.nameCn}</p>
                      <p className="text-xs text-gray-500">{agent.model}</p>
                    </div>
                    {isActive && <span className="w-2 h-2 bg-primary-400 rounded-full animate-pulse ml-auto"></span>}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{agent.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Center: Chat / Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="card-lab flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-deep-border mb-4">
            <div>
              <p className="kicker mb-2">学术贞德 / MULTI-AGENT</p>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-deep-cyan" />
                学术贞德
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">多智能体协作 · 当前阶段：{STAGES.find((s) => s.key === currentStage)?.label}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={clearMessages} className="btn-secondary text-sm">清空对话</button>
              <button onClick={handleRunPipeline} disabled={isRunning || !input.trim()} className="btn-primary text-sm flex items-center gap-2">
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                全流程执行
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {messages.length === 0 && !streamingContent && (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Brain className="w-12 h-12 mx-auto mb-4 text-deep-border" />
                  <p className="text-lg font-medium mb-2">开始您的科研探索</p>
                  <p className="text-sm">输入科学问题，AI智能体将协助您完成全流程研究</p>
                  <div className="mt-6 flex flex-wrap gap-2 justify-center">
                    {['太阳耀斑预测机制', '系外行星大气成分', '黑洞吸积盘辐射'].map((q) => (
                      <button
                        key={q}
                        onClick={() => setInput(q)}
                        className="px-3 py-1.5 rounded-full bg-deep-border/50 text-xs text-gray-400 hover:text-primary-400 hover:bg-primary-500/10 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-2' : ''}`}>
                  {msg.role === 'assistant' && msg.agent && (
                    <div className="flex items-center gap-2 mb-1.5">
                      {(() => {
                        const Icon = AGENT_ICONS[msg.agent] || Brain;
                        const agent = AGENTS.find((a) => a.type === msg.agent);
                        return (
                          <>
                            <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: (agent?.color || '#666') + '20' }}>
                              <Icon className="w-3 h-3" style={{ color: agent?.color || '#666' }} />
                            </div>
                            <span className="text-xs text-gray-500">{agent?.nameCn || 'AI'}</span>
                          </>
                        );
                      })()}
                    </div>
                  )}
                  <div className={`rounded-xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-primary-600 text-white'
                      : 'bg-deep-dark border border-deep-border'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="markdown-content text-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1.5 px-1">
                    {new Date(msg.timestamp).toLocaleTimeString('zh-CN')}
                  </p>
                </div>
              </div>
            ))}

            {/* Streaming content */}
            {streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[80%]">
                  {activeAgent && (
                    <div className="flex items-center gap-2 mb-1.5">
                      {(() => {
                        const Icon = AGENT_ICONS[activeAgent] || Brain;
                        const agent = AGENTS.find((a) => a.type === activeAgent);
                        return (
                          <>
                            <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: (agent?.color || '#666') + '20' }}>
                              <Icon className="w-3 h-3 animate-pulse" style={{ color: agent?.color || '#666' }} />
                            </div>
                            <span className="text-xs text-gray-500">{agent?.nameCn} 正在思考...</span>
                          </>
                        );
                      })()}
                    </div>
                  )}
                  <div className="rounded-xl px-4 py-3 bg-deep-dark border border-deep-border">
                    <div className="markdown-content text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                      <span className="inline-block w-2 h-4 bg-primary-400 animate-pulse ml-1"></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="mt-4 pt-4 border-t border-deep-border">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder={`输入科学问题... (当前: ${STAGES.find((s) => s.key === currentStage)?.label}阶段)`}
                className="input-field flex-1"
                disabled={isRunning}
              />
              <button
                onClick={handleSendMessage}
                disabled={isRunning || !input.trim()}
                className="btn-primary flex items-center gap-2"
              >
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                发送
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getSystemPrompt(stage: string): string {
  const prompts: Record<string, string> = {
    question: '你是Academic Joan of Arc平台的"问题理解"模块。请分析用户提出的科学问题，进行实体抽取、学科分类、可行性评估，并推荐研究路径。',
    literature: '你是Academic Joan of Arc平台的"文献整合者"智能体。请检索相关文献，提取关键证据，识别知识缺口，构建证据链。',
    hypothesis: '你是Academic Joan of Arc平台的"假设生成器"智能体。请基于已有分析，生成3个候选科学假设，评估创新性和可验证性。',
    experiment: '你是Academic Joan of Arc平台的"实验规划师"智能体。请设计验证实验方案，包括变量定义、实验步骤、代码框架和甘特图。',
    evaluation: '你是Academic Joan of Arc平台的"评估验证官"智能体。请评估假设质量，检测认知偏差，提出修正建议，搜索反例。',
  };
  return prompts[stage] || prompts.question;
}
