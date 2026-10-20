import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Head, Reveal, cn } from '../ui/Primitives';

const STEPS = [
  [
    "Report",
    "The resident submits an issue with a description, location, optional media evidence, or voice input.",
  ],
  [
    "Assign",
    "The authorized administrator or department manager reviews the complaint and assigns it to the designated officer.",
  ],
  [
    "Resolve",
    "Staff update progress, work toward the SLA deadline, and provide resolution remarks and evidence.",
  ],
  [
    "Verify and Improve",
    "The resident reviews the outcome and gives feedback. Administrators track aggregated metrics to prevent recurrences.",
  ],
] as const;

export const HowItWorks: React.FC = () => {
  const { t } = useApp();
  const [activeStep, setActiveStep] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          STEPS.forEach((_, k) => {
            timers.push(
              setTimeout(
                () => setActiveStep(k),
                isReducedMotion ? 0 : 300 + k * 550
              )
            );
          });
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  const lineBaseClasses =
    "absolute bottom-5 left-5 top-5 w-0.5 md:bottom-auto md:left-[12%] md:right-[12%] md:top-5 md:h-0.5 md:w-auto";

  return (
    <section id="how" className="glass-band py-16">
      <div className="mx-auto max-w-6xl px-5">
        <Head h={t("hh")} eyebrow="Workflow" />

        <Reveal>
          <div
            ref={containerRef}
            style={{ ['--p' as any]: activeStep < 0 ? 0 : activeStep / 3 }}
            className="relative grid gap-6 md:grid-cols-4"
          >
            {/* Background line */}
            <span className={cn(lineBaseClasses, "bg-bd")} />
            {/* Active animated line */}
            <span
              className={cn(
                lineBaseClasses,
                "origin-top bg-teal transition-transform duration-500 [transform:scaleY(var(--p))] md:origin-left md:[transform:scaleX(var(--p))]"
              )}
            />

            {STEPS.map(([title, desc], k) => (
              <div
                key={title}
                onMouseEnter={() => setActiveStep(k)}
                style={{ transitionDelay: `${200 + k * 120}ms` }}
                className="step relative grid grid-cols-[40px_1fr] gap-x-4 md:block cursor-pointer"
              >
                <span
                  className={cn(
                    "row-span-2 mb-0 grid h-10 w-10 place-items-center rounded-full font-bold text-white transition-all duration-300 md:mb-3 shadow-md",
                    k < activeStep
                      ? "bg-teal"
                      : k === activeStep
                      ? "scale-110 bg-[#263B52] ring-4 ring-teal/25"
                      : activeStep < 0
                      ? "bg-[#263B52]"
                      : "bg-[#263B52]/60"
                  )}
                >
                  {k < activeStep ? "✓" : k + 1}
                </span>
                <h3
                  className={cn(
                    "font-semibold transition-colors duration-200 text-base",
                    k <= activeStep || activeStep < 0 ? "text-navy" : "text-navy/60"
                  )}
                >
                  {title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
};
