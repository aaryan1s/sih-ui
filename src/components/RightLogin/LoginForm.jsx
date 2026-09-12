import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  XCircle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  TriangleAlert,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { DEMO_USERS } from '../../data/mockData';

export const LoginForm = ({ onForgotPassword, demoCredentials }) => {
  const { t } = useLanguage();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loginStatus, setLoginStatus] = useState(null); // 'success' | 'error' | null
  const [errors, setErrors] = useState({});
  const [capsLockOn, setCapsLockOn] = useState(false);

  const validate = () => {
    const nextErrors = {};
    if (!userId.trim()) nextErrors.userId = t.errors.userIdRequired;
    if (!password) {
      nextErrors.password = t.errors.passwordRequired;
    } else if (password.length < 6) {
      nextErrors.password = t.errors.passwordShort;
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    if (!validate()) return;

    setIsLoading(true);
    setLoginStatus(null);

    try {
      const user = await signIn(userId, password);
      setLoginStatus('success');
      // Role-based redirect: the role comes from the auth layer (server claim
      // in the future), never from client-side selection.
      setTimeout(() => {
        navigate(user.role === 'gov_officer' ? '/gov' : '/inspector');
      }, 650);
    } catch {
      setIsLoading(false);
      setLoginStatus('error');
    }
  };

  const handleCapsLock = (event) => {
    if (event.getModifierState) {
      setCapsLockOn(event.getModifierState('CapsLock'));
    }
  };

  const describedBy =
    [capsLockOn ? 'passwordHint' : null, errors.password ? 'passwordError' : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <form className="login-form" onSubmit={handleSubmit} noValidate>
      {/* Demo account picker (judge affordance — visible only in demo builds) */}
      {demoCredentials && (
        <div className="demo-accounts" role="group" aria-label="Demo accounts">
          <span className="demo-accounts-label">Demo mode — one-click portal access</span>
          <div className="demo-accounts-row">
            <button type="button" className="demo-account-chip" onClick={() => { setUserId(demoCredentials.inspector.userId); setPassword(demoCredentials.inspector.password); }}>
              <strong>Inspector</strong> · {DEMO_USERS.inspector.name}
            </button>
            <button type="button" className="demo-account-chip" onClick={() => { setUserId(demoCredentials.officer.userId); setPassword(demoCredentials.officer.password); }}>
              <strong>Govt. Officer</strong> · {DEMO_USERS.gov_officer.name}
            </button>
          </div>
        </div>
      )}

      {/* User ID / Email */}
      <div className="form-field-group">
        <label htmlFor="userIdInput" className="form-label">
          {t.labelUserId}
        </label>
        <div className={`input-box-wrapper ${errors.userId ? 'has-error' : ''}`}>
          <Mail size={18} className="input-leading-icon" aria-hidden="true" />
          <input
            id="userIdInput"
            type="text"
            className="text-input"
            placeholder={t.placeholderUserId}
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              if (errors.userId) setErrors((prev) => ({ ...prev, userId: undefined }));
              if (loginStatus === 'error') setLoginStatus(null);
            }}
            aria-invalid={errors.userId ? 'true' : undefined}
            aria-describedby={errors.userId ? 'userIdError' : undefined}
            autoComplete="username"
          />
          {userId.length > 0 && (
            <button
              type="button"
              className="input-trailing-action"
              onClick={() => setUserId('')}
              aria-label="Clear user ID"
            >
              <XCircle size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        {errors.userId && (
          <p className="field-error" id="userIdError" role="alert">
            <AlertCircle size={13} aria-hidden="true" /> {errors.userId}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="form-field-group">
        <label htmlFor="passwordInput" className="form-label">
          {t.labelPassword}
        </label>
        <div className={`input-box-wrapper ${errors.password ? 'has-error' : ''}`}>
          <Lock size={18} className="input-leading-icon" aria-hidden="true" />
          <input
            id="passwordInput"
            type={showPassword ? 'text' : 'password'}
            className="text-input"
            placeholder={t.placeholderPassword}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              if (loginStatus === 'error') setLoginStatus(null);
            }}
            onKeyUp={handleCapsLock}
            onKeyDown={handleCapsLock}
            aria-invalid={errors.password ? 'true' : undefined}
            aria-describedby={describedBy}
            autoComplete="current-password"
          />
          <button
            type="button"
            className="input-trailing-action"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>
        {capsLockOn && !errors.password && (
          <p className="field-warning" id="passwordHint" aria-live="polite">
            <TriangleAlert size={13} aria-hidden="true" /> {t.capsLockHint}
          </p>
        )}
        {errors.password && (
          <p className="field-error" id="passwordError" role="alert">
            <AlertCircle size={13} aria-hidden="true" /> {errors.password}
          </p>
        )}
      </div>

      {/* Remember Me & Forgot Password */}
      <div className="form-row-options">
        <label className="checkbox-label-container">
          <input
            type="checkbox"
            className="checkbox-input"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <span className="checkbox-custom" />
          <span className="checkbox-text">{t.rememberMe}</span>
        </label>

        <button type="button" className="forgot-password-link" onClick={onForgotPassword}>
          {t.forgotPassword}
        </button>
      </div>

      {/* Primary Login Button */}
      <button
        type="submit"
        className={`primary-login-btn ${isLoading ? 'loading' : ''}`}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 size={18} className="btn-spinner" aria-hidden="true" />
            <span>{t.verifyingBtn}</span>
          </>
        ) : loginStatus === 'success' ? (
          <>
            <CheckCircle2 size={18} className="btn-success-icon" aria-hidden="true" />
            <span>{t.authenticatedBtn}</span>
          </>
        ) : (
          <>
            <span>{t.loginBtn}</span>
            <ArrowRight size={18} className="btn-arrow" aria-hidden="true" />
          </>
        )}
      </button>

      {loginStatus === 'success' && (
        <div className="login-success-banner" role="status">
          {t.successBanner}
        </div>
      )}

      {loginStatus === 'error' && (
        <div className="login-error-banner" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          <span>{t.errors.invalidCredentials}</span>
        </div>
      )}

      <p className="demo-hint-text">{t.demoHint}</p>
    </form>
  );
};
