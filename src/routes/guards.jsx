import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const RequireAuth = ({ children }) => {
  const { status } = useAuth();
  if (status === 'loading') return <FullSplash />;
  if (status === 'unauthenticated') return <Navigate to="/" replace />;
  return children;
};

export const RequireRole = ({ role, children }) => {
  const { status, user } = useAuth();
  if (status === 'loading') return <FullSplash />;
  if (status === 'unauthenticated') return <Navigate to="/" replace />;
  if (user?.role !== role) return <Navigate to="/unauthorized" replace />;
  return children;
};

function FullSplash() {
  return (
    <div className="splash-screen" role="status" aria-live="polite">
      <img src="/assets/india-emblem.png" alt="" />
      <p className="splash-title">Legal Metrology Compliance System</p>
      <div className="splash-spinner" aria-hidden="true" />
    </div>
  );
}
