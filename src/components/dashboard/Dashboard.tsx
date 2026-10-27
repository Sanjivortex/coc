'use client';

import Link from 'next/link';
import { ChevronDown, FileUp, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useNow, useStoredJson, useStoredString } from '@/lib/client-store';
import { itemByKey } from '@/lib/gamedata';
import { formatDay, formatPercent } from '@/lib/format';
import {
  DAY,
  DEFAULT_SETTINGS,
  SCENARIOS,
  buildChains,
  defaultJamDates,
  customChains,
  planVillage,
  progressOf,
  type PlanResult,
  type PlanSettings,
  type ScenarioId,
} from '@/lib/planner';
import type { Village } from '@/lib/village';
import { Button, Segmented, Tabs } from '../ui/controls';
import { buttonClass } from '../ui/styles';
import { EmptyState, Panel } from '../ui/display';
import { BoostsPanel } from './BoostsPanel';
import { ItemDrawer } from './ItemDrawer';
import { ItemsTable } from './ItemsTable';
import { JamTab } from './JamTab';
import { OverviewTab } from './OverviewTab';
import { PlannerTab, type CustomUpgrade } from './PlannerTab';
import { TAB_SECTIONS, groupChains, inSection, sortGroups, type ItemGroup, type ListTabId, type TabId } from './model';

const SHORT: Record<ScenarioId, string> = {
  normal: 'Normal',
  items: 'Potions',
  gold: 'Gold Pass',
  jam: 'Hammer Jam',
  jamGold: 'HJ + Gold Pass',
  jamGoldItems: 'HJ + GP + Potions',
};

/** Facts an export tells us; the player's own planner choices still win when saved. */
function villageFacts(v: Village): Partial<PlanSettings> {
  if (v.source !== 'export') return {};
  return { builders: v.builders ?? DEFAULT_SETTINGS.builders, apprentice: v.helpers.apprentice, labAssistant: v.helpers.labAssistant };
}

type StoredJam = Partial<PlanSettings['hammerJam']> & { startDays?: number; days?: number };

/** Saved event dates, or 15 days from the start of today until the player enters the real ones. */
function resolveJam(j: StoredJam | undefined, today: number | null): PlanSettings['hammerJam'] {
  const discount = j?.discount ?? DEFAULT_SETTINGS.hammerJam.discount;
  if (j?.start && j.end && j.end > j.start) return { start: j.start, end: j.end, discount };
  if (today === null) return { ...DEFAULT_SETTINGS.hammerJam, discount };
  // Older saves kept "starts in N days, lasts M days".
  const start = today + (j?.startDays ?? 0) * DAY;
  return { start, end: start + (j?.days ?? 15) * DAY, discount };
}

