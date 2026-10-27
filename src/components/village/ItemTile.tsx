'use client';

import Image from 'next/image';
import { formatCompact, formatDuration } from '@/lib/format';
import { groupImage, groupStats, type ItemGroup } from './groups';
import { Badge, Bar, CostList } from './ui';

export function levelText(distribution: [number, number][], count: number): string {
  if (count === 1) return String(distribution[0]?.[0] ?? 0);
  return distribution.map(([lvl, n]) => (n > 1 ? `${lvl}×${n}` : String(lvl))).join(' · ');
}

export function ItemTile({ group, onOpen }: { group: ItemGroup; onOpen: () => void }) {
  const s = groupStats(group);
  const img = groupImage(group, s);
  const progress = s.maxLevels > 0 ? s.levels / s.maxLevels : 1;
  const sc = group.chains[0];
  const timed = group.item.queue === 'builder' || group.item.queue === 'lab' || group.item.queue === 'pet';

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`card group flex w-full flex-col gap-2 p-3 text-left transition hover:border-accent/60 ${s.maxed ? 'opacity-80' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="relative h-12 w-12 shrink-0">
          {img ? (
            <Image src={img} alt="" fill sizes="48px" className={`object-contain ${s.missing === s.count ? 'opacity-40 grayscale' : ''}`} />
          ) : (
            <div className="h-full w-full rounded-lg bg-surface-2" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{group.label}</div>
          <div className="num text-xs text-muted">
            <span className="text-ink">{levelText(s.distribution, s.count)}</span> / {s.target}
            {sc.scTo > 0 && <span className="ml-1">· SC {sc.scFrom}/{sc.scTo}</span>}
            {s.count > 1 && <span className="ml-1">({s.count})</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {s.maxed && <Badge tone="ok">Max</Badge>}
            {s.running.length > 0 && <Badge tone="info">Upgrading</Badge>}
            {s.rushed && <Badge tone="danger">Rushed</Badge>}
            {s.missing > 0 && <Badge tone="muted">{s.missing === s.count ? (group.item.counts ? 'Not built' : 'Locked') : `${s.missing} new`}</Badge>}
          </div>
        </div>
      </div>
      <Bar value={progress} tone={s.maxed ? 'ok' : s.rushed ? 'danger' : 'accent'} />
      {!s.maxed && (
        <div className="flex flex-col gap-1">
          {timed && s.remaining > 0 && (
            <span className="num text-xs">
              ⏱ <span className="font-semibold">{formatDuration(s.remaining)}</span>
              {s.count > 1 && <span className="text-muted"> builder time</span>}
            </span>
          )}
          <CostList cost={s.cost} />
          {s.ore.some((o) => o > 0) && (
            <span className="num text-xs text-muted">
              Ore: <span className="text-ink">{formatCompact(s.ore[0])}</span> shiny · <span className="text-ink">{formatCompact(s.ore[1])}</span> glowy ·{' '}
              <span className="text-ink">{formatCompact(s.ore[2])}</span> starry
            </span>
          )}
        </div>
      )}
    </button>
  );
}
