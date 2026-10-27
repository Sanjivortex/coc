import type { ReactNode } from 'react';
import type { Res } from '@/lib/gamedata';
import { RES_STYLE, formatCompact } from '@/lib/format';

export function Panel({
  title,
  description,
  action,
  children,
  className = '',
  bodyClassName = 'p-5',
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`rounded-xl border border-line bg-panel ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-ink-3">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xs text-ink-3">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold text-ink">{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

type Tone = 'neutral' | 'good' | 'warning' | 'critical' | 'info';

const TONE: Record<Tone, string> = {
  neutral: 'border-line bg-raised text-ink-2',
  good: 'border-good/25 bg-good/10 text-good',
  warning: 'border-warning/25 bg-warning/10 text-warning',
  critical: 'border-critical/25 bg-critical/10 text-critical',
  info: 'border-info/25 bg-info/10 text-info',
};

export function Badge({ tone = 'neutral', icon, children }: { tone?: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-px text-[11px] font-medium ${TONE[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

export function ProgressBar({ value, done = false, label }: { value: number; done?: boolean; label?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className="h-1 w-full overflow-hidden rounded-full bg-line"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div className={`h-full rounded-full ${done ? 'bg-good' : 'bg-ink-2/80'}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ResDot({ res }: { res: Res }) {
  return <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: RES_STYLE[res].color }} />;
}

const ORDER: Res[] = ['G', 'E', 'D', 'GE', 'BG', 'BE', 'BGE', 'GEM', 'ORE'];

/** Amounts with a resource dot; the resource name is in the title and for screen readers. */
export function CostList({
  cost,
  empty = '—',
  className = '',
  nowrap = false,
}: {
  cost: Partial<Record<Res, number>>;
  empty?: ReactNode;
  className?: string;
  /** Keep every amount on one line (table cells). */
  nowrap?: boolean;
}) {
  const entries = ORDER.filter((r) => (cost[r] ?? 0) > 0);
  if (entries.length === 0) return <span className="text-ink-3">{empty}</span>;
  return (
    <span className={`inline-flex items-center gap-y-1 ${nowrap ? 'flex-nowrap gap-x-2.5' : 'flex-wrap gap-x-3'} ${className}`}>
      {entries.map((r) => (
        <span key={r} className="tnum relative inline-flex items-center gap-1.5 whitespace-nowrap" title={RES_STYLE[r].label}>
          <ResDot res={r} />
          {formatCompact(cost[r]!)}
          <span className="sr-only">{RES_STYLE[r].label}</span>
        </span>
      ))}
    </span>
  );
}

export function Ore({ ore }: { ore: [number, number, number] }) {
  const names = ['Shiny', 'Glowy', 'Starry'];
  return (
    <span className="tnum inline-flex flex-wrap gap-x-3 gap-y-1">
      {ore.map((v, i) =>
        v > 0 ? (
          <span key={names[i]} className="whitespace-nowrap">
            {formatCompact(v)} <span className="text-ink-3">{names[i]}</span>
          </span>
        ) : null,
      )}
    </span>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-ink-3">{icon}</div>}
      <h3 className="text-sm font-semibold">{title}</h3>
      {children && <div className="mt-1 max-w-md text-sm text-ink-3">{children}</div>}
    </div>
  );
}
