import type { Res } from './gamedata';
import { DAY, HOUR, type Chain, type Step } from './planner';

// ---------------------------------------------------------------------------
// Hammer Jam planner: every builder sticks to what the player gives it (one hero, every copy of
// a building, or "auto"), and we follow the event day by day to see how far each one gets.
// ---------------------------------------------------------------------------

export interface Lane {
  id: string;
  /** What this builder works on: one hero, or every copy of a building (lowest level first). */
  chains: Chain[];
  /** Takes the upgrade with the most work left from the shared pool instead. */
  auto?: boolean;
  /** Starts nothing at or after this time (a Goblin Builder that leaves). */
  until?: number;
}

export interface LaneOptions {
  /** Event window in seconds from the plan start; upgrades started inside it cost and take `factor` ×. */
  jam: { start: number; end: number; factor: number };
  /** Nothing new starts at or after this time; defaults to the end of the event. */
  stop?: number;
  /** Gold Pass multiplier on time and cost (1 without it). */
  boost: number;
  /** Builder Potions back to back from `start`: every busy builder works `multiplier`× as fast. */
  potion?: { start: number; hours: number; multiplier: number };
  /** Builder's Apprentice: in the first hour of every day it adds `rate` hours of work on one lane. */
  helper?: { lane: string; rate: number };
  /** Upgrades the auto lanes pick from; running ones here keep a builder busy too. */
  pool?: Chain[];
}

export interface LaneStep {
  chain: Chain;
  step: Step;
  start: number;
  end: number;
  /** Started during the event, so discounted. */
  jam: boolean;
  /** Already running when the plan starts (paid before). */
  running: boolean;
  paid: number;
}

export interface ChainOutcome {
  chain: Chain;
  /** Upgrades finished by the end of the event, and in total (the last one can finish after it). */
  doneByStop: number;
  done: number;
  last: LaneStep;
}

export interface LanePlan {
  lanes: LaneStep[][];
  /** Running upgrades no lane was assigned to: they keep one of the builders busy. */
  extra: LaneStep[];
  outcomes: Map<string, ChainOutcome>;
  cost: Partial<Record<Res, number>>;
  /** Resources saved against the normal price. */
  saved: Partial<Record<Res, number>>;
  /** Levels finished, running upgrades included. */
  levels: number;
  /** When the last upgrade finishes. */
  end: number;
}

const add = (acc: Partial<Record<Res, number>>, res: Res, v: number) => {
  if (v > 0) acc[res] = (acc[res] ?? 0) + v;
};

/** The chain as it will be `seconds` from now: a running upgrade has less time left, or is done. */
export function ageChain(c: Chain, seconds: number): Chain {
  if (seconds <= 0 || c.firstRemaining === undefined || c.steps.length === 0) return c;
  const left = c.firstRemaining - seconds;
  if (left > 0) return { ...c, firstRemaining: left, remainingTime: c.remainingTime - seconds };
  const [done, ...steps] = c.steps;
  return {
    ...c,
    steps,
    firstRemaining: undefined,
    from: done.supercharge ? c.from : done.level,
    scFrom: done.supercharge ? done.level : c.scFrom,
    remainingTime: Math.max(0, c.remainingTime - c.firstRemaining),
  };
}

