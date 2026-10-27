import {
  ITEMS,
  countAt,
  hallOf,
  itemMaxLevel,
  maxLevelAt,
  superchargeMax,
  type Base,
  type Item,
  type Level,
  type Queue,
  type Res,
} from './gamedata';
import type { Village } from './village';

export const HOUR = 3600;
export const DAY = 24 * HOUR;

export interface Step {
  /** Level reached when this step finishes. */
  level: number;
  /** Base upgrade time in seconds (no boosts). */
  time: number;
  cost: number;
  res: Res;
  ore?: [number, number, number];
  supercharge?: boolean;
}

/** A sequence of upgrades that must happen one after another (one building instance, one hero, one troop…). */
export interface Chain {
  id: string;
  item: Item;
  label: string;
  base: Base;
  queue: Queue;
  /** Current and target (max for the hall level) normal levels. */
  from: number;
  to: number;
  /** Current and target supercharge levels (0 when not applicable). */
  scFrom: number;
  scTo: number;
  /** Identical instances folded into this chain (walls); always 1 for timed queues. */
  count: number;
  steps: Step[];
  /** Seconds left on steps[0] when it is already running (cost already paid). */
  firstRemaining?: number;
  /** Below the previous hall level's max. */
  rushed: boolean;
  /** Not built / not unlocked yet. */
  missing: boolean;
  /** Base seconds needed from level 0 to target, and still remaining, per instance. */
  totalTime: number;
  remainingTime: number;
}

export interface ChainOptions {
  /** Current unix seconds, used to age running timers from an export. */
  now?: number;
  includeSupercharge?: boolean;
  includeCrafted?: boolean;
}

function stepsFor(levels: Level[], from: number, to: number, supercharge = false): Step[] {
  const steps: Step[] = [];
  for (let l = from + 1; l <= Math.min(to, levels.length); l++) {
    const lv = levels[l - 1];
    steps.push({ level: l, time: lv.t, cost: lv.c, res: lv.r, ore: lv.o, supercharge: supercharge || undefined });
  }
  return steps;
}

const sumTime = (levels: Level[], from: number, to: number) => {
  let s = 0;
  for (let l = from + 1; l <= Math.min(to, levels.length); l++) s += levels[l - 1].t;
  return s;
};

interface ChainInput {
  id: string;
  item: Item;
  label: string;
  levels: Level[];
  level: number;
  max: number;
  hall: number;
  /** Seconds since the export was taken, subtracted from `timer`. */
  elapsed: number;
  timer?: number;
  count?: number;
  missing?: boolean;
  sc?: { from: number; to: number; levels: Level[] };
}

function makeChain(i: ChainInput): Chain {
  // A level above our data's cap means the game is ahead of the data set: treat it as maxed.
  const max = Math.max(i.max, i.level);
  let from = i.level;
  let firstRemaining: number | undefined;
  if (i.timer !== undefined && from < max) {
    const left = i.timer - i.elapsed;
    if (left > 0) firstRemaining = left;
    else from += 1; // finished since the export was taken
  }
  const steps = stepsFor(i.levels, from, max);
  let scFrom = 0;
  let scTo = 0;
  let scTotal = 0;
  let scRemaining = 0;
  if (i.sc && i.sc.to > 0) {
    scFrom = Math.min(i.sc.from, i.sc.to);
    scTo = i.sc.to;
    steps.push(...stepsFor(i.sc.levels, scFrom, scTo, true));
    scTotal = sumTime(i.sc.levels, 0, scTo);
    scRemaining = sumTime(i.sc.levels, scFrom, scTo);
  }
  // Walls and equipment are limited by resources/ore, so only timed upgrades count as rushed.
  const timed = i.item.queue === 'builder' || i.item.queue === 'lab' || i.item.queue === 'pet';
  const prevMax = timed && i.hall > 1 ? maxLevelAt(i.levels, i.hall - 1) : 0;
  let remainingTime = sumTime(i.levels, from, max) + scRemaining;
  if (firstRemaining !== undefined && steps.length) remainingTime += firstRemaining - steps[0].time;
  return {
    id: i.id,
    item: i.item,
    label: i.label,
    base: i.item.base,
    queue: i.item.queue,
    from,
    to: max,
    scFrom,
    scTo,
    count: i.count ?? 1,
    steps,
    firstRemaining,
    rushed: from < prevMax,
    missing: i.missing ?? false,
    totalTime: sumTime(i.levels, 0, max) + scTotal,
    remainingTime,
  };
}

