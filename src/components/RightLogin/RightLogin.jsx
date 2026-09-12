import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { JagoGrahakHeader } from './JagoGrahakHeader';
import { LangToggle } from './LangToggle';
import { InspectorLoginCard } from './InspectorLoginCard';
import { ParliamentFooter } from './ParliamentFooter';

export const RightLogin = () => {
  const { lang } = useLanguage();

  return (
    <section className="right-login-section" aria-labelledby="card-title">
      {/* Decorative Tricolor Ribbons in background */}
      <div className="tricolor-bg-accent left-accent" aria-hidden="true" />
      <div className="tricolor-bg-accent right-accent" aria-hidden="true" />

      {/* Top Right Jago Grahak Jago Branding + Language Toggle */}
      <div className="right-top-bar">
        <LangToggle />
        <JagoGrahakHeader />
      </div>

      {/* Main Centered Login Card */}
      <div className="login-card-center-wrapper" lang={lang}>
        <InspectorLoginCard />
      </div>

      {/* Bottom Parliament & Atmanirbhar Bharat Footer */}
      <div className="right-bottom-bar">
        <ParliamentFooter />
      </div>
    </section>
  );
};
