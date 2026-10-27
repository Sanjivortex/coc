import raw from '@/data/gamedata.json';

export type Base = 'home' | 'builder';
export type Kind =
  | 'defense'
  | 'trap'
  | 'wall'
  | 'army'
  | 'resource'
  | 'other'
  | 'helper'
  | 'townhall'
  | 'guardian'
  | 'crafted'
  | 'hero'
  | 'pet'
  | 'troop'
  | 'spell'
  | 'siege'
  | 'equipment';
/** Which in-game worker upgrades an item. `instant` = walls (no timer), `blacksmith` = ore only. */
export type Queue = 'builder' | 'lab' | 'pet' | 'blacksmith' | 'instant' | 'none';
/** G=Gold, E=Elixir, D=Dark Elixir, GE=Gold or Elixir, BG/BE/BGE = Builder Base resources. */
export type Res = 'G' | 'E' | 'D' | 'GE' | 'BG' | 'BE' | 'BGE' | 'GEM' | 'ORE';

export interface Level {
  /** Upgrade time in seconds to reach this level from the previous one. */
  t: number;
  /** Upgrade cost to reach this level. */
  c: number;
  r: Res;
  /** Hall level (Town Hall for home, Builder Hall for builder base) needed for this level. */
  h: number;
  img?: string | null;
  /** Ore cost for equipment: [shiny, glowy, starry]. */
  o?: [number, number, number];
  /** Helper work rate (hours saved per hour of work). */
  w?: number;
}

export interface Item {
  key: string;
  id: string;
  dataId: number | null;
  name: string;
  base: Base;
  kind: Kind;
  queue: Queue;
  icon: string | null;
  lv: Level[];
  /** Supercharge levels, available after the last normal level. */
  sc?: Level[];
  /** [hall level, number of instances available]. */
  counts?: [number, number][];
  /** regular | dark (troops and spells). */
  sub?: string;
  /** Equipment owner hero id and rarity. */
  hero?: string;
  rarity?: string;
  /** Crafted defenses: three modules upgraded independently. */
  modules?: { dataId: number | null; name: string; lv: Level[] }[];
  /** Town Hall weapon per TH level (only TH levels whose weapon has upgrades). */
  weapons?: Record<string, { name: string; lv: Level[] }>;
}

export interface MagicItem {
  name: string;
  description: string;
  icon: string | null;
  effect: { type: string; multiplier?: number; durationHours?: number; appliesTo?: string };
}

interface GameData {
  source: string;
  maxTownHall: number;
  maxBuilderHall: number;
  items: Item[];
  magic: Record<string, MagicItem>;
}

const data = raw as unknown as GameData;

export const GAME_DATA_SOURCE = data.source;
export const MAX_TH = data.maxTownHall;
export const MAX_BH = data.maxBuilderHall;
export const ITEMS = data.items;
export const MAGIC = data.magic;

const byKey = new Map<string, Item>();
const byDataId = new Map<number, Item>();
const byName = new Map<string, Item>();
const moduleById = new Map<number, { item: Item; index: number }>();

/** Lowercase, letters and digits only: "P.E.K.K.A" → "pekka". */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

for (const item of ITEMS) {
  byKey.set(item.key, item);
  if (item.dataId !== null) byDataId.set(item.dataId, item);
  byName.set(`${item.base}:${normalizeName(item.name)}`, item);
  item.modules?.forEach((m, index) => {
    if (m.dataId !== null) moduleById.set(m.dataId, { item, index });
  });
}

export function itemByKey(key: string): Item | undefined {
  return byKey.get(key);
}

export function itemByDataId(id: number): Item | undefined {
  return byDataId.get(id);
}

export function itemByName(base: Base, name: string): Item | undefined {
  return byName.get(`${base}:${normalizeName(name)}`);
}

export function craftedModuleById(id: number) {
  return moduleById.get(id);
}

/** Highest normal level unlocked at a hall level (0 = not available yet). */
export function maxLevelAt(levels: Level[], hall: number): number {
  let max = 0;
  for (let i = 0; i < levels.length; i++) if (levels[i].h <= hall) max = i + 1;
  return max;
}

export function itemMaxLevel(item: Item, hall: number): number {
  return maxLevelAt(item.lv, hall);
}

export function superchargeMax(item: Item, hall: number): number {
  return item.sc ? maxLevelAt(item.sc, hall) : 0;
}

/** Number of instances of a building available at a hall level. */
export function countAt(item: Item, hall: number): number {
  if (!item.counts) return item.kind === 'townhall' ? 1 : 0;
  let count = 0;
  for (const [h, c] of item.counts) if (h <= hall) count = c;
  return count;
}

export function hallOf(item: Item, village: { townHall: number; builderHall: number }): number {
  return item.base === 'home' ? village.townHall : village.builderHall;
}

export const KIND_LABEL: Record<Kind, string> = {
  defense: 'Defenses',
  trap: 'Traps',
  wall: 'Walls',
  army: 'Army Buildings',
  resource: 'Resource Buildings',
  other: 'Other Buildings',
  helper: 'Helpers',
  townhall: 'Town Hall',
  guardian: 'Guardians',
  crafted: 'Crafted Defenses',
  hero: 'Heroes',
  pet: 'Pets',
  troop: 'Troops',
  spell: 'Spells',
  siege: 'Siege Machines',
  equipment: 'Hero Equipment',
};

export const RES_LABEL: Record<Res, string> = {
  G: 'Gold',
  E: 'Elixir',
  D: 'Dark Elixir',
  GE: 'Gold/Elixir',
  BG: 'Builder Gold',
  BE: 'Builder Elixir',
  BGE: 'Builder Gold/Elixir',
  GEM: 'Gems',
  ORE: 'Ore',
};
