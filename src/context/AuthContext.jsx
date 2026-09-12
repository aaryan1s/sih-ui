import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authService, sessionStore } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [status, setStatus] = useState('loading'); // loading | unauthenticated | authenticated
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  // Restore session on first load (demo: sessionStorage; future: Supabase session)
  useEffect(() => {
    const session = sessionStore.load();
    if (session?.user) {
      setUser(session.user);
      setStatus('authenticated');
    } else {
      setStatus('unauthenticated');
    }
  }, []);

  const signIn = async (userId, password) => {
    setError(null);
    try {
      const session = await authService.signIn(userId, password);
      sessionStore.save(session);
      setUser(session.user);
      setStatus('authenticated');
      return session.user;
    } catch (err) {
      setError(err.code || 'invalid_credentials');
      throw err;
    }
  };

  const signOut = () => {
    sessionStore.clear();
    setUser(null);
    setStatus('unauthenticated');
  };

  const value = useMemo(
    () => ({ status, user, error, signIn, signOut }),
    [status, user, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
