'use client';

import Image from 'next/image';
import { useEffect } from 'react';
import { KIND_LABEL } from '@/lib/gamedata';
import { formatCompact, formatDuration, RES_STYLE } from '@/lib/format';
import { DEFAULT_SETTINGS, chainTime, type PlanSettings } from '@/lib/planner';
import { levelText } from './ItemTile';
import { groupImage, groupStats, type ItemGroup } from './groups';
import { Badge, CostList } from './ui';

const POTION: Record<string, { name: string; hours: number }> = {
  builder: { name: 'Builder Potion', hours: 9 },
  lab: { name: 'Research Potion', hours: 23 },
  pet: { name: 'Pet Potion', hours: 23 },
};

export function ItemDialog({ group, settings, onClose }: { group: ItemGroup; settings: PlanSettings; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const s = groupStats(group);
  const img = groupImage(group, s);
  const item = group.item;
  const timed = item.queue === 'builder' || item.queue === 'lab' || item.queue === 'pet';
  const main = group.chains.reduce((a, b) => (b.remainingTime > a.remainingTime ? b : a));
  const jamDays = settings.hammerJam.days;
  const home = item.base === 'home';
  const scenarios =
    timed && main.steps.length > 0
      ? [
          { label: 'No boosts', value: chainTime(main, DEFAULT_SETTINGS) },
          { label: 'With your boosts', value: chainTime(main, settings), hint: settings.hammerJam.enabled ? 'incl. Hammer Jam' : undefined },
          ...(home
            ? [
                { label: `Hammer Jam (${jamDays}-day event)`, value: chainTime(main, settings, { jam: 'window' }) },
                { label: 'Everything at Hammer Jam price', value: chainTime(main, settings, { jam: 'always' }) },
              ]
            : []),
        ]
      : [];
  const longestStep = Math.max(0, ...main.steps.map((st) => st.time));
  const cumulative: number[] = [];
  main.steps.forEach((st, k) => {
    const running = k === 0 && main.firstRemaining !== undefined;
    cumulative.push((cumulative[k - 1] ?? 0) + (running ? main.firstRemaining! : st.time));
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={group.label}
        className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-b-none p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="relative h-16 w-16 shrink-0">{img && <Image src={img} alt="" fill sizes="64px" className="object-contain" />}</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-muted">
              {KIND_LABEL[item.kind]}
              {item.base === 'builder' && ' · Builder Base'}
            </p>
            <h2 className="font-display text-2xl tracking-wide">{group.label}</h2>
            <p className="num text-sm text-muted">
              Level <span className="text-ink">{levelText(s.distribution, s.count)}</span> → max <span className="text-ink">{s.target}</span>
              {main.scTo > 0 && ` · supercharge ${main.scFrom}/${main.scTo}`}
              {s.count > 1 && ` · ${s.count} built`}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {s.maxed && <Badge tone="ok">Maxed for this hall</Badge>}
              {s.rushed && <Badge tone="danger">Below previous Town Hall max</Badge>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close">
            ×
          </button>
        </div>

        {scenarios.length > 0 && (
          <section className="mt-5">
            <h3 className="mb-2 text-sm font-semibold">
              Time to max{s.count > 1 ? ' (slowest one)' : ''}: {main.from} → {main.scTo > 0 ? `${main.to} + SC ${main.scTo}` : main.to}
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {scenarios.map((sc) => (
                <div key={sc.label} className="rounded-xl bg-surface-2 p-3">
                  <div className="num font-display text-2xl tracking-wide text-accent">{formatDuration(sc.value)}</div>
                  <div className="text-xs text-muted">{sc.label}</div>
                  {sc.hint && <div className="text-[10px] text-muted">{sc.hint}</div>}
                </div>
              ))}
            </div>
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {home && POTION[item.queue] && (
                <li>
                  Each {POTION[item.queue].name} used while this upgrades saves about {POTION[item.queue].hours}h.
                </li>
              )}
              {home && (item.kind === 'hero' || item.kind === 'pet') && longestStep > 0 && (
                <li>A Hammer of Heroes skips one level ({formatDuration(longestStep)} saved on the longest one). A Book of Heroes finishes a running upgrade.</li>
              )}
              {home && item.queue === 'builder' && settings.apprentice > 0 && <li>Builder&apos;s Apprentice lvl {settings.apprentice} is counted: {settings.apprentice}h saved per day.</li>}
              {home && item.queue === 'lab' && settings.labAssistant > 0 && <li>Lab Assistant lvl {settings.labAssistant} is counted: {settings.labAssistant}h saved per day.</li>}
              {settings.goldPass > 0 && home && item.queue !== 'pet' && <li>Gold Pass {Math.round(settings.goldPass * 100)}% boost is applied to time and cost.</li>}
            </ul>
          </section>
        )}

        {!s.maxed && (
          <section className="mt-5">
            <h3 className="mb-2 text-sm font-semibold">Cost to max{s.count > 1 ? ` (all ${s.count})` : ''}</h3>
            <CostList cost={s.cost} />
            {s.ore.some((o) => o > 0) && (
              <p className="num mt-1 text-xs text-muted">
                Ore: {formatCompact(s.ore[0])} shiny · {formatCompact(s.ore[1])} glowy · {formatCompact(s.ore[2])} starry
              </p>
            )}
          </section>
        )}

        {s.count > 1 && (
          <section className="mt-5">
            <h3 className="mb-2 text-sm font-semibold">Each one</h3>
            <div className="grid gap-1 sm:grid-cols-2">
              {group.chains.map((c, i) => (
                <div key={c.id} className="num flex justify-between rounded-lg bg-surface-2 px-3 py-1.5 text-xs">
                  <span>
                    #{i + 1} · lvl {c.from}
                    {c.count > 1 && ` ×${c.count}`}
                    {c.missing && ' (not built)'}
                  </span>
                  <span className="text-muted">
                    {c.firstRemaining !== undefined && <span className="text-info">upgrading, {formatDuration(c.firstRemaining)} left · </span>}
                    {c.steps.length === 0 ? 'max' : timed ? formatDuration(c.remainingTime) : `${c.steps.length} levels`}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {main.steps.length > 0 && (
          <section className="mt-5">
            <h3 className="mb-2 text-sm font-semibold">Level by level{s.count > 1 ? ' (slowest one)' : ''}</h3>
            <div className="overflow-x-auto">
              <table className="num w-full text-left text-xs">
                <thead className="text-muted">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Level</th>
                    {timed && <th className="py-1 pr-3 font-medium">Time</th>}
                    <th className="py-1 pr-3 font-medium">Cost</th>
                    {timed && <th className="py-1 font-medium">Total time</th>}
                  </tr>
                </thead>
                <tbody>
                  {main.steps.map((st, k) => {
                    const running = k === 0 && main.firstRemaining !== undefined;
                    return (
                      <tr key={`${st.level}-${st.supercharge ? 'sc' : 'n'}`} className="border-t border-line/60">
                        <td className="py-1 pr-3">
                          {st.supercharge ? `SC ${st.level}` : st.level}
                          {running && <span className="ml-1 text-info">running</span>}
                        </td>
                        {timed && <td className="py-1 pr-3">{running ? `${formatDuration(main.firstRemaining!)} left` : formatDuration(st.time)}</td>}
                        <td className="py-1 pr-3">
                          {st.ore
                            ? `${formatCompact(st.ore[0])} / ${formatCompact(st.ore[1])} / ${formatCompact(st.ore[2])}`
                            : running
                              ? 'paid'
                              : `${formatCompact(st.cost * main.count)} ${RES_STYLE[st.res].label}`}
                        </td>
                        {timed && <td className="py-1">{formatDuration(cumulative[k])}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {main.steps[0]?.ore && <p className="mt-1 text-xs text-muted">Ore columns: shiny / glowy / starry.</p>}
          </section>
        )}
      </div>
    </div>
  );
}
