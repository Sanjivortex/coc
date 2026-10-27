'use client';

import { CalendarX, HardHat, TriangleAlert } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useStoredJson } from '@/lib/client-store';
import { formatDateTime, formatDuration } from '@/lib/format';
import type { Res } from '@/lib/gamedata';
import { planJam, type ChainOutcome, type Lane, type LaneStep } from '@/lib/jam';
import { DAY, type Chain, type PlanSettings } from '@/lib/planner';
import type { Village } from '@/lib/village';
import { Timeline, type TimelineBar } from '../charts/Timeline';
import { Button, DateInput, Field, Segmented, Stepper, Switch } from '../ui/controls';
import { Badge, CostList, EmptyState, Panel, Stat } from '../ui/display';
import { AddBuilding, type CustomUpgrade } from './PlannerTab';
import { categoryOf, groupChains, sortGroups, type ItemGroup } from './model';

/** Saved per account: what each builder sticks to during the event. */
interface JamChoices {
  /** Builder id → group key, 'auto' (longest upgrade left) or '' (nothing). */
  lanes?: Record<string, string>;
  goldPass?: boolean;
  /** Builder the Apprentice helps every day. */
  helper?: string;
}

const CATEGORY_ORDER = ['hero', 'defense', 'trap', 'army', 'crafted'];
const GOLD_OPTIONS = [
  { value: 0.1, label: '10%' },
  { value: 0.15, label: '15%' },
  { value: 0.2, label: '20%' },
];
const JAM_OPTIONS = [
  { value: 0.25, label: '25%' },
  { value: 0.3, label: '30%' },
  { value: 0.5, label: '50%' },
];

const laneName = (id: string) => (id === 'goblin' ? 'Goblin Builder' : `Builder ${id.slice(1)}`);

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-3">{title}</h3>
      <div className="divide-y divide-line/60">{children}</div>
    </div>
  );
}

/** "102" for a hero, "11×2 · 10" for copies of a building; after `outcomes` when given. */
function levelsText(chains: Chain[], outcomes?: Map<string, ChainOutcome>): string {
  const count = new Map<string, number>();
  for (const c of chains) {
    const st = outcomes?.get(c.id)?.last.step;
    const label = st ? (st.supercharge ? `${c.to} SC${st.level}` : String(st.level)) : c.scFrom > 0 ? `${c.from} SC${c.scFrom}` : String(c.from);
    count.set(label, (count.get(label) ?? 0) + 1);
  }
  return [...count.entries()]
    .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
    .map(([l, n]) => (n > 1 ? `${l}×${n}` : l))
    .join(' · ');
}

function costOf(steps: LaneStep[]): Partial<Record<Res, number>> {
  const out: Partial<Record<Res, number>> = {};
  for (const s of steps) if (s.paid > 0) out[s.step.res] = (out[s.step.res] ?? 0) + s.paid;
  return out;
}

