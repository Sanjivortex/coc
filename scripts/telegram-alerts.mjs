#!/usr/bin/env node
// Telegram alert when a home-village builder is about to be free.
//
// The Upgrade Tracker page sends each pasted village export to POST /api/alerts, which saves it to
// ALERTS_FILE. This worker:
//   - asks on Telegram, for every new export, whether a Builder Potion or Builder Bite is running
//     and how long it has left (reply "potion 2h 41m", "bite 45m", both, or "no"),
//   - sends one message when a builder upgrade has ALERT_LEAD_MINUTES (default 10) or less left,
//   - answers /status with the finish times.
// Runs as the `coc-alerts` systemd service (deploy/setup-vps.sh). No dependencies, Node.js 22.
//
//   node --env-file=.env.local scripts/telegram-alerts.mjs           run the worker
//   node --env-file=.env.local scripts/telegram-alerts.mjs --check   check the bot token
//   node --env-file=.env.local scripts/telegram-alerts.mjs --chat-id print the chat that sent /start
//   node --env-file=.env.local scripts/telegram-alerts.mjs --test    send a test message
//   node scripts/telegram-alerts.mjs --plan export.json [reply]      print finish times, send nothing

import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALERTS_FILE = process.env.ALERTS_FILE || path.join(ROOT, '.data', 'alerts.json');
const STATE_FILE = path.join(path.dirname(ALERTS_FILE), 'alerts-state.json');
const LEAD = Math.max(1, Number(process.env.ALERT_LEAD_MINUTES) || 10) * 60;
const TIME_ZONE = process.env.ALERT_TIMEZONE || 'Asia/Kolkata';
/** Full link to the Upgrade Tracker; a bare "/tracker" would show up as a bot command in Telegram. */
const TRACKER_URL = `${(process.env.SITE_URL || 'https://coc.test-hub.xyz').replace(/\/$/, '')}/tracker`;
const HOW_TO_EXPORT = [
  'Export kaise bhejna hai:',
  '1. Game me Settings → More Settings → Data Export → Copy',
  `2. Browser me kholo: ${TRACKER_URL}`,
  '3. Paste karke "Import village" dabao',
  'Phir main yahan boost ka time puchunga.',
].join('\n');
/** Long-poll wait for Telegram replies; the alert check runs between polls. */
const POLL_SECONDS = 25;

// Builders work at 1× normally. A Builder Potion adds 9× (10× total), a Builder Bite adds 1×
// (2× total), and both together give 11×. The export's timers are the time left at 1×.
const POTION_EXTRA = 9;
const BITE_EXTRA = 1;

// ---------------------------------------------------------------------------
// Export → builder upgrades with real finish times
// ---------------------------------------------------------------------------

let names;
async function gameNames() {
  if (names) return names;
  const data = JSON.parse(await readFile(path.join(ROOT, 'src', 'data', 'gamedata.json'), 'utf8'));
  names = new Map();
  for (const item of data.items) {
    if (item.base !== 'home' || item.queue !== 'builder') continue;
    if (item.dataId !== null) names.set(item.dataId, item.name);
    for (const m of item.modules ?? []) if (m.dataId !== null) names.set(m.dataId, `${item.name} ${m.name}`);
  }
  return names;
}

/** Boosts as absolute end times; a boost counts from the export's timestamp until its end. */
export function exportBoosts(ex) {
  return { potionEnd: ex.timestamp + (Number(ex.boosts?.builder_boost) || 0), biteEnd: ex.timestamp };
}

/** Unix time when `work` seconds (at 1×) are done, starting at `start` with the given boosts. */
export function finishTime(start, work, { potionEnd, biteEnd }) {
  let t = start;
  let left = work;
  for (const edge of [potionEnd, biteEnd].filter((e) => e > start).sort((a, b) => a - b)) {
    if (edge <= t) continue;
    const speed = 1 + (t < potionEnd ? POTION_EXTRA : 0) + (t < biteEnd ? BITE_EXTRA : 0);
    const capacity = (edge - t) * speed;
    if (left <= capacity) return t + left / speed;
    left -= capacity;
    t = edge;
  }
  return t + left;
}

