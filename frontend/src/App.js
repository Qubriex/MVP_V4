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
import CohortLive from './pages/inst/CohortLive';
import EvidenceReport from './pages/inst/EvidenceReport';
import Curriculum from './pages/inst/Curriculum';
import Standing from './pages/inst/Standing';
import FacultyReview from './pages/inst/Review';
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
import Reviews from './pages/learn/Reviews';
import LearnerSettings from './pages/learn/Settings';
import Passport from './pages/learn/Passport';
import Verify from './pages/Verify';
import EmployerLogin from './pages/employer/Login';
import EmployerInvite from './pages/employer/Invite';
import EmployerLayout from './pages/employer/Layout';
import EmployerHome from './pages/employer/Home';
import EmployerCompany from './pages/employer/Company';
import EmployerTeam from './pages/employer/Team';
import EmployerApiKeys from './pages/employer/ApiKeys';
import AdminLogin from './pages/admin/Login';
import AdminLayout from './pages/admin/Layout';
import AdminOverview from './pages/admin/Overview';
import AdminEmployers from './pages/admin/Employers';
import AdminOntology from './pages/admin/Ontology';
import AdminQuality from './pages/admin/Quality';

const LOGIN_FOR = { learner: '/learner-login', employer: '/employer/login', admin: '/admin/login' };

function ProtectedRoute({ children, requiredRole }) {
  const { token, role } = useAuth();
  if (!token) return <Navigate to={LOGIN_FOR[requiredRole] || '/login'} replace />;
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
              <Route path="/verify" element={<Verify />} />
              <Route path="/verify/:id" element={<Verify />} />
              <Route path="/employer/login" element={<EmployerLogin />} />
              <Route path="/employer/register" element={<EmployerLogin />} />
              <Route path="/employer/invite/:token" element={<EmployerInvite />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/employer/*" element={
                <ProtectedRoute requiredRole="employer">
                  <Routes>
                    <Route element={<EmployerLayout />}>
                      <Route path="home" element={<EmployerHome />} />
                      <Route path="company" element={<EmployerCompany />} />
                      <Route path="team" element={<EmployerTeam />} />
                      <Route path="api-keys" element={<EmployerApiKeys />} />
                      <Route path="*" element={<Navigate to="/employer/home" replace />} />
                    </Route>
                  </Routes>
                </ProtectedRoute>
              } />
              <Route path="/admin/*" element={
                <ProtectedRoute requiredRole="admin">
                  <Routes>
                    <Route element={<AdminLayout />}>
                      <Route path="overview" element={<AdminOverview />} />
                      <Route path="employers" element={<AdminEmployers />} />
                      <Route path="ontology" element={<AdminOntology />} />
                      <Route path="quality" element={<AdminQuality />} />
                      <Route path="*" element={<Navigate to="/admin/overview" replace />} />
                    </Route>
                  </Routes>
                </ProtectedRoute>
              } />

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
                      <Route path="cohorts/:id/live" element={<CohortLive />} />
                      <Route path="cohorts/:id/report" element={<EvidenceReport />} />
                      <Route path="curriculum" element={<Curriculum />} />
                      <Route path="benchmark" element={<Standing />} />
                      <Route path="review" element={<FacultyReview />} />
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
                      <Route path="settings" element={<LearnerSettings />} />
                      <Route path="resume" element={<ResumeBuilder />} />
                      <Route path="reviews" element={<Reviews />} />
                      <Route path="passport" element={<Passport />} />
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
