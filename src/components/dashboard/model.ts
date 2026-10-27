import type { Base, Item, Kind, Res } from '@/lib/gamedata';
import { chainCost, scenarioFlags, type Chain, type PlanSettings, type ScenarioId } from '@/lib/planner';

/** All chains of one item (e.g. every Inferno Tower) shown as one row. */
export interface ItemGroup {
  key: string;
  item: Item;
  label: string;
  chains: Chain[];
}

export function groupChains(chains: Chain[]): ItemGroup[] {
  const map = new Map<string, ItemGroup>();
  for (const c of chains) {
    const key = `${c.item.key}|${c.label}`;
    let g = map.get(key);
    if (!g) map.set(key, (g = { key, item: c.item, label: c.label, chains: [] }));
    g.chains.push(c);
  }
  return [...map.values()];
}

export interface GroupStats {
  count: number;
  levels: number;
  maxLevels: number;
  cost: Partial<Record<Res, number>>;
  ore: [number, number, number];
  maxed: boolean;
  rushed: boolean;
  missing: number;
  running: Chain[];
  /** Current level → instance count, highest first. */
  distribution: [number, number][];
  target: number;
}

export function groupStats(g: ItemGroup): GroupStats {
  const s: GroupStats = {
    count: 0,
    levels: 0,
    maxLevels: 0,
    cost: {},
    ore: [0, 0, 0],
    maxed: true,
    rushed: false,
    missing: 0,
    running: [],
    distribution: [],
    target: 0,
  };
  const dist = new Map<number, number>();
  for (const c of g.chains) {
    s.count += c.count;
    s.levels += (c.from + c.scFrom) * c.count;
    s.maxLevels += (c.to + c.scTo) * c.count;
    for (const [r, v] of Object.entries(chainCost(c)) as [Res, number][]) s.cost[r] = (s.cost[r] ?? 0) + v;
    for (const st of c.steps) {
      s.ore[0] += (st.ore?.[0] ?? 0) * c.count;
      s.ore[1] += (st.ore?.[1] ?? 0) * c.count;
      s.ore[2] += (st.ore?.[2] ?? 0) * c.count;
    }
    if (c.steps.length > 0) s.maxed = false;
    if (c.rushed) s.rushed = true;
    if (c.missing) s.missing += c.count;
    if (c.firstRemaining !== undefined) s.running.push(c);
    dist.set(c.from, (dist.get(c.from) ?? 0) + c.count);
    s.target = Math.max(s.target, c.to);
  }
  s.distribution = [...dist.entries()].sort((a, b) => b[0] - a[0]);
  return s;
}

/** "12 · 11×2" for buildings, "97" for a single item. */
export function levelText(stats: GroupStats): string {
  if (stats.count === 1) return String(stats.distribution[0]?.[0] ?? 0);
  return stats.distribution.map(([lvl, n]) => (n > 1 ? `${lvl}×${n}` : String(lvl))).join(' · ');
}

/** Building picture at its highest owned level, else the item icon. */
export function groupImage(g: ItemGroup, stats: GroupStats): string | null {
  if (g.item.lv[0]?.img) {
    const top = stats.distribution[0]?.[0] ?? 0;
    return g.item.lv[Math.max(0, Math.min(g.item.lv.length, top || 1) - 1)]?.img ?? g.item.icon;
  }
  return g.item.icon;
}

export const isTimed = (c: { queue: string }) => c.queue === 'builder' || c.queue === 'lab' || c.queue === 'pet';

/** Note under a scenario: the Hammer Jam dates are over, or no potions were entered yet. */
export function scenarioHint(s: PlanSettings, id: ScenarioId, now: number | undefined, where = 'in Boosts & inventory'): string | undefined {
  if (scenarioFlags(id).jam && now !== undefined && s.hammerJam.end <= now) return 'Hammer Jam dates are over: set the next event';
  if (id !== 'items' && id !== 'jamGoldItems') return undefined;
  const any =
    s.builderPotions + s.researchPotions + s.petPotions > 0 ||
    Object.values(s.books).some((n) => n > 0) ||
    Object.values(s.hammers).some((n) => n > 0);
  return any ? undefined : `Add potions ${where}`;
}

export type TabId = 'overview' | 'heroes' | 'pets' | 'equipment' | 'lab' | 'buildings' | 'builder' | 'planner' | 'jam';
export type ListTabId = Exclude<TabId, 'overview' | 'planner' | 'jam'>;

