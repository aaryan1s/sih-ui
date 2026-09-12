import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { DEMO_CREDENTIALS } from '../../services/authService';
import { DemoModal } from '../common/DemoModal';
import { useToast } from '../../context/ToastContext';
import { authService } from '../../services/authService';
import { LoginTabs } from './LoginTabs';
import { LoginForm } from './LoginForm';
import { SSOCards } from './SSOCards';
import { CardFooter } from './CardFooter';

export const InspectorLoginCard = () => {
  const [activeTab, setActiveTab] = useState('credentials'); // 'credentials' | 'sso'
  const [activeModal, setActiveModal] = useState(null);
  const { t } = useLanguage();
  const toast = useToast();

  return (
    <div className="inspector-login-card">
      {/* Top Header Badge */}
      <div className="card-top-header">
        <div className="lock-icon-badge">
          <Lock size={22} className="lock-icon" aria-hidden="true" />
        </div>
        <h2 className="card-title" id="card-title">{t.cardTitle}</h2>
        <p className="card-subtitle">{t.cardSubtitle}</p>
      </div>

      {/* Tabs */}
      <LoginTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content depending on active tab */}
      {activeTab === 'credentials' ? (
        <LoginForm onForgotPassword={() => setActiveModal('forgot')} demoCredentials={DEMO_CREDENTIALS} />
      ) : (
        <div className="govt-sso-tab-content">
          <p className="sso-desc-text">{t.ssoDesc}</p>
          <button
            type="button"
            className="primary-login-btn sso-redirect-btn"
            onClick={() => setActiveModal('sso')}
          >
            <span>{t.ssoBtn}</span>
          </button>
        </div>
      )}

      {/* Alternative SSO Providers */}
      <SSOCards onOpenModal={setActiveModal} />

      {/* Bottom Footer Info */}
      <CardFooter />

      {/* Demo Modal / Dialog feedback */}
      {activeModal && (
        <DemoModalWrapper modalKey={activeModal} onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
};

const DemoModalWrapper = ({ modalKey, onClose }) => {
  const { t } = useLanguage();
  const modalContent = {
    sso: { title: t.modal.ssoTitle, body: t.modal.ssoBody },
    aadhaar: { title: t.modal.aadhaarTitle, body: t.modal.aadhaarBody },
    digilocker: { title: t.modal.digilockerTitle, body: t.modal.digilockerBody },
    forgot: {
      title: t.modal.forgotTitle,
      body: (
        <div style={{ fontSize: 13 }}>
          <p>{t.modal.forgotBody}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const email = e.currentTarget.email.value.trim();
              if (!email) return;
              authService
                .resetPassword(email)
                .then(() => {
                  toast.ok('If an account exists for that email, a password-reset link has been sent.');
                  onClose();
                })
                .catch((err) => toast.error(err?.message || 'Could not start the reset.'));
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}
          >
            <label className="form-field-group" style={{ margin: 0 }}>
              <span className="form-label">Email</span>
              <input
                name="email"
                type="email"
                className="text-input"
                placeholder="name@department.gov.in"
                required
                autoFocus
              />
            </label>
            <button type="submit" className="app-btn app-btn-primary" style={{ width: '100%' }}>
              Send Reset Link
            </button>
          </form>
          <p className="app-footnote" style={{ margin: '10px 0 0' }}>
            In production this triggers a Supabase password-reset email to the address on file.
          </p>
        </div>
      ),
    },
  }[modalKey];

  return (
    <DemoModal
      title={modalContent.title}
      body={modalContent.body}
      actionLabel={t.modal.understood}
      closeLabel={t.modal.close}
      onClose={onClose}
    />
  );
};
