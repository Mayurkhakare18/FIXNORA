import React, { useRef, useEffect } from 'react';
import { Icon, IconName } from './Icon';

// Helper for joining classes
export const cn = (...classes: (string | boolean | undefined | null)[]): string =>
  classes.filter(Boolean).join(' ');

// Button Component
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  v?: 'p' | 'secondary' | 'outline' | 'danger';
  as?: React.ElementType;
  href?: string;
  className?: string;
  children: React.ReactNode;
}

export const Btn: React.FC<BtnProps> = ({
  v = 'secondary',
  as: Component = 'button',
  className = '',
  children,
  ...rest
}) => {
  const baseClasses =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
  
  const variantClasses = {
    p: "shine border border-[#263B52] bg-[#263B52] text-white hover:bg-[#34506b] hover:-translate-y-px shadow-md shadow-navy/20",
    secondary: "border border-bd bg-card text-navy hover:border-brand hover:-translate-y-px shadow-sm",
    outline: "border border-teal/40 bg-transparent text-teal hover:bg-teal/10",
    danger: "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  }[v];

  return (
    <Component className={cn(baseClasses, variantClasses, className)} {...rest}>
      {children}
    </Component>
  );
};

// Pill Badge Component
interface PillProps {
  tone?: 'n' | 'h' | 't' | 'w';
  children: React.ReactNode;
  className?: string;
}

export const Pill: React.FC<PillProps> = ({ tone = 'n', children, className = '' }) => {
  const toneClasses = {
    n: "bg-soft text-brand border border-brand/20",
    h: "bg-red-100 text-red-800 border border-red-200",
    t: "bg-teal/15 text-teal border border-teal/30",
    w: "bg-amber-100 text-amber-800 border border-amber-200",
  }[tone];

  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", toneClasses, className)}>
      {children}
    </span>
  );
};

// Glass Card Component
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ className = '', children, ...rest }) => (
  <div className={cn("glass gcard rounded-xl border border-white/70 p-5", className)} {...rest}>
    {children}
  </div>
);

// Badge7
export const Badge7: React.FC<{ label: string; className?: string }> = ({ label, className = '' }) => (
  <span className={cn("inline-flex items-center gap-2 rounded-full border border-bd bg-card px-3 py-1 text-xs font-semibold text-navy shadow-sm", className)}>
    <span className="h-1.5 w-1.5 rounded-full bg-teal animate-pulse" />
    {label}
  </span>
);

// Row Helper
export const Row: React.FC<{ a: React.ReactNode; b: React.ReactNode; className?: string }> = ({ a, b, className = '' }) => (
  <div className={cn("flex flex-wrap justify-between gap-3 border-t border-bd py-2 text-sm", className)}>
    <span className="text-muted-foreground">{a}</span>
    <span className="text-right font-medium text-navy">{b}</span>
  </div>
);

// Note Notice Component
export const Note: React.FC<{ children: React.ReactNode; icon?: IconName; className?: string }> = ({
  children,
  icon = 'bell',
  className = '',
}) => (
  <div className={cn("mt-3 flex items-center gap-2.5 rounded-md border-l-[3px] border-teal bg-soft px-3 py-2.5 text-[13px] text-navy", className)}>
    <Icon n={icon} s={15} c="text-teal shrink-0" />
    <span>{children}</span>
  </div>
);

// Reveal Animation Container
interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  d?: number;
  v?: 'up' | 'left' | 'right';
  className?: string;
  children: React.ReactNode;
}

export const Reveal: React.FC<RevealProps> = ({
  children,
  d = 0,
  v = 'up',
  className = '',
  ...rest
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('in');
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${d}ms` }}
      className={cn("rv", `rv-${v}`, className)}
      {...rest}
    >
      {children}
    </div>
  );
};

// Section Header
export const Head: React.FC<{ h: string; sub?: string; eyebrow?: string; className?: string }> = ({
  h,
  sub,
  eyebrow,
  className = '',
}) => (
  <Reveal className={cn("mb-9", className)}>
    {eyebrow && <div className="mb-2 text-xs font-bold uppercase tracking-widest text-teal">{eyebrow}</div>}
    <h2 className="text-2xl font-bold leading-tight text-navy md:text-4xl">{h}</h2>
    {sub && <p className="mt-3 max-w-2xl text-muted-foreground">{sub}</p>}
  </Reveal>
);

// Tracking Timeline Component
export const STAGES = ["Raised", "Assigned", "In Progress", "Resolved"] as const;
export const STAGE_TIMES = ["11 Oct, 9:10", "11 Oct, 11:30", "12 Oct, 8:45", "13 Oct, 4:20"] as const;

interface TrackingTimelineProps {
  index: number;
  onSelect?: (idx: number) => void;
  times?: string[];
}

export const TrackingTimeline: React.FC<TrackingTimelineProps> = ({
  index,
  onSelect,
  times = STAGE_TIMES as unknown as string[],
}) => {
  return (
    <ol className="my-5 flex w-full">
      {STAGES.map((stage, k) => {
        const isDone = k < index;
        const isCurrent = k === index;
        const El = onSelect ? 'button' : 'div';

        return (
          <li key={stage} className="relative flex-1 text-center text-xs">
            {k > 0 && (
              <span
                className={cn(
                  "absolute left-[-50%] top-3 h-[3px] w-full transition-colors duration-300",
                  k <= index ? "bg-teal" : "bg-bd"
                )}
              />
            )}
            <El
              {...(onSelect
                ? {
                    onClick: () => onSelect(k),
                    'aria-label': `Select status ${stage}`,
                    'aria-current': isCurrent ? 'step' : undefined,
                  }
                : {})}
              className="relative z-10 w-full focus:outline-none"
            >
              <span
                className={cn(
                  "mx-auto mb-1.5 grid h-6 w-6 place-items-center rounded-full border-2 text-[11px] font-bold transition-all duration-300",
                  isDone && "border-teal bg-teal text-white",
                  isCurrent && "border-teal bg-card text-teal ring-4 ring-teal/20 scale-110",
                  !isDone && !isCurrent && "border-bd bg-card text-muted-foreground"
                )}
              >
                {isDone ? '✓' : k + 1}
              </span>
              <span
                className={cn(
                  "block text-xs transition-colors",
                  isCurrent ? "font-semibold text-navy" : "text-muted-foreground"
                )}
              >
                {stage}
              </span>
              <small className="block text-[10px] text-muted-foreground">
                {k <= index ? (times[k] ?? 'Recorded') : 'Pending'}
              </small>
            </El>
          </li>
        );
      })}
    </ol>
  );
};
