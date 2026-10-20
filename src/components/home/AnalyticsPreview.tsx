import React from 'react';
import { useApp } from '../../context/AppContext';
import { Head, Card, Pill, Reveal } from '../ui/Primitives';
import { Icon } from '../ui/Icon';

const SAMPLE_CATEGORIES = [
  ["Electrical", 34],
  ["Water", 27],
  ["Roads", 22],
  ["Waste", 15],
  ["Security", 9],
] as const;

const SAMPLE_POINTS = [
  [10, 20, "Wk1 6.2d"],
  [50, 32, "Wk2 5.6d"],
  [90, 38, "Wk3 5.2d"],
  [130, 55, "Wk4 4.7d"],
  [170, 64, "Wk5 4.3d"],
  [210, 76, "Wk6 3.9d"],
] as const;

export const AnalyticsPreview: React.FC = () => {
  const { t } = useApp();

  return (
    <section id="admins" className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <Head eyebrow="Intelligence" h={t("ah")} />

        <div className="-mt-6 mb-6 flex items-center gap-2">
          <Pill tone="w">Illustrative demo data</Pill>
          <span className="text-xs text-muted-foreground">
            Live database statistics will be computed directly from real records in Phase 7.
          </span>
        </div>

        <Reveal className="grid gap-5 md:grid-cols-3">
          {/* Card 1: Categories Bar Chart */}
          <Card>
            <h3 className="font-semibold text-navy text-base">Complaints by category</h3>
            <div className="mt-3 space-y-2.5">
              {SAMPLE_CATEGORIES.map(([category, count]) => (
                <div
                  key={category}
                  className="grid grid-cols-[84px_1fr_24px] items-center gap-2.5 text-[13px]"
                >
                  <span className="font-medium text-navy">{category}</span>
                  <div
                    title={`${category}: ${count}`}
                    className="h-1.5 rounded-full bg-bd overflow-hidden"
                  >
                    <div
                      className="bar-grow h-full origin-left rounded-full bg-brand transition-transform duration-1000"
                      style={{ width: `${count * 2.6}%` }}
                    />
                  </div>
                  <b className="text-right text-xs text-muted-foreground">{count}</b>
                </div>
              ))}
            </div>
          </Card>

          {/* Card 2: Status Distribution Donut */}
          <Card>
            <h3 className="font-semibold text-navy text-base">Status distribution</h3>
            <div className="mt-4 flex flex-wrap items-center gap-5">
              <div
                role="img"
                aria-label="Resolved 45%, In progress 30%, Assigned 17%, Raised 8%"
                className="donut grid h-28 w-28 place-items-center rounded-full shadow-inner"
                style={{
                  background:
                    "conic-gradient(rgb(var(--teal)) 0 45%, rgb(var(--blue)) 45% 75%, #E0A526 75% 92%, rgb(var(--bd)) 92%)",
                }}
              >
                <span className="h-[68px] w-[68px] rounded-full bg-card shadow-sm" />
              </div>
              <ul className="text-[13px] leading-7 font-medium">
                <li>
                  <span className="text-teal font-bold mr-1.5">■</span> Resolved 45%
                </li>
                <li>
                  <span className="text-brand font-bold mr-1.5">■</span> In Progress 30%
                </li>
                <li>
                  <span className="text-amber-500 font-bold mr-1.5">■</span> Assigned 17%
                </li>
                <li>
                  <span className="text-bd font-bold mr-1.5">■</span> Raised 8%
                </li>
              </ul>
            </div>
          </Card>

          {/* Card 3: Avg SLA Resolution Time */}
          <Card>
            <h3 className="font-semibold text-navy text-base">Avg. resolution time (days)</h3>
            <div className="mt-3">
              <svg
                viewBox="0 0 220 100"
                className="w-full overflow-visible"
                role="img"
                aria-label="Trend from 6.2 to 3.9 days"
              >
                <polyline
                  pathLength="1"
                  className="draw"
                  strokeLinecap="round"
                  fill="none"
                  stroke="rgb(var(--teal))"
                  strokeWidth="2.5"
                  points={SAMPLE_POINTS.map((p) => `${p[0]},${p[1]}`).join(" ")}
                />
                {SAMPLE_POINTS.map((p) => (
                  <circle
                    key={p[2]}
                    cx={p[0]}
                    cy={p[1]}
                    r="4"
                    fill="rgb(var(--teal))"
                  >
                    <title>{p[2]}</title>
                  </circle>
                ))}
              </svg>
              <div className="mt-3 text-[13px] text-muted-foreground">
                Satisfaction (sample): <b className="text-navy">4.3 / 5</b> ★★★★☆
              </div>
            </div>
          </Card>
        </Reveal>

        {/* Predictive Alert Banner */}
        <Reveal className="mt-5">
          <div className="flex items-start gap-3 rounded-lg border-l-[3px] border-orange-500 bg-orange-50 p-4 text-sm font-medium text-orange-900 shadow-sm">
            <Icon n="alert" c="mt-0.5 shrink-0 text-orange-600" />
            <span>
              Recurring streetlight complaints detected in Block B. Review the affected area for preventive maintenance.
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
};
