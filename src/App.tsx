// ==============================================================================
// SmartResolve Main Application Component
// Routing with role-based protected route guards and multi-tenant onboarding
// ==============================================================================

import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useInteractiveEffects } from './hooks/useInteractiveEffects';
import { Navbar } from './components/home/Navbar';
import { Footer } from './components/home/Footer';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { JoinSocietyPage } from './pages/onboarding/JoinSocietyPage';
import { PendingStatusPage } from './pages/onboarding/PendingStatusPage';
import { CitizenDashboard } from './pages/citizen/CitizenDashboard';
import { NewComplaintPage } from './pages/citizen/NewComplaintPage';
import { ComplaintTrackingPage } from './pages/citizen/ComplaintTrackingPage';
import { OfficerDashboard } from './pages/officer/OfficerDashboard';
import { DepartmentDashboard } from './pages/department/DepartmentDashboard';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ProfileSettingsPage } from './pages/settings/ProfileSettingsPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

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
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/track" element={<ComplaintTrackingPage />} />

        {/* Onboarding Routes (Authenticated, pre-active membership) */}
        <Route
          path="/onboarding/join-society"
          element={
            <ProtectedRoute requireActiveMembership={false}>
              <JoinSocietyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/pending-status"
          element={
            <ProtectedRoute requireActiveMembership={false}>
              <PendingStatusPage />
            </ProtectedRoute>
          }
        />

        {/* Resident / Citizen Protected Routes */}
        <Route
          path="/dashboard/citizen"
          element={
            <ProtectedRoute allowedRoles={['resident']}>
              <CitizenDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/complaints/new"
          element={
            <ProtectedRoute allowedRoles={['resident']}>
              <NewComplaintPage />
            </ProtectedRoute>
          }
        />

        {/* In-House Maintenance Staff Protected Route */}
        <Route
          path="/dashboard/officer"
          element={
            <ProtectedRoute allowedRoles={['maintenance_staff', 'supervisor', 'society_admin']}>
              <OfficerDashboard />
            </ProtectedRoute>
          }
        />

        {/* Department / Supervisor Protected Route */}
        <Route
          path="/dashboard/department"
          element={
            <ProtectedRoute allowedRoles={['supervisor', 'society_admin']}>
              <DepartmentDashboard />
            </ProtectedRoute>
          }
        />

        {/* Society Administrator Protected Routes */}
        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute allowedRoles={['society_admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/billing"
          element={
            <ProtectedRoute allowedRoles={['society_admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/revenue"
          element={
            <ProtectedRoute allowedRoles={['society_admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/departments"
          element={
            <ProtectedRoute allowedRoles={['society_admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/categories"
          element={
            <ProtectedRoute allowedRoles={['society_admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <ProtectedRoute allowedRoles={['society_admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* User Account Settings */}
        <Route
          path="/settings/profile"
          element={
            <ProtectedRoute requireActiveMembership={false}>
              <ProfileSettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global Footer on public landing page */}
      {isPublicRoute && <Footer />}
    </>
  );
};