export interface Section {
  id: string;
  title: string;
  base: Base;
  kinds: Kind[];
  /** troopType / spellType filter. */
  sub?: string;
}

export const TAB_SECTIONS: Record<ListTabId, Section[]> = {
  heroes: [{ id: 'heroes', title: 'Heroes', base: 'home', kinds: ['hero'] }],
  pets: [{ id: 'pets', title: 'Pets', base: 'home', kinds: ['pet'] }],
  equipment: [{ id: 'equipment', title: 'Hero equipment', base: 'home', kinds: ['equipment'] }],
  lab: [
    { id: 'elixir-troops', title: 'Elixir troops', base: 'home', kinds: ['troop'], sub: 'regular' },
    { id: 'dark-troops', title: 'Dark Elixir troops', base: 'home', kinds: ['troop'], sub: 'dark' },
    { id: 'spells', title: 'Spells', base: 'home', kinds: ['spell'] },
    { id: 'sieges', title: 'Siege machines', base: 'home', kinds: ['siege'] },
  ],
  buildings: [
    { id: 'defenses', title: 'Defenses', base: 'home', kinds: ['defense', 'townhall', 'guardian'] },
    { id: 'crafted', title: 'Crafted defenses', base: 'home', kinds: ['crafted'] },
    { id: 'traps', title: 'Traps', base: 'home', kinds: ['trap'] },
    { id: 'army', title: 'Army & resource buildings', base: 'home', kinds: ['army', 'resource', 'other'] },
    { id: 'walls', title: 'Walls', base: 'home', kinds: ['wall'] },
  ],
  builder: [
    { id: 'bb-heroes', title: 'Heroes', base: 'builder', kinds: ['hero'] },
    { id: 'bb-troops', title: 'Troops', base: 'builder', kinds: ['troop'] },
    { id: 'bb-buildings', title: 'Buildings', base: 'builder', kinds: ['townhall', 'defense', 'trap', 'army', 'resource', 'other'] },
    { id: 'bb-walls', title: 'Walls', base: 'builder', kinds: ['wall'] },
  ],
};

export function inSection(c: Chain, s: Section): boolean {
  return c.base === s.base && s.kinds.includes(c.item.kind) && (!s.sub || c.item.sub === s.sub);
}

const HERO_ORDER = ['barbarian-king', 'archer-queen', 'minion-prince', 'grand-warden', 'royal-champion', 'dragon-duke', 'battle-machine', 'battle-copter'];

/** Unfinished first; heroes (and their equipment) in game order; then by name. */
export function sortGroups(groups: ItemGroup[]): ItemGroup[] {
  const rank = (g: ItemGroup) => {
    const h = HERO_ORDER.indexOf(g.item.hero ?? g.item.id);
    return h < 0 ? 99 : h;
  };
  const maxed = new Map(groups.map((g) => [g.key, g.chains.every((c) => c.steps.length === 0)]));
  return [...groups].sort((a, b) => {
    if (maxed.get(a.key) !== maxed.get(b.key)) return maxed.get(a.key) ? 1 : -1;
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return a.label.localeCompare(b.label);
  });
}

/** Chart category (fixed slot order, validated on the panel surface). */
export function categoryOf(c: Chain): { id: string; label: string; color: string } {
  const k = c.item.kind;
  if (c.queue === 'lab') {
    if (k === 'spell') return { id: 'spell', label: 'Spells', color: 'var(--series-3)' };
    if (k === 'siege') return { id: 'siege', label: 'Siege machines', color: 'var(--series-4)' };
    if (c.item.sub === 'dark') return { id: 'dark', label: 'Dark troops', color: 'var(--series-2)' };
    return { id: 'troop', label: 'Elixir troops', color: 'var(--series-1)' };
  }
  if (c.queue === 'pet') return { id: 'pet', label: 'Pets', color: 'var(--series-1)' };
  if (k === 'hero') return { id: 'hero', label: 'Heroes', color: 'var(--series-1)' };
  if (k === 'trap') return { id: 'trap', label: 'Traps', color: 'var(--series-3)' };
  if (k === 'army' || k === 'resource' || k === 'other') return { id: 'army', label: 'Army & resources', color: 'var(--series-4)' };
  if (k === 'crafted') return { id: 'crafted', label: 'Crafted defenses', color: 'var(--series-5)' };
  return { id: 'defense', label: 'Defenses', color: 'var(--series-2)' };
}
