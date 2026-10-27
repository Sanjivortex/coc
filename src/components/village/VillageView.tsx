'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useNow, useStoredJson } from '@/lib/client-store';
import { formatCompact, formatDuration, formatPercent } from '@/lib/format';
import type { Res } from '@/lib/gamedata';
import { DEFAULT_SETTINGS, buildChains, planVillage, progressOf, type Chain, type PlanResult, type PlanSettings } from '@/lib/planner';
import type { Village } from '@/lib/village';
import { ItemDialog } from './ItemDialog';
import { ItemTile } from './ItemTile';
import { PlannerPanel } from './PlannerPanel';
import { SECTIONS, groupChains, groupStats, type ItemGroup } from './groups';
import { Bar, CostList } from './ui';

const STORAGE_KEY = 'coc-stats:planner';
const HERO_ORDER = ['barbarian-king', 'archer-queen', 'minion-prince', 'grand-warden', 'royal-champion', 'dragon-duke', 'battle-machine', 'battle-copter'];

function villageFacts(v: Village): Partial<PlanSettings> {
  if (v.source !== 'export') return {};
  return { builders: v.builders ?? DEFAULT_SETTINGS.builders, apprentice: v.helpers.apprentice, labAssistant: v.helpers.labAssistant };
}

function mergeCost(...costs: Partial<Record<Res, number>>[]): Partial<Record<Res, number>> {
  const out: Partial<Record<Res, number>> = {};
  for (const c of costs) for (const [r, v] of Object.entries(c) as [Res, number][]) out[r] = (out[r] ?? 0) + v;
  return out;
}

function sortGroups(groups: ItemGroup[]): ItemGroup[] {
  const rank = (g: ItemGroup) => {
    const h = HERO_ORDER.indexOf(g.item.hero ?? g.item.id);
    return h < 0 ? 99 : h;
  };
  const stats = new Map(groups.map((g) => [g.key, groupStats(g)]));
  return [...groups].sort((a, b) => {
    const sa = stats.get(a.key)!;
    const sb = stats.get(b.key)!;
    if (sa.maxed !== sb.maxed) return sa.maxed ? 1 : -1;
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return a.label.localeCompare(b.label);
  });
}

export function VillageView({ village }: { village: Village }) {
  // Boosts are remembered per account, on top of what the export tells us (builders, helpers).
  const [stored, update] = useStoredJson<PlanSettings>(`${STORAGE_KEY}:${village.tag}`);
  const settings = useMemo<PlanSettings>(() => ({ ...DEFAULT_SETTINGS, ...villageFacts(village), ...stored }), [village, stored]);
  const now = useNow() ?? undefined;
  const [open, setOpen] = useState<ItemGroup | null>(null);

  const chains = useMemo(
    () => buildChains(village, { now, includeSupercharge: settings.includeSupercharge, includeCrafted: settings.includeCrafted }),
    [village, now, settings.includeSupercharge, settings.includeCrafted],
  );

  const plans = useMemo(() => {
    const none: PlanSettings = {
      ...DEFAULT_SETTINGS,
      builders: settings.builders,
      builderBaseBuilders: settings.builderBaseBuilders,
      includeSupercharge: settings.includeSupercharge,
      includeCrafted: settings.includeCrafted,
    };
    return {
      none: planVillage(chains, none),
      yours: planVillage(chains, settings),
      jam: planVillage(chains, { ...settings, hammerJam: { ...settings.hammerJam, enabled: true } }),
      allJam: planVillage(chains, { ...settings, hammerJam: { ...settings.hammerJam, enabled: true, startDays: 0, days: 100_000 } }),
    };
  }, [chains, settings]);

  const sections = useMemo(
    () =>
      SECTIONS.map((sec) => {
        const cs = chains.filter((c) => c.base === sec.base && sec.kinds.includes(c.item.kind));
        return { ...sec, chains: cs, groups: sortGroups(groupChains(cs)) };
      }).filter((s) => s.chains.length > 0),
    [chains],
  );

  const isExport = village.source === 'export';
  const running = chains.filter((c) => c.firstRemaining !== undefined).sort((a, b) => a.firstRemaining! - b.firstRemaining!);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4 lg:col-start-1">
        <Summary plans={plans} settings={settings} now={now} village={village} />
        <Queues plan={plans.yours} settings={settings} hasBuilderBase={village.builderHall > 0} />
        <ProgressOverview sections={sections} />
        {running.length > 0 && <Running chains={running} now={now} />}
        <SuggestedOrder plan={plans.yours} />
      </div>

      <aside className="self-start lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <PlannerPanel settings={settings} onChange={update} showBuildingOptions={isExport} />
      </aside>

      <div className="space-y-8 lg:col-start-1">
        {sections.map((sec) => {
          const p = progressOf(sec.chains);
          const timed = sec.chains.some((c) => c.queue === 'builder' || c.queue === 'lab' || c.queue === 'pet');
          const left = sec.chains.reduce((s, c) => s + c.remainingTime * c.count, 0);
          return (
            <section key={sec.id} id={sec.id} className="scroll-mt-20">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <h2 className="font-display text-2xl tracking-wide">{sec.title}</h2>
                <p className="num text-sm text-muted">
                  {formatPercent(p.time)} done
                  {timed && left > 0 && ` · ${formatDuration(left)} of upgrades left`}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {sec.groups.map((g) => (
                  <ItemTile key={g.key} group={g} onOpen={() => setOpen(g)} />
                ))}
              </div>
            </section>
          );
        })}

        {!isExport && (
          <div className="card p-5 text-sm">
            <h2 className="font-display text-xl tracking-wide">Defenses, traps and walls</h2>
            <p className="mt-1 text-muted">
              The official API does not share buildings. Copy your village in-game (Settings → More Settings → Data Export → Copy) and
              paste it in the{' '}
              <Link className="text-accent underline-offset-4 hover:underline" href="/tracker">
                Upgrade Tracker
              </Link>{' '}
              to see every defense and the full time to max.
            </p>
          </div>
        )}

        {(village.unknown.length > 0 || village.superTroops.length > 0) && (
          <div className="card space-y-2 p-4 text-xs text-muted">
            {village.superTroops.length > 0 && (
              <p>
                Super troops:{' '}
                {village.superTroops.map((t) => (
                  <span key={t.name} className={t.active ? 'text-ok' : ''}>
                    {t.name}
                    {t.active ? ' (active)' : ''}
                    {', '}
                  </span>
                ))}
              </p>
            )}
            {village.unknown.length > 0 && <p>Not in our data yet (ignored): {village.unknown.join(', ')}</p>}
          </div>
        )}
      </div>

      {open && <ItemDialog group={open} settings={settings} onClose={() => setOpen(null)} />}
    </div>
  );
}

