import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { EmblemOfIndia } from '../common/Logos';

export const GovHeader = () => {
  const { t, lang } = useLanguage();

  return (
    <header className="gov-header anim-rise" style={{ '--delay': '0s' }}>
      <div className="gov-brand-container">
        <EmblemOfIndia size={38} />
        <div className="gov-title-group">
          <h2 className="gov-dept-name" lang={lang}>
            {t.deptName}
          </h2>
          <p className="gov-ministry-name" lang={lang}>
            {t.ministryName}
          </p>
          <p className="gov-country-name" lang={lang}>
            {t.countryName}
          </p>
        </div>
      </div>

      <div className="gov-tagline-bar">
        {t.taglines.map((tagline, index) => (
          <React.Fragment key={tagline}>
            {index > 0 && <span className="divider">|</span>}
            <span lang={lang}>{tagline}</span>
          </React.Fragment>
        ))}
      </div>

      <div className="portal-status-pill" role="status">
        <span className="status-dot" aria-hidden="true" />
        <span className="status-text">{t.statusLabel}</span>
      </div>
    </header>
  );
};
