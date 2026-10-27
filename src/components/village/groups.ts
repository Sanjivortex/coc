import type { Item, Kind, Res } from '@/lib/gamedata';
import { chainCost, type Chain } from '@/lib/planner';

/** All chains of one item (e.g. every Inferno Tower) shown as a single tile. */
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
  remaining: number;
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
    remaining: 0,
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
    s.remaining += c.remainingTime * c.count;
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

/** Picture for the tile: the building at its highest owned level, else the item icon. */
export function groupImage(g: ItemGroup, stats: GroupStats): string | null {
  if (g.item.lv[0]?.img) {
    const top = stats.distribution[0]?.[0] ?? 0;
    return g.item.lv[Math.max(0, Math.min(g.item.lv.length, top || 1) - 1)]?.img ?? g.item.icon;
  }
  return g.item.icon;
}

export interface Section {
  id: string;
  title: string;
  kinds: Kind[];
  base: 'home' | 'builder';
}

export const SECTIONS: Section[] = [
  { id: 'heroes', title: 'Heroes', kinds: ['hero'], base: 'home' },
  { id: 'pets', title: 'Pets', kinds: ['pet'], base: 'home' },
  { id: 'equipment', title: 'Hero Equipment', kinds: ['equipment'], base: 'home' },
  { id: 'troops', title: 'Troops', kinds: ['troop'], base: 'home' },
  { id: 'spells', title: 'Spells', kinds: ['spell'], base: 'home' },
  { id: 'sieges', title: 'Siege Machines', kinds: ['siege'], base: 'home' },
  { id: 'defenses', title: 'Defenses', kinds: ['defense', 'townhall', 'guardian'], base: 'home' },
  { id: 'crafted', title: 'Crafted Defenses', kinds: ['crafted'], base: 'home' },
  { id: 'traps', title: 'Traps', kinds: ['trap'], base: 'home' },
  { id: 'army', title: 'Army & Resource Buildings', kinds: ['army', 'resource', 'other'], base: 'home' },
  { id: 'walls', title: 'Walls', kinds: ['wall'], base: 'home' },
  { id: 'bb-heroes', title: 'Builder Base · Heroes', kinds: ['hero'], base: 'builder' },
  { id: 'bb-troops', title: 'Builder Base · Troops', kinds: ['troop'], base: 'builder' },
  { id: 'bb-buildings', title: 'Builder Base · Buildings', kinds: ['defense', 'trap', 'army', 'resource', 'other'], base: 'builder' },
  { id: 'bb-walls', title: 'Builder Base · Walls', kinds: ['wall'], base: 'builder' },
];
