import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { GovHeader } from './GovHeader';
import { HeroTitle } from './HeroTitle';
import { FeatureCardsRow } from './FeatureCardsRow';
import { StatsRow } from './StatsRow';
import { TrustStrip } from './TrustStrip';

export const LeftHero = () => {
  const { t } = useLanguage();

  return (
    <section className="left-hero-section" aria-labelledby="hero-main-heading">
      {/* Ambient animated background orbs */}
      <div className="ambient-orb orb-a" aria-hidden="true" />
      <div className="ambient-orb orb-b" aria-hidden="true" />

      <div className="left-hero-content">
        <div className="left-hero-top-group">
          <GovHeader />
          <div className="left-hero-main">
            <HeroTitle />
            <FeatureCardsRow />
          </div>
        </div>

        {/* Responsive Packaged Commodity Showcase with animated scan-line */}
        <div className="package-showcase-box">
          <img
            src="/assets/packaged-product.jpg"
            alt={t.showcaseAlt}
            className="package-showcase-img"
            loading="lazy"
            decoding="async"
          />
          <div className="scanline-overlay" aria-hidden="true">
            <div className="scanline-beam" />
          </div>
          <span className="scan-chip" aria-hidden="true">
            <span className="scan-chip-dot" />
            AI SCANNING
          </span>
        </div>

        <StatsRow />
        <TrustStrip />
      </div>
    </section>
  );
};
