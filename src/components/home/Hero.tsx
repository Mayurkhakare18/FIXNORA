import React from 'react';
import { useApp } from '../../context/AppContext';
import { Btn, Card, Pill, Row, Note, TrackingTimeline, Reveal } from '../ui/Primitives';
import { Icon } from '../ui/Icon';

export const ProductPreview: React.FC = () => {
  return (
    <Card aria-label="Sample product preview">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-muted-foreground">SR-2026-1042 • Electrical</div>
          <h3 className="text-xl font-bold text-navy">Streetlight Not Working</h3>
        </div>
        <div className="flex gap-1.5">
          <Pill tone="h">High</Pill>
          <Pill tone="t">
            <span className="pdot" />
            In Progress
          </Pill>
        </div>
      </div>

      <TrackingTimeline index={2} />

      <div className="h-1.5 overflow-hidden rounded bg-bd">
        <div className="bar-anim h-full w-[62%] bg-teal" />
      </div>
      <div className="mb-3 mt-1 text-xs text-muted-foreground">62% complete</div>

      <Row a="Location" b="Block B, Community Road" />
      <Row a="Assigned to" b="R. Deshmukh (Electrical)" />
      <Row a="Target date" b="18 Oct 2026" />
      <Note>Complaint assigned to R. Deshmukh • 2h ago</Note>
      <div className="mt-3 text-[11px] font-medium text-muted-foreground/80">
        Sample data • static preview
      </div>
    </Card>
  );
};

export const Hero: React.FC = () => {
  const { t } = useApp();

  return (
    <section id="overview" className="relative overflow-hidden pb-12 pt-10 md:pt-16">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <div className="aurora" />
        <div className="dots" />
        <svg className="beams" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMin slice">
          <defs>
            <linearGradient id="bg1" x1="0" x2="1">
              <stop offset="0" stopColor="#258F86" stopOpacity="0" />
              <stop offset="0.5" stopColor="#258F86" />
              <stop offset="1" stopColor="#416A8A" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[
            "M-50 80C250 120 450 20 700 90S1050 40 1250 110",
            "M-50 200C200 150 480 260 720 190S1000 150 1250 230",
            "M-50 320C300 280 420 380 680 310S1000 290 1250 350",
            "M100 -20C180 150 300 250 420 420S600 560 640 640",
            "M900 -20C860 160 780 260 700 400S560 540 520 640",
            "M1250 40C1050 160 900 140 760 300S520 420 380 640",
          ].map((d, i) => (
            <path key={i} d={d} stroke="url(#bg1)" />
          ))}
        </svg>
      </div>

      <Reveal className="relative mx-auto max-w-6xl px-5 text-center">
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-muted-foreground">
          {t("p")}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Btn as="a" href="#track" v="p" className="rounded-full px-6">
            {t("c1")} →
          </Btn>
          <Btn as="a" href="#features" className="rounded-full px-6">
            {t("c2")}
          </Btn>
        </div>

        <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {(["t1", "t2", "t3"] as const).map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <Icon n="check" s={14} c="text-teal" />
              <span>{t(k)}</span>
            </li>
          ))}
        </ul>

        <div data-fly="hero" className="mx-auto mt-10 max-w-3xl animate-[float_7s_ease-in-out_infinite] text-left">
          <div className="tilt layers glass rounded-2xl border border-white/70 p-2 shadow-xl shadow-navy/10 md:p-3">
            <ProductPreview />
          </div>
        </div>
      </Reveal>
    </section>
  );
};
