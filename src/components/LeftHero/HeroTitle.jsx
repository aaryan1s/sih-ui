import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

export const HeroTitle = () => {
  const { t, lang } = useLanguage();

  return (
    <div className="hero-title-section">
      <h1 className="hero-main-heading" lang={lang}>
        <span className="heading-line-1 anim-rise" style={{ '--delay': '0.05s' }}>
          {t.heroLine1}
        </span>
        <span className="heading-line-2 anim-rise" style={{ '--delay': '0.12s' }}>
          {t.heroLine2}
        </span>
      </h1>

      <p className="hero-sub-tagline anim-rise" style={{ '--delay': '0.2s' }}>
        {t.heroTagline}
      </p>

      <p className="hero-description anim-rise" style={{ '--delay': '0.26s' }}>
        {t.heroDescription}
      </p>
    </div>
  );
};
