import { describe, expect, it } from 'vitest';
import { itemByKey } from './gamedata';
import { formatCompact, normalizeTag } from './format';
import {
  DAY,
  DEFAULT_SETTINGS,
  HOUR,
  buildChains,
  chainCost,
  customChains,
  limitChain,
  planVillage,
  simulateChain,
  type PlanSettings,
  type ScenarioId,
} from './planner';
import { mergeVillages, parseExport, villageFromApi, villageFromExport, type ApiPlayer, type Village } from './village';

const settings = (patch: Partial<PlanSettings> = {}): PlanSettings => ({ ...DEFAULT_SETTINGS, ...patch });

function queenVillage(level = 97): Village {
  return {
    source: 'api',
    tag: '#PQL0289',
    townHall: 18,
    builderHall: 0,
    entries: [{ item: itemByKey('home:archer-queen')!, level, count: 1 }],
    helpers: { apprentice: 0, labAssistant: 0 },
    superTroops: [],
    unknown: [],
  };
}

/** Only the chains for the given heroes (buildChains also plans every locked hero from level 0). */
const heroChains = (v: Village, ...ids: string[]) => buildChains(v).filter((c) => ids.includes(c.item.id));
const queenChain = (level = 97) => heroChains(queenVillage(level), 'archer-queen')[0];

describe('Archer Queen 97 → 110 at TH18', () => {
  it('has 13 upgrades of 8 days', () => {
    const c = queenChain();
    expect(c.to).toBe(110);
    expect(c.steps).toHaveLength(13);
    expect(c.remainingTime).toBe(104 * DAY);
    expect(chainCost(c).D).toBe(5_600_000);
  });

  const time = (s: PlanSettings, scenario: ScenarioId) => simulateChain(queenChain(), s, scenario).makespan;

  it('applies the Gold Pass boost only in Gold Pass scenarios', () => {
    expect(time(settings(), 'normal')).toBeCloseTo(104 * DAY, 0);
    expect(time(settings({ goldPass: 0.2 }), 'gold')).toBeCloseTo(104 * 0.8 * DAY, 0);
  });

  it('halves only the upgrades started during a 15 day Hammer Jam', () => {
    // Upgrades start on day 0, 4, 8 and 12 at half time, the other 9 take the full 8 days.
    expect(time(settings(), 'jam')).toBeCloseTo(88 * DAY, 0);
    // With a 20% Gold Pass too: 6.4-day upgrades, halved to 3.2 for the 5 that start inside the event.
    expect(time(settings(), 'jamGold')).toBeCloseTo((5 * 3.2 + 8 * 6.4) * DAY, 0);
  });

  it('counts the Builder’s Apprentice as extra hours every day', () => {
    const t = time(settings({ apprentice: 8 }), 'normal');
    expect(t / DAY).toBeGreaterThan(77.5);
    expect(t / DAY).toBeLessThan(78.5);
  });

  it('saves 9 hours per builder potion and a full level per hammer', () => {
    expect(time(settings(), 'normal') - time(settings({ builderPotions: 5 }), 'items')).toBeCloseTo(45 * HOUR, 0);
    const hammers = settings({ hammers: { heroes: 2, building: 0, fighting: 0, spells: 0 } });
    const plan = planVillage([queenChain()], { ...hammers, builders: 1 }, 'items');
    expect(plan.builder.makespan).toBeCloseTo(88 * DAY, 0);
    expect(plan.builder.cost.D).toBe(5_600_000 - 490_000 - 485_000);
    // Inventory only counts in the potions scenarios.
    expect(planVillage([queenChain()], { ...hammers, builders: 1 }, 'normal').builder.makespan).toBeCloseTo(104 * DAY, 0);
  });

  it('stops at a lower target level', () => {
    const c = limitChain(queenChain(), 3);
    expect(c.to).toBe(100);
    expect(simulateChain(c, settings(), 'normal').makespan).toBe(24 * DAY);
  });
});

