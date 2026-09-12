import React from 'react';
import { ChevronRight } from 'lucide-react';
import { AadhaarLogo, DigiLockerLogo } from '../common/Logos';
import { useLanguage } from '../../context/LanguageContext';

export const SSOCards = ({ onOpenModal }) => {
  const { t } = useLanguage();

  return (
    <div className="sso-section">
      <div className="divider-or-container">
        <span className="divider-line" />
        <span className="divider-text">OR</span>
        <span className="divider-line" />
      </div>

      <div className="sso-cards-group">
        {/* Aadhaar Card */}
        <button
          type="button"
          className="sso-card-btn"
          onClick={() => onOpenModal('aadhaar')}
          aria-label={t.aadhaarTitle}
        >
          <AadhaarLogo width={42} height={32} />
          <div className="sso-card-info">
            <span className="sso-card-title">{t.aadhaarTitle}</span>
            <span className="sso-card-subtitle">{t.aadhaarSub}</span>
          </div>
          <ChevronRight size={18} className="sso-card-chevron" aria-hidden="true" />
        </button>

        {/* DigiLocker Card */}
        <button
          type="button"
          className="sso-card-btn"
          onClick={() => onOpenModal('digilocker')}
          aria-label={t.digilockerTitle}
        >
          <DigiLockerLogo width={38} height={36} />
          <div className="sso-card-info">
            <span className="sso-card-title">{t.digilockerTitle}</span>
            <span className="sso-card-subtitle">{t.digilockerSub}</span>
          </div>
          <ChevronRight size={18} className="sso-card-chevron" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
