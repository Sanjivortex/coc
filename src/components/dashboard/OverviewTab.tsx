'use client';

import Link from 'next/link';
import { ArrowRight, FileUp, Hourglass } from 'lucide-react';
import { formatCompact, formatDate, formatDateTime, formatDuration, formatPercent } from '@/lib/format';
import type { Res } from '@/lib/gamedata';
import { SCENARIOS, progressOf, type Chain, type PlanResult, type PlanSettings, type ScenarioId } from '@/lib/planner';
import type { Village } from '@/lib/village';
import { buttonClass } from '../ui/styles';
import { CostList, Panel, ProgressBar } from '../ui/display';
import { ScenarioTable } from './ScenarioTable';
import { TAB_SECTIONS, inSection, inventoryHint, type TabId } from './model';

function mergeCost(...costs: Partial<Record<Res, number>>[]): Partial<Record<Res, number>> {
  const out: Partial<Record<Res, number>> = {};
  for (const c of costs) for (const [r, v] of Object.entries(c) as [Res, number][]) out[r] = (out[r] ?? 0) + v;
  return out;
}

const PROGRESS_ROWS: { tab: Exclude<TabId, 'overview' | 'planner'>; title: string }[] = [
  { tab: 'heroes', title: 'Heroes' },
  { tab: 'pets', title: 'Pets' },
  { tab: 'equipment', title: 'Hero equipment' },
  { tab: 'lab', title: 'Laboratory' },
  { tab: 'buildings', title: 'Buildings' },
  { tab: 'builder', title: 'Builder Base' },
];