export function buildChains(v: Village, opts: ChainOptions = {}): Chain[] {
  const chains: Chain[] = [];
  const owned = new Map<string, number>();
  const elapsed = v.timestamp && opts.now ? Math.max(0, opts.now - v.timestamp) : 0;
  let seq = 0;
  const push = (input: Omit<ChainInput, 'id' | 'hall' | 'elapsed'>) =>
    chains.push(makeChain({ ...input, id: `${input.item.key}#${seq++}`, hall: hallOf(input.item, v), elapsed }));

  for (const e of v.entries) {
    const item = e.item;
    const hall = hallOf(item, v);

    if (e.weapon) {
      const w = item.weapons?.[String(v.townHall)];
      if (w) push({ item, label: w.name, levels: w.lv, level: e.level, max: w.lv.length, timer: e.timer });
      continue;
    }
    if (e.module !== undefined) {
      if (opts.includeCrafted === false) continue;
      const m = item.modules?.[e.module];
      // Module caps are only known for the Town Hall level the data set lists them at.
      const max = m ? maxLevelAt(m.lv, hall) : 0;
      if (m && max > 0) push({ item, label: `${item.name} · ${m.name}`, levels: m.lv, level: e.level, max, timer: e.timer });
      continue;
    }
    if (item.kind === 'townhall' || item.kind === 'helper') continue;

    owned.set(item.key, (owned.get(item.key) ?? 0) + e.count);
    const max = itemMaxLevel(item, hall);
    const scTo = opts.includeSupercharge && item.sc ? superchargeMax(item, hall) : 0;
    const sc = scTo > 0 ? { from: e.supercharge ?? 0, to: scTo, levels: item.sc! } : undefined;

    if (item.queue === 'instant' || item.queue === 'blacksmith') {
      push({ item, label: item.name, levels: item.lv, level: e.level, max, count: e.count });
    } else {
      for (let k = 0; k < e.count; k++) {
        push({ item, label: item.name, levels: item.lv, level: e.level, max, timer: k === 0 ? e.timer : undefined, sc });
      }
    }
  }

  // Things the player could have at this hall level but doesn't: unbuilt buildings, locked units.
  for (const item of ITEMS) {
    if (item.kind === 'helper' || item.kind === 'townhall' || item.kind === 'crafted' || item.kind === 'equipment') continue;
    const hall = hallOf(item, v);
    if (hall <= 0) continue;
    const max = itemMaxLevel(item, hall);
    if (max === 0) continue;
    const have = owned.get(item.key) ?? 0;
    const scTo = opts.includeSupercharge && item.sc ? superchargeMax(item, hall) : 0;
    const sc = scTo > 0 ? { from: 0, to: scTo, levels: item.sc! } : undefined;
    if (item.counts) {
      // The API does not expose buildings, so only an export can tell us what is missing.
      if (v.source !== 'export') continue;
      const missing = countAt(item, hall) - have;
      if (missing <= 0) continue;
      if (item.queue === 'instant') push({ item, label: item.name, levels: item.lv, level: 0, max, count: missing, missing: true });
      else for (let k = 0; k < missing; k++) push({ item, label: item.name, levels: item.lv, level: 0, max, missing: true, sc });
    } else if (have === 0) {
      push({ item, label: item.name, levels: item.lv, level: 0, max, missing: true });
    }
  }
  return chains;
}

