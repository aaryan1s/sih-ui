import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Languages, Info } from 'lucide-react';
import { Card } from '../../components/common/ui';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

/* Shared Settings page for both portals — language preference is functional;
   everything else is demo-mode information. */
export const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const navigate = useNavigate();

  return (
    <>
      <header className="app-page-header">
        <div>
          <h1 className="app-page-title">{t.app.titleSettings}</h1>
          <p className="app-page-subtitle">Preferences for your account in this demo build.</p>
        </div>
      </header>

      <Card title="Language Preference" className="placeholder-panel">
        <p className="wizard-step-intro" style={{ margin: 0 }}>Switch the interface language. The change applies across the portal instantly.</p>
        <div className="radio-row" role="radiogroup" aria-label="Interface language">
          {[
            { id: 'en', label: 'English' },
            { id: 'hi', label: 'हिन्दी' },
          ].map((option) => (
            <label key={option.id} className="radio-pill">
              <input type="radio" name="lang" checked={lang === option.id} onChange={() => setLang(option.id)} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <p className="app-footnote"><Languages size={12} aria-hidden="true" /> Dashboard strings adopt the same dictionary as the landing page.</p>
      </Card>

      <Card title="Account" className="placeholder-panel">
        <dl className="report-summary">
          <div className="report-summary-row"><dt>Signed in as</dt><dd>{user?.name} ({user?.roleLabel})</dd></div>
          <div className="report-summary-row"><dt>Department</dt><dd>{user?.department}</dd></div>
        </dl>
        <p className="app-footnote"><Info size={12} aria-hidden="true" /> Password, signature and notification settings arrive with the backend phase.</p>
        <div className="wizard-actions" style={{ borderTop: 'none', paddingTop: 8, marginTop: 8 }}>
          <span />
          <button
            type="button"
            className="app-btn app-btn-secondary"
            onClick={() => {
              signOut();
              navigate('/', { replace: true });
            }}
          >
            <LogOut size={15} aria-hidden="true" /> {t.app.signOut}
          </button>
        </div>
      </Card>
    </>
  );
};
