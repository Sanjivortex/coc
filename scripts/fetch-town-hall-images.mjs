#!/usr/bin/env node
// Town Hall pictures from the Clash of Clans Wiki for halls that clash-of-clans-data does not have
// yet. src/data/extra-town-halls.json maps the hall level to the wiki file. The picture is resized
// like `npm run gamedata` does (128 px WebP) and saved where the package's picture will go, so the
// package replaces it once it adds that hall. The Game data workflow runs this every hour.
//
//   node scripts/fetch-town-hall-images.mjs                  fetch the missing pictures
//   node scripts/fetch-town-hall-images.mjs --missing        list the missing ones, download nothing
//   node scripts/fetch-town-hall-images.mjs --force --print  fetch all again and print them as base64

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIST = path.join(ROOT, 'src/data/extra-town-halls.json');
const OUT_DIR = path.join(ROOT, 'public/game/home/town-hall/normal');
const IMG_SIZE = 128;
const USER_AGENT = 'CoC Stats image fetch (+https://github.com/Sanjivortex/coc)';

const args = new Set(process.argv.slice(2));
const exists = (p) => fs.access(p).then(() => true, () => false);

/** Special:FilePath redirects to the file; the CDN URL from the name's MD5 is the fallback. */
function sources(file) {
  const md5 = createHash('md5').update(file).digest('hex');
  return [
    `https://clashofclans.fandom.com/wiki/Special:FilePath/${encodeURIComponent(file)}`,
    `https://static.wikia.nocookie.net/clashofclans/images/${md5[0]}/${md5.slice(0, 2)}/${encodeURIComponent(file)}/revision/latest`,
  ];
}

async function download(file) {
  const errors = [];
  for (const url of sources(file)) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(30_000) });
      const type = res.headers.get('content-type') ?? '';
      if (res.ok && type.startsWith('image/')) return Buffer.from(await res.arrayBuffer());
      errors.push(`${url}: HTTP ${res.status} ${type}`);
    } catch (e) {
      errors.push(`${url}: ${e instanceof Error ? e.message : e}`);
    }
  }
  throw new Error(`Could not download ${file}:\n  ${errors.join('\n  ')}`);
}

async function main() {
  const list = JSON.parse(await fs.readFile(LIST, 'utf8'));
  const todo = [];
  for (const [level, file] of Object.entries(list)) {
    if (!/^\d+$/.test(level) || !/^[\w.-]+\.(png|webp|jpe?g)$/i.test(file)) throw new Error(`Bad entry in ${LIST}: ${level} → ${file}`);
    const dest = path.join(OUT_DIR, `level-${level}.webp`);
    const missing = !(await exists(dest));
    if (args.has('--missing')) {
      if (missing) console.log(`Town Hall ${level}`);
    } else if (missing || args.has('--force')) {
      todo.push({ level, file, dest });
    }
  }
  if (args.has('--missing')) return;

  const { default: sharp } = await import('sharp');
  for (const { level, file, dest } of todo) {
    const input = await download(file);
    const { width, height, format } = await sharp(input).metadata();
    await fs.mkdir(OUT_DIR, { recursive: true });
    await sharp(input).resize(IMG_SIZE, IMG_SIZE, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(dest);
    console.log(`Town Hall ${level}: ${file} (${format} ${width}×${height}) → ${path.relative(ROOT, dest)}`);
    if (args.has('--print')) console.log(`base64 level-${level}.webp ${(await fs.readFile(dest)).toString('base64')}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
