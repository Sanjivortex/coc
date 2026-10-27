import { describe, expect, it } from 'vitest';
import { itemByKey } from './gamedata';
import { ageChain, planJam, simulateLanes, type JamSetup } from './jam';
import { DAY, HOUR, buildChains, customChains, type Chain } from './planner';
import type { Village } from './village';

function village(...heroes: [string, number][]): Village {
  return {
    source: 'api',
    tag: '#PQL0289',
    townHall: 18,
    builderHall: 0,
    entries: heroes.map(([id, level]) => ({ item: itemByKey(`home:${id}`)!, level, count: 1 })),
    helpers: { apprentice: 0, labAssistant: 0 },
    superTroops: [],
    unknown: [],
  };
}

const hero = (id: string, level: number) => buildChains(village([id, level])).find((c) => c.item.id === id)!;
const queen = () => hero('archer-queen', 97);

// Queen 97 → 110 has 8-day upgrades: 3.2 days with a 20% Gold Pass and 50% Hammer Jam.
const jam15 = { start: 0, end: 15 * DAY, factor: 0.5 };

describe('simulateLanes', () => {
  it('counts the levels a builder gets through during the event', () => {
    const plan = simulateLanes([{ id: 'b1', chains: [queen()] }], { jam: jam15, boost: 0.8 });
    // Starts on day 0, 3.2, 6.4, 9.6 and 12.8; the one after would start on day 16, after the event.
    expect(plan.lanes[0].map((s) => s.step.level)).toEqual([98, 99, 100, 101, 102]);
    expect(plan.lanes[0].every((s) => s.jam)).toBe(true);
    const oc = plan.outcomes.get(queen().id)!;
    expect(oc.done).toBe(5);
    expect(oc.doneByStop).toBe(4);
    expect(plan.end).toBeCloseTo(16 * DAY, 0);
    // Paid at 40% of the normal price, the rest saved.
    const full = queen().steps.slice(0, 5).reduce((sum, st) => sum + st.cost, 0);
    expect(plan.cost.D).toBeCloseTo(0.4 * full, 0);
    expect(plan.saved.D! / (plan.cost.D! + plan.saved.D!)).toBeCloseTo(0.6, 5);
  });

  it('gets fewer levels without the event discount', () => {
    const plan = simulateLanes([{ id: 'b1', chains: [queen()] }], { jam: { ...jam15, factor: 1 }, boost: 0.8 });
    // 6.4-day upgrades start on day 0, 6.4 and 12.8.
    expect(plan.levels).toBe(3);
  });

  it('runs every busy builder 10× faster while potions last', () => {
    const lanes = [
      { id: 'b1', chains: [queen()] },
      { id: 'b2', chains: [hero('barbarian-king', 78)] },
    ];
    const plan = simulateLanes(lanes, { jam: jam15, boost: 0.8, potion: { start: 0, hours: 10, multiplier: 10 } });
    // The first 3.2-day (76.8 h) Queen upgrade gets 100 hours of work in the first 10 hours.
    expect(plan.lanes[0][0].end).toBeCloseTo(7.68 * HOUR, 0);
    // Both builders gain 90 hours: the King finishes more too.
    const without = simulateLanes(lanes, { jam: jam15, boost: 0.8 });
    expect(plan.lanes[1].length).toBeGreaterThan(without.lanes[1].length);
  });

  it('lets the Builder’s Apprentice help only the builder it is assigned to', () => {
    const lanes = [
      { id: 'b1', chains: [queen()] },
      { id: 'b2', chains: [hero('archer-queen', 97)].map((c) => ({ ...c, id: 'other-queen' })) },
    ];
    const plan = simulateLanes(lanes, { jam: jam15, boost: 0.8, helper: { lane: 'b2', rate: 8 } });
    // 8 extra hours a day: the first 76.8-hour upgrade is done after 52.8 hours instead of 76.8.
    expect(plan.lanes[0][0].end).toBeCloseTo(3.2 * DAY, 0);
    expect(plan.lanes[1][0].end).toBeCloseTo(52.8 * HOUR, 0);
  });

  it('keeps copies of a building level, lowest first', () => {
    const v = village();
    const towers = [...customChains(v, itemByKey('home:inferno-tower')!, 9, 1, 'a'), ...customChains(v, itemByKey('home:inferno-tower')!, 10, 2, 'b')];
    const plan = simulateLanes([{ id: 'b1', chains: towers }], { jam: { start: 0, end: 60 * DAY, factor: 0.5 }, boost: 1 });
    expect(plan.lanes[0][0].step.level).toBe(10);
    expect(plan.lanes[0].slice(1, 3).map((s) => s.step.level)).toEqual([11, 11]);
  });

  it('leaves a second builder idle on a hero that is already upgrading', () => {
    const q = queen();
    const plan = simulateLanes(
      [
        { id: 'b1', chains: [q] },
        { id: 'b2', chains: [q] },
      ],
      { jam: jam15, boost: 0.8 },
    );
    expect(plan.levels).toBe(5);
  });

  it('gives auto builders the upgrades with the most work left', () => {
    const pool: Chain[] = [hero('barbarian-king', 108), queen()];
    const plan = simulateLanes([{ id: 'b1', chains: [], auto: true }], { jam: jam15, boost: 0.8, pool });
    expect(plan.lanes[0][0].chain.item.id).toBe('archer-queen');
  });

  it('lets a Goblin Builder start upgrades only while it is around', () => {
    const plan = simulateLanes([{ id: 'goblin', chains: [queen()], until: 5 * DAY }], { jam: jam15, boost: 0.8 });
    expect(plan.lanes[0].map((s) => s.start / DAY)).toEqual([0, expect.closeTo(3.2, 5)]);
  });
});

describe('planJam', () => {
  const setup = (patch: Partial<JamSetup>): JamSetup => ({
    now: 1_000 * DAY,
    jamStart: 1_000 * DAY,
    jamEnd: 1_015 * DAY,
    discount: 0.5,
    goldPass: 0.2,
    potions: 0,
    lanes: [{ id: 'b1', chains: [queen()] }],
    pool: [],
    ...patch,
  });

  it('starts the builders when the event starts', () => {
    const r = planJam(setup({ jamStart: 1_003 * DAY, jamEnd: 1_018 * DAY }));
    expect(r.origin).toBe(1_003 * DAY);
    expect(r.plan.levels).toBe(5);
    expect(r.normal.levels).toBe(3);
  });

  it('starts now when the event is already on', () => {
    const r = planJam(setup({ jamStart: 995 * DAY }));
    expect(r.origin).toBe(1_000 * DAY);
    // 15 days left of the 20 is still enough for 5 starts
    expect(r.plan.levels).toBe(5);
  });

  it('finishes a running upgrade first, without the discount', () => {
    const running = { ...queen(), firstRemaining: 5 * DAY };
    const r = planJam(setup({ jamStart: 1_002 * DAY, jamEnd: 1_017 * DAY, lanes: [{ id: 'b1', chains: [running] }] }));
    const steps = r.plan.lanes[0];
    expect(steps[0]).toMatchObject({ running: true, jam: false, paid: 0 });
    expect(steps[0].end).toBeCloseTo(3 * DAY, 0);
    expect(steps[1].start).toBeCloseTo(3 * DAY, 0);
  });

  it('treats an upgrade that ends before the event as done', () => {
    const running = { ...queen(), firstRemaining: DAY };
    const aged = ageChain(running, 2 * DAY);
    expect(aged.from).toBe(98);
    expect(aged.steps[0].level).toBe(99);
    expect(aged.firstRemaining).toBeUndefined();
  });
});
