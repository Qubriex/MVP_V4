// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { UiLangProvider } from './context/UiLangContext';
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
import LearnerLayout from './components/learn/LearnerLayout';
import LearnerHome from './pages/learn/Dashboard';
import VoiceSession from './pages/learn/Session';
import SkillRecord from './pages/learn/Record';
import JobMarket from './pages/learn/JobMarket';
import JobDetail from './pages/learn/JobDetail';
import InterviewPractice from './pages/learn/Interview';
import EmergingTopics from './pages/learn/Topics';
import LearnerProfile from './pages/learn/Profile';
import ResumeBuilder from './pages/learn/Resume';
import Welcome from './pages/learn/Welcome';

function ProtectedRoute({ children, requiredRole }) {
  const { token, role } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (requiredRole && role !== requiredRole && role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <UiLangProvider>
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

              {/* Learner routes — all under /learn/*, sharing the sidebar shell
                  except the voice session, which runs full screen. */}
              <Route path="/learn/*" element={
                <ProtectedRoute requiredRole="learner">
                  <Routes>
                    <Route path="session" element={<VoiceSession />} />
                    <Route element={<LearnerLayout />}>
                      <Route path="dashboard" element={<LearnerHome />} />
                      <Route path="welcome" element={<Welcome />} />
                      <Route path="record" element={<SkillRecord />} />
                      <Route path="market" element={<JobMarket />} />
                      <Route path="market/:jobId" element={<JobDetail />} />
                      <Route path="market/:jobId/interview" element={<InterviewPractice />} />
                      <Route path="topics" element={<EmergingTopics />} />
                      <Route path="profile" element={<LearnerProfile />} />
                      <Route path="resume" element={<ResumeBuilder />} />
                      <Route path="*" element={<Navigate to="/learn/dashboard" replace />} />
                    </Route>
                  </Routes>
                </ProtectedRoute>
              } />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </PageTransition>
          <DevNav />
        </BrowserRouter>
      </AuthProvider>
      </UiLangProvider>
    </ThemeProvider>
  );
}
