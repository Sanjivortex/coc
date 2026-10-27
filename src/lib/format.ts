import type { Res } from './gamedata';

/** "104d", "83d 5h", "5h 20m", "45m". */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds)) return '∞';
  const s = Math.max(0, Math.round(seconds));
  if (s === 0) return '0m';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d >= 100) return `${d}d`;
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

/** 5_555_000 → "5.56M". */
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${trim(n / 1e9)}B`;
  if (abs >= 1e6) return `${trim(n / 1e6)}M`;
  if (abs >= 1e3) return `${trim(n / 1e3)}K`;
  return String(Math.round(n));
}

/** 3 significant digits without trailing decimal zeros: 360 → "360", 4.50 → "4.5". */
const trim = (x: number) => {
  const s = Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2);
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
};

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function formatPercent(x: number): string {
  return `${Math.floor(Math.max(0, Math.min(1, x)) * 1000) / 10}%`;
}

/** "12 Feb 2027" for a unix time in seconds. */
export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "12 Feb, 14:30" for a unix time in seconds. */
export function formatDateTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const RES_STYLE: Record<Res, { label: string; color: string }> = {
  G: { label: 'Gold', color: 'var(--res-gold)' },
  E: { label: 'Elixir', color: 'var(--res-elixir)' },
  D: { label: 'Dark Elixir', color: 'var(--res-dark)' },
  GE: { label: 'Gold or Elixir', color: 'var(--res-gold)' },
  BG: { label: 'Builder Gold', color: 'var(--res-gold)' },
  BE: { label: 'Builder Elixir', color: 'var(--res-elixir)' },
  BGE: { label: 'Builder Gold or Elixir', color: 'var(--res-gold)' },
  GEM: { label: 'Gems', color: 'var(--res-gem)' },
  ORE: { label: 'Ore', color: 'var(--res-ore)' },
};

const TAG_CHARS = /^[0289PYLQGRJCUV]{3,12}$/;

/** Cleans user input into a player/clan tag: uppercase, O→0, leading '#'. Returns null when invalid. */
export function normalizeTag(input: string): string | null {
  const body = decodeURIComponent(input).trim().toUpperCase().replace(/^#/, '').replace(/O/g, '0').replace(/\s+/g, '');
  return TAG_CHARS.test(body) ? `#${body}` : null;
}

/** "#2PP" → "2PP" for URLs. */
export function tagSlug(tag: string): string {
  return tag.replace(/^#/, '');
}
