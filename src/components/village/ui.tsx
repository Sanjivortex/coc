'use client';

import type { ReactNode } from 'react';
import type { Res } from '@/lib/gamedata';
import { RES_STYLE, formatCompact } from '@/lib/format';

export function Bar({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'ok' | 'danger' | 'info' }) {
  const color = { accent: 'bg-accent', ok: 'bg-ok', danger: 'bg-danger', info: 'bg-info' }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

const ORDER: Res[] = ['G', 'E', 'D', 'GE', 'BG', 'BE', 'BGE', 'GEM', 'ORE'];

export function CostList({ cost, className = '' }: { cost: Partial<Record<Res, number>>; className?: string }) {
  const entries = ORDER.filter((r) => (cost[r] ?? 0) > 0);
  if (entries.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-x-3 gap-y-1 ${className}`}>
      {entries.map((r) => (
        <span key={r} className="num inline-flex items-center gap-1 text-xs">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: RES_STYLE[r].color }} aria-hidden />
          <span className="text-ink">{formatCompact(cost[r]!)}</span>
          <span className="text-muted">{RES_STYLE[r].label}</span>
        </span>
      ))}
    </div>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone: 'ok' | 'danger' | 'info' | 'muted' | 'warn' }) {
  const cls = {
    ok: 'bg-ok/15 text-ok',
    danger: 'bg-danger/15 text-danger',
    info: 'bg-info/15 text-info',
    warn: 'bg-warn/15 text-warn',
    muted: 'bg-surface-2 text-muted',
  }[tone];
  return <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{children}</span>;
}

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span className="flex items-center gap-1">
        <button type="button" className="h-7 w-7 rounded-md bg-surface-2 text-muted hover:text-ink" onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Decrease ${label}`}>
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, Math.round(v))));
          }}
          className="num h-7 w-14 rounded-md border border-line bg-bg text-center outline-none focus:border-accent"
        />
        <button type="button" className="h-7 w-7 rounded-md bg-surface-2 text-muted hover:text-ink" onClick={() => onChange(Math.min(max, value + 1))} aria-label={`Increase ${label}`}>
          +
        </button>
      </span>
    </label>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      <span>
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-surface-2'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-5' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="text-sm">
      <div className="mb-1.5">{label}</div>
      <div className="flex gap-1 rounded-lg bg-bg p-1">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${o.value === value ? 'bg-accent text-accent-ink' : 'text-muted hover:text-ink'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
