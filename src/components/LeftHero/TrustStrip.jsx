import React from 'react';
import { ShieldCheck, Users, Leaf } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const icons = [ShieldCheck, Users, Leaf];

export const TrustStrip = () => {
  const { t } = useLanguage();

  return (
    <div className="trust-strip-container">
      {t.trustItems.map((item, index) => {
        const Icon = icons[index];
        return (
          <div key={item.title} className="trust-item">
            <div className="trust-icon-box">
              <Icon size={22} className="trust-icon" aria-hidden="true" />
            </div>
            <div className="trust-text-group">
              <h4 className="trust-title">{item.title}</h4>
              <p className="trust-sub">{item.sub}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
