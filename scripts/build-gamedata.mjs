// Builds src/data/gamedata.json (compact upgrade data) and public/game/** (resized images)
// from the `clash-of-clans-data` package.
//
// Usage:
//   node scripts/build-gamedata.mjs            # data + images
//   node scripts/build-gamedata.mjs --no-images
//
// Re-run after `npm update clash-of-clans-data` whenever Supercell ships a balance update.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG_DIR = path.join(ROOT, 'node_modules/clash-of-clans-data');
const DATA_DIR = path.join(PKG_DIR, 'data');
const OUT_JSON = path.join(ROOT, 'src/data/gamedata.json');
const OUT_IMG_DIR = path.join(ROOT, 'public/game');
const IMG_SIZE = 128;
const withImages = !process.argv.includes('--no-images');

const RES = {
  Gold: 'G',
  Elixir: 'E',
  'Dark Elixir': 'D',
  'Gold or Elixir': 'GE',
  'Builder Gold': 'BG',
  'Builder Elixir': 'BE',
  'Builder Gold or Builder Elixir': 'BGE',
  Gems: 'GEM',
};

/** folder (relative to data/) → kind + queue */
const FOLDERS = [
  ['home/defenses', 'defense', 'builder'],
  ['home/traps', 'trap', 'builder'],
  ['home/walls', 'wall', 'instant'],
  ['home/army-buildings', 'army', 'builder'],
  ['home/resource-buildings', 'resource', 'builder'],
  ['home/other', 'other', 'builder'],
  ['home/other/helpers', 'helper', 'none'],
  ['home/town-hall', 'townhall', 'builder'],
  ['home/guardians', 'guardian', 'builder'],
  ['home/crafted-defenses', 'crafted', 'builder'],
  ['home/heroes', 'hero', 'builder'],
  ['home/pets', 'pet', 'pet'],
  ['home/troops', 'troop', 'lab'],
  ['home/spells', 'spell', 'lab'],
  ['home/siege-machines', 'siege', 'lab'],
  ['home/hero-equipment', 'equipment', 'blacksmith'],
  ['builder/defenses', 'defense', 'builder'],
  ['builder/traps', 'trap', 'builder'],
  ['builder/walls', 'wall', 'instant'],
  ['builder/army-buildings', 'army', 'builder'],
  ['builder/resource-buildings', 'resource', 'builder'],
  ['builder/other', 'other', 'builder'],
  ['builder/builder-hall', 'townhall', 'builder'],
  ['builder/heroes', 'hero', 'builder'],
  ['builder/troops', 'troop', 'lab'],
];

const seconds = (t) => (t ? (t.days ?? 0) * 86400 + (t.hours ?? 0) * 3600 + (t.minutes ?? 0) * 60 + (t.seconds ?? 0) : 0);
const res = (name) => {
  if (!name) return 'E';
  const code = RES[name];
  if (!code) throw new Error(`Unknown resource "${name}"`);
  return code;
};

async function readJson(rel) {
  return JSON.parse(await fs.readFile(path.join(DATA_DIR, rel), 'utf8'));
}

async function listJson(folder) {
  const dir = path.join(DATA_DIR, folder);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isFile() && e.name.endsWith('.json')).map((e) => path.join(folder, e.name));
}

