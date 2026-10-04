import React, { useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { AppLayout } from './components/Layout/AppLayout';
import { useAuthStore } from './store/authStore';
import { authApi } from './api/auth';
import { AdminLayout } from './components/Admin/AdminLayout';


const LoginPage = React.lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const ProjectsPage = React.lazy(() => import('./pages/ProjectsPage').then(m => ({ default: m.ProjectsPage })));
const ProjectDetailPage = React.lazy(() => import('./pages/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })));
const TaskSetupPage = React.lazy(() => import('./pages/TaskSetupPage').then(m => ({ default: m.TaskSetupPage })));
const TaskToolSetupPage = React.lazy(() => import('./pages/TaskToolSetupPage').then(m => ({ default: m.TaskToolSetupPage })));
const AnnotatePage = React.lazy(() => import('./pages/AnnotatePage').then(m => ({ default: m.AnnotatePage })));
const VideoAnnotatePage = React.lazy(() => import('./pages/VideoAnnotatePage').then(m => ({ default: m.VideoAnnotatePage })));
const MyTasksPage = React.lazy(() => import('./pages/MyTaskPage').then(m => ({ default: m.MyTasksPage })));
const MyStatsPage = React.lazy(() => import('./pages/MyStatsPage').then(m => ({ default: m.MyStatsPage })));
const TaskDetailPage = React.lazy(() => import('./pages/TaskDetailPage').then(m => ({ default: m.TaskDetailPage })));

const AdminQualityPage = React.lazy(() => import('./pages/admin/AdminQualityPage').then(m => ({ default: m.AdminQualityPage })));
const AdminDashboardPage = React.lazy(() => import('./pages/admin/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const AdminUsersPage = React.lazy(() => import('./pages/admin/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const AdminUserDetailPage = React.lazy(() => import('./pages/admin/AdminUserDetailPage').then(m => ({ default: m.AdminUserDetailPage })));
const AdminAuditPage = React.lazy(() => import('./pages/admin/AdminAuditPage').then(m => ({ default: m.AdminAuditPage })));
const AdminHealthPage = React.lazy(() => import('./pages/admin/AdminHealthPage').then(m => ({ default: m.AdminHealthPage })));
const AdminProjectsPage = React.lazy(() => import('./pages/admin/AdminProjectsPage').then(m => ({ default: m.AdminProjectsPage })));
const AdminTasksPage = React.lazy(() => import('./pages/admin/AdminTasksPage').then(m => ({ default: m.AdminTasksPage })));
const AdminApiKeysPage = React.lazy(() => import('./pages/admin/AdminApiKeysPage').then(m => ({ default: m.AdminApiKeysPage })));
const AdminSettingsPage = React.lazy(() => import('./pages/AdminSettingsPage').then(m => ({ default: m.AdminSettingsPage })));
const AdminNotificationsPage = React.lazy(() => import('./pages/admin/AdminNotificationsPage').then(m => ({ default: m.AdminNotificationsPage })));
const AdminProjectDetailPage = React.lazy(() => import('./pages/admin/AdminProjectDetailPage').then(m => ({ default: m.AdminProjectDetailPage })));
const AdminModelsPage = React.lazy(() => import('./pages/admin/AdminModelsPage').then(m => ({ default: m.AdminModelsPage })));
const AdminToolSetupPage = React.lazy(() => import('./pages/admin/AdminToolSetupPage').then(m => ({ default: m.AdminToolSetupPage })));

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div className="p-8 text-slate-500">Loading...</div>}>
    {children}
  </Suspense>
);

export const App: React.FC = () => {
  const { accessToken, setUser } = useAuthStore();

  useEffect(() => {
    if (!accessToken) return;
    authApi.me().then(setUser).catch(() => useAuthStore.getState().clear());
  }, [accessToken, setUser]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<SuspenseWrapper><LoginPage /></SuspenseWrapper>} />
        <Route path="/register" element={<SuspenseWrapper><RegisterPage /></SuspenseWrapper>} />

        <Route path="/" element={
          <ProtectedRoute><AppLayout><SuspenseWrapper><ProjectsPage /></SuspenseWrapper></AppLayout></ProtectedRoute>
        } />
        <Route path="/my-tasks" element={
          <ProtectedRoute><AppLayout><SuspenseWrapper><MyTasksPage /></SuspenseWrapper></AppLayout></ProtectedRoute>
        } />
        <Route path="/my-stats" element={
          <ProtectedRoute><AppLayout><SuspenseWrapper><MyStatsPage /></SuspenseWrapper></AppLayout></ProtectedRoute>
        } />
        <Route path="/projects/:projectId" element={
          <ProtectedRoute><AppLayout><SuspenseWrapper><ProjectDetailPage /></SuspenseWrapper></AppLayout></ProtectedRoute>
        } />
        <Route path="/tasks/:taskId/detail" element={
          <ProtectedRoute><AppLayout><SuspenseWrapper><TaskDetailPage /></SuspenseWrapper></AppLayout></ProtectedRoute>
        } />
        <Route path="/tasks/:taskId/setup" element={
          <ProtectedRoute><AppLayout><SuspenseWrapper><TaskSetupPage /></SuspenseWrapper></AppLayout></ProtectedRoute>
        } />
        <Route path="/tasks/:taskId/tool-setup" element={
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <AppLayout><SuspenseWrapper><TaskToolSetupPage /></SuspenseWrapper></AppLayout>
          </ProtectedRoute>
        } />

        {/* Workspace — full-screen, no layout */}
        <Route path="/tasks/:taskId" element={
          <ProtectedRoute><SuspenseWrapper><AnnotatePage /></SuspenseWrapper></ProtectedRoute>
        } />
        <Route path="/tasks/:taskId/videos/:videoId" element={
          <ProtectedRoute><SuspenseWrapper><VideoAnnotatePage /></SuspenseWrapper></ProtectedRoute>
        } />

        {/* Admin section */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout><SuspenseWrapper><AdminDashboardPage /></SuspenseWrapper></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/quality" element={
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <AdminLayout><SuspenseWrapper><AdminQualityPage /></SuspenseWrapper></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/projects" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout><SuspenseWrapper><AdminProjectsPage /></SuspenseWrapper></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/projects/:projectId" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout><SuspenseWrapper><AdminProjectDetailPage /></SuspenseWrapper></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/tasks" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout><SuspenseWrapper><AdminTasksPage /></SuspenseWrapper></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/api-keys" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout><SuspenseWrapper><AdminApiKeysPage /></SuspenseWrapper></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/settings" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout><SuspenseWrapper><AdminSettingsPage /></SuspenseWrapper></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/notifications" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout><SuspenseWrapper><AdminNotificationsPage /></SuspenseWrapper></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout><SuspenseWrapper><AdminUsersPage /></SuspenseWrapper></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/users/:userId" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout><SuspenseWrapper><AdminUserDetailPage /></SuspenseWrapper></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/audit" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout><SuspenseWrapper><AdminAuditPage /></SuspenseWrapper></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/health" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout><SuspenseWrapper><AdminHealthPage /></SuspenseWrapper></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/models" element={
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <AdminLayout><SuspenseWrapper><AdminModelsPage /></SuspenseWrapper></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/tool-setup" element={
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <AdminLayout><SuspenseWrapper><AdminToolSetupPage /></SuspenseWrapper></AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
