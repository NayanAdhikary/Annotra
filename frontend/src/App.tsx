import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { TaskSetupPage } from './pages/TaskSetupPage';
import { AnnotatePage } from './pages/AnnotatePage';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { AppLayout } from './components/Layout/AppLayout';
import { useAuthStore } from './store/authStore';
import { authApi } from './api/auth';

export const App: React.FC = () => {
  const { accessToken, setUser } = useAuthStore();

  useEffect(() => {
    if (!accessToken) return;
    authApi.me().then(setUser).catch(() => useAuthStore.getState().clear());
  }, [accessToken, setUser]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/" element={
          <ProtectedRoute><AppLayout><ProjectsPage /></AppLayout></ProtectedRoute>
        } />
        <Route path="/projects/:projectId" element={
          <ProtectedRoute><AppLayout><ProjectDetailPage /></AppLayout></ProtectedRoute>
        } />
        <Route path="/tasks/:taskId/setup" element={
          <ProtectedRoute><AppLayout><TaskSetupPage /></AppLayout></ProtectedRoute>
        } />

        {/* Workspace — full-screen, no layout */}
        <Route path="/tasks/:taskId" element={
          <ProtectedRoute><AnnotatePage /></ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
