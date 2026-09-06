import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, ChatMessage, ResearchSession, ResearchProject, Hypothesis, ExperimentResult, EvaluationResult, LiteratureResult } from '../types';

// Auth Store
interface AuthStore {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null });
      },
    }),
    { name: 'auth-storage' }
  )
);

// Research Store
interface ResearchStore {
  currentSession: ResearchSession | null;
  sessions: ResearchSession[];
  projects: ResearchProject[];
  currentStage: string;
  isRunning: boolean;

  // Results
  literatureResult: LiteratureResult | null;
  hypothesisResult: { hypotheses: Hypothesis[]; comparison: any; recommendations: string[] } | null;
  experimentResult: ExperimentResult | null;
  evaluationResult: EvaluationResult | null;

  // Chat
  messages: ChatMessage[];

  setCurrentSession: (session: ResearchSession | null) => void;
  setSessions: (sessions: ResearchSession[]) => void;
  setProjects: (projects: ResearchProject[]) => void;
  setCurrentStage: (stage: string) => void;
  setIsRunning: (running: boolean) => void;
  setLiteratureResult: (result: LiteratureResult | null) => void;
  setHypothesisResult: (result: any) => void;
  setExperimentResult: (result: ExperimentResult | null) => void;
  setEvaluationResult: (result: EvaluationResult | null) => void;
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  resetResearch: () => void;
}

export const useResearchStore = create<ResearchStore>((set) => ({
  currentSession: null,
  sessions: [],
  projects: [],
  currentStage: 'question',
  isRunning: false,
  literatureResult: null,
  hypothesisResult: null,
  experimentResult: null,
  evaluationResult: null,
  messages: [],

  setCurrentSession: (session) => set({ currentSession: session }),
  setSessions: (sessions) => set({ sessions }),
  setProjects: (projects) => set({ projects }),
  setCurrentStage: (stage) => set({ currentStage: stage }),
  setIsRunning: (running) => set({ isRunning: running }),
  setLiteratureResult: (result) => set({ literatureResult: result }),
  setHypothesisResult: (result) => set({ hypothesisResult: result }),
  setExperimentResult: (result) => set({ experimentResult: result }),
  setEvaluationResult: (result) => set({ evaluationResult: result }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ messages: [] }),
  resetResearch: () => set({
    currentSession: null,
    currentStage: 'question',
    isRunning: false,
    literatureResult: null,
    hypothesisResult: null,
    experimentResult: null,
    evaluationResult: null,
    messages: [],
  }),
}));

// UI Store
interface UIStore {
  sidebarOpen: boolean;
  activeNav: string;
  theme: 'dark' | 'light';
  toggleSidebar: () => void;
  setActiveNav: (nav: string) => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      activeNav: 'dashboard',
      theme: 'dark',
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setActiveNav: (nav) => set({ activeNav: nav }),
      setTheme: (theme) => {
        set({ theme });
        document.documentElement.classList.toggle('dark', theme === 'dark');
      },
    }),
    { name: 'ui-storage' }
  )
);
