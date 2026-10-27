import { craftedModuleById, itemByDataId, itemByName, type Base, type Item } from './gamedata';

/** One group of identical things in a village: e.g. "3 × Inferno Tower at level 9". */
export interface Entry {
  item: Item;
  level: number;
  count: number;
  /** Seconds left on the running upgrade (level → level + 1), as of `Village.timestamp`. */
  timer?: number;
  /** Supercharge level reached on a max-level building. */
  supercharge?: number;
  /** Crafted defense module index (0-2). */
  module?: number;
  /** Town Hall weapon instead of the Town Hall itself. */
  weapon?: boolean;
}

export interface Village {
  source: 'api' | 'export';
  tag: string;
  name?: string;
  townHall: number;
  builderHall: number;
  /** Unix seconds when the in-game export was copied. */
  timestamp?: number;
  entries: Entry[];
  helpers: { apprentice: number; labAssistant: number };
  /** Home village builders (Builder's Huts + B.O.B's Hut), when known. */
  builders?: number;
  superTroops: { name: string; level: number; active: boolean }[];
  /** Names or ids we could not match to game data. */
  unknown: string[];
}

// ---------------------------------------------------------------------------
// Official API (GET /v1/players/{tag})
// ---------------------------------------------------------------------------

export interface ApiUnit {
  name: string;
  level: number;
  maxLevel: number;
  village: 'home' | 'builderBase' | 'clanCapital';
  superTroopIsActive?: boolean;
}

export interface ApiIcon {
  tiny?: string;
  small?: string;
  medium?: string;
  large?: string;
}

export interface ApiPlayer {
  tag: string;
  name: string;
  townHallLevel: number;
  townHallWeaponLevel?: number;
  expLevel: number;
  trophies: number;
  bestTrophies: number;
  warStars: number;
  attackWins: number;
  defenseWins: number;
  builderHallLevel?: number;
  builderBaseTrophies?: number;
  bestBuilderBaseTrophies?: number;
  role?: string;
  warPreference?: 'in' | 'out';
  donations: number;
  donationsReceived: number;
  clanCapitalContributions?: number;
  clan?: { tag: string; name: string; clanLevel: number; badgeUrls: { small: string; medium: string; large: string } };
  league?: { id: number; name: string; iconUrls?: ApiIcon };
  leagueTier?: { id: number; name: string; iconUrls?: ApiIcon };
  builderBaseLeague?: { id: number; name: string };
  labels?: { id: number; name: string; iconUrls: ApiIcon }[];
  achievements?: {
    name: string;
    stars: number;
    value: number;
    target: number;
    info: string;
    completionInfo?: string | null;
    village: 'home' | 'builderBase' | 'clanCapital';
  }[];
  troops?: ApiUnit[];
  heroes?: (ApiUnit & { equipment?: ApiUnit[] })[];
  heroEquipment?: ApiUnit[];
  spells?: ApiUnit[];
}

const SUPER_TROOPS = new Set(
  [
    'Super Barbarian',
    'Super Archer',
    'Super Giant',
    'Sneaky Goblin',
    'Super Wall Breaker',
    'Rocket Balloon',
    'Super Wizard',
    'Super Dragon',
    'Inferno Dragon',
    'Super Minion',
    'Super Valkyrie',
    'Super Witch',
    'Ice Hound',
    'Super Bowler',
    'Super Miner',
    'Super Hog Rider',
    'Super Yeti',
  ].map((n) => n.toLowerCase()),
);

function apiBase(v: ApiUnit['village']): Base | null {
  if (v === 'home') return 'home';
  if (v === 'builderBase') return 'builder';
  return null;
}

export function villageFromApi(p: ApiPlayer): Village {
  const village: Village = {
    source: 'api',
    tag: p.tag,
    name: p.name,
    townHall: p.townHallLevel,
    builderHall: p.builderHallLevel ?? 0,
    entries: [],
    helpers: { apprentice: 0, labAssistant: 0 },
    superTroops: [],
    unknown: [],
  };

  const add = (u: ApiUnit) => {
    const base = apiBase(u.village);
    if (!base) return;
    const item = itemByName(base, u.name);
    if (item) {
      village.entries.push({ item, level: u.level, count: 1 });
    } else if (base === 'home' && SUPER_TROOPS.has(u.name.toLowerCase())) {
      village.superTroops.push({ name: u.name, level: u.level, active: !!u.superTroopIsActive });
    } else {
      village.unknown.push(`${u.village}: ${u.name}`);
    }
  };

  p.heroes?.forEach(add);
  p.troops?.forEach(add);
  p.spells?.forEach(add);
  p.heroEquipment?.forEach(add);

  const th = itemByDataId(1000001);
  if (th) {
    village.entries.push({ item: th, level: p.townHallLevel, count: 1 });
    if (p.townHallWeaponLevel) village.entries.push({ item: th, level: p.townHallWeaponLevel, count: 1, weapon: true });
  }
  return village;
}