/** Every running home-village builder upgrade in the export, soonest first. */
export function builderUpgrades(ex, nameOf, boosts = exportBoosts(ex)) {
  const out = [];
  const seen = new Map();
  const add = (id, level, timer) => {
    const name = nameOf.get(id);
    if (!name || typeof timer !== 'number' || timer <= 0) return;
    const base = `${id}:${level}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.push({ key: `${base}:${n}`, name, level: level + 1, finishAt: Math.round(finishTime(ex.timestamp, timer, boosts)) });
  };
  for (const section of ['buildings', 'traps', 'heroes', 'guardians']) {
    for (const e of ex[section] ?? []) {
      for (const t of e.types ?? []) for (const m of t.modules ?? []) add(m.data, m.lvl ?? 0, m.timer);
      add(e.data, e.lvl ?? 0, e.timer);
    }
  }
  return out.sort((a, b) => a.finishAt - b.finishAt);
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export function clock(unix) {
  return new Date(unix * 1000).toLocaleString('en-IN', { timeZone: TIME_ZONE, weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

/** "2h 41m", "45m". */
export function span(seconds) {
  const m = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

function minutes(seconds) {
  return Math.max(1, Math.ceil(seconds / 60));
}

/**
 * Reads a reply about running boosts. "2h 41m" or "potion 2h 41m" → potion, "bite 45m" → bite,
 * both can be in one message, "no" → nothing running. Returns null when it is not a boost reply.
 */
export function parseBoostReply(text) {
  const t = text.toLowerCase().trim();
  if (/^(no|nahi|nahin|nhi|nai|none|0)\b/.test(t)) return { potion: 0, bite: 0 };
  const out = {};
  // Units end at a non-letter so "2h41m" works as well as "2h 41m".
  for (const m of t.matchAll(/(potion|boost|bite)?[\s:=-]*((?:\d+\s*(?:hours|hour|hrs|hr|h|ghante|ghanta|minutes|minute|mins|min|m)(?![a-z])\s*)+)/g)) {
    const h = /(\d+)\s*(?:hours|hour|hrs|hr|h|ghante|ghanta)(?![a-z])/.exec(m[2]);
    const mm = /(\d+)\s*(?:minutes|minute|mins|min|m)(?![a-z])/.exec(m[2]);
    const seconds = (h ? Number(h[1]) * 3600 : 0) + (mm ? Number(mm[1]) * 60 : 0);
    out[m[1] === 'bite' ? 'bite' : 'potion'] = seconds;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** New boosts after a reply at `now`: a mentioned boost ends `now + time left`, others stay. */
export function applyReply(boosts, reply, exportTs, now) {
  const next = { ...boosts };
  if ('potion' in reply) next.potionEnd = reply.potion > 0 ? now + reply.potion : exportTs;
  if ('bite' in reply) next.biteEnd = reply.bite > 0 ? now + reply.bite : exportTs;
  return next;
}

function boostLine({ potionEnd, biteEnd }, now) {
  const parts = [];
  if (potionEnd > now) parts.push(`Builder Potion ${span(potionEnd - now)} (${clock(potionEnd)} tak)`);
  if (biteEnd > now) parts.push(`Builder Bite ${span(biteEnd - now)} (${clock(biteEnd)} tak)`);
  return parts.length > 0 ? parts.join(' + ') : 'koi boost nahi';
}

function upgradeList(upgrades, now, limit = 10) {
  const list = upgrades.filter((u) => u.finishAt > now).slice(0, limit);
  if (list.length === 0) return 'Koi builder upgrade nahi chal raha.';
  return list.map((u) => `• ${u.name} → lvl ${u.level}: ${clock(u.finishAt)} (${span(u.finishAt - now)})`).join('\n');
}

const REPLY_HELP = [
  'Reply karo kitna time bacha hai:',
  '• potion 2h 41m',
  '• bite 45m',
  '• potion 2h 41m bite 45m',
  '• no (koi boost nahi)',
].join('\n');

export function askText(upgrades, boosts, now) {
  return [
    `📥 Export mila: ${upgrades.length} builder upgrade chal rahe.`,
    `Export ke hisaab se: ${boostLine(boosts, now)}.`,
    '',
    'Kya abhi Builder Potion ya Builder Bite chalu hai?',
    REPLY_HELP,
    '',
    'Reply nahi kiya toh export wala time use hoga. /status se time dekh sakte ho.',
  ].join('\n');
}

export function statusText(upgrades, boosts, now) {
  return `Boost: ${boostLine(boosts, now)}\n\n${upgradeList(upgrades, now)}`;
}

/** Upgrades whose alert is due now and was not sent yet (the same upgrade from a newer export counts as sent). */
export function dueAlerts(upgrades, sent, now) {
  return upgrades.filter((u) => {
    if (now < u.finishAt - LEAD || now >= u.finishAt) return false;
    const prev = sent[u.key];
    return prev === undefined || Math.abs(prev - u.finishAt) > 15 * 60;
  });
}

export function alertText(due, now) {
  const lines = due.map((u) => `• ${u.name} → lvl ${u.level}: ${minutes(u.finishAt - now)} min (${clock(u.finishAt)})`);
  const head = due.length === 1 ? '⏰ Builder free hone wala hai' : `⏰ ${due.length} builders free hone wale hain`;
  return `${head}\n${lines.join('\n')}\n\nNaya upgrade lagao, phir export dobara yahan paste karna: ${TRACKER_URL}`;
}

// ---------------------------------------------------------------------------
// Telegram
// ---------------------------------------------------------------------------

async function telegram(method, body, timeoutMs = 15_000) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set.');
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = await res.json().catch(() => ({}));
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description ?? res.status}`);
  return json.result;
}

