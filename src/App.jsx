import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import './styles/variables.css';
import './styles/reset.css';
import './styles/landing.css';
import './styles/left-hero.css';
import './styles/login-card.css';
import './styles/app.css';

import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AppRoutes } from './routes/AppRoutes';

const SkipLink = () => {
  const { t } = useLanguage();
  return (
    <a href="#main-content" className="skip-link">
      {t.skipLink}
    </a>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <SkipLink />
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