export function simulateLanes(lanes: Lane[], o: LaneOptions): LanePlan {
  const stop = o.stop ?? o.jam.end;
  type Work = { chain: Chain; next: number; busy: boolean; left: number };
  const works = new Map<string, Work>();
  const track = (c: Chain) => {
    let w = works.get(c.id);
    if (!w) works.set(c.id, (w = { chain: c, next: 0, busy: false, left: c.steps.reduce((s, st) => s + st.time, 0) }));
    return w;
  };
  const pool = (o.pool ?? []).map(track);
  const own = lanes.map((l) => (l.auto ? pool : l.chains.map(track)));
  // Dedicated builders choose first, auto ones take what is left.
  const order = lanes.map((_, i) => i).sort((a, b) => Number(!!lanes[a].auto) - Number(!!lanes[b].auto));

  type Job = { w: Work; step: Step; start: number; left: number; jam: boolean; running: boolean; paid: number };
  const jobs: (Job | null)[] = lanes.map(() => null);
  const out: LaneStep[][] = lanes.map(() => []);
  const extra: Job[] = [];
  const extraDone: LaneStep[] = [];
  const cost: Partial<Record<Res, number>> = {};
  const saved: Partial<Record<Res, number>> = {};

  // A running upgrade stays with a builder assigned to it.
  for (const w of works.values()) {
    const c = w.chain;
    if (c.firstRemaining === undefined || c.steps.length === 0) continue;
    w.next = 1;
    w.left -= c.steps[0].time;
    if (c.firstRemaining <= 0) continue;
    const job: Job = { w, step: c.steps[0], start: 0, left: c.firstRemaining, jam: false, running: true, paid: 0 };
    w.busy = true;
    const k = order.find((i) => !jobs[i] && own[i].includes(w));
    if (k === undefined) extra.push(job);
    else jobs[k] = job;
  }

  const potion = o.potion && o.potion.hours > 0 ? { start: o.potion.start, end: o.potion.start + o.potion.hours * HOUR, m: o.potion.multiplier } : null;
  const helperLane = o.helper && o.helper.rate > 0 ? lanes.findIndex((l) => l.id === o.helper!.lane) : -1;
  const helperRate = o.helper?.rate ?? 0;
  const helperOn = (t: number) => helperLane >= 0 && t - Math.floor(t / DAY) * DAY < HOUR;
  let t = 0;

  const pick = (i: number): Work | null => {
    const lane = lanes[i];
    if (t >= stop || (lane.until !== undefined && t >= lane.until)) return null;
    let best: Work | null = null;
    let bestKey = 0;
    for (const w of own[i]) {
      if (w.busy || w.next >= w.chain.steps.length) continue;
      const st = w.chain.steps[w.next];
      // Auto: most work left first. Dedicated: keep copies level, lowest first.
      const key = lane.auto ? -w.left : (st.supercharge ? 1e6 : 0) + st.level;
      if (!best || key < bestKey) {
        best = w;
        bestKey = key;
      }
    }
    return best;
  };

  const record = (j: Job, list: LaneStep[]) => {
    j.w.busy = false;
    list.push({ chain: j.w.chain, step: j.step, start: j.start, end: t, jam: j.jam, running: j.running, paid: j.paid });
  };

  const startAll = () => {
    for (const i of order) {
      while (!jobs[i]) {
        const w = pick(i);
        if (!w) break;
        const st = w.chain.steps[w.next++];
        w.left -= st.time;
        const jam = t >= o.jam.start && t < o.jam.end;
        const f = o.boost * (jam ? o.jam.factor : 1);
        const paid = st.cost * f;
        add(cost, st.res, paid);
        add(saved, st.res, st.cost - paid);
        const job: Job = { w, step: st, start: t, left: st.time * f, jam, running: false, paid };
        if (job.left <= 0) record(job, out[i]);
        else {
          w.busy = true;
          jobs[i] = job;
        }
      }
    }
  };

  startAll();
  for (let guard = 0; jobs.some(Boolean) || extra.length > 0; guard++) {
    if (guard > 1_000_000) throw new Error('Hammer Jam simulation did not finish');
    const m = potion && t >= potion.start && t < potion.end ? potion.m : 1;
    const h = helperOn(t);
    const rate = (i: number) => m + (h && i === helperLane ? helperRate : 0);
    let next = Infinity;
    if (potion) next = t < potion.start ? potion.start : t < potion.end ? potion.end : Infinity;
    if (helperLane >= 0) {
      const day = Math.floor(t / DAY) * DAY;
      next = Math.min(next, h ? day + HOUR : day + DAY);
    }
    let dt = next - t;
    jobs.forEach((j, i) => {
      if (j) dt = Math.min(dt, j.left / rate(i));
    });
    for (const j of extra) dt = Math.min(dt, j.left / m);
    jobs.forEach((j, i) => {
      if (j) j.left -= rate(i) * dt;
    });
    for (const j of extra) j.left -= m * dt;
    t += dt;
    jobs.forEach((j, i) => {
      if (j && j.left <= 1e-6) {
        record(j, out[i]);
        jobs[i] = null;
      }
    });
    for (let k = extra.length - 1; k >= 0; k--) {
      if (extra[k].left > 1e-6) continue;
      record(extra[k], extraDone);
      extra.splice(k, 1);
    }
    startAll();
  }

  const outcomes = new Map<string, ChainOutcome>();
  const all = [...out.flat(), ...extraDone].sort((a, b) => a.end - b.end);
  for (const s of all) {
    let oc = outcomes.get(s.chain.id);
    if (!oc) outcomes.set(s.chain.id, (oc = { chain: s.chain, doneByStop: 0, done: 0, last: s }));
    oc.done++;
    if (s.end <= stop + 1e-6) oc.doneByStop++;
    oc.last = s;
  }
  return {
    lanes: out,
    extra: extraDone,
    outcomes,
    cost,
    saved,
    levels: all.length,
    end: all.reduce((m, s) => Math.max(m, s.end), 0),
  };
}

export interface JamSetup {
  /** Unix seconds. */
  now: number;
  jamStart: number;
  jamEnd: number;
  discount: number;
  /** Gold Pass builder boost (0 without the pass). */
  goldPass: number;
  potions: number;
  apprentice?: { level: number; lane: string };
  lanes: Lane[];
  pool: Chain[];
}

export interface JamPlan {
  /** Unix seconds the plan starts: the start of the event, or now if it is already on. */
  origin: number;
  /** The lanes with their chains as they will be at `origin`. */
  lanes: Lane[];
  plan: LanePlan;
  /** The same builders without the event, to show what it adds. */
  normal: LanePlan;
}

/** Builders start when the event does; upgrades running now are aged to that moment. */
export function planJam(s: JamSetup): JamPlan {
  const origin = Math.max(s.now, s.jamStart);
  const aged = new Map<string, Chain>();
  const age = (c: Chain) => {
    let a = aged.get(c.id);
    if (!a) aged.set(c.id, (a = ageChain(c, origin - s.now)));
    return a;
  };
  const lanes = s.lanes.map((l) => ({ ...l, chains: l.chains.map(age) }));
  const pool = s.pool.map(age);
  const options = (factor: number): LaneOptions => ({
    jam: { start: s.jamStart - origin, end: s.jamEnd - origin, factor },
    boost: 1 - s.goldPass,
    potion: s.potions > 0 ? { start: 0, hours: s.potions, multiplier: 10 } : undefined,
    helper: s.apprentice && s.apprentice.level > 0 ? { lane: s.apprentice.lane, rate: s.apprentice.level } : undefined,
    pool,
  });
  return { origin, lanes, plan: simulateLanes(lanes, options(1 - s.discount)), normal: simulateLanes(lanes, options(1)) };
}