describe('planVillage', () => {
  it('runs hero chains in parallel on separate builders', () => {
    const v = queenVillage();
    v.entries.push({ item: itemByKey('home:barbarian-king')!, level: 105, count: 1 });
    const chains = heroChains(v, 'archer-queen', 'barbarian-king');
    const plan = planVillage(chains, settings({ builders: 2 }));
    const king = chains.find((c) => c.item.id === 'barbarian-king')!;
    expect(plan.builder.chainEnd.get(king.id)).toBe(king.remainingTime);
    expect(plan.builder.makespan).toBeCloseTo(104 * DAY, 0);
    expect(planVillage(chains, settings({ builders: 1 })).builder.makespan).toBeCloseTo(104 * DAY + king.remainingTime, 0);
  });

  it('gives the Goblin Builder its own row and only lets it start jobs while it is around', () => {
    const v = queenVillage();
    const heroes = buildChains(v).filter((c) => c.item.kind === 'hero' && c.base === 'home');
    const inferno = customChains(v, itemByKey('home:inferno-tower')!, 10, 1, 'custom');
    const chains = [...heroes, ...inferno];
    // 6 heroes on 6 builders + the Inferno Tower on the Goblin Builder.
    const plan = planVillage(chains, settings({ builders: 6, goblinBuilder: true }));
    expect(plan.builder.workerRows).toBe(7);
    const goblinJobs = plan.builder.timeline.filter((s) => s.worker === 6);
    expect(goblinJobs.length).toBeGreaterThan(0);
    const longestHero = Math.max(...heroes.map((c) => c.remainingTime));
    expect(plan.builder.makespan).toBeCloseTo(Math.max(longestHero, inferno[0].remainingTime), 0);
    // A Goblin Builder that leaves on day 1 starts one upgrade at most, then the regular builders take over.
    const short = planVillage(chains, settings({ builders: 6, goblinBuilder: true, goblinDays: 1 }));
    expect(short.builder.timeline.filter((s) => s.worker === 6).every((s) => s.start < DAY)).toBe(true);
  });

  it('marks upgrades that start during Hammer Jam', () => {
    const plan = planVillage([queenChain()], settings({ builders: 1 }), 'jam');
    expect(plan.builder.timeline.filter((s) => s.jam).map((s) => s.level)).toEqual([98, 99, 100, 101]);
  });
});

describe('official API player', () => {
  it('maps heroes, pets, troops and equipment by name', () => {
    const player = {
      tag: '#PQL0289',
      name: 'Tester',
      townHallLevel: 18,
      expLevel: 250,
      trophies: 5000,
      bestTrophies: 5500,
      warStars: 1000,
      attackWins: 10,
      defenseWins: 1,
      builderHallLevel: 10,
      donations: 0,
      donationsReceived: 0,
      heroes: [
        { name: 'Archer Queen', level: 97, maxLevel: 110, village: 'home' },
        { name: 'Battle Machine', level: 30, maxLevel: 35, village: 'builderBase' },
      ],
      troops: [
        { name: 'P.E.K.K.A', level: 11, maxLevel: 13, village: 'home' },
        { name: 'L.A.S.S.I', level: 10, maxLevel: 15, village: 'home' },
        { name: 'Super Barbarian', level: 12, maxLevel: 13, village: 'home', superTroopIsActive: true },
        { name: 'Baby Dragon', level: 10, maxLevel: 16, village: 'builderBase' },
      ],
      spells: [{ name: 'Rage Spell', level: 6, maxLevel: 7, village: 'home' }],
      heroEquipment: [{ name: 'Giant Gauntlet', level: 20, maxLevel: 27, village: 'home' }],
    } satisfies ApiPlayer;
    const v = villageFromApi(player);
    expect(v.unknown).toEqual([]);
    expect(v.superTroops).toEqual([{ name: 'Super Barbarian', level: 12, active: true }]);
    const keys = v.entries.map((e) => e.item.key);
    expect(keys).toEqual(
      expect.arrayContaining(['home:archer-queen', 'builder:battle-machine', 'home:pekka', 'home:lassi', 'builder:baby-dragon', 'home:rage-spell', 'home:giant-gauntlet']),
    );
    const chains = buildChains(v);
    // Buildings are not in the API, so none are invented.
    expect(chains.some((c) => c.item.kind === 'defense')).toBe(false);
    // Locked units the TH allows are planned from level 0.
    expect(chains.some((c) => c.missing && c.item.kind === 'troop')).toBe(true);
  });
});

