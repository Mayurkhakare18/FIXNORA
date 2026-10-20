import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useInteractiveEffects } from './hooks/useInteractiveEffects';
import { Navbar } from './components/home/Navbar';
import { Footer } from './components/home/Footer';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { CitizenDashboard } from './pages/citizen/CitizenDashboard';
import { NewComplaintPage } from './pages/citizen/NewComplaintPage';
import { ComplaintTrackingPage } from './pages/citizen/ComplaintTrackingPage';
import { OfficerDashboard } from './pages/officer/OfficerDashboard';
import { DepartmentDashboard } from './pages/department/DepartmentDashboard';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ProfileSettingsPage } from './pages/settings/ProfileSettingsPage';

export const App: React.FC = () => {
  useInteractiveEffects();
  const location = useLocation();
  const isPublicRoute = location.pathname === '/';

  return (
    <>
      {/* Ambient background orbs & grain */}
      <div className="orbs" aria-hidden="true">
        <i />
        <i />
        <i />
        <div className="grain" />
      </div>

      {/* Scroll progress bar */}
      <div id="sp" />

      {/* Global Navbar on public landing page */}
      {isPublicRoute && <Navbar />}

      {/* Route Switcher */}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/dashboard/citizen" element={<CitizenDashboard />} />
        <Route path="/complaints/new" element={<NewComplaintPage />} />
        <Route path="/track" element={<ComplaintTrackingPage />} />
        <Route path="/dashboard/officer" element={<OfficerDashboard />} />
        <Route path="/dashboard/department" element={<DepartmentDashboard />} />
        <Route path="/dashboard/admin" element={<AdminDashboard />} />
        <Route path="/admin/departments" element={<AdminDashboard />} />
        <Route path="/admin/categories" element={<AdminDashboard />} />
        <Route path="/admin/audit-logs" element={<AdminDashboard />} />
        <Route path="/settings/profile" element={<ProfileSettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global Footer on public landing page */}
      {isPublicRoute && <Footer />}
    </>
  );
};
