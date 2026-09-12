import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const LangToggle = () => {
  const { lang, setLang } = useLanguage();

  return (
    <div className="lang-toggle" role="group" aria-label="Select language / भाषा चुनें">
      <Languages size={15} className="lang-toggle-icon" aria-hidden="true" />
      <button
        type="button"
        className={`lang-option ${lang === 'en' ? 'active' : ''}`}
        onClick={() => setLang('en')}
        aria-pressed={lang === 'en'}
      >
        EN
      </button>
      <button
        type="button"
        className={`lang-option ${lang === 'hi' ? 'active' : ''}`}
        onClick={() => setLang('hi')}
        aria-pressed={lang === 'hi'}
      >
        हिं
      </button>
    </div>
  );
};
