import { describe, expect, it } from 'vitest';
import extraTownHalls from '@/data/extra-town-halls.json';
import { MAX_BH, MAX_TH, countAt, hallsAheadOfData, itemByKey, townHallImage } from './gamedata';
import { buildChains } from './planner';
import { parseExport, villageFromExport } from './village';

describe('halls newer than the game data', () => {
  it('lists only the halls above the data', () => {
    expect(hallsAheadOfData({ townHall: MAX_TH, builderHall: MAX_BH })).toEqual([]);
    expect(hallsAheadOfData({ townHall: MAX_TH + 1, builderHall: MAX_BH })).toEqual([`Town Hall ${MAX_TH + 1}`]);
    expect(hallsAheadOfData({ townHall: MAX_TH + 1, builderHall: MAX_BH + 1 })).toEqual([`Town Hall ${MAX_TH + 1}`, `Builder Hall ${MAX_BH + 1}`]);
  });

  it('shows the Town Hall picture, or the newest one we have', () => {
    expect(townHallImage(10)).toBe('/game/home/town-hall/normal/level-10.webp');
    expect(townHallImage(MAX_TH)).toBe(`/game/home/town-hall/normal/level-${MAX_TH}.webp`);
    // Halls fetched from the wiki ahead of the data use their own picture, before and after the data adds them.
    for (const level of Object.keys(extraTownHalls)) {
      expect(townHallImage(Number(level))).toBe(`/game/home/town-hall/normal/level-${level}.webp`);
    }
    const newest = Math.max(MAX_TH, ...Object.keys(extraTownHalls).map(Number));
    expect(townHallImage(newest + 5)).toBe(townHallImage(MAX_TH));
    expect(townHallImage(0)).toBe('/game/home/town-hall/normal/level-1.webp');
  });

  it('plans a newer Town Hall with the last known levels, without crashing', () => {
    const v = villageFromExport(
      parseExport(
        JSON.stringify({
          tag: '#NEWTH',
          timestamp: 1_800_000_000,
          buildings: [{ data: 1000001, lvl: MAX_TH + 1 }],
          heroes: [{ data: 28000001, lvl: 112 }],
        }),
      ),
    );
    expect(v.townHall).toBe(MAX_TH + 1);
    const queen = buildChains(v).find((c) => c.item.id === 'archer-queen')!;
    // Level 112 is past the data, so the Queen counts as maxed instead of breaking the plan.
    expect(queen.from).toBe(112);
    expect(queen.steps).toEqual([]);
  });
});

describe('walls', () => {
  it('allows 325 walls at Town Hall 18 (clash-of-clans-data 0.19.1)', () => {
    const wall = itemByKey('home:wall')!;
    expect(countAt(wall, 17)).toBe(325);
    expect(countAt(wall, 18)).toBe(325);
  });
});
