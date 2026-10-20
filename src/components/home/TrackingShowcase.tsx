import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Pill, Row, Note, TrackingTimeline, STAGES, Btn, Reveal } from '../ui/Primitives';

const SAMPLE_ACTIVITIES = [
  "Complaint received by system — pending initial review",
  "Assigned to Electrical Department (Officer R. Deshmukh)",
  "Technician dispatched on site — replacement hardware ordered",
  "Resolved — street fixture restored and awaiting resident feedback",
];

export const TrackingShowcase: React.FC = () => {
  const [selectedStage, setSelectedStage] = useState(2);
  const [searchTrackingId, setSearchTrackingId] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTrackingId.trim()) {
      navigate(`/track?id=${encodeURIComponent(searchTrackingId.trim())}`);
    }
  };

  return (
    <section id="track" className="py-16 md:py-24">
      <div className="mx-auto grid max-w-6xl items-start gap-8 px-5 lg:grid-cols-2">
        {/* Left Column: Information & Live ID Lookup */}
        <Reveal v="left">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-teal">
            Complaint tracking
          </div>
          <h2 className="text-2xl font-bold text-navy md:text-3xl">
            See exactly where your complaint stands
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Pick a status below to preview the complaint lifecycle progression. Every stage is timestamped, audited, and updated in real-time.
          </p>

          {/* Status switcher buttons */}
          <div className="mt-5 flex flex-wrap gap-2">
            {STAGES.map((stage, k) => (
              <Btn
                key={stage}
                type="button"
                v={k === selectedStage ? "p" : "secondary"}
                onClick={() => setSelectedStage(k)}
              >
                {stage}
              </Btn>
            ))}
          </div>

          {/* Genuine Tracking ID search form */}
          <div className="mt-8 rounded-xl border border-bd/80 bg-white/70 p-4 shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-navy mb-2">
              Have a real Tracking ID?
            </h4>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="e.g. SR-2026-1042"
                  value={searchTrackingId}
                  onChange={(e) => setSearchTrackingId(e.target.value)}
                  className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-sm text-navy placeholder:text-muted-foreground/60 focus:border-teal focus:outline-none"
                />
              </div>
              <Btn type="submit" v="p" className="px-4">
                Track
              </Btn>
            </form>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Search real complaints stored in Supabase (persisted in Phase 5).
            </p>
          </div>
        </Reveal>

        {/* Right Column: Interactive Card Preview */}
        <Reveal v="right" d={150}>
          <Card>
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  SR-2026-1042 • Electrical
                </div>
                <h3 className="font-bold text-navy text-lg">Streetlight Not Working</h3>
              </div>
              <Pill tone="t">{STAGES[selectedStage]}</Pill>
            </div>

            <TrackingTimeline index={selectedStage} onSelect={setSelectedStage} />

            <Row a="Assigned officer" b="R. Deshmukh" />
            <Row a="Submitted" b="11 Oct 2026, 09:10" />
            <Row a="SLA Target" b="18 Oct 2026, 17:00" />
            <Row a="Latest activity" b={SAMPLE_ACTIVITIES[selectedStage]} />

            <Note>Status: {STAGES[selectedStage]}</Note>
            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Interactive prototype preview</span>
              <span className="text-teal font-medium">Click any stage above to test</span>
            </div>
          </Card>
        </Reveal>
      </div>
    </section>
  );
};
