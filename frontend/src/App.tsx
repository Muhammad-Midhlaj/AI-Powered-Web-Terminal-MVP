import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { LoginPage } from './pages/LoginPage';
import { TerminalPage } from './pages/TerminalPage';
import { Layout } from './components/Layout';
import { Toaster } from './components/ui/toaster';

function App() {
  const { isAuthenticated, initializeAuth } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-white">
        <Routes>
          <Route 
            path="/login" 
            element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/*" 
            element={
              isAuthenticated ? (
                <Layout>
                  <Routes>
                    <Route path="/" element={<TerminalPage />} />
                    <Route path="/terminal" element={<TerminalPage />} />
                    <Route path="/terminal/:sessionId" element={<TerminalPage />} />
                  </Routes>
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
        </Routes>
        <Toaster />
      </div>
    </Router>
  );
}

export default App; 