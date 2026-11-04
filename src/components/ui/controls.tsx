'use client';

import { Minus, Plus } from 'lucide-react';
import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { buttonClass, type ButtonSize as Size, type ButtonVariant as Variant } from './styles';

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

/** Label on the left, control on the right; stacks on narrow panels. */
export function Field({ label, hint, children, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <label htmlFor={htmlFor} className="min-w-0 text-[13px] text-ink">
        {label}
        {hint && <span className="block text-xs text-ink-3">{hint}</span>}
      </label>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  label,
  id,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
  id?: string;
  suffix?: string;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v)));
  return (
    <div className="inline-flex h-8 items-center rounded-lg border border-line bg-bg">
      <button
        type="button"
        className="grid h-full w-7 place-items-center text-ink-3 hover:text-ink disabled:opacity-30"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label={`Decrease ${label}`}
      >
        <Minus size={14} />
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(clamp(v));
        }}
        className="tnum h-full w-10 bg-transparent text-center text-[13px] outline-none"
      />
      {suffix && <span className="pr-1 text-xs text-ink-3">{suffix}</span>}
      <button
        type="button"
        className="grid h-full w-7 place-items-center text-ink-3 hover:text-ink disabled:opacity-30"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label={`Increase ${label}`}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Unix seconds shown in the viewer's time zone; without `withTime` the time of day is kept on change. */
export function DateInput({ value, onChange, label, withTime = false }: { value: number; onChange: (v: number) => void; label: string; withTime?: boolean }) {
  const d = new Date(value * 1000);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return (
    <input
      type={withTime ? 'datetime-local' : 'date'}
      aria-label={label}
      value={withTime ? `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}` : date}
      onChange={(e) => {
        const v = e.target.value;
        if (!v) return;
        let next: Date;
        if (withTime) next = new Date(v);
        else {
          const [y, m, day] = v.split('-').map(Number);
          next = new Date(value * 1000);
          next.setFullYear(y, m - 1, day);
        }
        const t = next.getTime();
        if (Number.isFinite(t)) onChange(Math.round(t / 1000));
      }}
      className="tnum h-8 rounded-lg border border-line bg-bg px-2 text-[13px] text-ink outline-none focus-visible:border-line-strong"
    />
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-line-strong'}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  size = 'sm',
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-lg border border-line bg-bg p-0.5 scrollbar-none">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`whitespace-nowrap rounded-md font-medium transition-colors ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]'} ${
              active ? 'bg-[rgba(240,180,41,0.12)] text-[#f7cf5e] shadow-[inset_0_0_0_1px_rgba(240,180,41,0.4)]' : 'text-ink-3 hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: T; label: ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const id = useId();
  return (
    <div role="tablist" aria-label={label} className="flex gap-5 overflow-x-auto border-b border-line scrollbar-none">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            id={`${id}-${t.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              const i = tabs.findIndex((x) => x.id === value);
              const nextTab = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
              onChange(nextTab.id);
              document.getElementById(`${id}-${nextTab.id}`)?.focus();
            }}
            tabIndex={active ? 0 : -1}
            className={`relative -mb-px flex shrink-0 items-center gap-1.5 border-b-2 py-3 text-[13px] font-medium transition-colors ${
              active ? 'border-brand text-ink' : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            {t.label}
            {t.count !== undefined && <span className="tnum rounded bg-raised px-1.5 text-[11px] text-ink-3">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
