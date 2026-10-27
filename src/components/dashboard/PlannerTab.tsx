'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatDate, formatDateTime, formatDuration } from '@/lib/format';
import { ITEMS, itemByKey, itemMaxLevel } from '@/lib/gamedata';
import { SCENARIOS, planVillage, scenarioFlags, type Chain, type PlanSettings, type ScenarioId } from '@/lib/planner';
import type { Village } from '@/lib/village';
import { Timeline, type TimelineBar } from '../charts/Timeline';
import { Button, Segmented, Stepper } from '../ui/controls';
import { EmptyState, Panel } from '../ui/display';
import { ScenarioTable } from './ScenarioTable';
import { categoryOf, groupChains, inventoryHint, type ItemGroup } from './model';

export interface CustomUpgrade {
  id: string;
  key: string;
  level: number;
  count: number;
}

type QueueId = 'builder' | 'lab' | 'pet';
const QUEUES: { value: QueueId; label: string }[] = [
  { value: 'builder', label: 'Builders' },
  { value: 'lab', label: 'Laboratory' },
  { value: 'pet', label: 'Pet House' },
];
const CATEGORY_ORDER = ['hero', 'defense', 'trap', 'army', 'crafted', 'troop', 'dark', 'spell', 'siege', 'pet'];

export function PlannerTab({
  village,
  chains,
  settings,
  scenario,
  onScenario,
  now,
  custom,
  onCustom,
}: {
  village: Village;
  chains: Chain[];
  settings: PlanSettings;
  scenario: ScenarioId;
  onScenario: (id: ScenarioId) => void;
  now?: number;
  custom: CustomUpgrade[];
  onCustom: (c: CustomUpgrade[]) => void;
}) {
  const [queue, setQueue] = useState<QueueId>('builder');
  // null = everything in the queue is selected
  const [picked, setPicked] = useState<Record<QueueId, Set<string> | null>>({ builder: null, lab: null, pet: null });
  const [showAll, setShowAll] = useState(false);

  const groups = useMemo(() => {
    const list = groupChains(chains.filter((c) => c.base === 'home' && c.queue === queue && c.steps.length > 0));
    return list.sort((a, b) => {
      const ca = CATEGORY_ORDER.indexOf(categoryOf(a.chains[0]).id);
      const cb = CATEGORY_ORDER.indexOf(categoryOf(b.chains[0]).id);
      return ca - cb || a.label.localeCompare(b.label);
    });
  }, [chains, queue]);

  const selectedKeys = useMemo(() => picked[queue] ?? new Set(groups.map((g) => g.key)), [picked, queue, groups]);
  const selectedChains = useMemo(() => groups.filter((g) => selectedKeys.has(g.key)).flatMap((g) => g.chains), [groups, selectedKeys]);
  const plans = useMemo(
    () => Object.fromEntries(SCENARIOS.map((s) => [s.id, planVillage(selectedChains, settings, s.id)[queue]])) as Record<ScenarioId, ReturnType<typeof planVillage>['builder']>,
    [selectedChains, settings, queue],
  );
  const result = plans[scenario];
  const flags = scenarioFlags(scenario);

  const setSelection = (keys: Set<string> | null) => setPicked((p) => ({ ...p, [queue]: keys }));
  const toggle = (g: ItemGroup) => {
    const next = new Set(selectedKeys);
    if (next.has(g.key)) next.delete(g.key);
    else next.add(g.key);
    setSelection(next);
  };

  const goblinRow = queue === 'builder' && settings.goblinBuilder ? result.regularWorkers : -1;
  const rowLabel = (k: number) => {
    if (queue === 'lab') return k === 0 ? 'Laboratory' : 'Running';
    if (queue === 'pet') return k === 0 ? 'Pet House' : 'Running';
    if (k < result.regularWorkers) return `Builder ${k + 1}`;
    return k === goblinRow ? 'Goblin Builder' : 'Running';
  };
  const rows = Array.from({ length: Math.max(1, result.workerRows) }, (_, k) => rowLabel(k));
  const bars: TimelineBar[] = result.timeline.map((t, i) => ({
    key: `${t.chain.id}-${t.level}-${t.supercharge}-${i}`,
    row: t.worker,
    start: t.start,
    end: t.end,
    color: categoryOf(t.chain).color,
    label: `${t.chain.label} → ${t.supercharge ? 'supercharge ' : 'level '}${t.level}`,
    detail: [
      `${rowLabel(t.worker)} · ${formatDuration(t.end - t.start)}${t.jam ? ' · Hammer Jam' : ''}`,
      now ? `${formatDateTime(now + t.start)} → ${formatDateTime(now + t.end)}` : `Day ${Math.floor(t.start / 86400)} → ${Math.ceil(t.end / 86400)}`,
    ],
  }));
  const legend = [...new Map(result.timeline.map((t) => [categoryOf(t.chain).id, categoryOf(t.chain)])).values()]
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.id) - CATEGORY_ORDER.indexOf(b.id))
    .map((c) => ({ label: c.label, color: c.color }));
  const span = Math.max(plans.normal.makespan, result.makespan);
  const jam = flags.jam ? { start: settings.hammerJam.startDays * 86400, end: (settings.hammerJam.startDays + settings.hammerJam.days) * 86400 } : undefined;
  const schedule = showAll ? result.timeline : result.timeline.slice(0, 25);

  const byCategory = new Map<string, { label: string; groups: ItemGroup[] }>();
  for (const g of groups) {
    const cat = categoryOf(g.chains[0]);
    if (!byCategory.has(cat.id)) byCategory.set(cat.id, { label: cat.label, groups: [] });
    byCategory.get(cat.id)!.groups.push(g);
  }
  const workers =
    queue === 'builder'
      ? `${settings.builders} builder${settings.builders === 1 ? '' : 's'}${settings.goblinBuilder ? ` + Goblin Builder${settings.goblinDays ? ` (${settings.goblinDays}d)` : ''}` : ''}`
      : queue === 'lab'
        ? 'Laboratory'
        : 'Pet House';

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Panel
        title="What to upgrade"
        description={`${selectedKeys.size} of ${groups.length} selected`}
        bodyClassName="p-0"
        action={<Segmented label="Queue" value={queue} options={QUEUES} onChange={setQueue} />}
      >
        <div className="flex flex-wrap gap-1 border-b border-line px-4 py-2.5">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSelection(null)}>
            All
          </Button>
          {queue === 'builder' && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSelection(new Set(groups.filter((g) => g.item.kind === 'hero').map((g) => g.key)))}>
              Heroes only
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSelection(new Set(groups.filter((g) => g.chains.some((c) => c.firstRemaining !== undefined)).map((g) => g.key)))}>
            Upgrading now
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSelection(new Set())}>
            None
          </Button>
        </div>
        <div className="max-h-[560px] overflow-y-auto px-5 py-2">
          {groups.length === 0 && <p className="py-6 text-center text-[13px] text-ink-3">Nothing left to upgrade here.</p>}
          {[...byCategory.entries()].map(([id, cat]) => (
            <fieldset key={id} className="py-2">
              <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-3">{cat.label}</legend>
              {cat.groups.map((g) => {
                const n = g.chains.length;
                return (
                  <label key={g.key} className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1 text-[13px] hover:bg-hover">
                    <input type="checkbox" checked={selectedKeys.has(g.key)} onChange={() => toggle(g)} className="h-3.5 w-3.5 accent-[var(--brand)]" />
                    <span className="min-w-0 flex-1 truncate">{g.label}</span>
                    <span className="tnum text-xs text-ink-3">
                      {n > 1 ? `×${n} · ` : ''}
                      {g.chains[0].from}→{g.chains[0].scTo > 0 ? `SC${g.chains[0].scTo}` : g.chains[0].to}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>
        {queue === 'builder' && village.source === 'api' && <AddBuilding village={village} custom={custom} onCustom={onCustom} />}
      </Panel>

      <div className="min-w-0 space-y-4">
        <Panel title="Time for this plan" description={`${workers} · ${selectedChains.length} upgrade chain${selectedChains.length === 1 ? '' : 's'}`}>
          {selectedChains.length === 0 ? (
            <EmptyState title="Nothing selected">Pick upgrades on the left to see how long they take.</EmptyState>
          ) : (
            <ScenarioTable
              rows={SCENARIOS.map((s) => ({ id: s.id, label: s.label, time: plans[s.id].makespan, cost: plans[s.id].cost, hint: inventoryHint(settings, s.id) }))}
              active={scenario}
              onSelect={onScenario}
              now={now}
            />
          )}
        </Panel>

        {selectedChains.length > 0 && (
          <Panel
            title={`Schedule · ${SCENARIOS.find((s) => s.id === scenario)!.label}`}
            description={`Finished ${result.makespan > 0 ? `in ${formatDuration(result.makespan)}${now ? `, around ${formatDate(now + result.makespan)}` : ''}` : 'already'}. Hover or focus a bar for details.`}
          >
            <Timeline rows={rows} bars={bars} span={span} jam={jam} now={now} legend={legend} ariaLabel={`${workers} schedule`} />
          </Panel>
        )}

        {result.timeline.length > 0 && (
          <Panel title="Upgrade order" description="When each upgrade starts. The table matches the chart.">
            <div className="-mx-5 -my-2 overflow-x-auto">
              <table className="tnum w-full min-w-[560px] text-[13px]">
                <thead>
                  <tr className="text-left text-xs text-ink-3">
                    <th className="px-5 py-2 font-medium">Upgrade</th>
                    <th className="px-2 py-2 font-medium">Worker</th>
                    <th className="px-2 py-2 font-medium">Starts</th>
                    <th className="px-2 py-2 font-medium">Takes</th>
                    <th className="px-5 py-2 text-right font-medium">Done</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((t, i) => (
                    <tr key={`${t.chain.id}-${t.level}-${i}`} className="border-t border-line">
                      <td className="px-5 py-1.5">
                        <span className="inline-flex items-center gap-2">
                          <span aria-hidden className="h-2 w-2 rounded-sm" style={{ background: categoryOf(t.chain).color }} />
                          {t.chain.label}
                          <span className="text-ink-3">→ {t.supercharge ? `SC ${t.level}` : t.level}</span>
                          {t.jam && <span className="text-xs text-brand">HJ</span>}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-ink-2">{rowLabel(t.worker)}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-ink-2">{t.start === 0 ? 'Now' : now ? formatDateTime(now + t.start) : `Day ${Math.floor(t.start / 86400)}`}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-ink-2">{formatDuration(t.end - t.start)}</td>
                      <td className="whitespace-nowrap px-5 py-1.5 text-right text-ink">{now ? formatDateTime(now + t.end) : `Day ${Math.ceil(t.end / 86400)}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.timeline.length > 25 && (
              <div className="mt-3">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'Show fewer' : `Show all ${result.timeline.length}`}
                </Button>
              </div>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}

/** API profiles have no buildings: let people add the ones they plan to upgrade. */
function AddBuilding({ village, custom, onCustom }: { village: Village; custom: CustomUpgrade[]; onCustom: (c: CustomUpgrade[]) => void }) {
  const options = useMemo(
    () =>
      ITEMS.filter((i) => i.base === 'home' && i.queue === 'builder' && i.counts && i.kind !== 'wall' && itemMaxLevel(i, village.townHall) > 0).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [village.townHall],
  );
  const [key, setKey] = useState(options[0]?.key ?? '');
  const item = itemByKey(key);
  const max = item ? itemMaxLevel(item, village.townHall) : 1;
  const [level, setLevel] = useState(Math.max(0, max - 1));
  const [count, setCount] = useState(1);

  return (
    <div className="border-t border-line px-5 py-4">
      <h3 className="text-[13px] font-semibold">Add a building</h3>
      <p className="mt-0.5 text-xs text-ink-3">The API does not include buildings. Add the ones you are upgrading, or import your village.</p>
      <div className="mt-3 space-y-2">
        <select
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            const it = itemByKey(e.target.value);
            setLevel(it ? Math.max(0, itemMaxLevel(it, village.townHall) - 1) : 0);
          }}
          className="h-8 w-full rounded-lg border border-line bg-bg px-2 text-[13px]"
          aria-label="Building"
        >
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.name}
            </option>
          ))}
        </select>
        <div className="flex items-center justify-between gap-2 text-[13px]">
          <span className="text-ink-2">Current level</span>
          <Stepper label="Current level" value={Math.min(level, max)} max={max} onChange={setLevel} />
        </div>
        <div className="flex items-center justify-between gap-2 text-[13px]">
          <span className="text-ink-2">How many</span>
          <Stepper label="How many" value={count} min={1} max={20} onChange={setCount} />
        </div>
        <Button
          size="sm"
          className="w-full"
          disabled={!item || level >= max}
          onClick={() => onCustom([...custom, { id: crypto.randomUUID(), key, level: Math.min(level, max), count }])}
        >
          <Plus size={14} aria-hidden /> Add {count > 1 ? `${count} × ` : ''}
          {item?.name}
        </Button>
      </div>
      {custom.length > 0 && (
        <ul className="mt-3 space-y-1">
          {custom.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-md bg-raised px-2 py-1 text-[13px]">
              <span className="truncate">
                {c.count > 1 ? `${c.count} × ` : ''}
                {itemByKey(c.key)?.name ?? c.key} <span className="text-ink-3">from level {c.level}</span>
              </span>
              <button type="button" onClick={() => onCustom(custom.filter((x) => x.id !== c.id))} className="rounded p-1 text-ink-3 hover:text-critical" aria-label="Remove">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