/** Chains for buildings the API cannot see (e.g. 1 × Inferno Tower at level 10), so API profiles can plan them too. */
export function customChains(v: Village, item: Item, level: number, count: number, idPrefix: string): Chain[] {
  const hall = hallOf(item, v);
  const max = itemMaxLevel(item, hall);
  return Array.from({ length: count }, (_, k) =>
    makeChain({ id: `${idPrefix}#${k}`, item, label: item.name, levels: item.lv, level, max, hall, elapsed: 0 }),
  );
}

/** The same chain, stopped after its first `steps` upgrades (target level below max). */
export function limitChain(chain: Chain, steps: number): Chain {
  if (steps >= chain.steps.length) return chain;
  const kept = chain.steps.slice(0, Math.max(0, steps));
  let remainingTime = kept.reduce((s, st) => s + st.time, 0);
  if (chain.firstRemaining !== undefined && kept.length) remainingTime += chain.firstRemaining - kept[0].time;
  const last = kept[kept.length - 1];
  return {
    ...chain,
    steps: kept,
    to: last && !last.supercharge ? last.level : chain.to,
    scTo: last?.supercharge ? last.level : 0,
    firstRemaining: kept.length ? chain.firstRemaining : undefined,
    remainingTime,
  };
}

// ---------------------------------------------------------------------------
// Simulation of one worker pool (builders, laboratory or pet house)
// ---------------------------------------------------------------------------

export interface QueueSim {
  workers: number;
  /** Temporary extra workers (Goblin Builder): they can start upgrades only before `until` (seconds). */
  extra?: { count: number; until: number };
  /** Multiplier on step time and cost (e.g. 0.8 with a 20% Gold Pass boost). */
  timeFactor: number;
  costFactor: number;
  /** Potions used back to back from `start`: every busy worker runs `multiplier`× for `hours`. */
  potion?: { start: number; hours: number; multiplier: number };
  /** Builder's Apprentice / Lab Assistant: one worker gets +rate hours per hour, for 1 hour every day. */
  helperRate?: number;
  /** Steps started inside [start, end) cost and take `factor` × as long. */
  hammerJam?: { start: number; end: number; factor: number };
}

export interface ScheduledStep {
  chain: Chain;
  level: number;
  supercharge: boolean;
  start: number;
  end: number;
  /** Worker row: 0…workers-1 regular, then extra (Goblin) workers, then upgrades already running beyond capacity. */
  worker: number;
  /** Started during Hammer Jam (time and cost discounted). */
  jam: boolean;
}

export interface QueueResult {
  /** Seconds until the last upgrade of this queue finishes. */
  makespan: number;
  /** Sum of upgrade times without any boost. */
  baseWork: number;
  cost: Partial<Record<Res, number>>;
  chainEnd: Map<string, number>;
  timeline: ScheduledStep[];
  /** Rows used in `timeline` (regular + extra + overflow) and how many are regular. */
  workerRows: number;
  regularWorkers: number;
}

const addCost = (acc: Partial<Record<Res, number>>, res: Res, amount: number) => {
  if (amount > 0) acc[res] = (acc[res] ?? 0) + amount;
};

