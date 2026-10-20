import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card, Pill, Note, TrackingTimeline, Head, Reveal, cn } from '../ui/Primitives';
import { Icon, IconName } from '../ui/Icon';
import { Language } from '../../i18n/translations';

// 5-Star interactive rating component (prototype)
const Rating: React.FC = () => {
  const [stars, setStars] = useState(0);

  return (
    <div className="mt-2">
      <div role="radiogroup" aria-label="Rate resolution" className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((idx) => (
          <button
            key={idx}
            type="button"
            role="radio"
            aria-checked={idx === stars}
            aria-label={`${idx} stars`}
            onClick={() => setStars(idx)}
            className={`text-xl transition-colors focus:outline-none ${
              idx <= stars ? "text-amber-500" : "text-bd"
            }`}
          >
            ★
          </button>
        ))}
      </div>
      <small className="block text-[11px] text-muted-foreground mt-0.5">
        {stars
          ? `Selected: ${stars}/5 (Interactive sample — backend ratings coming in Phase 5)`
          : "Tap to rate (sample preview)"}
      </small>
    </div>
  );
};

interface FeatureItem {
  icon: IconName;
  title: string;
  points: string[];
}

const FEATURE_LIST: FeatureItem[] = [
  {
    icon: "file",
    title: "Easy Complaint Reporting",
    points: [
      "Report problems with a structured form",
      "Attach photos and files as evidence",
      "Category, description, location, priority",
    ],
  },
  {
    icon: "mic",
    title: "Voice-to-Complaint",
    points: [
      "Speak in a supported local language",
      "Review and edit transcript before submitting",
      "Planned capability — speech engine connect in Phase 8",
    ],
  },
  {
    icon: "globe",
    title: "Multilingual Experience",
    points: [
      "English, Hindi and Marathi",
      "Client-side and backend language support",
      "Localized notifications and complaint logs",
    ],
  },
  {
    icon: "lock",
    title: "Privacy & Anonymous Reporting",
    points: [
      "Anonymous submission where permitted",
      "Visible strictly to resident and authorized officers",
      "Enforced by Supabase Row-Level Security (RLS)",
    ],
  },
  {
    icon: "clock",
    title: "Transparent Complaint Timeline",
    points: [
      "Raised → Assigned → In Progress → Resolved",
      "Immutable timestamps and actor records",
      "Full audit trail for accountability",
    ],
  },
  {
    icon: "bell",
    title: "Notifications & Feedback",
    points: [
      "Assignment and status-update alerts",
      "Rate resolution quality after closing",
      "Email and dashboard notification feed",
    ],
  },
  {
    icon: "users",
    title: "Staff Assignment & Escalation",
    points: [
      "Assigned staff with target SLA deadlines",
      "Automatic escalation rules on overdue cases",
      "Department-level workload distribution",
    ],
  },
  {
    icon: "chart",
    title: "Analytics & Predictive Maintenance",
    points: [
      "Live SQL metrics by category and status",
      "Recurring issues flagged for city engineering",
      "Resolution rate and department SLA reports",
    ],
  },
];

export const Features: React.FC = () => {
  const { t, setLang } = useApp();
  const [activeIdx, setActiveIdx] = useState(-1);

  const scrollToFeature = (idx: number) => {
    setActiveIdx(idx);
    const target = document.getElementById(`f-${idx}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => setActiveIdx(-1), 1600);
  };

  const renderFeaturePreview = (idx: number) => {
    switch (idx) {
      case 0:
        return (
          <div className="flex flex-wrap gap-1.5">
            <Pill>Electrical</Pill>
            <Pill tone="h">High</Pill>
            <Pill>📎 2 files</Pill>
          </div>
        );
      case 1:
        return (
          <Note>
            “Corner streetlight flickering since Tuesday” (mock transcript, editable)
          </Note>
        );
      case 2:
        return (
          <div className="flex flex-wrap gap-2">
            {(["en", "hi", "mr"] as Language[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className="rounded-full border border-bd px-3 py-1 text-xs font-medium text-navy hover:border-teal hover:text-teal focus:outline-none"
              >
                {{ en: "English", hi: "हिन्दी", mr: "मराठी" }[l]}
              </button>
            ))}
          </div>
        );
      case 3:
        return <Pill tone="t">Anonymous mode permitted</Pill>;
      case 4:
        return <TrackingTimeline index={1} />;
      case 5:
        return (
          <div>
            <Note>Status: In Progress</Note>
            <Rating />
          </div>
        );
      case 6:
        return (
          <div className="flex flex-wrap gap-1.5">
            <Pill>R. Deshmukh • due 18 Oct</Pill>
            <Pill tone="h">⚠ Overdue 2d (example)</Pill>
          </div>
        );
      case 7:
        return (
          <div className="flex flex-wrap gap-1.5">
            <Pill tone="w">Illustrative prototype</Pill>
            <Pill tone="h">Recurring: Block B lights</Pill>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <section id="features" className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <Head eyebrow="Features" h={t("fh")} sub={t("fp")} />

        {/* Chips Navigation */}
        <div className="chips -mx-5 mb-7 flex gap-2 overflow-x-auto px-5 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {FEATURE_LIST.map((f, idx) => (
            <button
              key={f.title}
              type="button"
              onClick={() => scrollToFeature(idx)}
              className="rounded-full border border-bd bg-card px-3 py-1.5 text-[13px] font-medium text-navy shadow-sm transition hover:border-teal hover:text-teal focus:outline-none"
            >
              {f.title}
            </button>
          ))}
        </div>

        {/* Feature Grid */}
        <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURE_LIST.map((f, idx) => (
            <Reveal key={f.title} d={(idx % 4) * 70} className="flex">
              <div className="tilt flex flex-1">
                <Card
                  id={`f-${idx}`}
                  className={cn(
                    "flex flex-col gap-2 w-full transition duration-300 hover:-translate-y-1 hover:border-brand",
                    activeIdx === idx && "border-teal ring-2 ring-teal/30"
                  )}
                >
                  <div className="mb-1 grid h-10 w-10 place-items-center rounded-lg bg-soft text-brand shadow-sm">
                    <Icon n={f.icon} />
                  </div>
                  <h3 className="font-semibold text-navy text-base">{f.title}</h3>
                  <ul className="mb-3 list-disc space-y-1 pl-4 text-xs text-muted-foreground leading-relaxed">
                    {f.points.map((pt) => (
                      <li key={pt}>{pt}</li>
                    ))}
                  </ul>
                  <div className="mt-auto min-h-[88px] border-t border-bd/60 pt-3">
                    {renderFeaturePreview(idx)}
                  </div>
                </Card>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};
