#!/usr/bin/env node
// Telegram alert when a home-village builder is about to be free.
//
// The Upgrade Tracker page sends each pasted village export to POST /api/alerts, which saves it to
// ALERTS_FILE. This worker reads that file every 30 seconds and sends one Telegram message when a
// builder upgrade has ALERT_LEAD_MINUTES (default 10) or less left. Runs as the `coc-alerts`
// systemd service (deploy/setup-vps.sh). No dependencies, plain Node.js 22.
//
//   node --env-file=.env.local scripts/telegram-alerts.mjs           run the worker
//   node --env-file=.env.local scripts/telegram-alerts.mjs --check   check the bot token
//   node --env-file=.env.local scripts/telegram-alerts.mjs --chat-id print the chat that sent /start
//   node --env-file=.env.local scripts/telegram-alerts.mjs --test    send a test message
//   node scripts/telegram-alerts.mjs --plan export.json              print the alert times, send nothing

import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALERTS_FILE = process.env.ALERTS_FILE || path.join(ROOT, '.data', 'alerts.json');
const STATE_FILE = path.join(path.dirname(ALERTS_FILE), 'alerts-sent.json');
const LEAD = Math.max(1, Number(process.env.ALERT_LEAD_MINUTES) || 10) * 60;
const TIME_ZONE = process.env.ALERT_TIMEZONE || 'Asia/Kolkata';
const TICK_MS = 30_000;
/** A Builder Potion makes builders work this many times faster while `boosts.builder_boost` runs. */
const POTION_SPEED = 10;

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

/**
 * Seconds of real time to finish `work` seconds of upgrade time when the builders are boosted for
 * `boost` more seconds (the export's timers are the time left at normal speed).
 */
export function realSeconds(work, boost) {
  const boosted = boost * POTION_SPEED;
  return work <= boosted ? work / POTION_SPEED : boost + (work - boosted);
}

/** Every running home-village builder upgrade in the export, soonest first. */
export function builderUpgrades(ex, nameOf) {
  const out = [];
  const seen = new Map();
  const boost = Number(ex.boosts?.builder_boost) || 0;
  const add = (id, level, timer) => {
    const name = nameOf.get(id);
    if (!name || typeof timer !== 'number' || timer <= 0) return;
    const base = `${id}:${level}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.push({ key: `${base}:${n}`, name, level: level + 1, finishAt: Math.round(ex.timestamp + realSeconds(timer, boost)) });
  };
  for (const section of ['buildings', 'traps', 'heroes', 'guardians']) {
    for (const e of ex[section] ?? []) {
      for (const t of e.types ?? []) for (const m of t.modules ?? []) add(m.data, m.lvl ?? 0, m.timer);
      add(e.data, e.lvl ?? 0, e.timer);
    }
  }
  return out.sort((a, b) => a.finishAt - b.finishAt);
}

export function clock(unix) {
  return new Date(unix * 1000).toLocaleString('en-IN', { timeZone: TIME_ZONE, weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

function minutes(seconds) {
  return Math.max(1, Math.ceil(seconds / 60));
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
  return `${head}\n${lines.join('\n')}\n\nNaya upgrade lagao, phir export dobara paste karna.`;
}

// ---------------------------------------------------------------------------
// Telegram
// ---------------------------------------------------------------------------

async function telegram(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set.');
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(15_000),
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
  const nameOf = await gameNames();
  let mtime = 0;
  let upgrades = [];
  let sent = await readJson(STATE_FILE, {});
  console.log(`Watching ${ALERTS_FILE}, alert ${LEAD / 60} min before a builder is free.`);

  const tick = async () => {
    const st = await stat(ALERTS_FILE).catch(() => null);
    if (st && st.mtimeMs !== mtime) {
      mtime = st.mtimeMs;
      const saved = await readJson(ALERTS_FILE, null);
      upgrades = saved?.export ? builderUpgrades(saved.export, nameOf) : [];
      console.log(`Loaded export of ${saved?.export?.tag}: ${upgrades.length} builder upgrades running.`);
    }
    const now = Math.floor(Date.now() / 1000);
    const due = dueAlerts(upgrades, sent, now);
    if (due.length === 0) return;
    await send(alertText(due, now));
    for (const u of due) sent[u.key] = u.finishAt;
    // Forget alerts for upgrades that finished more than a day ago.
    sent = Object.fromEntries(Object.entries(sent).filter(([, t]) => t > now - 86400));
    await writeJson(STATE_FILE, sent);
    console.log(`Sent: ${due.map((u) => u.name).join(', ')}`);
  };

  for (;;) {
    try {
      await tick();
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, TICK_MS));
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
      await send('✅ CoC builder alerts chalu hain. Builder free hone se pehle yahan message aayega.');
      console.log('Test message sent.');
      return;
    case '--plan': {
      const ex = JSON.parse(await readFile(args[1], 'utf8'));
      const list = builderUpgrades(ex, await gameNames());
      for (const u of list) console.log(`${u.name} → lvl ${u.level}: free ${clock(u.finishAt)}, alert ${clock(u.finishAt - LEAD)}`);
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
