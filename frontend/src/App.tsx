import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AnnotatePage } from './pages/AnnotatePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { useAuthStore } from './store/authStore';
import { authApi } from './api/auth';

function App() {
  const { accessToken, setSession, clear } = useAuthStore();

  useEffect(() => {
    // Bootstrap session on mount if token exists
    if (accessToken) {
      authApi.me()
        .then(user => {
          setSession(user, accessToken, useAuthStore.getState().refreshToken || '');
        })
        .catch(() => {
          clear();
        });
    }
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      
      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        {/* For now, just rendering AnnotatePage at / as a placeholder for a projects list */}
        <Route path="/" element={<AnnotatePage taskId={1} />} />
        <Route path="/task/:taskId" element={<AnnotatePage taskId={1} />} />
      </Route>
    </Routes>
  );
}

export default App;
