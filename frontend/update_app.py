import os
import re

def update_app():
    with open('src/App.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Update imports
    content = content.replace("import React, { useEffect } from 'react';", "import React, { useEffect, Suspense } from 'react';")
    
    # Remove old page imports (but keep Layouts and ProtectedRoute)
    lines = content.split('\n')
    new_lines = []
    
    for line in lines:
        if line.startswith('import {') and 'Page } from ' in line:
            continue
        new_lines.append(line)
        
    content = '\n'.join(new_lines)
    
    # Add lazy definitions
    lazy_defs = """
const LoginPage = React.lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const ProjectsPage = React.lazy(() => import('./pages/ProjectsPage').then(m => ({ default: m.ProjectsPage })));
const ProjectDetailPage = React.lazy(() => import('./pages/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })));
const TaskSetupPage = React.lazy(() => import('./pages/TaskSetupPage').then(m => ({ default: m.TaskSetupPage })));
const AnnotatePage = React.lazy(() => import('./pages/AnnotatePage').then(m => ({ default: m.AnnotatePage })));
const VideoAnnotatePage = React.lazy(() => import('./pages/VideoAnnotatePage').then(m => ({ default: m.VideoAnnotatePage })));
const MyTasksPage = React.lazy(() => import('./pages/MyTaskPage').then(m => ({ default: m.MyTasksPage })));
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

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div className="p-8 text-slate-500">Loading...</div>}>
    {children}
  </Suspense>
);
"""
    content = content.replace('export const App: React.FC = () => {', lazy_defs + '\nexport const App: React.FC = () => {')

    # Wrap page components in SuspenseWrapper
    # Find <PageName /> and replace with <SuspenseWrapper><PageName /></SuspenseWrapper>
    pages = [
        "LoginPage", "RegisterPage", "ProjectsPage", "ProjectDetailPage", 
        "TaskSetupPage", "AnnotatePage", "VideoAnnotatePage", "MyTasksPage", 
        "TaskDetailPage", "AdminQualityPage", "AdminDashboardPage", "AdminUsersPage", 
        "AdminUserDetailPage", "AdminAuditPage", "AdminHealthPage", "AdminProjectsPage", 
        "AdminTasksPage", "AdminApiKeysPage", "AdminSettingsPage", "AdminNotificationsPage", 
        "AdminProjectDetailPage"
    ]
    
    for page in pages:
        content = content.replace(f'<{page} />', f'<SuspenseWrapper><{page} /></SuspenseWrapper>')

    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
        
update_app()