export function simulateQueue(chains: Chain[], o: QueueSim): QueueResult {
  const regular = Math.max(1, Math.floor(o.workers));
  const extraCount = Math.max(0, Math.floor(o.extra?.count ?? 0));
  const extraUntil = o.extra?.until ?? 0;
  const n = chains.length;
  const next = new Array<number>(n).fill(0);
  const rem = chains.map((c) => c.steps.reduce((s, st) => s + st.time, 0));
  const ready = new Array<boolean>(n).fill(true);
  const cost: Partial<Record<Res, number>> = {};
  const chainEnd = new Map<string, number>();
  const timeline: ScheduledStep[] = [];
  type Job = { i: number; left: number; helper: boolean; start: number; step: Step; slot: number; jam: boolean };
  const slots: (Job | null)[] = new Array(regular + extraCount).fill(null);
  const busy: Job[] = [];
  let baseWork = 0;
  let t = 0;

  const usable = (k: number, time: number) => k < regular || (k < regular + extraCount && time < extraUntil);
  const occupy = (job: Job) => {
    slots[job.slot] = job;
    busy.push(job);
  };

  // Upgrades already running take the first workers; more than we have (Goblin events) get overflow rows.
  for (let i = 0; i < n; i++) {
    const c = chains[i];
    if (c.steps.length === 0) {
      ready[i] = false;
      chainEnd.set(c.id, 0);
      continue;
    }
    if (c.firstRemaining === undefined) continue;
    next[i] = 1;
    rem[i] -= c.steps[0].time;
    baseWork += c.firstRemaining;
    if (c.firstRemaining > 0) {
      let slot = slots.findIndex((s, k) => s === null && usable(k, 0));
      if (slot < 0) slot = slots.push(null) - 1;
      occupy({ i, left: c.firstRemaining, helper: false, start: 0, step: c.steps[0], slot, jam: false });
      ready[i] = false;
    } else if (c.steps.length === 1) {
      ready[i] = false;
      chainEnd.set(c.id, 0);
    }
  }

  const jam = o.hammerJam;
  const potion = o.potion && o.potion.hours > 0 ? { start: o.potion.start, end: o.potion.start + o.potion.hours * HOUR, m: o.potion.multiplier } : null;
  const helperRate = o.helperRate ?? 0;
  const multAt = (time: number) => (potion && time >= potion.start && time < potion.end ? potion.m : 1);
  const helperOn = (time: number) => helperRate > 0 && time - Math.floor(time / DAY) * DAY < HOUR;
  const nextBoundary = (time: number) => {
    let b = Infinity;
    if (potion) {
      if (time < potion.start) b = potion.start;
      else if (time < potion.end) b = potion.end;
    }
    if (helperRate > 0) {
      const dayStart = Math.floor(time / DAY) * DAY;
      b = Math.min(b, time < dayStart + HOUR ? dayStart + HOUR : dayStart + DAY);
    }
    return b;
  };

  const startWork = () => {
    for (;;) {
      const slot = slots.findIndex((s, k) => s === null && usable(k, t));
      if (slot < 0) return;
      let best = -1;
      for (let i = 0; i < n; i++) if (ready[i] && (best < 0 || rem[i] > rem[best])) best = i;
      if (best < 0) return;
      const c = chains[best];
      const st = c.steps[next[best]];
      const inJam = !!jam && t >= jam.start && t < jam.end;
      const f = inJam ? jam!.factor : 1;
      const dur = st.time * o.timeFactor * f;
      addCost(cost, st.res, st.cost * o.costFactor * f);
      baseWork += st.time;
      rem[best] -= st.time;
      next[best]++;
      if (dur <= 0) {
        if (next[best] >= c.steps.length) {
          ready[best] = false;
          chainEnd.set(c.id, t);
        }
        continue;
      }
      ready[best] = false;
      occupy({ i: best, left: dur, helper: false, start: t, step: st, slot, jam: inJam });
    }
  };

  let helperDay = -1;
  startWork();
  for (let guard = 0; busy.length > 0; guard++) {
    if (guard > 2_000_000) throw new Error('Upgrade simulation did not finish');
    const day = Math.floor(t / DAY);
    if (helperOn(t) && helperDay !== day) {
      let pick: Job | null = null;
      for (const j of busy) if (!pick || j.left + rem[j.i] > pick.left + rem[pick.i]) pick = j;
      if (pick) {
        pick.helper = true;
        helperDay = day;
      }
    }
    const m = multAt(t);
    const hOn = helperOn(t);
    const rate = (j: Job) => m + (j.helper && hOn ? helperRate : 0);
    let dt = nextBoundary(t) - t;
    for (const j of busy) dt = Math.min(dt, j.left / rate(j));
    for (const j of busy) j.left -= rate(j) * dt;
    t += dt;
    if (!helperOn(t)) for (const j of busy) j.helper = false;
    for (let k = busy.length - 1; k >= 0; k--) {
      const j = busy[k];
      if (j.left > 1e-6) continue;
      busy.splice(k, 1);
      slots[j.slot] = null;
      const c = chains[j.i];
      timeline.push({ chain: c, level: j.step.level, supercharge: !!j.step.supercharge, start: j.start, end: t, worker: j.slot, jam: j.jam });
      if (next[j.i] < c.steps.length) ready[j.i] = true;
      else chainEnd.set(c.id, t);
    }
    startWork();
  }

  let makespan = 0;
  for (const end of chainEnd.values()) makespan = Math.max(makespan, end);
  timeline.sort((a, b) => a.start - b.start || a.worker - b.worker);
  return { makespan, baseWork, cost, chainEnd, timeline, workerRows: slots.length, regularWorkers: regular };
}

