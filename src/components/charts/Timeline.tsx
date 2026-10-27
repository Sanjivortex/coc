'use client';

import { useEffect, useRef, useState } from 'react';
import { DAY } from '@/lib/planner';

export interface TimelineBar {
  key: string;
  row: number;
  /** Seconds from now. */
  start: number;
  end: number;
  color: string;
  /** Accessible name and tooltip title, e.g. "Archer Queen → 98". */
  label: string;
  /** Extra tooltip lines. */
  detail: string[];
}

interface Props {
  rows: string[];
  bars: TimelineBar[];
  /** Seconds the x axis covers. */
  span: number;
  /** Shaded Hammer Jam window, in seconds from now. */
  jam?: { start: number; end: number };
  /** Unix seconds for "now": ticks show dates instead of day numbers. */
  now?: number;
  legend?: { label: string; color: string }[];
  ariaLabel: string;
}

const ROW_H = 30;
const BAR_H = 14;

function tickStep(spanDays: number, maxTicks: number): number {
  for (const step of [1, 2, 7, 14, 30, 60, 90, 180, 365]) if (spanDays / step <= maxTicks) return step;
  return 730;
}

/**
 * Gantt-style timeline: one row per worker (or per level), bars positioned in % of the span so the
 * chart scales with its container. Bars are focusable; hover and focus show the same tooltip.
 */
export function Timeline({ rows, bars, span, jam, now, legend, ariaLabel }: Props) {
  const [hover, setHover] = useState<TimelineBar | null>(null);
  // Date labels need ~72px each, so narrow charts (phones, the drawer) get fewer ticks.
  const plot = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = plot.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const total = Math.max(span, DAY);
  const x = (t: number) => `${(Math.max(0, Math.min(t, total)) / total) * 100}%`;
  const spanDays = total / DAY;
  const step = tickStep(spanDays, width > 0 ? Math.max(2, Math.floor(width / 72)) : 8);
  const ticks: number[] = [];
  for (let d = 0; d <= spanDays + 1e-9; d += step) ticks.push(d);
  const tickLabel = (d: number) =>
    now ? new Date((now + d * DAY) * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : d === 0 ? 'Today' : `Day ${d}`;
  const height = rows.length * ROW_H;

  return (
    <figure className="m-0" aria-label={ariaLabel}>
      {legend && legend.length > 1 && (
        <figcaption className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
          {jam && (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm border border-[var(--jam-edge)] bg-[var(--jam)]" />
              Hammer Jam
            </span>
          )}
        </figcaption>
      )}
      <div className="grid grid-cols-[5.5rem_1fr] gap-x-3 sm:grid-cols-[7.5rem_1fr]">
        <div className="pt-6">
          {rows.map((r) => (
            <div key={r} className="flex items-center truncate text-xs text-ink-2" style={{ height: ROW_H }}>
              {r}
            </div>
          ))}
        </div>
        <div ref={plot} className="relative min-w-0">
          {/* Hammer Jam label row */}
          <div className="relative h-6">
            {jam && jam.end > 0 && jam.start < total && (
              <span className="absolute top-1 truncate pl-1 text-[11px] font-medium text-brand" style={{ left: x(jam.start), maxWidth: `calc(${x(jam.end)} - ${x(jam.start)})` }}>
                Hammer Jam
              </span>
            )}
          </div>
          <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
            {ticks.map((d) => (
              <span key={d} aria-hidden className="absolute inset-y-0 w-px bg-[var(--grid)]" style={{ left: x(d * DAY) }} />
            ))}
            {jam && jam.end > 0 && jam.start < total && (
              <span
                aria-hidden
                className="absolute inset-y-0 border-x border-[var(--jam-edge)] bg-[var(--jam)]"
                style={{ left: x(jam.start), width: `calc(${x(jam.end)} - ${x(jam.start)})` }}
              />
            )}
            {rows.map((r, i) => (
              <span key={r} aria-hidden className="absolute inset-x-0 h-px bg-[var(--grid)]" style={{ top: (i + 1) * ROW_H - 1 }} />
            ))}
            {bars.map((b) => (
              <button
                key={b.key}
                type="button"
                aria-label={[b.label, ...b.detail].join(', ')}
                onMouseEnter={() => setHover(b)}
                onFocus={() => setHover(b)}
                onBlur={() => setHover(null)}
                className="absolute rounded-[3px] outline-offset-1 transition-[filter] hover:brightness-125 focus-visible:brightness-125"
                style={{
                  left: x(b.start),
                  // 2px surface gap between back-to-back bars in a row.
                  width: `max(3px, calc(${x(b.end)} - ${x(b.start)} - 2px))`,
                  top: b.row * ROW_H + (ROW_H - BAR_H) / 2 - 1,
                  height: BAR_H,
                  background: b.color,
                }}
              />
            ))}
            {hover && (
              <div
                role="status"
                className="pointer-events-none absolute z-10 w-max max-w-64 rounded-lg border border-line-strong bg-raised px-3 py-2 text-xs shadow-xl"
                style={{
                  top: hover.row * ROW_H + ROW_H,
                  left: `clamp(0px, ${x(hover.start)}, calc(100% - 16rem))`,
                }}
              >
                <div className="font-medium text-ink">{hover.label}</div>
                {hover.detail.map((d) => (
                  <div key={d} className="tnum text-ink-2">
                    {d}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="relative mt-1.5 h-5" aria-hidden>
            {ticks.map((d, i) => (
              <span
                key={d}
                className="tnum absolute top-0 whitespace-nowrap text-[11px] text-ink-3"
                style={{ left: x(d * DAY), transform: i === 0 ? 'none' : d * DAY >= total * 0.95 ? 'translateX(-100%)' : 'translateX(-50%)' }}
              >
                {tickLabel(d)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}