export function OverviewTab({
  village,
  chains,
  plans,
  settings,
  scenario,
  onScenario,
  now,
  onTab,
}: {
  village: Village;
  chains: Chain[];
  plans: Record<ScenarioId, PlanResult>;
  settings: PlanSettings;
  scenario: ScenarioId;
  onScenario: (id: ScenarioId) => void;
  now?: number;
  onTab: (t: TabId) => void;
}) {
  const p = plans[scenario];
  const queues = [
    { label: 'Builders', q: p.builder, work: 'of builder work' },
    { label: 'Laboratory', q: p.lab, work: 'of research' },
    { label: 'Pet House', q: p.pet, work: 'of pet upgrades' },
  ];
  const slowest = [...queues].sort((a, b) => b.q.makespan - a.q.makespan)[0];
  const running = chains.filter((c) => c.firstRemaining !== undefined).sort((a, b) => a.firstRemaining! - b.firstRemaining!);
  const homeCost = mergeCost(p.builder.cost, p.lab.cost, p.pet.cost);
  const wallCost = Object.fromEntries(Object.entries(p.instantCost).filter(([r]) => !r.startsWith('B')));
  const label = SCENARIOS.find((s) => s.id === scenario)!.label;
  const progress = PROGRESS_ROWS.map((r) => ({ ...r, chains: chains.filter((c) => TAB_SECTIONS[r.tab].some((s) => inSection(c, s))) })).filter(
    (r) => r.chains.length > 0,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel>
          <p className="text-[13px] text-ink-3">
            Time to max Town Hall {village.townHall} · {label}
          </p>
          <p className="mt-2 text-5xl font-semibold tracking-tight">{p.homeTotal > 0 ? formatDuration(p.homeTotal) : 'Maxed'}</p>
          {p.homeTotal > 0 && (
            <p className="mt-2 text-[13px] text-ink-2">
              {now && <>Done around {formatDate(now + p.homeTotal)} · </>}
              slowest is the {slowest.label.toLowerCase()}
            </p>
          )}
          <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-4">
            {queues.map((x) => (
              <div key={x.label} className="min-w-0">
                <dt className="truncate text-xs text-ink-3">{x.label}</dt>
                <dd className="tnum mt-1 text-base font-semibold">{x.q.makespan > 0 ? formatDuration(x.q.makespan) : 'Done'}</dd>
                <dd className="tnum truncate text-xs text-ink-3">
                  {formatDuration(x.q.baseWork)} {x.work}
                </dd>
              </div>
            ))}
          </dl>
          {village.source === 'api' && (
            <p className="mt-4 rounded-lg border border-line bg-raised px-3 py-2 text-xs text-ink-2">
              Heroes, pets and lab only. The API does not include buildings; import your village to add them.
            </p>
          )}
        </Panel>

        <Panel title="Scenarios" description="Click one to use it on every tab. Builders and helpers count in all of them.">
          <ScenarioTable
            rows={SCENARIOS.map((s) => ({
              id: s.id,
              label: s.label,
              time: plans[s.id].homeTotal,
              cost: mergeCost(plans[s.id].builder.cost, plans[s.id].lab.cost, plans[s.id].pet.cost),
              hint: inventoryHint(settings, s.id),
            }))}
            active={scenario}
            onSelect={onScenario}
            now={now}
          />
        </Panel>
      </div>

      {running.length > 0 && (
        <Panel title="Upgrading now" description={village.timestamp ? `From your village export, counted down to now.` : undefined}>
          <div className="-mx-5 -my-2 overflow-x-auto">
            <table className="tnum w-full min-w-[520px] text-[13px]">
              <tbody>
                {running.map((c) => {
                  const st = c.steps[0];
                  const done = st.time > 0 ? 1 - c.firstRemaining! / st.time : 0;
                  return (
                    <tr key={c.id} className="border-t border-line first:border-t-0">
                      <td className="px-5 py-2.5">
                        <span className="inline-flex items-center gap-2 font-medium">
                          <Hourglass size={14} className="text-info" aria-hidden />
                          {c.label}
                        </span>
                        <span className="ml-2 text-ink-3">→ {st.supercharge ? `supercharge ${st.level}` : `level ${st.level}`}</span>
                      </td>
                      <td className="w-40 px-2 py-2.5">
                        <ProgressBar value={done} label={`${c.label} upgrade progress`} />
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right text-ink">{formatDuration(c.firstRemaining!)} left</td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-right text-ink-3">{now ? formatDateTime(now + c.firstRemaining!) : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Progress" description="Share of upgrade time done for this hall level.">
          <div className="space-y-1">
            {progress.map((r) => {
              const pr = progressOf(r.chains);
              return (
                <button key={r.tab} type="button" onClick={() => onTab(r.tab)} className="group block w-full rounded-md px-2 py-1.5 text-left hover:bg-hover">
                  <span className="mb-1.5 flex items-center justify-between text-[13px]">
                    <span className="text-ink">{r.title}</span>
                    <span className="tnum inline-flex items-center gap-1 text-ink-2">
                      {formatPercent(pr.time)}
                      <ArrowRight size={13} className="text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                    </span>
                  </span>
                  <ProgressBar value={pr.time} done={pr.time >= 0.9999} label={`${r.title} progress`} />
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel title="Resources needed" description={label}>
          <dl className="space-y-4 text-[13px]">
            <div>
              <dt className="mb-1 text-xs text-ink-3">Builders, laboratory and pets</dt>
              <dd>
                <CostList cost={homeCost} empty="Nothing left" />
              </dd>
            </div>
            {Object.keys(wallCost).length > 0 && (
              <div>
                <dt className="mb-1 text-xs text-ink-3">Walls</dt>
                <dd>
                  <CostList cost={wallCost} />
                </dd>
              </div>
            )}
            {p.ore.some((o) => o > 0) && (
              <div>
                <dt className="mb-1 text-xs text-ink-3">Hero equipment ore</dt>
                <dd className="tnum">
                  {formatCompact(p.ore[0])} <span className="text-ink-3">Shiny</span> · {formatCompact(p.ore[1])} <span className="text-ink-3">Glowy</span> ·{' '}
                  {formatCompact(p.ore[2])} <span className="text-ink-3">Starry</span>
                </dd>
              </div>
            )}
            {p.builderBaseTotal > 0 && (
              <div>
                <dt className="mb-1 text-xs text-ink-3">Builder Base · {formatDuration(p.builderBaseTotal)}</dt>
                <dd>
                  <CostList cost={mergeCost(p.builder2.cost, p.lab2.cost, Object.fromEntries(Object.entries(p.instantCost).filter(([r]) => r.startsWith('B'))))} />
                </dd>
              </div>
            )}
          </dl>
        </Panel>
      </div>

      {village.source === 'api' && (
        <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-line bg-panel p-5 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-sm font-semibold">Add defenses, walls and live upgrade timers</h3>
            <p className="mt-1 text-[13px] text-ink-3">In the game: Settings → More Settings → Data Export → Copy, then paste it once. It stays in this browser.</p>
          </div>
          <Link href="/tracker" className={buttonClass('primary', 'md', 'shrink-0')}>
            <FileUp size={16} aria-hidden /> Import village
          </Link>
        </div>
      )}
    </div>
  );
}