function LaneSelect({
  id,
  value,
  categories,
  onChange,
}: {
  id: string;
  value: string;
  categories: { label: string; groups: ItemGroup[] }[];
  onChange: (id: string, value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(id, e.target.value)}
      className="h-8 w-full min-w-44 rounded-lg border border-line bg-bg px-2 text-[13px] sm:max-w-64"
      aria-label={`What ${laneName(id)} works on`}
    >
      <option value="">Nothing</option>
      <option value="auto">Auto: most work left</option>
      {categories.map((cat) => (
        <optgroup key={cat.label} label={cat.label}>
          {cat.groups.map((g) => (
            <option key={g.key} value={g.key}>
              {g.label}
              {g.chains.length > 1 ? ` ×${g.chains.length}` : ''} · {g.chains[0].from}→{g.chains[0].to}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function LaneBadges({ id, helper, apprentice, goblinDays }: { id: string; helper: string; apprentice: number; goblinDays: number }) {
  return (
    <>
      {apprentice > 0 && helper === id && (
        <Badge tone="info" icon={<HardHat size={10} />}>
          Apprentice
        </Badge>
      )}
      {id === 'goblin' && goblinDays > 0 && <span className="text-xs text-ink-3">{goblinDays} days</span>}
    </>
  );
}

const stepLabel = (s: LaneStep) => `${s.chain.label} → ${s.step.supercharge ? 'supercharge ' : 'level '}${s.step.level}`;

export function JamTab({
  village,
  chains,
  settings,
  onSettings,
  now,
  custom,
  onCustom,
}: {
  village: Village;
  chains: Chain[];
  settings: PlanSettings;
  onSettings: (s: PlanSettings) => void;
  now?: number;
  custom: CustomUpgrade[];
  onCustom: (c: CustomUpgrade[]) => void;
}) {
  const [stored, setStored] = useStoredJson<JamChoices>(`coc-stats:v2:jam:${village.tag}`);
  const [showAll, setShowAll] = useState(false);
  const choices = useMemo(() => stored ?? {}, [stored]);
  const jam = settings.hammerJam;
  const set = <K extends keyof PlanSettings>(key: K, value: PlanSettings[K]) => onSettings({ ...settings, [key]: value });
  const goldPass = choices.goldPass ?? true;

  const groups = useMemo(() => {
    const list = sortGroups(groupChains(chains.filter((c) => c.base === 'home' && c.queue === 'builder' && c.steps.length > 0)));
    // Stable sort: heroes stay in game order inside their category.
    return list.sort((a, b) => CATEGORY_ORDER.indexOf(categoryOf(a.chains[0]).id) - CATEGORY_ORDER.indexOf(categoryOf(b.chains[0]).id));
  }, [chains]);
  const byKey = useMemo(() => new Map(groups.map((g) => [g.key, g])), [groups]);
  const categories = useMemo(() => {
    const map = new Map<string, { label: string; groups: ItemGroup[] }>();
    for (const g of groups) {
      const cat = categoryOf(g.chains[0]);
      if (!map.has(cat.id)) map.set(cat.id, { label: cat.label, groups: [] });
      map.get(cat.id)!.groups.push(g);
    }
    return [...map.values()];
  }, [groups]);

  const laneIds = useMemo(
    () => [...Array.from({ length: settings.builders }, (_, i) => `b${i + 1}`), ...(settings.goblinBuilder ? ['goblin'] : [])],
    [settings.builders, settings.goblinBuilder],
  );

  // Saved choices first; free builders get the heroes in game order, then "auto" if buildings are known.
  const assignment = useMemo(() => {
    const out: Record<string, string> = {};
    const used = new Set<string>();
    for (const id of laneIds) {
      const v = choices.lanes?.[id];
      if (v === undefined || (v !== '' && v !== 'auto' && !byKey.has(v))) continue;
      out[id] = v;
      used.add(v);
    }
    const heroes = groups.filter((g) => g.item.kind === 'hero' && !used.has(g.key));
    const others = groups.some((g) => g.item.kind !== 'hero');
    for (const id of laneIds) if (!(id in out)) out[id] = heroes.shift()?.key ?? (others ? 'auto' : '');
    return out;
  }, [laneIds, choices.lanes, byKey, groups]);

  const helper = choices.helper && laneIds.includes(choices.helper) ? choices.helper : (laneIds.find((id) => assignment[id] !== '') ?? laneIds[0]);
  const valid = jam.end > jam.start;
  const over = now !== undefined && jam.end <= now;

  const result = useMemo(() => {
    if (now === undefined || !valid || over) return null;
    const lanes: Lane[] = laneIds.map((id) => {
      const a = assignment[id];
      return {
        id,
        chains: a && a !== 'auto' ? byKey.get(a)!.chains : [],
        auto: a === 'auto',
        until: id === 'goblin' && settings.goblinDays > 0 ? settings.goblinDays * DAY : undefined,
      };
    });
    const dedicated = new Set(lanes.flatMap((l) => l.chains.map((c) => c.id)));
    return planJam({
      now,
      jamStart: jam.start,
      jamEnd: jam.end,
      discount: jam.discount,
      goldPass: goldPass ? settings.goldPass : 0,
      potions: settings.builderPotions,
      apprentice: { level: settings.apprentice, lane: helper },
      lanes,
      pool: groups.flatMap((g) => g.chains).filter((c) => !dedicated.has(c.id)),
    });
  }, [now, valid, over, laneIds, assignment, byKey, groups, jam, goldPass, settings.goldPass, settings.builderPotions, settings.apprentice, settings.goblinDays, helper]);

  const setLane = (id: string, value: string) => setStored({ ...choices, lanes: { ...assignment, [id]: value } });
  const laneRows = laneIds.map((id, i) => {
    const value = assignment[id];
    const auto = value === 'auto';
    const lane = result?.lanes[i];
    const own = lane && !auto ? lane.chains : [];
    const done = result?.plan.lanes[i] ?? [];
    return {
      id,
      value,
      auto,
      done,
      normal: result?.normal.lanes[i] ?? [],
      last: done.reduce((m, s) => Math.max(m, s.end), 0),
      from: own.length > 0 ? levelsText(own) : '—',
      reach: !lane || value === '' ? '—' : auto ? `${done.length} upgrade${done.length === 1 ? '' : 's'}` : levelsText(own, result?.plan.outcomes),
      maxed: own.length > 0 && own.every((c) => (result?.plan.outcomes.get(c.id)?.done ?? 0) >= c.steps.length),
    };
  });
  const days = (jam.end - jam.start) / DAY;
  const status =
    now === undefined || !valid
      ? undefined
      : over
        ? 'This event is over'
        : now < jam.start
          ? `Starts in ${formatDuration(jam.start - now)} · ${formatDuration(jam.end - jam.start)} long`
          : `On now · ends in ${formatDuration(jam.end - now)}`;

  const origin = result?.origin ?? 0;
  const plan = result?.plan;
  const steps = plan ? [...plan.lanes.flatMap((list, i) => list.map((s) => ({ s, lane: laneIds[i] })))].sort((a, b) => a.s.start - b.s.start || a.s.end - b.s.end) : [];
  const listed = showAll ? steps : steps.slice(0, 25);

  const rows = [...laneIds.map(laneName), ...(plan?.extra.map((_, k) => `Other builder ${k + 1}`) ?? [])];
  const bar = (s: LaneStep, row: number, who: string, key: string): TimelineBar => ({
    key,
    row,
    start: s.start,
    end: s.end,
    color: s.running ? 'var(--series-muted)' : categoryOf(s.chain).color,
    label: stepLabel(s),
    detail: [
      `${who} · ${formatDuration(s.end - s.start)}${s.running ? ' · already running' : s.jam ? ' · Hammer Jam price' : ''}`,
      `${formatDateTime(origin + s.start)} → ${formatDateTime(origin + s.end)}`,
    ],
  });
  const bars: TimelineBar[] = plan
    ? [
        ...plan.lanes.flatMap((list, i) => list.map((s, k) => bar(s, i, laneName(laneIds[i]), `${laneIds[i]}-${k}`))),
        ...plan.extra.map((s, k) => bar(s, laneIds.length + k, 'Another builder', `extra-${k}`)),
      ]
    : [];
  const legendMap = new Map<string, { label: string; color: string }>();
  for (const b of plan ? [...plan.lanes.flat(), ...plan.extra] : []) {
    const c = b.running ? { id: 'running', label: 'Already running', color: 'var(--series-muted)' } : categoryOf(b.chain);
    legendMap.set(c.id, { label: c.label, color: c.color });
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Your Hammer Jam"
        description="Enter the event and your boosts. Each builder keeps upgrading the same thing: when one level is done, the next one starts."
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
          <Group title="Event">
            <Field label="Starts">
              <DateInput withTime label="Hammer Jam starts" value={jam.start} onChange={(v) => set('hammerJam', { ...jam, start: v })} />
            </Field>
            <Field label="Ends" hint={valid ? `${Math.round(days * 10) / 10} days` : 'Must be after the start'}>
              <DateInput withTime label="Hammer Jam ends" value={jam.end} onChange={(v) => set('hammerJam', { ...jam, end: v })} />
            </Field>
            <Field label="Discount" hint="Time and cost">
              <Segmented label="Hammer Jam discount" value={jam.discount} options={JAM_OPTIONS} onChange={(v) => set('hammerJam', { ...jam, discount: v })} />
            </Field>
            {status && <p className="pt-2 text-xs text-ink-3">{status}</p>}
          </Group>

          <Group title="Boosts">
            <Field label="Gold Pass" hint="Builder boost on time and cost">
              <Switch label="Gold Pass" checked={goldPass} onChange={(v) => setStored({ ...choices, goldPass: v })} />
            </Field>
            {goldPass && (
              <Field label="Builder boost">
                <Segmented label="Gold Pass builder boost" value={settings.goldPass} options={GOLD_OPTIONS} onChange={(v) => set('goldPass', v)} />
              </Field>
            )}
            <Field label="Builder Potions" hint="Used when the event starts">
              <Stepper label="Builder Potions" value={settings.builderPotions} onChange={(v) => set('builderPotions', v)} />
            </Field>
          </Group>

          <Group title="Builders">
            <Field label="Builders" hint="5 huts + B.O.B">
              <Stepper label="Builders" value={settings.builders} min={1} max={8} onChange={(v) => set('builders', v)} />
            </Field>
            <Field label="Goblin Builder">
              <Switch label="Goblin Builder" checked={settings.goblinBuilder} onChange={(v) => set('goblinBuilder', v)} />
            </Field>
            {settings.goblinBuilder && (
              <Field label="Goblin stays" hint="Days, 0 = whole event">
                <Stepper label="Goblin Builder days" value={settings.goblinDays} max={60} onChange={(v) => set('goblinDays', v)} />
              </Field>
            )}
            <Field label="Builder's Apprentice" hint="Level = hours a day">
              <Stepper label="Builder's Apprentice level" value={settings.apprentice} max={8} onChange={(v) => set('apprentice', v)} />
            </Field>
            {settings.apprentice > 0 && (
              <Field label="Apprentice helps">
                <select
                  value={helper}
                  onChange={(e) => setStored({ ...choices, helper: e.target.value })}
                  className="h-8 rounded-lg border border-line bg-bg px-2 text-[13px]"
                  aria-label="Builder the Apprentice helps"
                >
                  {laneIds.map((id) => (
                    <option key={id} value={id}>
                      {laneName(id)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </Group>
        </div>
      </Panel>

      {plan && result && (
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-xl border border-line bg-panel p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Levels during the event" value={`+${plan.levels}`} hint={`+${result.normal.levels} with the same builders, no event`} />
          <Stat label="Resources to start them" value={<CostList cost={plan.cost} nowrap />} hint={goldPass ? 'Hammer Jam + Gold Pass prices' : 'Hammer Jam prices'} />
          <Stat label="Saved on prices" value={<CostList cost={plan.saved} nowrap />} hint="Against normal prices" />
          <Stat
            label="Last upgrade done"
            value={plan.end > 0 ? formatDateTime(origin + plan.end) : '—'}
            hint={plan.end > jam.end - origin ? 'Started before the event ended' : 'Inside the event'}
          />
        </div>
      )}

      <Panel title="Builders" description="Pick what each builder works on. Levels are what it reaches with every upgrade it starts before the event ends." bodyClassName="p-0">
        {!valid ? (
          <EmptyState icon={<CalendarX size={22} />} title="Check the dates">
            The end of the event must be after its start.
          </EmptyState>
        ) : over ? (
          <EmptyState icon={<CalendarX size={22} />} title="This Hammer Jam is over">
            Enter the dates of the next one above to plan it.
          </EmptyState>
        ) : (
          <>
            <ul className="divide-y divide-line sm:hidden">
              {laneRows.map((r) => (
                <li key={r.id} className="space-y-2 px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-ink">{laneName(r.id)}</span>
                    <LaneBadges id={r.id} helper={helper} apprentice={settings.apprentice} goblinDays={settings.goblinDays} />
                  </div>
                  <LaneSelect id={r.id} value={r.value} categories={categories} onChange={setLane} />
                  {r.value !== '' && plan && (
                    <div className="tnum flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[13px]">
                      <span className="text-ink-2">
                        {r.auto ? 'Auto' : r.from} → <span className="font-medium text-ink">{r.reach}</span>
                      </span>
                      {r.maxed && <Badge tone="good">Max</Badge>}
                      <span className={r.done.length > 0 ? 'font-medium text-good' : 'text-ink-3'}>+{r.done.length}</span>
                      <span className="text-xs text-ink-3">+{r.normal.length} without the event</span>
                      {r.last > 0 && <span className="w-full text-xs text-ink-3">Last one done {formatDateTime(origin + r.last)}</span>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="tnum w-full min-w-[640px] text-[13px]">
                <thead>
                  <tr className="text-left text-xs text-ink-3">
                    <th className="px-5 py-2.5 font-medium">Builder</th>
                    <th className="px-2 py-2.5 font-medium">Works on</th>
                    <th className="px-2 py-2.5 font-medium">At the start</th>
                    <th className="px-2 py-2.5 font-medium">Reaches</th>
                    <th className="px-2 py-2.5 font-medium">Levels</th>
                    <th className="hidden px-2 py-2.5 font-medium md:table-cell">Last one done</th>
                    <th className="hidden px-5 py-2.5 text-right font-medium lg:table-cell">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {laneRows.map((r) => (
                    <tr key={r.id} className="border-t border-line align-top">
                      <td className="whitespace-nowrap px-5 py-2.5">
                        <span className="font-medium text-ink">{laneName(r.id)}</span>
                        <span className="mt-0.5 flex flex-wrap gap-1">
                          <LaneBadges id={r.id} helper={helper} apprentice={settings.apprentice} goblinDays={settings.goblinDays} />
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <LaneSelect id={r.id} value={r.value} categories={categories} onChange={setLane} />
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-ink-2">{r.from}</td>
                      <td className="whitespace-nowrap px-2 py-2.5 font-medium text-ink">
                        {r.reach}
                        {r.maxed && (
                          <span className="ml-2 align-middle">
                            <Badge tone="good">Max</Badge>
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5">
                        {r.value === '' || !plan ? (
                          <span className="text-ink-3">—</span>
                        ) : (
                          <>
                            <span className={r.done.length > 0 ? 'font-medium text-good' : 'text-ink-3'}>+{r.done.length}</span>
                            <span className="block text-xs text-ink-3">+{r.normal.length} without the event</span>
                          </>
                        )}
                      </td>
                      <td className="hidden whitespace-nowrap px-2 py-2.5 text-ink-2 md:table-cell">
                        {r.last > 0 ? formatDateTime(origin + r.last) : r.value !== '' && plan ? <span className="text-ink-3">Nothing to do</span> : '—'}
                      </td>
                      <td className="hidden whitespace-nowrap px-5 py-2.5 text-right text-ink-2 lg:table-cell">
                        <CostList cost={costOf(r.done)} nowrap />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {plan && plan.extra.length > 0 && (
          <p className="flex gap-2 border-t border-line px-5 py-3 text-xs text-ink-2">
            <TriangleAlert size={14} className="mt-px shrink-0 text-warning" aria-hidden />
            <span>
              Still running when the event starts, on a builder not listed above:{' '}
              {plan.extra.map((s) => `${stepLabel(s)} (done ${formatDateTime(origin + s.end)})`).join(', ')}. In the game they keep a builder busy, so give
              that builder this upgrade or expect fewer levels.
            </span>
          </p>
        )}
        {village.source === 'api' && (
          <details className="border-t border-line">
            <summary className="cursor-pointer px-5 py-3 text-[13px] text-ink-2 hover:text-ink">Add a building the Clash of Clans API does not show</summary>
            <div className="max-w-sm">
              <AddBuilding village={village} custom={custom} onCustom={onCustom} />
            </div>
          </details>
        )}
      </Panel>

      {plan && plan.levels > 0 && (
        <Panel title="Schedule" description="Hover or focus a bar for details. The shaded band is the event.">
          <Timeline
            rows={rows}
            bars={bars}
            span={Math.max(plan.end, jam.end - origin)}
            jam={{ start: jam.start - origin, end: jam.end - origin }}
            now={origin}
            legend={[...legendMap.values()]}
            ariaLabel="Builders during Hammer Jam"
          />
        </Panel>
      )}

      {steps.length > 0 && (
        <Panel title="Upgrade order" description="Start each one as soon as the builder is free. The table matches the chart.">
          <div className="-mx-5 -my-2 overflow-x-auto">
            <table className="tnum w-full min-w-[600px] text-[13px]">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th className="px-5 py-2 font-medium">Upgrade</th>
                  <th className="px-2 py-2 font-medium">Builder</th>
                  <th className="px-2 py-2 font-medium">Starts</th>
                  <th className="px-2 py-2 font-medium">Takes</th>
                  <th className="px-2 py-2 font-medium">Done</th>
                  <th className="px-5 py-2 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {listed.map(({ s, lane }, k) => (
                  <tr key={`${lane}-${k}-${s.chain.id}-${s.step.level}`} className="border-t border-line">
                    <td className="whitespace-nowrap px-5 py-1.5">
                      <span className="inline-flex items-center gap-2">
                        <span aria-hidden className="h-2 w-2 rounded-sm" style={{ background: s.running ? 'var(--series-muted)' : categoryOf(s.chain).color }} />
                        {s.chain.label}
                        <span className="text-ink-3">→ {s.step.supercharge ? `SC ${s.step.level}` : s.step.level}</span>
                        {s.jam && <span className="text-xs text-brand">HJ</span>}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-ink-2">{laneName(lane)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-ink-2">{s.running ? 'Running' : formatDateTime(origin + s.start)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-ink-2">{formatDuration(s.end - s.start)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-ink">{formatDateTime(origin + s.end)}</td>
                    <td className="whitespace-nowrap px-5 py-1.5 text-right text-ink-2">{s.running ? 'paid' : <CostList cost={{ [s.step.res]: s.paid }} nowrap />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {steps.length > 25 && (
            <div className="mt-3">
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show fewer' : `Show all ${steps.length}`}
              </Button>
            </div>
          )}
        </Panel>
      )}

      <p className="text-xs text-ink-3">
        Builders start when the event starts and potions are used right away. Hammer Jam prices apply to every upgrade started before the event ends, so
        the last ones can finish later. Books and Hammers are left out: they are worth less while upgrade times are halved.
      </p>
    </div>
  );
}