type Plans = { none: PlanResult; yours: PlanResult; jam: PlanResult; allJam: PlanResult };

function Summary({ plans, settings, now, village }: { plans: Plans; settings: PlanSettings; now?: number; village: Village }) {
  const p = plans.yours;
  const bottleneck = [
    { name: 'Builders', t: p.builder.makespan },
    { name: 'Laboratory', t: p.lab.makespan },
    { name: 'Pet House', t: p.pet.makespan },
  ].sort((a, b) => b.t - a.t)[0];
  const finish = now ? new Date((now + p.homeTotal) * 1000) : null;
  const cards = [
    { label: 'No boosts', value: plans.none.homeTotal },
    { label: `Hammer Jam (${settings.hammerJam.days}-day event${settings.hammerJam.startDays ? ` in ${settings.hammerJam.startDays}d` : ''})`, value: plans.jam.homeTotal },
    { label: 'Everything at Hammer Jam price', value: plans.allJam.homeTotal },
  ];
  return (
    <section className="card p-5">
      <p className="text-xs uppercase tracking-wide text-muted">
        Time to max · Town Hall {village.townHall}
        {village.source === 'api' && ' · heroes, pets & lab only'}
      </p>
      <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-1">
        <span className="num font-display text-5xl tracking-wide text-accent">{p.homeTotal > 0 ? formatDuration(p.homeTotal) : 'Maxed!'}</span>
        {p.homeTotal > 0 && (
          <span className="pb-1 text-sm text-muted">
            with your boosts{finish && ` · done around ${finish.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`} · slowest:{' '}
            <span className="text-ink">{bottleneck.name}</span>
          </span>
        )}
      </div>
      {p.homeTotal > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl bg-surface-2 p-3">
              <div className="num font-display text-2xl tracking-wide">{formatDuration(c.value)}</div>
              <div className="text-xs text-muted">{c.label}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Queues({ plan, settings, hasBuilderBase }: { plan: PlanResult; settings: PlanSettings; hasBuilderBase: boolean }) {
  const homeCost = mergeCost(plan.builder.cost, plan.lab.cost, plan.pet.cost);
  const items = [
    { label: `Builders (${settings.builders})`, q: plan.builder, sub: `${formatDuration(plan.builder.baseWork)} of work` },
    { label: 'Laboratory', q: plan.lab, sub: `${formatDuration(plan.lab.baseWork)} of research` },
    { label: 'Pet House', q: plan.pet, sub: `${formatDuration(plan.pet.baseWork)} of pet upgrades` },
  ];
  const wallCost = Object.fromEntries(Object.entries(plan.instantCost).filter(([r]) => !r.startsWith('B'))) as Partial<Record<Res, number>>;
  const bbWallCost = Object.fromEntries(Object.entries(plan.instantCost).filter(([r]) => r.startsWith('B'))) as Partial<Record<Res, number>>;
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="card p-5">
        <h2 className="font-display text-xl tracking-wide">Queues</h2>
        <div className="mt-3 space-y-3">
          {items.map((i) => (
            <div key={i.label} className="flex items-baseline justify-between gap-3">
              <div>
                <div className="text-sm">{i.label}</div>
                <div className="text-xs text-muted">{i.sub}</div>
              </div>
              <div className="num font-display text-2xl tracking-wide">{i.q.makespan > 0 ? formatDuration(i.q.makespan) : '—'}</div>
            </div>
          ))}
          {hasBuilderBase && (
            <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
              <div>
                <div className="text-sm">Builder Base</div>
                <div className="text-xs text-muted">
                  builders {plan.builder2.makespan > 0 ? formatDuration(plan.builder2.makespan) : 'done'} · star lab{' '}
                  {plan.lab2.makespan > 0 ? formatDuration(plan.lab2.makespan) : 'done'}
                </div>
              </div>
              <div className="num font-display text-2xl tracking-wide">{plan.builderBaseTotal > 0 ? formatDuration(plan.builderBaseTotal) : '—'}</div>
            </div>
          )}
        </div>
      </div>
      <div className="card p-5">
        <h2 className="font-display text-xl tracking-wide">Resources needed</h2>
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <div className="mb-1 text-xs text-muted">Builders, lab & pets</div>
            <CostList cost={homeCost} />
            {Object.keys(homeCost).length === 0 && <span className="text-xs text-muted">Nothing left</span>}
          </div>
          {Object.keys(wallCost).length > 0 && (
            <div>
              <div className="mb-1 text-xs text-muted">Walls</div>
              <CostList cost={wallCost} />
            </div>
          )}
          {plan.ore.some((o) => o > 0) && (
            <div>
              <div className="mb-1 text-xs text-muted">Hero equipment ore</div>
              <p className="num text-xs">
                {formatCompact(plan.ore[0])} shiny · {formatCompact(plan.ore[1])} glowy · {formatCompact(plan.ore[2])} starry
              </p>
            </div>
          )}
          {hasBuilderBase && (Object.keys(plan.builder2.cost).length > 0 || Object.keys(bbWallCost).length > 0) && (
            <div>
              <div className="mb-1 text-xs text-muted">Builder Base</div>
              <CostList cost={mergeCost(plan.builder2.cost, plan.lab2.cost, bbWallCost)} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ProgressOverview({ sections }: { sections: { id: string; title: string; chains: Chain[] }[] }) {
  return (
    <section className="card p-5">
      <h2 className="font-display text-xl tracking-wide">Progress</h2>
      <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {sections.map((s) => {
          const p = progressOf(s.chains);
          return (
            <a key={s.id} href={`#${s.id}`} className="block rounded-lg p-1 hover:bg-surface-2/60">
              <div className="mb-1 flex justify-between text-sm">
                <span>{s.title}</span>
                <span className="num text-muted">{formatPercent(p.time)}</span>
              </div>
              <Bar value={p.time} tone={p.time >= 0.9999 ? 'ok' : 'accent'} />
            </a>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted">Progress is weighted by upgrade time, like most trackers: late levels count more than early ones.</p>
    </section>
  );
}

function Running({ chains, now }: { chains: Chain[]; now?: number }) {
  return (
    <section className="card p-5">
      <h2 className="font-display text-xl tracking-wide">Upgrading now</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {chains.map((c) => (
          <div key={c.id} className="num flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <span>
              {c.label} → {c.steps[0]?.supercharge ? `SC ${c.steps[0].level}` : c.steps[0]?.level}
            </span>
            <span className="text-info">
              {formatDuration(c.firstRemaining!)}
              {now && (
                <span className="ml-1 text-xs text-muted">
                  ({new Date((now + c.firstRemaining!) * 1000).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SuggestedOrder({ plan }: { plan: PlanResult }) {
  const lists = [
    { title: 'Builders', steps: plan.builder.timeline },
    { title: 'Laboratory', steps: plan.lab.timeline },
    { title: 'Pet House', steps: plan.pet.timeline },
  ]
    .map((l) => ({ ...l, steps: [...l.steps].filter((s) => s.start > 0 || s.chain.firstRemaining === undefined).sort((a, b) => a.start - b.start).slice(0, 8) }))
    .filter((l) => l.steps.length > 0);
  if (lists.length === 0) return null;
  return (
    <section className="card p-5">
      <h2 className="font-display text-xl tracking-wide">Suggested order</h2>
      <p className="mt-1 text-xs text-muted">Longest chains first keeps every builder busy until the end. Day = when to start.</p>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        {lists.map((l) => (
          <div key={l.title}>
            <h3 className="mb-1 text-sm font-semibold">{l.title}</h3>
            <ol className="space-y-1">
              {l.steps.map((s, i) => (
                <li key={i} className="num flex justify-between gap-2 text-xs">
                  <span className="truncate">
                    {s.chain.label} → {s.level}
                  </span>
                  <span className="shrink-0 text-muted">day {Math.floor(s.start / 86400)}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
