import React from 'react';
import { Badge7, cn } from '../ui/Primitives';

interface CtaBannerProps {
  badge?: { label: string };
  heading: string;
  button?: { label: string; href: string };
  labels?: {
    marqueePhrase?: string;
    note?: string;
    secondary?: string;
    footnote?: string;
  };
  className?: string;
}

export const CtaBanner: React.FC<CtaBannerProps> = ({
  badge,
  heading,
  button,
  labels = {},
  className = '',
}) => {
  const marquee = labels.marqueePhrase;
  const marqueeLine = marquee ? `${marquee} • `.repeat(8) : "";

  return (
    <section id="cta" className={cn("relative w-full overflow-hidden glass-band py-16 md:py-24", className)}>
      {marquee && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex select-none items-center overflow-hidden"
        >
          <div className="flex w-max shrink-0 animate-[cta69-marquee_40s_linear_infinite] whitespace-nowrap text-foreground/[0.06]">
            {[0, 1].map((c) => (
              <span
                key={c}
                className="text-[22vw] font-bold leading-none tracking-tighter md:text-[16vw]"
              >
                {marqueeLine}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 text-center md:px-6">
        {badge && <Badge7 label={badge.label} />}

        {heading && (
          <h2 className="mt-8 text-balance text-4xl font-bold leading-[1.05] tracking-tight text-navy md:text-6xl">
            {heading}
          </h2>
        )}

        {labels.note && (
          <p className="mt-6 max-w-xl text-balance text-lg text-muted-foreground md:text-xl">
            {labels.note}
          </p>
        )}

        {button && (
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <a
              href={button.href}
              className="shine inline-flex items-center gap-2 rounded-full bg-[#263B52] px-7 py-3.5 text-base font-semibold text-white shadow-lg transition hover:bg-[#34506b] hover:-translate-y-0.5"
            >
              {button.label}
            </a>
            {labels.secondary && (
              <a
                href="#features"
                className="inline-flex items-center rounded-full border border-bd bg-card px-7 py-3.5 font-semibold text-navy shadow-sm transition hover:border-brand hover:-translate-y-0.5"
              >
                {labels.secondary}
              </a>
            )}
          </div>
        )}

        {labels.footnote && (
          <p className="mt-8 text-sm text-muted-foreground font-medium">
            {labels.footnote}
          </p>
        )}
      </div>
    </section>
  );
};