// ---------------------------------------------------------------------------
// Settings and scenarios
// ---------------------------------------------------------------------------

export interface PlanSettings {
  builders: number;
  /** Goblin Builder: one extra builder for `goblinDays` days (0 = the whole plan). */
  goblinBuilder: boolean;
  goblinDays: number;
  builderBaseBuilders: number;
  /** Gold Pass builder & research boost used in the Gold Pass scenarios, 0.1-0.2. */
  goldPass: number;
  apprentice: number;
  labAssistant: number;
  builderPotions: number;
  researchPotions: number;
  petPotions: number;
  hammers: { heroes: number; building: number; fighting: number; spells: number };
  books: { heroes: number; building: number; fighting: number; spells: number; everything: number };
  /** Hammer Jam used in the Hammer Jam scenarios: starts in `startDays`, lasts `days`, `discount` off time and cost. */
  hammerJam: { startDays: number; days: number; discount: number };
  includeSupercharge: boolean;
  includeCrafted: boolean;
}

export const DEFAULT_SETTINGS: PlanSettings = {
  builders: 6,
  goblinBuilder: false,
  goblinDays: 0,
  builderBaseBuilders: 2,
  goldPass: 0.2,
  apprentice: 0,
  labAssistant: 0,
  builderPotions: 0,
  researchPotions: 0,
  petPotions: 0,
  hammers: { heroes: 0, building: 0, fighting: 0, spells: 0 },
  books: { heroes: 0, building: 0, fighting: 0, spells: 0, everything: 0 },
  hammerJam: { startDays: 0, days: 15, discount: 0.5 },
  includeSupercharge: false,
  includeCrafted: true,
};

export type ScenarioId = 'normal' | 'items' | 'gold' | 'jam' | 'jamGold' | 'jamGoldItems';

export const SCENARIOS: { id: ScenarioId; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'items', label: 'Potions & items' },
  { id: 'gold', label: 'Gold Pass' },
  { id: 'jam', label: 'Hammer Jam' },
  { id: 'jamGold', label: 'Hammer Jam + Gold Pass' },
  { id: 'jamGoldItems', label: 'Hammer Jam + Gold Pass + potions' },
];

/** Which boosts a scenario turns on. Builders, Goblin Builder and helpers count in every scenario. */
export function scenarioFlags(id: ScenarioId) {
  return {
    items: id === 'items' || id === 'jamGoldItems',
    gold: id === 'gold' || id === 'jamGold' || id === 'jamGoldItems',
    jam: id === 'jam' || id === 'jamGold' || id === 'jamGoldItems',
  };
}

export function jamWindow(s: PlanSettings, always = false) {
  const start = always ? 0 : s.hammerJam.startDays * DAY;
  return { start, end: always ? Infinity : start + s.hammerJam.days * DAY, factor: 1 - s.hammerJam.discount };
}

type Magic = { kind: 'hammer' | 'book'; count: number; eligible: (c: Chain) => boolean };