// ---------------------------------------------------------------------------
// In-game export (Settings → More Settings → Data Export → Copy)
// ---------------------------------------------------------------------------

interface ExportEntry {
  data: number;
  lvl?: number;
  cnt?: number;
  timer?: number;
  supercharge?: number;
  weapon?: number;
  gear_up?: number;
  types?: { data: number; modules: { data: number; lvl: number; timer?: number }[] }[];
}

export interface VillageExport {
  tag: string;
  timestamp: number;
  helpers?: ExportEntry[];
  guardians?: ExportEntry[];
  buildings?: ExportEntry[];
  traps?: ExportEntry[];
  units?: ExportEntry[];
  siege_machines?: ExportEntry[];
  heroes?: ExportEntry[];
  spells?: ExportEntry[];
  pets?: ExportEntry[];
  equipment?: ExportEntry[];
  buildings2?: ExportEntry[];
  traps2?: ExportEntry[];
  units2?: ExportEntry[];
  heroes2?: ExportEntry[];
}

const TOWN_HALL = 1000001;
const BUILDER_HALL = 1000034;
const CRAFTING_STATION = 1000097;
const BUILDERS_HUT = 1000015;
const BOBS_HUT = 1000064;
const APPRENTICE = 93000000;
const LAB_ASSISTANT = 93000001;

export class ExportParseError extends Error {}

/** Parses the text copied from the game. Throws ExportParseError with a readable message. */
export function parseExport(text: string): VillageExport {
  let json: unknown;
  try {
    json = JSON.parse(text.trim());
  } catch {
    throw new ExportParseError('This is not valid JSON. Tap “Copy” in the game again and paste the whole text.');
  }
  const ex = json as VillageExport;
  if (!ex || typeof ex !== 'object' || typeof ex.tag !== 'string' || !Array.isArray(ex.buildings)) {
    throw new ExportParseError('This does not look like a Clash of Clans village export (no tag or buildings).');
  }
  return ex;
}

export function villageFromExport(ex: VillageExport): Village {
  const village: Village = {
    source: 'export',
    tag: ex.tag,
    townHall: 0,
    builderHall: 0,
    timestamp: ex.timestamp,
    entries: [],
    helpers: { apprentice: 0, labAssistant: 0 },
    superTroops: [],
    unknown: [],
  };
  let huts = 0;
  let bob = 0;

  const addAll = (list: ExportEntry[] | undefined, base: Base, section: string) => {
    for (const e of list ?? []) {
      if (base === 'home' && e.data === CRAFTING_STATION && e.types) {
        for (const t of e.types) {
          for (const m of t.modules) {
            const mod = craftedModuleById(m.data);
            if (mod) village.entries.push({ item: mod.item, module: mod.index, level: m.lvl, count: 1, timer: m.timer });
            else village.unknown.push(`${section}: crafted module ${m.data}`);
          }
        }
        continue;
      }
      const item = itemByDataId(e.data);
      if (!item || item.base !== base) {
        village.unknown.push(`${section}: ${e.data}`);
        continue;
      }
      const level = e.lvl ?? 0;
      if (e.data === TOWN_HALL) {
        village.townHall = level;
        if (e.weapon) village.entries.push({ item, level: e.weapon, count: 1, weapon: true });
      }
      if (e.data === BUILDER_HALL) village.builderHall = level;
      if (e.data === BUILDERS_HUT) huts += e.cnt ?? 1;
      if (e.data === BOBS_HUT) bob += e.cnt ?? 1;
      village.entries.push({
        item,
        level,
        count: e.cnt ?? 1,
        timer: e.timer,
        supercharge: typeof e.supercharge === 'number' ? e.supercharge : undefined,
      });
    }
  };

  addAll(ex.buildings, 'home', 'buildings');
  addAll(ex.traps, 'home', 'traps');
  addAll(ex.guardians, 'home', 'guardians');
  addAll(ex.units, 'home', 'units');
  addAll(ex.siege_machines, 'home', 'siege_machines');
  addAll(ex.spells, 'home', 'spells');
  addAll(ex.heroes, 'home', 'heroes');
  addAll(ex.pets, 'home', 'pets');
  addAll(ex.equipment, 'home', 'equipment');
  addAll(ex.buildings2, 'builder', 'buildings2');
  addAll(ex.traps2, 'builder', 'traps2');
  addAll(ex.units2, 'builder', 'units2');
  addAll(ex.heroes2, 'builder', 'heroes2');

  for (const h of ex.helpers ?? []) {
    if (h.data === APPRENTICE) village.helpers.apprentice = h.lvl ?? 0;
    if (h.data === LAB_ASSISTANT) village.helpers.labAssistant = h.lvl ?? 0;
  }
  if (huts > 0) village.builders = huts + bob;
  return village;
}
