import React from 'react';
import { JagoGrahakWave } from '../common/Logos';
import { useLanguage } from '../../context/LanguageContext';

export const JagoGrahakHeader = () => {
  const { t } = useLanguage();

  return (
    <header className="jago-grahak-header">
      <div className="jago-text-group">
        <h3 className="jago-title">{t.jagoTitle}</h3>
        <p className="jago-sub">{t.jagoSub1}</p>
        <p className="jago-sub">{t.jagoSub2}</p>
      </div>
      <JagoGrahakWave width={64} height={52} className="jago-wave-icon" />
    </header>
  );
};
