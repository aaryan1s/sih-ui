import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

const featureMeta = [
  { id: 'scan', colorClass: 'circle-blue', icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* Scanner brackets */}
        <path d="M3 7V5a2 2 0 0 1 2-2h2" />
        <path d="M17 3h2a2 2 0 0 1 2 2v2" />
        <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
        <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
        {/* Barcode lines */}
        <line x1="7" y1="8" x2="7" y2="16" />
        <line x1="9.5" y1="8" x2="9.5" y2="16" strokeWidth="2.2" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="14.5" y1="8" x2="14.5" y2="16" strokeWidth="2" />
        <line x1="17" y1="8" x2="17" y2="16" />
      </svg>
    )
  },
  { id: 'verify', colorClass: 'circle-green', icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* Document */}
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        {/* Lines */}
        <line x1="8" y1="13" x2="13" y2="13" />
        <line x1="8" y1="17" x2="11" y2="17" />
        {/* Magnifier / check */}
        <circle cx="15.5" cy="15.5" r="3.5" />
        <line x1="18" y1="18" x2="21" y2="21" />
      </svg>
    )
  },
  { id: 'detect', colorClass: 'circle-orange', icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* Gavel head */}
        <path d="m14 13-7.5-7.5 2.5-2.5 7.5 7.5z" />
        {/* Handle */}
        <path d="m9.5 8 8 8" />
        <path d="m16 14.5 1.5 1.5" />
        <path d="m17.5 16 3 3" />
        {/* Sound block base */}
        <path d="M3 21h7" strokeWidth="2.2" />
      </svg>
    )
  },
  { id: 'generate', colorClass: 'circle-purple', icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* Document */}
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        {/* Bar chart & trend */}
        <line x1="8" y1="18" x2="8" y2="15" strokeWidth="2" />
        <line x1="12" y1="18" x2="12" y2="12" strokeWidth="2" />
        <line x1="16" y1="18" x2="16" y2="10" strokeWidth="2" />
        <polyline points="8 14 12 11 16 9" strokeWidth="1.2" />
      </svg>
    )
  }
];

export const FeatureCardsRow = () => {
  const { t } = useLanguage();

  return (
    <div className="feature-cards-row">
      {featureMeta.map((f, index) => (
        <div
          key={f.id}
          className="feature-card-item anim-rise"
          style={{ '--delay': `${0.32 + index * 0.06}s` }}
        >
          <div className={`feature-circle-icon ${f.colorClass}`}>{f.icon}</div>
          <div className="feature-card-label">
            <span>{t.features[index].line1}</span>
            <span>{t.features[index].line2}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
