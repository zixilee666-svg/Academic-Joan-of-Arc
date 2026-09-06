// Academic Joan of Arc Type Definitions

export interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'user';
  avatar: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

// Research Session
export interface ResearchSession {
  id: string;
  userId: string;
  title: string;
  domain: string;
  question: string;
  depth: 'standard' | 'deep' | 'expert';
  status: 'created' | 'running' | 'completed' | 'failed';
  currentStage: ResearchStage;
  stages: StageRecord;
  agents: AgentLog[];
  createdAt: string;
  updatedAt: string;
}

export type ResearchStage = 'question' | 'literature' | 'hypothesis' | 'experiment' | 'evaluation';

export interface StageRecord {
  question: StageState;
  literature: StageState;
  hypothesis: StageState;
  experiment: StageState;
  evaluation: StageState;
}

export interface StageState {
  status: 'pending' | 'running' | 'completed' | 'failed';
  result: any;
}

export interface AgentLog {
  name: string;
  status: 'running' | 'completed' | 'failed';
  completedAt: string;
}

// Literature
export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  journal: string;
  doi?: string;
  abstract: string;
  relevance: number;
  keywords: string[];
}

export interface Evidence {
  id: string;
  claim: string;
  supportingPapers: string[];
  confidence: number;
  source: string;
}

export interface KnowledgeGap {
  id: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  relatedPapers: string[];
  suggestion: string;
}

export interface LiteratureResult {
  papers: Paper[];
  evidence: Evidence[];
  gaps: KnowledgeGap[];
  summary: string;
}

// Hypothesis
export interface Hypothesis {
  id: string;
  title: string;
  description: string;
  rationale: string;
  scores: HypothesisScores;
  validation: ValidationPlan;
  risks: string[];
  references: string[];
  version: number;
  status: 'draft' | 'reviewed' | 'approved' | 'rejected';
}

export interface HypothesisScores {
  innovation: number;
  verifiability: number;
  theoretical: number;
  dataSupport: number;
  practicality: number;
  overall: number;
}

export interface ValidationPlan {
  method: string;
  datasets: string[];
  expectedResults: string;
  timeline: string;
}

export interface HypothesisComparison {
  dimensions: string[];
  scores: number[][];
  ranking: number[];
}

export interface HypothesisResult {
  hypotheses: Hypothesis[];
  comparison: HypothesisComparison;
  recommendations: string[];
}

// Experiment
export interface ExperimentVariable {
  type: 'independent' | 'dependent' | 'control';
  name: string;
  definition: string;
  range: string;
}

export interface ExperimentStep {
  order: number;
  name: string;
  description: string;
  duration: string;
  deliverable: string;
}

export interface GanttTask {
  id: string;
  name: string;
  start: number;
  duration: number;
  dependencies: string[];
}

export interface ResourceEstimate {
  compute: string;
  storage: string;
  time: string;
  cost: string;
}

export interface RiskItem {
  risk: string;
  probability: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  mitigation: string;
}

export interface ExperimentResult {
  objective: string;
  variables: ExperimentVariable[];
  steps: ExperimentStep[];
  code: string;
  gantt: GanttTask[];
  resources: ResourceEstimate;
  risks: RiskItem[];
}

// Evaluation
export interface DimensionScore {
  dimension: string;
  score: number;
  maxScore: number;
  rationale: string;
}

export interface BiasCheck {
  confirmationBias: { level: 'low' | 'medium' | 'high'; description: string };
  availabilityBias: { level: 'low' | 'medium' | 'high'; description: string };
  anchoringBias: { level: 'low' | 'medium' | 'high'; description: string };
  overallRisk: 'low' | 'medium' | 'high';
}

export interface VersionComparison {
  version: number;
  changes: string[];
  scoreDelta: number;
}

export interface EvaluationResult {
  scores: DimensionScore[];
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  counterExamples: string[];
  biasCheck: BiasCheck;
  versionComparison?: VersionComparison;
}

// Agent types
export type AgentType = 'literature' | 'hypothesis' | 'experiment' | 'evaluation';

export interface AgentInfo {
  type: AgentType;
  name: string;
  nameCn: string;
  model: string;
  description: string;
  icon: string;
  color: string;
}

// Chat message
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  agent?: AgentType;
}

// Research project
export interface ResearchProject {
  id: string;
  userId: string;
  title: string;
  domain: string;
  question: string;
  hypothesis?: Hypothesis;
  experiment?: ExperimentResult;
  evaluation?: EvaluationResult;
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
}

// ─── Wizard / Pipeline Types (Phase 3) ───

export type WizardStage = 'question' | 'literature' | 'hypothesis' | 'experiment' | 'evaluation' | 'paper';

export const WIZARD_STAGE_ORDER: WizardStage[] = ['question', 'literature', 'hypothesis', 'experiment', 'evaluation', 'paper'];

export interface WizardStageState {
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface WizardProject {
  id: string;
  title: string;
  domain: string;
  question: string;
  stages: Partial<Record<WizardStage, WizardStageState>>;
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface WizardDecision {
  stage: WizardStage;
  choice: string;
  rationale: string;
}

export interface QuestionResult {
  analysis: string;
  entities: { name: string; type: string }[];
  classification: string;
  similarTopics?: { topic: string; reference?: string; year?: string }[];
  feasibility: {
    dataAvailability: number;
    methodMaturity: number;
    innovationSpace: number;
    applicationValue: number;
    overall?: string;
    description?: string;
  };
}

export interface PaperFigure {
  type: 'bar' | 'line' | 'scatter' | 'pie' | 'heatmap';
  title: string;
  description: string;
  data: {
    labels: string[];
    datasets: { label: string; data: number[]; backgroundColor?: string[]; borderColor?: string }[];
  };
  xLabel?: string;
  yLabel?: string;
}

export interface PaperResult {
  title: string;
  markdown: string;
  figures?: PaperFigure[];
}

export interface JournalFormat {
  id: string;
  name: string;
  description: string;
}

export interface PaperSearchResult {
  id: string;
  title: string;
  authors: string[];
  year: number;
  journal: string;
  doi?: string;
  abstract: string;
  citations?: number;
  source: 'crossref' | 'openalex';
}
