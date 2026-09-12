import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

export const ParliamentFooter = () => {
  const { t } = useLanguage();

  return (
    <div className="parliament-footer-container">
      <div className="parliament-artwork-wrapper">
        <img
          src="/assets/parliament-illustration.png"
          alt={t.atmanirbhar}
          className="parliament-img"
          loading="lazy"
          decoding="async"
        />
      </div>

      <div className="parliament-vertical-divider" />

      <div className="atmanirbhar-text-group">
        <span className="atmanirbhar-lead">{t.atmanirbharLead}</span>
        <strong className="atmanirbhar-highlight">{t.atmanirbhar}</strong>
        <span className="atmanirbhar-trail">{t.atmanirbharTrail}</span>
      </div>
    </div>
  );
};