describe('in-game export', () => {
  const text = JSON.stringify({
    tag: '#PQL0289',
    timestamp: 1_800_000_000,
    helpers: [
      { data: 93000000, lvl: 8 },
      { data: 93000001, lvl: 12 },
    ],
    buildings: [
      { data: 1000001, lvl: 17, weapon: 3 },
      { data: 1000015, lvl: 8, cnt: 5 },
      { data: 1000064, lvl: 1, cnt: 1 },
      { data: 1000027, lvl: 11, cnt: 2 },
      { data: 1000027, lvl: 10, timer: 2 * 3600 },
      { data: 1000010, lvl: 17, cnt: 300 },
    ],
    traps: [{ data: 12000000, lvl: 13, cnt: 8 }],
    heroes: [{ data: 28000001, lvl: 99, timer: 5 * 86400 }],
    units: [{ data: 4000000, lvl: 12 }],
    spells: [],
    pets: [{ data: 73000000, lvl: 15 }],
    equipment: [{ data: 90000010, lvl: 27 }],
  });

  it('reads hall levels, helpers and builders', () => {
    const v = villageFromExport(parseExport(text));
    expect(v.townHall).toBe(17);
    expect(v.helpers).toEqual({ apprentice: 8, labAssistant: 12 });
    expect(v.builders).toBe(6);
    expect(v.unknown).toEqual([]);
  });

  it('plans running timers, unbuilt buildings and the TH weapon', () => {
    const v = villageFromExport(parseExport(text));
    const chains = buildChains(v, { now: 1_800_000_000 + 3600 });
    const infernos = chains.filter((c) => c.item.id === 'inferno-tower');
    expect(infernos).toHaveLength(3);
    const running = infernos.find((c) => c.firstRemaining !== undefined)!;
    expect(running.firstRemaining).toBe(3600);
    const queen = chains.find((c) => c.item.id === 'archer-queen')!;
    expect(queen.firstRemaining).toBe(5 * 86400 - 3600);
    expect(queen.to).toBe(100);
    const weapon = chains.find((c) => c.label === 'Inferno Artillery')!;
    expect(weapon.steps.map((s) => s.level)).toEqual([4, 5]);
    // Walls: 300 built at level 17; TH17 allows 325, so 25 more from level 0.
    const walls = chains.filter((c) => c.item.id === 'wall');
    expect(walls.reduce((n, c) => n + c.count, 0)).toBe(325);
    expect(chains.some((c) => c.missing && c.item.id === 'x-bow')).toBe(true);
  });

  it('rejects text that is not an export', () => {
    expect(() => parseExport('hello')).toThrow();
    expect(() => parseExport('{"foo":1}')).toThrow();
  });

  it('merges a saved export into the live profile', () => {
    const ex = villageFromExport(parseExport(text));
    const api = villageFromApi({
      tag: '#PQL0289',
      name: 'Tester',
      townHallLevel: 17,
      townHallWeaponLevel: 3,
      expLevel: 250,
      trophies: 0,
      bestTrophies: 0,
      warStars: 0,
      attackWins: 0,
      defenseWins: 0,
      donations: 0,
      donationsReceived: 0,
      // The queen finished the upgrade that was running in the export; the barbarian is unchanged.
      heroes: [{ name: 'Archer Queen', level: 100, maxLevel: 110, village: 'home' }],
      troops: [{ name: 'Barbarian', level: 12, maxLevel: 13, village: 'home' }],
    });
    const merged = mergeVillages(api, ex);
    expect(merged.name).toBe('Tester');
    expect(merged.source).toBe('export');
    const chains = buildChains(merged, { now: 1_800_000_000 });
    const queen = chains.find((c) => c.item.id === 'archer-queen')!;
    expect(queen.from).toBe(100);
    expect(queen.firstRemaining).toBeUndefined();
    expect(chains.filter((c) => c.item.id === 'inferno-tower')).toHaveLength(3);
    expect(merged.entries.filter((e) => e.item.id === 'town-hall')).toHaveLength(2); // hall + weapon, no duplicates
  });
});

describe('formatCompact', () => {
  it('keeps integer zeros and drops decimal ones', () => {
    expect(formatCompact(360_000)).toBe('360K');
    expect(formatCompact(400_000)).toBe('400K');
    expect(formatCompact(300_000_000)).toBe('300M');
    expect(formatCompact(5_600_000)).toBe('5.6M');
    expect(formatCompact(4_090_000)).toBe('4.09M');
    expect(formatCompact(1_040_000_000)).toBe('1.04B');
    expect(formatCompact(950)).toBe('950');
  });
});

describe('normalizeTag', () => {
  it('accepts tags with or without # and fixes O → 0', () => {
    expect(normalizeTag('#2pp')).toBe('#2PP');
    expect(normalizeTag(' 2ppO ')).toBe('#2PP0');
    expect(normalizeTag('%232PP')).toBe('#2PP');
    expect(normalizeTag('#ABC')).toBeNull();
  });
});