function send(text) {
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!chat) throw new Error('TELEGRAM_CHAT_ID is not set.');
  return telegram('sendMessage', { chat_id: chat, text });
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(value));
  await rename(tmp, file);
}

async function run() {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.log('Telegram is not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID); nothing to do.');
    return;
  }
  const chatId = String(process.env.TELEGRAM_CHAT_ID);
  const nameOf = await gameNames();
  // offset: next Telegram update to read; sent: alert already sent per upgrade;
  // boosts: potion/bite end times for the export with timestamp `exportTs`.
  const state = { offset: 0, sent: {}, exportTs: 0, boosts: null, ...(await readJson(STATE_FILE, {})) };
  const save = () => writeJson(STATE_FILE, state);
  let ex = null;
  let mtime = 0;
  let upgrades = [];
  const recompute = () => {
    upgrades = ex ? builderUpgrades(ex, nameOf, state.boosts ?? exportBoosts(ex)) : [];
  };
  console.log(`Watching ${ALERTS_FILE}, alert ${LEAD / 60} min before a builder is free.`);

  const checkExport = async () => {
    const st = await stat(ALERTS_FILE).catch(() => null);
    if (!st || st.mtimeMs === mtime) return;
    const saved = await readJson(ALERTS_FILE, null);
    if (!saved?.export) return;
    mtime = st.mtimeMs;
    ex = saved.export;
    const now = Math.floor(Date.now() / 1000);
    if (state.exportTs !== ex.timestamp || !state.boosts) {
      state.boosts = exportBoosts(ex);
      recompute();
      await send(askText(upgrades, state.boosts, now));
      state.exportTs = ex.timestamp;
      await save();
    } else {
      recompute();
    }
    console.log(`Export of ${ex.tag}: ${upgrades.length} builder upgrades running.`);
  };

  const checkAlerts = async () => {
    const now = Math.floor(Date.now() / 1000);
    const due = dueAlerts(upgrades, state.sent, now);
    if (due.length === 0) return;
    await send(alertText(due, now));
    for (const u of due) state.sent[u.key] = u.finishAt;
    // Forget alerts for upgrades that finished more than a day ago.
    state.sent = Object.fromEntries(Object.entries(state.sent).filter(([, t]) => t > now - 86400));
    await save();
    console.log(`Alert sent: ${due.map((u) => u.name).join(', ')}`);
  };

  const handle = async (text) => {
    const now = Math.floor(Date.now() / 1000);
    if (/^\/status\b/i.test(text)) return send(ex ? statusText(upgrades, state.boosts, now) : `Abhi tak koi export nahi mila.\n\n${HOW_TO_EXPORT}`);
    if (/^\/start\b/i.test(text)) return send(`Bot chalu hai. Builder free hone se 10 min pehle yahan message aayega.\n\n${HOW_TO_EXPORT}\n\n/status se time dekho.`);
    if (/^\/(tracker|export|help)\b/i.test(text)) return send(HOW_TO_EXPORT);
    const reply = parseBoostReply(text);
    if (!reply) return send(`Samjha nahi. ${REPLY_HELP}\n\nExport ke liye /help bhejo.`);
    if (!ex) return send(`Pehle export bhejo.\n\n${HOW_TO_EXPORT}`);
    state.boosts = applyReply(state.boosts ?? exportBoosts(ex), reply, ex.timestamp, now);
    recompute();
    await save();
    return send(`✅ Theek hai: ${boostLine(state.boosts, now)}.\n\n${upgradeList(upgrades, now)}`);
  };

  const poll = async () => {
    const updates = await telegram(
      'getUpdates',
      { offset: state.offset, timeout: POLL_SECONDS, allowed_updates: ['message'] },
      (POLL_SECONDS + 15) * 1000,
    );
    for (const u of updates) {
      state.offset = u.update_id + 1;
      const msg = u.message;
      // Only the owner's chat; anyone else who finds the bot is ignored.
      if (!msg?.text || String(msg.chat?.id) !== chatId) continue;
      await handle(msg.text);
    }
    if (updates.length > 0) await save();
  };

  for (;;) {
    try {
      await checkExport();
      await checkAlerts();
      await poll();
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
}

async function main(args) {
  switch (args[0]) {
    case '--check': {
      const me = await telegram('getMe');
      console.log(`@${me.username}`);
      return;
    }
    case '--chat-id': {
      const updates = await telegram('getUpdates', { allowed_updates: ['message'] });
      const msg = updates.map((u) => u.message).filter((m) => m?.chat?.type === 'private' && m.text?.startsWith('/start')).pop();
      if (!msg) throw new Error('No /start message found. Open the bot in Telegram, send /start and try again.');
      console.log(msg.chat.id);
      return;
    }
    case '--test':
      await send('✅ CoC builder alerts chalu hain. Builder free hone se pehle yahan message aayega. /status se time dekho.');
      console.log('Test message sent.');
      return;
    case '--plan': {
      const ex = JSON.parse(await readFile(args[1], 'utf8'));
      let boosts = exportBoosts(ex);
      const reply = args[2] ? parseBoostReply(args.slice(2).join(' ')) : null;
      if (reply) boosts = applyReply(boosts, reply, ex.timestamp, ex.timestamp);
      console.log(`Boost (from export time): ${boostLine(boosts, ex.timestamp)}`);
      for (const u of builderUpgrades(ex, await gameNames(), boosts)) {
        console.log(`${u.name} → lvl ${u.level}: free ${clock(u.finishAt)}, alert ${clock(u.finishAt - LEAD)}`);
      }
      return;
    }
    default:
      return run();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
