'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { formatCompact, formatDate, formatDateTime, formatDuration } from '@/lib/format';
import { KIND_LABEL } from '@/lib/gamedata';
import { SCENARIOS, applyMagicItems, limitChain, scenarioFlags, simulateChain, type PlanSettings, type ScenarioId } from '@/lib/planner';
import { Timeline, type TimelineBar } from '../charts/Timeline';
import { Field, Segmented, Stepper } from '../ui/controls';
import { Drawer } from '../ui/Drawer';
import { Badge, CostList, Ore } from '../ui/display';
import { ScenarioTable } from './ScenarioTable';
import { groupImage, groupStats, inventoryHint, isTimed, levelText, type ItemGroup } from './model';

const POTIONS = {
  builder: { key: 'builderPotions', label: 'Builder Potions', hint: '≈ 9h each while it upgrades' },
  lab: { key: 'researchPotions', label: 'Research Potions', hint: '≈ 23h each' },
  pet: { key: 'petPotions', label: 'Pet Potions', hint: '≈ 23h each' },
} as const;
const HELPERS = {
  builder: { key: 'apprentice', label: "Builder's Apprentice", max: 8 },
  lab: { key: 'labAssistant', label: 'Lab Assistant', max: 12 },
} as const;

export function ItemDrawer({
  group,
  settings,
  onSettings,
  scenario,
  onScenario,
  now,
  onClose,
}: {
  group: ItemGroup;
  settings: PlanSettings;
  onSettings: (s: PlanSettings) => void;
  scenario: ScenarioId;
  onScenario: (id: ScenarioId) => void;
  now?: number;
  onClose: () => void;
}) {
  const item = group.item;
  const stats = groupStats(group);
  const img = groupImage(group, stats);
  const instances = useMemo(() => [...group.chains].sort((a, b) => b.remainingTime - a.remainingTime), [group]);
  const [instanceId, setInstanceId] = useState(instances[0].id);
  const [target, setTarget] = useState<number | null>(null);
  const chain = instances.find((c) => c.id === instanceId) ?? instances[0];
  const steps = target === null ? chain.steps.length : Math.min(target, chain.steps.length);
  const limited = useMemo(() => limitChain(chain, steps), [chain, steps]);
  const boosted = isTimed(item) && item.base === 'home';
  const queue = item.queue as 'builder' | 'lab' | 'pet';

  const results = useMemo(
    () => (isTimed(item) ? SCENARIOS.map((s) => ({ ...s, res: simulateChain(limited, settings, s.id) })) : []),
    [item, limited, settings],
  );
  const activeId = boosted ? scenario : 'normal';
  const active = results.find((r) => r.id === activeId);
  const normal = results.find((r) => r.id === 'normal');
  const flags = scenarioFlags(activeId);
  const applied = useMemo(() => (flags.items ? applyMagicItems([limited], settings)[0] : limited), [flags.items, limited, settings]);

  const rowLabel = (st: { level: number; supercharge?: boolean }) => (st.supercharge ? `SC ${st.level}` : `Lv ${st.level}`);
  const entryFor = (timeline: { level: number; supercharge: boolean }[] | undefined, st: { level: number; supercharge?: boolean }) =>
    timeline?.find((t) => t.level === st.level && t.supercharge === !!st.supercharge) as
      | { start: number; end: number; jam: boolean; level: number; supercharge: boolean }
      | undefined;

  const bars: TimelineBar[] = (active?.res.timeline ?? []).map((t) => {
    const row = limited.steps.findIndex((st) => st.level === t.level && !!st.supercharge === t.supercharge);
    return {
      key: `${t.level}-${t.supercharge}`,
      row,
      start: t.start,
      end: t.end,
      color: 'var(--series-1)',
      label: `${group.label} → ${rowLabel(limited.steps[row])}`,
      detail: [
        `${formatDuration(t.end - t.start)}${t.jam ? ' · started in Hammer Jam' : ''}`,
        now ? `${formatDateTime(now + t.start)} → ${formatDateTime(now + t.end)}` : `Day ${Math.floor(t.start / 86400)} → ${Math.ceil(t.end / 86400)}`,
      ],
    };
  });
  const span = Math.max(normal?.res.makespan ?? 0, active?.res.makespan ?? 0);
  const jam = flags.jam ? { start: settings.hammerJam.startDays * 86400, end: (settings.hammerJam.startDays + settings.hammerJam.days) * 86400 } : undefined;
  const gp = flags.gold && queue !== 'pet' ? 1 - settings.goldPass : 1;

  const setNum = (key: keyof PlanSettings, v: number) => onSettings({ ...settings, [key]: v });
  const scenarioLabel = SCENARIOS.find((s) => s.id === activeId)!.label;

  return (
    <Drawer
      onClose={onClose}
      title={group.label}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            {KIND_LABEL[item.kind]}
            {item.base === 'builder' && ' · Builder Base'}
          </span>
          <span aria-hidden>·</span>
          <span className="tnum">
            Level {levelText(stats)} of {stats.target}
          </span>
          {stats.rushed && <Badge tone="critical">Below last TH max</Badge>}
          {stats.maxed && <Badge tone="good">Max for this hall</Badge>}
        </span>
      }
      icon={<span className="relative mt-0.5 h-12 w-12 shrink-0">{img && <Image src={img} alt="" fill sizes="48px" className="object-contain" />}</span>}
    >
      <div className="space-y-7 p-5">
        {limited.steps.length > 0 && (
          <section className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
            {instances.length > 1 && (
              <Field label="Which one">
                <select
                  value={chain.id}
                  onChange={(e) => {
                    setInstanceId(e.target.value);
                    setTarget(null);
                  }}
                  className="h-8 rounded-lg border border-line bg-bg px-2 text-[13px]"
                >
                  {instances.map((c, i) => (
                    <option key={c.id} value={c.id}>
                      #{i + 1} · level {c.from}
                      {c.firstRemaining !== undefined ? ' (upgrading)' : ''}
                      {c.missing ? ' (not built)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Upgrade to">
              <select
                value={steps}
                onChange={(e) => setTarget(Number(e.target.value))}
                className="tnum h-8 rounded-lg border border-line bg-bg px-2 text-[13px]"
                aria-label="Target level"
              >
                {chain.steps.map((st, k) => (
                  <option key={`${st.level}-${st.supercharge}`} value={k + 1}>
                    {st.supercharge ? `Supercharge ${st.level}` : `Level ${st.level}`}
                    {k === chain.steps.length - 1 ? ' (max)' : ''}
                  </option>
                ))}
              </select>
            </Field>
            {boosted && (
              <>
                <Field label={POTIONS[queue].label} hint={POTIONS[queue].hint}>
                  <Stepper label={POTIONS[queue].label} value={settings[POTIONS[queue].key]} onChange={(v) => setNum(POTIONS[queue].key, v)} />
                </Field>
                {queue !== 'pet' && (
                  <Field label={HELPERS[queue].label} hint="Level = hours saved per day">
                    <Stepper label={HELPERS[queue].label} value={settings[HELPERS[queue].key]} max={HELPERS[queue].max} onChange={(v) => setNum(HELPERS[queue].key, v)} />
                  </Field>
                )}
                {queue !== 'pet' && (
                  <Field label="Gold Pass boost">
                    <Segmented
                      label="Gold Pass boost"
                      value={settings.goldPass}
                      onChange={(v) => setNum('goldPass', v)}
                      options={[
                        { value: 0.1, label: '10%' },
                        { value: 0.15, label: '15%' },
                        { value: 0.2, label: '20%' },
                      ]}
                    />
                  </Field>
                )}
                <Field label="Hammer Jam" hint="Starts in · lasts (days)">
                  <span className="flex gap-1.5">
                    <Stepper label="Hammer Jam starts in days" value={settings.hammerJam.startDays} max={365} onChange={(v) => onSettings({ ...settings, hammerJam: { ...settings.hammerJam, startDays: v } })} />
                    <Stepper label="Hammer Jam length in days" value={settings.hammerJam.days} min={1} max={60} onChange={(v) => onSettings({ ...settings, hammerJam: { ...settings.hammerJam, days: v } })} />
                  </span>
                </Field>
              </>
            )}
          </section>
        )}

        {boosted && limited.steps.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold">
              Time to {limited.scTo > 0 ? `supercharge ${limited.scTo}` : `level ${limited.to}`}
            </h3>
            <ScenarioTable
              rows={results.map((r) => ({ id: r.id, label: r.label, time: r.res.makespan, cost: r.res.cost, hint: inventoryHint(settings, r.id, 'above') }))}
              active={scenario}
              onSelect={onScenario}
              now={now}
            />
            <p className="mt-2 text-xs text-ink-3">
              Potions & items uses your inventory on this upgrade only. Hammer Jam discounts upgrades that start during the event; potions are used when it starts.
            </p>
          </section>
        )}

        {isTimed(item) && limited.steps.length > 0 && active && (
          <section>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">Upgrade timeline · {scenarioLabel}</h3>
              <span className="tnum text-[13px] text-ink-2">
                {formatDuration(active.res.makespan)}
                {now && ` · done ${formatDate(now + active.res.makespan)}`}
              </span>
            </div>
            <Timeline
              rows={limited.steps.map(rowLabel)}
              bars={bars}
              span={span}
              jam={jam}
              now={now}
              ariaLabel={`${group.label} upgrade timeline, ${scenarioLabel}`}
            />
          </section>
        )}

        {limited.steps.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold">Level by level</h3>
            <div className="-mx-5 overflow-x-auto">
              <table className="tnum w-full min-w-[520px] text-[13px]">
                <thead>
                  <tr className="text-left text-xs text-ink-3">
                    <th className="px-5 pb-2 font-medium">Level</th>
                    {isTimed(item) && <th className="px-2 pb-2 font-medium">Normal</th>}
                    {boosted && activeId !== 'normal' && <th className="px-2 pb-2 font-medium">{scenarioLabel}</th>}
                    {isTimed(item) && <th className="px-2 pb-2 font-medium">Done</th>}
                    <th className="px-5 pb-2 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {limited.steps.map((st, k) => {
                    const running = k === 0 && limited.firstRemaining !== undefined;
                    const base = entryFor(normal?.res.timeline, st);
                    const cur = entryFor(active?.res.timeline, st);
                    const skipped = applied.steps[k] && applied.steps[k].time === 0 && st.time > 0 && !running;
                    const factor = gp * (cur?.jam ? 1 - settings.hammerJam.discount : 1);
                    const cost = skipped && applied.steps[k].cost === 0 ? 0 : st.cost * limited.count * factor;
                    return (
                      <tr key={`${st.level}-${st.supercharge}`} className="border-t border-line">
                        <td className="whitespace-nowrap px-5 py-1.5 text-ink">
                          {st.supercharge ? `Supercharge ${st.level}` : st.level}
                          {running && <span className="ml-2 text-xs text-info">upgrading</span>}
                        </td>
                        {isTimed(item) && (
                          <td className="whitespace-nowrap px-2 py-1.5 text-ink-2">{running ? `${formatDuration(limited.firstRemaining!)} left` : base ? formatDuration(base.end - base.start) : formatDuration(st.time)}</td>
                        )}
                        {boosted && activeId !== 'normal' && (
                          <td className="whitespace-nowrap px-2 py-1.5 text-ink">
                            {skipped ? <span className="text-good">{applied.steps[k].cost === 0 ? 'Hammer' : 'Book'}</span> : cur ? formatDuration(cur.end - cur.start) : '—'}
                            {cur?.jam && <span className="ml-1.5 text-xs text-brand">HJ</span>}
                          </td>
                        )}
                        {isTimed(item) && <td className="whitespace-nowrap px-2 py-1.5 text-ink-2">{cur && now ? formatDate(now + cur.end) : cur ? `day ${Math.ceil(cur.end / 86400)}` : '—'}</td>}
                        <td className="whitespace-nowrap px-5 py-1.5 text-right text-ink-2">
                          {st.ore ? (
                            <Ore ore={[st.ore[0] * limited.count, st.ore[1] * limited.count, st.ore[2] * limited.count]} />
                          ) : running ? (
                            'paid'
                          ) : cost === 0 ? (
                            'free'
                          ) : (
                            <CostList cost={{ [st.res]: cost }} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!isTimed(item) && (
              <p className="mt-2 text-xs text-ink-3">
                {item.queue === 'blacksmith' ? 'Equipment upgrades are instant; ore is the only limit.' : 'Walls upgrade instantly; resources are the only limit.'}
                {stats.count > 1 && ` Costs are for all ${formatCompact(limited.count)} at this level.`}
              </p>
            )}
          </section>
        )}

        {limited.steps.length === 0 && <p className="text-sm text-ink-2">This one is maxed for the current hall level.</p>}
      </div>
    </Drawer>
  );
}
