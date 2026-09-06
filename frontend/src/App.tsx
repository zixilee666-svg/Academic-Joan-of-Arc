import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AIHub from './pages/AIHub';
import AstroDataPage from './pages/AstroDataPage';
import KnowledgeGraphPage from './pages/KnowledgeGraphPage';
import DataDashboard from './pages/DataDashboard';
import SettingsPage from './pages/SettingsPage';
import QuestionsBankPage from './pages/QuestionsBankPage';
import PipelineWorkbenchPage from './pages/PipelineWorkbenchPage';
import EvalCenterPage from './pages/EvalCenterPage';
import NewQuestionPage from './pages/NewQuestionPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="ai-hub" element={<AIHub />} />
          {/* 旧 Mock 占位流水线5页已下线：/research/* 统一重定向到真实六环节入口 */}
          <Route path="research/question" element={<Navigate to="/pipeline/new" replace />} />
          <Route path="research/literature" element={<Navigate to="/pipeline/new" replace />} />
          <Route path="research/hypothesis" element={<Navigate to="/pipeline/new" replace />} />
          <Route path="research/plan" element={<Navigate to="/pipeline/new" replace />} />
          <Route path="research/iterate" element={<Navigate to="/pipeline/new" replace />} />
          <Route path="pipeline/new" element={<NewQuestionPage />} />
          <Route path="pipeline/questions" element={<QuestionsBankPage />} />
          <Route path="pipeline/workbench" element={<PipelineWorkbenchPage />} />
          <Route path="pipeline/eval" element={<EvalCenterPage />} />
          <Route path="data/astronomy" element={<AstroDataPage />} />
          <Route path="knowledge/graph" element={<KnowledgeGraphPage />} />
          <Route path="visualization/dashboard" element={<DataDashboard />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
