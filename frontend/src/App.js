// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import DevNav from './components/DevNav';
import PageTransition from './components/PageTransition';

// Pages
import LandingPage from './pages/LandingPage';
import InstitutionLogin from './pages/InstitutionLogin';
import LearnerLogin from './pages/LearnerLogin';
import InstitutionDashboard from './pages/InstitutionDashboard';
import CapabilityTargetUpload from './pages/CapabilityTargetUpload';
import EngagementSetup from './pages/EngagementSetup';
import EngagementDetail from './pages/EngagementDetail';
import MasteryLogView from './pages/MasteryLogView';
import LearnerDashboard from './pages/LearnerDashboard';
import LearningSession from './pages/LearningSession';

function ProtectedRoute({ children, requiredRole }) {
  const { token, role } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (requiredRole && role !== requiredRole && role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <PageTransition>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<InstitutionLogin />} />
              <Route path="/learner-login" element={<LearnerLogin />} />

              {/* Institution routes */}
              <Route path="/institution/*" element={
                <ProtectedRoute requiredRole="institution">
                  <Routes>
                    <Route path="dashboard" element={<InstitutionDashboard />} />
                    <Route path="upload-target" element={<CapabilityTargetUpload />} />
                    <Route path="engagement/new" element={<EngagementSetup />} />
                    <Route path="engagement/:id" element={<EngagementDetail />} />
                    <Route path="mastery-log/:logId" element={<MasteryLogView />} />
                  </Routes>
                </ProtectedRoute>
              } />

              {/* Learner routes */}
              <Route path="/learn/*" element={
                <ProtectedRoute requiredRole="learner">
                  <Routes>
                    <Route path="dashboard" element={<LearnerDashboard />} />
                    <Route path="session" element={<LearningSession />} />
                  </Routes>
                </ProtectedRoute>
              } />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </PageTransition>
          <DevNav />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
