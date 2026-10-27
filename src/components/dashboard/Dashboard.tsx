'use client';

import Link from 'next/link';
import { ChevronDown, FileUp, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useNow, useStoredJson, useStoredString } from '@/lib/client-store';
import { itemByKey } from '@/lib/gamedata';
import { formatPercent } from '@/lib/format';
import {
  DEFAULT_SETTINGS,
  SCENARIOS,
  buildChains,
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
import { OverviewTab } from './OverviewTab';
import { PlannerTab, type CustomUpgrade } from './PlannerTab';
import { TAB_SECTIONS, groupChains, inSection, sortGroups, type ItemGroup, type TabId } from './model';

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

export function Dashboard({ village, notice }: { village: Village; notice?: ReactNode }) {
  const [stored, setStored] = useStoredJson<Partial<PlanSettings>>(`coc-stats:v2:planner:${village.tag}`);
  const settings = useMemo<PlanSettings>(() => {
    const base = { ...DEFAULT_SETTINGS, ...villageFacts(village) };
    const s = stored ?? {};
    return { ...base, ...s, hammers: { ...base.hammers, ...s.hammers }, books: { ...base.books, ...s.books }, hammerJam: { ...base.hammerJam, ...s.hammerJam } };
  }, [village, stored]);
  const [scenarioRaw, setScenario] = useStoredString('coc-stats:v2:scenario');
  const scenario: ScenarioId = SCENARIOS.some((s) => s.id === scenarioRaw) ? (scenarioRaw as ScenarioId) : 'normal';
  const [customStored, setCustom] = useStoredJson<CustomUpgrade[]>(`coc-stats:v2:custom:${village.tag}`);
  const custom = useMemo(() => (village.source === 'api' ? (customStored ?? []) : []), [village.source, customStored]);
  const now = useNow() ?? undefined;
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
    () => Object.fromEntries(SCENARIOS.map((s) => [s.id, planVillage(chains, settings, s.id)])) as Record<ScenarioId, PlanResult>,
    [chains, settings],
  );

  const remaining = (t: Exclude<TabId, 'overview' | 'planner'>) =>
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
  ];
  const summary = [
    `${settings.builders} builders${settings.goblinBuilder ? ' + Goblin' : ''}`,
    `GP ${Math.round(settings.goldPass * 100)}%`,
    `${settings.builderPotions} builder potions`,
    `HJ ${settings.hammerJam.days}d${settings.hammerJam.startDays ? ` in ${settings.hammerJam.startDays}d` : ''}`,
  ].join(' · ');

  return (
    <div>
      {notice}
      <div className="sticky top-14 z-20 -mx-4 bg-bg/95 px-4 backdrop-blur sm:-mx-6 sm:px-6">
        <Tabs label="Sections" tabs={tabs.map((t) => ({ ...t, count: t.count || undefined }))} value={tab} onChange={setTab} />
      </div>

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
      {boostsOpen && (
        <div className="mb-4">
          <BoostsPanel settings={settings} onChange={setStored} showBuildingOptions={village.source === 'export'} />
        </div>
      )}

      {tab === 'overview' && <OverviewTab village={village} chains={chains} plans={plans} settings={settings} scenario={scenario} onScenario={setScenario} now={now} onTab={setTab} />}

      {tab !== 'overview' && tab !== 'planner' && (
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
                <ItemsTable groups={groups} scenario={scenario} settings={settings} onOpen={setOpen} />
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
