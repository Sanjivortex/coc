'use client';

import Image from 'next/image';
import { Check, Hourglass } from 'lucide-react';
import { useMemo } from 'react';
import { formatDuration } from '@/lib/format';
import type { Res } from '@/lib/gamedata';
import { simulateChain, type PlanSettings, type ScenarioId } from '@/lib/planner';
import { Badge, CostList, Ore, ProgressBar } from '../ui/display';
import { groupImage, groupStats, isTimed, levelText, type GroupStats, type ItemGroup } from './model';

interface Row {
  group: ItemGroup;
  stats: GroupStats;
  img: string | null;
  /** Builder/lab/pet time under the scenario (sum over instances). */
  time: number;
  cost: Partial<Record<Res, number>>;
}

export function ItemsTable({
  groups,
  scenario,
  settings,
  now,
  onOpen,
}: {
  groups: ItemGroup[];
  scenario: ScenarioId;
  settings: PlanSettings;
  now?: number;
  onOpen: (g: ItemGroup) => void;
}) {
  const rows = useMemo<Row[]>(
    () =>
      groups.map((group) => {
        const stats = groupStats(group);
        let time = 0;
        let cost: Partial<Record<Res, number>> = stats.cost;
        if (isTimed(group.item) && !stats.maxed) {
          cost = {};
          for (const c of group.chains) {
            if (c.steps.length === 0) continue;
            const r = simulateChain(c, settings, scenario, now ?? 0);
            time += r.makespan;
            for (const [res, v] of Object.entries(r.cost) as [Res, number][]) cost[res] = (cost[res] ?? 0) + v;
          }
        }
        return { group, stats, img: groupImage(group, stats), time, cost };
      }),
    [groups, scenario, settings, now],
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-xs text-ink-3">
            <th className="px-5 py-2.5 font-medium">Item</th>
            <th className="px-3 py-2.5 font-medium">Level</th>
            <th className="hidden w-36 px-3 py-2.5 font-medium md:table-cell">Progress</th>
            <th className="hidden px-3 py-2.5 font-medium lg:table-cell">Next upgrade</th>
            <th className="px-3 py-2.5 text-right font-medium">Time to max</th>
            <th className="hidden px-5 py-2.5 text-right font-medium sm:table-cell">Cost to max</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ group, stats, img, time, cost }) => {
            const first = group.chains.find((c) => c.steps.length > 0);
            const running = stats.running[0];
            const timed = isTimed(group.item);
            return (
              <tr key={group.key} onClick={() => onOpen(group)} className="cursor-pointer border-t border-line transition-colors hover:bg-hover/60">
                <td className="px-5 py-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(group);
                    }}
                    className="flex items-center gap-3 text-left"
                  >
                    <span className="relative h-8 w-8 shrink-0">
                      {img ? (
                        <Image src={img} alt="" fill sizes="32px" className={`object-contain ${stats.missing === stats.count ? 'opacity-40 grayscale' : ''}`} />
                      ) : (
                        <span className="block h-full w-full rounded-md bg-raised" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{group.label}</span>
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        {stats.count > 1 && <span className="tnum text-xs text-ink-3">{stats.count} built</span>}
                        {running && (
                          <Badge tone="info" icon={<Hourglass size={10} />}>
                            Upgrading
                          </Badge>
                        )}
                        {stats.rushed && <Badge tone="critical">Below last TH max</Badge>}
                        {stats.missing > 0 && <Badge>{stats.missing === stats.count ? (group.item.counts ? 'Not built' : 'Locked') : `${stats.missing} not built`}</Badge>}
                      </span>
                    </span>
                  </button>
                </td>
                <td className="tnum whitespace-nowrap px-3 py-2 text-ink-2">
                  <span className="text-ink">{levelText(stats)}</span> / {stats.target}
                </td>
                <td className="hidden px-3 py-2 md:table-cell">
                  <ProgressBar value={stats.maxLevels ? stats.levels / stats.maxLevels : 1} done={stats.maxed} label={`${group.label} level progress`} />
                </td>
                <td className="tnum hidden whitespace-nowrap px-3 py-2 text-ink-2 lg:table-cell">
                  {running ? (
                    <span className="text-info">{formatDuration(running.firstRemaining!)} left</span>
                  ) : first && timed ? (
                    <span className="inline-flex items-center gap-2">
                      {formatDuration(first.steps[0].time)}
                      <CostList cost={{ [first.steps[0].res]: first.steps[0].cost * first.count }} />
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="tnum whitespace-nowrap px-3 py-2 text-right">
                  {stats.maxed ? (
                    <span className="inline-flex items-center gap-1 text-good">
                      <Check size={14} /> Max
                    </span>
                  ) : timed ? (
                    <span className="text-ink" title={stats.count > 1 ? `Builder time for all ${stats.count}, one after another` : undefined}>
                      {formatDuration(time)}
                    </span>
                  ) : (
                    <span className="text-ink-3">—</span>
                  )}
                </td>
                <td className="hidden px-5 py-2 text-right text-ink-2 sm:table-cell">
                  {stats.maxed ? '' : stats.ore.some((o) => o > 0) ? <Ore ore={stats.ore} /> : <CostList cost={cost} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
