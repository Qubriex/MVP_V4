// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { UiLangProvider } from './context/UiLangContext';
import DevNav from './components/DevNav';
import PageTransition from './components/PageTransition';

// Pages
import LandingPage from './pages/LandingPage';
import LearnerLogin from './pages/LearnerLogin';
import MasteryLogView from './pages/MasteryLogView';
import LearnerInvite from './pages/LearnerInvite';
import InstitutionLayout from './components/inst/InstitutionLayout';
import StaffLogin from './pages/inst/StaffLogin';
import StaffInvite from './pages/inst/StaffInvite';
import StaffWelcome from './pages/inst/StaffWelcome';
import StaffProfile from './pages/inst/StaffProfile';
import InstHome from './pages/inst/Home';
import Team from './pages/inst/Team';
import Students from './pages/inst/Students';
import AddStudents from './pages/inst/AddStudents';
import Cohorts from './pages/inst/Cohorts';
import NewCohort from './pages/inst/NewCohort';
import Cohort from './pages/inst/Cohort';
import Curriculum from './pages/inst/Curriculum';
import Standing from './pages/inst/Standing';
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

function LegacyCohortRedirect() {
  const { id } = useParams();
  return <Navigate to={`/institution/cohorts/${id}`} replace />;
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
              <Route path="/login" element={<StaffLogin />} />
              <Route path="/institution/invite/:token" element={<StaffInvite />} />
              <Route path="/learner-login" element={<LearnerLogin />} />
              <Route path="/learner-invite/:token" element={<LearnerInvite />} />

              {/* Institution (staff) routes — one dark-sidebar shell; profile
                  setup after an invite runs full screen. Old URLs redirect. */}
              <Route path="/institution/*" element={
                <ProtectedRoute requiredRole="institution">
                  <Routes>
                    <Route path="welcome" element={<StaffWelcome />} />
                    <Route element={<InstitutionLayout />}>
                      <Route path="home" element={<InstHome />} />
                      <Route path="team" element={<Team />} />
                      <Route path="students" element={<Students />} />
                      <Route path="students/add" element={<AddStudents />} />
                      <Route path="cohorts" element={<Cohorts />} />
                      <Route path="cohorts/new" element={<NewCohort />} />
                      <Route path="cohorts/:id" element={<Cohort />} />
                      <Route path="curriculum" element={<Curriculum />} />
                      <Route path="benchmark" element={<Standing />} />
                      <Route path="profile" element={<StaffProfile />} />
                      <Route path="mastery-log/:logId" element={<MasteryLogView />} />
                      <Route path="dashboard" element={<Navigate to="/institution/home" replace />} />
                      <Route path="upload-target" element={<Navigate to="/institution/cohorts/new" replace />} />
                      <Route path="engagement/new" element={<Navigate to="/institution/cohorts/new" replace />} />
                      <Route path="engagement/:id" element={<LegacyCohortRedirect />} />
                      <Route path="*" element={<Navigate to="/institution/home" replace />} />
                    </Route>
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