export function Dashboard({ village, notice }: { village: Village; notice?: ReactNode }) {
  const [stored, setStored] = useStoredJson<Partial<PlanSettings>>(`coc-stats:v2:planner:${village.tag}`);
  const now = useNow() ?? undefined;
  const today = now === undefined ? null : defaultJamDates(now).start;
  const settings = useMemo<PlanSettings>(() => {
    const base = { ...DEFAULT_SETTINGS, ...villageFacts(village) };
    const s = stored ?? {};
    return { ...base, ...s, hammers: { ...base.hammers, ...s.hammers }, books: { ...base.books, ...s.books }, hammerJam: resolveJam(s.hammerJam, today) };
  }, [village, stored, today]);
  const [scenarioRaw, setScenario] = useStoredString('coc-stats:v2:scenario');
  const scenario: ScenarioId = SCENARIOS.some((s) => s.id === scenarioRaw) ? (scenarioRaw as ScenarioId) : 'normal';
  const [customStored, setCustom] = useStoredJson<CustomUpgrade[]>(`coc-stats:v2:custom:${village.tag}`);
  const custom = useMemo(() => (village.source === 'api' ? (customStored ?? []) : []), [village.source, customStored]);
  // Only exports have running timers to count down; API data does not change with the clock.
  const chainNow = village.timestamp ? now : undefined;
  const [tab, setTab] = useState<TabId>('overview');
  const [open, setOpen] = useState<ItemGroup | null>(null);
  const [boostsOpen, setBoostsOpen] = useState(false);

  const chains = useMemo(() => {
    const list = buildChains(village, { now: chainNow, includeSupercharge: settings.includeSupercharge, includeCrafted: settings.includeCrafted });
    for (const c of custom) {
      const item = itemByKey(c.key);
      if (item) list.push(...customChains(village, item, c.level, c.count, `custom:${c.id}`));
    }
    return list;
  }, [village, chainNow, settings.includeSupercharge, settings.includeCrafted, custom]);

  const plans = useMemo(
    () => Object.fromEntries(SCENARIOS.map((s) => [s.id, planVillage(chains, settings, s.id, now ?? 0)])) as Record<ScenarioId, PlanResult>,
    [chains, settings, now],
  );

  const remaining = (t: ListTabId) =>
    groupChains(chains.filter((c) => TAB_SECTIONS[t].some((s) => inSection(c, s)) && c.steps.length > 0)).length;
  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'heroes', label: 'Heroes', count: remaining('heroes') },
    { id: 'pets', label: 'Pets', count: remaining('pets') },
    { id: 'equipment', label: 'Equipment', count: remaining('equipment') },
    { id: 'lab', label: 'Laboratory', count: remaining('lab') },
    { id: 'buildings', label: 'Buildings', count: remaining('buildings') },
    ...(village.builderHall > 0 ? [{ id: 'builder' as const, label: 'Builder Base', count: remaining('builder') }] : []),
    { id: 'planner', label: 'Planner' },
    { id: 'jam', label: 'Hammer Jam' },
  ];
  const jamOver = now !== undefined && settings.hammerJam.end <= now;
  const summary = [
    `${settings.builders} builders${settings.goblinBuilder ? ' + Goblin' : ''}`,
    `GP ${Math.round(settings.goldPass * 100)}%`,
    `${settings.builderPotions} builder potions`,
    jamOver ? 'Hammer Jam over' : `HJ ${formatDay(settings.hammerJam.start)}–${formatDay(settings.hammerJam.end)}`,
  ].join(' · ');

  return (
    <div>
      {notice}
      <div className="sticky top-14 z-20 -mx-4 bg-bg/95 px-4 backdrop-blur sm:-mx-6 sm:px-6">
        <Tabs label="Sections" tabs={tabs.map((t) => ({ ...t, count: t.count || undefined }))} value={tab} onChange={setTab} />
      </div>

      {tab === 'jam' ? (
        <div className="h-4" />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex min-w-0 max-w-full items-center gap-3">
            <span className="shrink-0 text-xs text-ink-3">Scenario</span>
            <Segmented label="Scenario" value={scenario} options={SCENARIOS.map((s) => ({ value: s.id, label: SHORT[s.id] }))} onChange={(v) => setScenario(v)} />
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden truncate text-xs text-ink-3 xl:inline">{summary}</span>
            <Button size="sm" onClick={() => setBoostsOpen((v) => !v)} aria-expanded={boostsOpen}>
              <SlidersHorizontal size={14} aria-hidden />
              Boosts & inventory
              <ChevronDown size={14} aria-hidden className={`transition-transform ${boostsOpen ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        </div>
      )}
      {boostsOpen && tab !== 'jam' && (
        <div className="mb-4">
          <BoostsPanel settings={settings} onChange={setStored} showBuildingOptions={village.source === 'export'} />
        </div>
      )}

      {tab === 'overview' && <OverviewTab village={village} chains={chains} plans={plans} settings={settings} scenario={scenario} onScenario={setScenario} now={now} onTab={setTab} />}

      {tab !== 'overview' && tab !== 'planner' && tab !== 'jam' && (
        <div className="space-y-4">
          {TAB_SECTIONS[tab].map((section) => {
            const groups = sortGroups(groupChains(chains.filter((c) => inSection(c, section))));
            if (groups.length === 0) return null;
            const p = progressOf(groups.flatMap((g) => g.chains));
            const left = groups.filter((g) => g.chains.some((c) => c.steps.length > 0)).length;
            return (
              <Panel
                key={section.id}
                title={section.title}
                description={`${left === 0 ? 'All maxed' : `${left} of ${groups.length} to upgrade`} · ${formatPercent(p.time)} of upgrade time done`}
                bodyClassName="pb-1"
              >
                <ItemsTable groups={groups} scenario={scenario} settings={settings} now={now} onOpen={setOpen} />
              </Panel>
            );
          })}
          {tab === 'buildings' && village.source === 'api' && custom.length === 0 && (
            <Panel>
              <EmptyState icon={<FileUp size={22} />} title="Buildings are not in the Clash of Clans API">
                Copy your village in the game (Settings → More Settings → Data Export → Copy) and paste it once to see every defense, trap and wall,
                with live upgrade timers. Or add a few buildings by hand in the Planner.
                <div className="mt-4 flex justify-center gap-2">
                  <Link href="/tracker" className={buttonClass('primary', 'sm')}>
                    Import village
                  </Link>
                  <Button size="sm" onClick={() => setTab('planner')}>
                    Open Planner
                  </Button>
                </div>
              </EmptyState>
            </Panel>
          )}
        </div>
      )}

      {tab === 'planner' && (
        <PlannerTab village={village} chains={chains} settings={settings} scenario={scenario} onScenario={setScenario} now={now} custom={custom} onCustom={setCustom} />
      )}

      {tab === 'jam' && <JamTab village={village} chains={chains} settings={settings} onSettings={setStored} now={now} custom={custom} onCustom={setCustom} />}

      {(village.unknown.length > 0 || village.superTroops.length > 0) && tab === 'overview' && (
        <p className="mt-6 text-xs text-ink-3">
          {village.superTroops.length > 0 && <>Super troops: {village.superTroops.map((t) => `${t.name}${t.active ? ' (active)' : ''}`).join(', ')}. </>}
          {village.unknown.length > 0 && <>Not in our data yet: {village.unknown.join(', ')}.</>}
        </p>
      )}

      {open && <ItemDrawer key={open.key} group={open} settings={settings} onSettings={setStored} scenario={scenario} onScenario={setScenario} now={now} onClose={() => setOpen(null)} />}
    </div>
  );
}
