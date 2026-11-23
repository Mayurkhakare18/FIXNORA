import React from 'react';
import { useApp } from '../context/AppContext';
import { InkHero } from '../components/home/InkHero';
import { Hero } from '../components/home/Hero';
import { Strip } from '../components/home/Strip';
import { Features } from '../components/home/Features';
import { HowItWorks } from '../components/home/HowItWorks';
import { TrackingShowcase } from '../components/home/TrackingShowcase';
import { Roles } from '../components/home/Roles';
import { Pricing } from '../components/home/Pricing';
import { AnalyticsPreview } from '../components/home/AnalyticsPreview';
import { CtaBanner } from '../components/home/CtaBanner';

export const LandingPage: React.FC = () => {
  const { t } = useApp();

  return (
    <main>
      <InkHero />
      <Hero />
      <Strip />
      <Features />
      <HowItWorks />
      <TrackingShowcase />
      <Roles />
      <Pricing />
      <AnalyticsPreview />
      <CtaBanner
        badge={{ label: "SmartResolve" }}
        heading={t("ch")}
        button={{ label: t("gs"), href: "#overview" }}
        labels={{
          marqueePhrase: "Every Resolution Counts",
          note: t("cp"),
          secondary: t("c2"),
          footnote: t("tag"),
        }}
      />
    </main>
  );
};
