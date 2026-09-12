import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LeftHero } from './components/LeftHero/LeftHero';
import { RightLogin } from './components/RightLogin/RightLogin';

/**
 * The existing landing + login page (visual source of truth), now wired to the
 * auth layer. When the session becomes authenticated (fresh sign-in or a
 * restored session on "/"), the user is sent to the portal matching their
 * server-provided role claim.
 */
export const LandingPage = () => {
  const { status, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'authenticated' && user) {
      navigate(user.role === 'gov_officer' ? '/gov' : '/inspector', { replace: true });
    }
  }, [status, user, navigate]);

  return (
    <main className="split-landing-layout">
      {/* Left Photographic Hero Section */}
      <LeftHero />

      {/* Right Inspector Login Card Section */}
      <RightLogin />
    </main>
  );
};
