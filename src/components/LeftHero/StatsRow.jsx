import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

export const StatsRow = () => {
  const { t } = useLanguage();

  return (
    <div className="stats-row" role="group" aria-label="Impact statistics">
      {t.stats.map((stat, index) => (
        <div key={stat.label} className="stat-item anim-rise" style={{ '--delay': `${0.3 + index * 0.07}s` }}>
          <span className="stat-value">{stat.value}</span>
          <span className="stat-label">{stat.label}</span>
        </div>
      ))}
    </div>
  );
};
