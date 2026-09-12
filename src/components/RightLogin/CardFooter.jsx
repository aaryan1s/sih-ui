import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

export const CardFooter = () => {
  const { t } = useLanguage();

  return (
    <footer className="login-card-footer">
      <p className="new-user-text">
        {t.newUser} <a href="#admin-contact" className="admin-link">{t.contactAdmin}</a>
      </p>

      <div className="footer-links-row">
        <a href="#help" className="footer-link">{t.help}</a>
        <span className="footer-divider">|</span>
        <a href="#privacy" className="footer-link">{t.privacy}</a>
        <span className="footer-divider">|</span>
        <a href="#terms" className="footer-link">{t.terms}</a>
      </div>
    </footer>
  );
};
