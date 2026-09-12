import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const Unauthorized = () => {
  const { user } = useAuth();
  const portalHome = user?.role === 'gov_officer' ? '/gov' : '/inspector';

  return (
    <div className="error-page">
      <span className="error-page-code">403</span>
      <h1 className="error-page-title">Unauthorized Access</h1>
      <p className="error-page-sub">
        Your account ({user?.roleLabel || 'unknown role'}) is not authorized to open this portal. Access is enforced by the authorization layer, not just navigation.
      </p>
      <Link to={portalHome} className="app-btn app-btn-primary">Return to My Portal</Link>
    </div>
  );
};

export const NotFound = () => (
  <div className="error-page">
    <span className="error-page-code">404</span>
    <h1 className="error-page-title">Page Not Found</h1>
    <p className="error-page-sub">The page you requested does not exist in this application.</p>
    <Link to="/" className="app-btn app-btn-primary">Go to Home</Link>
  </div>
);