// Images: source path (relative to package) → public URL. Filled while building items, written at the end.
const images = new Map();
function img(src) {
  if (!src) return null;
  const rel = src.replace(/^images\//, '').replace(/\.(png|webp|jpg)$/i, '.webp');
  const url = `/game/${rel}`;
  images.set(src, path.join(OUT_IMG_DIR, rel));
  return url;
}

// Hall level → Town Hall / Builder Hall maps for buildings that gate other items.
function hallMap(levels, key) {
  const m = {};
  for (const l of levels) m[l.level] = l[key];
  return m;
}

function counts(avail, hallKey) {
  if (!avail) return undefined;
  return avail.map((a) => [a[hallKey], a.countAfterMerges ?? a.count]);
}

async function main() {
  const pkg = JSON.parse(await fs.readFile(path.join(PKG_DIR, 'package.json'), 'utf8'));
  const heroHall = await readJson('home/army-buildings/hero-hall.json');
  const blacksmith = await readJson('home/army-buildings/blacksmith.json');
  const starLab = await readJson('builder/army-buildings/star-laboratory.json');
  const heroHallTH = hallMap(heroHall.levels, 'townHallRequired');
  const blacksmithTH = hallMap(blacksmith.levels, 'townHallRequired');
  const starLabBH = hallMap(starLab.levels, 'builderHallRequired');

  const items = [];
  const seen = new Set();

  for (const [folder, kind, queue] of FOLDERS) {
    const base = folder.split('/')[0];
    for (const file of await listJson(folder)) {
      const d = await readJson(file);
      if (!d || typeof d !== 'object' || Array.isArray(d)) continue;
      const key = `${base}:${d.id}`;
      if (seen.has(key)) throw new Error(`Duplicate key ${key}`);
      seen.add(key);

      const item = {
        key,
        id: d.id,
        dataId: typeof d.dataId === 'number' ? d.dataId : null,
        name: d.name,
        base,
        kind,
        queue,
        icon: null,
        lv: [],
      };
      if (d.troopType) item.sub = d.troopType;
      if (d.spellType) item.sub = d.spellType;

      if (kind === 'crafted') {
        // Crafted defenses: three independently upgraded modules, each its own chain.
        if (!d.isCurrent) continue;
        item.icon = img(d.images?.[0]?.normal);
        item.lv = [];
        item.modules = d.modules.map((m) => ({
          dataId: m.dataId ?? null,
          name: m.name,
          lv: m.upgrades.map((u) => ({ t: seconds(u.buildTime), c: u.buildCost, r: res(u.buildCostResource), h: 18 })),
        }));
        item.counts = [[18, 1]];
        items.push(item);
        continue;
      }

      const levels = d.levels ?? [];
      if (levels.length === 0) continue;

      if (kind === 'helper') {
        item.icon = img(d.images?.normal);
        item.lv = levels.map((l) => ({ t: 0, c: l.upgradeCost ?? 0, r: 'GEM', h: l.townHallRequired, w: l.workRate ?? 0 }));
        items.push(item);
        continue;
      }

      if (kind === 'equipment') {
        item.icon = img(d.images?.icon);
        item.hero = d.hero;
        item.rarity = d.rarity;
        item.lv = levels.map((l) => ({
          t: 0,
          c: 0,
          r: 'ORE',
          h: blacksmithTH[l.blacksmithLevelRequired] ?? 99,
          o: [l.upgradeShinyOre ?? 0, l.upgradeGlowingOre ?? 0, l.upgradeStarryOre ?? 0],
        }));
        items.push(item);
        continue;
      }

      if (kind === 'hero') {
        item.icon = img(d.images?.icon);
        item.lv = levels.map((l) => ({
          t: seconds(l.upgradeTime),
          c: l.upgradeCost ?? 0,
          r: res(l.upgradeCostResource),
          h: base === 'home' ? heroHallTH[l.heroHallLevelRequired] ?? 99 : l.builderHallLevelRequired,
        }));
        items.push(item);
        continue;
      }

      if (kind === 'pet') {
        item.icon = img(d.images?.icon);
        item.lv = levels.map((l) => ({ t: seconds(l.upgradeTime), c: l.upgradeCost ?? 0, r: res(l.upgradeCostResource), h: l.townHallRequired }));
        items.push(item);
        continue;
      }

      if (kind === 'troop' || kind === 'spell' || kind === 'siege') {
        item.icon = img(d.images?.icon);
        item.lv = levels.map((l) => ({
          t: seconds(l.researchTime),
          c: l.researchCost ?? 0,
          r: res(l.researchCostResource),
          h: base === 'home' ? l.townHallRequired : starLabBH[l.starLabRequired] ?? 99,
        }));
        items.push(item);
        continue;
      }

      // Buildings, traps, walls, town/builder hall, guardians, other.
      const hallKey = base === 'home' ? 'townHallRequired' : 'builderHallRequired';
      const normal = levels.filter((l) => !l.supercharge);
      const supercharge = levels.filter((l) => l.supercharge);
      const lvl = (l, i) => ({
        t: seconds(l.buildTime),
        c: l.buildCost ?? 0,
        r: res(l.buildCostResource),
        // Halls gate themselves: level N needs hall N-1 to start, so treat as available at N.
        h: kind === 'townhall' ? i + 1 : l[hallKey] ?? 1,
        img: img(l.images?.normal),
      });
      item.lv = normal.map(lvl);
      if (supercharge.length) item.sc = supercharge.map((l) => ({ t: seconds(l.buildTime), c: l.buildCost ?? 0, r: res(l.buildCostResource), h: l[hallKey] ?? 99 }));
      item.icon = item.lv[item.lv.length - 1]?.img ?? null;
      item.counts =
        kind === 'townhall'
          ? undefined
          : counts(d.availablePerTownHall ?? d.availablePerBuilderHall, base === 'home' ? 'townHallLevel' : 'builderHallLevel');
      if (kind === 'townhall' && base === 'home') {
        // Town Hall weapons (e.g. TH17 Inferno Artillery): weapon levels per TH level.
        item.weapons = {};
        levels.forEach((l) => {
          const w = l.weapon;
          if (w && w.levels?.length > 1) {
            item.weapons[l.level] = {
              name: w.name,
              lv: w.levels.map((x) => ({ t: seconds(x.buildTime), c: x.buildCost ?? 0, r: res(x.buildCostResource), h: l.level })),
            };
          }
        });
      }
      items.push(item);
    }
  }

  const magicFiles = [
    'potions/builder-potion.json',
    'potions/research-potion.json',
    'potions/pet-potion.json',
    'books/book-of-heroes.json',
    'books/book-of-building.json',
    'books/book-of-fighting.json',
    'books/book-of-spells.json',
    'books/book-of-everything.json',
    'hammers/hammer-of-heroes.json',
    'hammers/hammer-of-building.json',
    'hammers/hammer-of-fighting.json',
    'hammers/hammer-of-spells.json',
  ];
  const magic = {};
  for (const f of magicFiles) {
    const d = await readJson(`magic-items/${f}`);
    magic[d.id] = { name: d.name, description: d.description, effect: d.effect, icon: img(d.image) };
  }

  const out = {
    source: `${pkg.name}@${pkg.version}`,
    maxTownHall: Math.max(...heroHall.levels.map((l) => l.townHallRequired)),
    maxBuilderHall: Math.max(...starLab.levels.map((l) => l.builderHallRequired)),
    items,
    magic,
  };

  await fs.mkdir(path.dirname(OUT_JSON), { recursive: true });
  await fs.writeFile(OUT_JSON, JSON.stringify(out));
  const kb = (Buffer.byteLength(JSON.stringify(out)) / 1024).toFixed(0);
  console.log(`Wrote ${path.relative(ROOT, OUT_JSON)}: ${items.length} items, ${kb} KB`);

  if (!withImages) return;
  const { default: sharp } = await import('sharp');
  let written = 0;
  for (const [src, dest] of images) {
    const from = path.join(PKG_DIR, src);
    try {
      await fs.access(from);
    } catch {
      continue;
    }
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await sharp(from).resize(IMG_SIZE, IMG_SIZE, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(dest);
    written++;
  }
  console.log(`Wrote ${written} images to ${path.relative(ROOT, OUT_IMG_DIR)}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