/** Books finish a running upgrade (cost still paid); hammers skip one level for free. Both go to the longest steps. */
export function applyMagicItems(chains: Chain[], s: PlanSettings): Chain[] {
  const out = chains.map((c) => ({ ...c, steps: c.steps.map((st) => ({ ...st })) }));
  const home = (c: Chain) => c.base === 'home';
  const heroLike = (c: Chain) => home(c) && (c.item.kind === 'hero' || c.item.kind === 'pet');
  const building = (c: Chain) => home(c) && c.queue === 'builder' && c.item.kind !== 'hero';
  const fighting = (c: Chain) => home(c) && (c.item.kind === 'troop' || c.item.kind === 'siege');
  const spells = (c: Chain) => home(c) && c.item.kind === 'spell';
  const anyTimed = (c: Chain) => home(c) && (c.queue === 'builder' || c.queue === 'lab' || c.queue === 'pet');
  const magic: Magic[] = [
    { kind: 'hammer', count: s.hammers.heroes, eligible: heroLike },
    { kind: 'hammer', count: s.hammers.building, eligible: building },
    { kind: 'hammer', count: s.hammers.fighting, eligible: fighting },
    { kind: 'hammer', count: s.hammers.spells, eligible: spells },
    { kind: 'book', count: s.books.heroes, eligible: heroLike },
    { kind: 'book', count: s.books.building, eligible: building },
    { kind: 'book', count: s.books.fighting, eligible: fighting },
    { kind: 'book', count: s.books.spells, eligible: spells },
    { kind: 'book', count: s.books.everything, eligible: anyTimed },
  ];
  for (const m of magic) {
    if (m.count <= 0) continue;
    const candidates: { c: Chain; k: number; time: number; cost: number }[] = [];
    for (const c of out) {
      if (!m.eligible(c)) continue;
      c.steps.forEach((st, k) => {
        const running = k === 0 && c.firstRemaining !== undefined;
        if (m.kind === 'hammer' && running) return; // a hammer cannot be used on a running upgrade
        const time = running ? c.firstRemaining! : st.time;
        if (time > 0) candidates.push({ c, k, time, cost: running ? 0 : st.cost });
      });
    }
    // Longest upgrades first; among equally long ones, hammers save the most resources on the priciest.
    candidates.sort((a, b) => b.time - a.time || b.cost - a.cost);
    for (const { c, k } of candidates.slice(0, m.count)) {
      if (k === 0 && c.firstRemaining !== undefined) c.firstRemaining = 0;
      c.steps[k].time = 0;
      if (m.kind === 'hammer') c.steps[k].cost = 0;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Whole-village plan
// ---------------------------------------------------------------------------

export interface PlanResult {
  builder: QueueResult;
  lab: QueueResult;
  pet: QueueResult;
  builder2: QueueResult;
  lab2: QueueResult;
  /** Walls (no timer): total cost. */
  instantCost: Partial<Record<Res, number>>;
  /** Equipment ore: shiny, glowy, starry. */
  ore: [number, number, number];
  /** Seconds until the home village is fully maxed (slowest of builders, lab and pet house). */
  homeTotal: number;
  builderBaseTotal: number;
}

const POTION_MULTIPLIER: Partial<Record<Queue, number>> = { builder: 10, lab: 24, pet: 24 };

function potionsFor(queue: Queue, s: PlanSettings): number {
  return queue === 'builder' ? s.builderPotions : queue === 'lab' ? s.researchPotions : queue === 'pet' ? s.petPotions : 0;
}

/** Simulation options for one home-village queue under a scenario. */
function queueOptions(queue: 'builder' | 'lab' | 'pet', s: PlanSettings, scenario: ScenarioId, workers: number): QueueSim {
  const f = scenarioFlags(scenario);
  const jam = f.jam ? jamWindow(s) : undefined;
  // Gold Pass boosts builders and research, not the Pet House.
  const gp = f.gold && queue !== 'pet' ? 1 - s.goldPass : 1;
  const hours = f.items ? potionsFor(queue, s) : 0;
  return {
    workers,
    extra: queue === 'builder' && s.goblinBuilder ? { count: 1, until: s.goblinDays > 0 ? s.goblinDays * DAY : Infinity } : undefined,
    timeFactor: gp,
    costFactor: gp,
    // Potions are worth twice as much during Hammer Jam, so they are spent at its start.
    potion: hours > 0 ? { start: jam ? jam.start : 0, hours, multiplier: POTION_MULTIPLIER[queue]! } : undefined,
    helperRate: queue === 'builder' ? s.apprentice : queue === 'lab' ? s.labAssistant : 0,
    hammerJam: jam,
  };
}

export function planVillage(chains: Chain[], s: PlanSettings, scenario: ScenarioId = 'normal'): PlanResult {
  const f = scenarioFlags(scenario);
  const adjusted = f.items ? applyMagicItems(chains, s) : chains;
  const pick = (base: Base, queue: Queue) => adjusted.filter((c) => c.base === base && c.queue === queue);

  const builder = simulateQueue(pick('home', 'builder'), queueOptions('builder', s, scenario, s.builders));
  const lab = simulateQueue(pick('home', 'lab'), queueOptions('lab', s, scenario, 1));
  const pet = simulateQueue(pick('home', 'pet'), queueOptions('pet', s, scenario, 1));
  const builder2 = simulateQueue(pick('builder', 'builder'), { workers: s.builderBaseBuilders, timeFactor: 1, costFactor: 1 });
  const lab2 = simulateQueue(pick('builder', 'lab'), { workers: 1, timeFactor: 1, costFactor: 1 });

  const instantCost: Partial<Record<Res, number>> = {};
  const ore: [number, number, number] = [0, 0, 0];
  const wallFactor = f.jam ? 1 - s.hammerJam.discount : 1;
  for (const c of adjusted) {
    if (c.queue === 'instant') {
      // Walls have no timer, so with Hammer Jam they can all be bought at the event price.
      for (const st of c.steps) addCost(instantCost, st.res, st.cost * c.count * (c.base === 'home' ? wallFactor : 1));
    } else if (c.queue === 'blacksmith') {
      for (const st of c.steps) {
        ore[0] += (st.ore?.[0] ?? 0) * c.count;
        ore[1] += (st.ore?.[1] ?? 0) * c.count;
        ore[2] += (st.ore?.[2] ?? 0) * c.count;
      }
    }
  }

  return {
    builder,
    lab,
    pet,
    builder2,
    lab2,
    instantCost,
    ore,
    homeTotal: Math.max(builder.makespan, lab.makespan, pet.makespan),
    builderBaseTotal: Math.max(builder2.makespan, lab2.makespan),
  };
}

/** One chain on its own worker under a scenario (potions, books and hammers all go to this upgrade). */
export function simulateChain(chain: Chain, s: PlanSettings, scenario: ScenarioId): QueueResult {
  const home = chain.base === 'home';
  const timed = chain.queue === 'builder' || chain.queue === 'lab' || chain.queue === 'pet';
  if (!home || !timed) {
    return simulateQueue([chain], { workers: 1, timeFactor: 1, costFactor: 1 });
  }
  const [c] = scenarioFlags(scenario).items ? applyMagicItems([chain], s) : [chain];
  return simulateQueue([c], { ...queueOptions(chain.queue as 'builder' | 'lab' | 'pet', s, scenario, 1), extra: undefined });
}

export function chainCost(chain: Chain): Partial<Record<Res, number>> {
  const cost: Partial<Record<Res, number>> = {};
  chain.steps.forEach((st, k) => {
    if (k === 0 && chain.firstRemaining !== undefined) return;
    addCost(cost, st.res, st.cost * chain.count);
  });
  return cost;
}

export interface Progress {
  levels: number;
  maxLevels: number;
  /** 0-1, share of upgrade time already done. */
  time: number;
}

export function progressOf(chains: Chain[]): Progress {
  let levels = 0;
  let maxLevels = 0;
  let total = 0;
  let remaining = 0;
  for (const c of chains) {
    levels += (Math.min(c.from, c.to) + c.scFrom) * c.count;
    maxLevels += (c.to + c.scTo) * c.count;
    total += c.totalTime * c.count;
    remaining += c.remainingTime * c.count;
  }
  const time = total > 0 ? 1 - remaining / total : maxLevels > 0 ? levels / maxLevels : 1;
  return { levels, maxLevels, time };
}
