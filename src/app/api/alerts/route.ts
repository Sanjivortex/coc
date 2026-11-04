import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeTag } from '@/lib/format';
import { ExportParseError, parseExport } from '@/lib/village';

/** Where the latest export is kept for scripts/telegram-alerts.mjs. Outside git, survives deploys. */
const ALERTS_FILE = process.env.ALERTS_FILE || path.join(process.cwd(), '.data', 'alerts.json');
const MAX_BYTES = 512 * 1024;

/**
 * Saves the pasted village export so the Telegram worker can alert before a builder is free.
 * Only the account in ALERT_PLAYER_TAG is accepted; other villages stay in the browser only.
 */
export async function POST(req: Request) {
  const owner = normalizeTag(process.env.ALERT_PLAYER_TAG ?? '');
  if (!owner || !process.env.TELEGRAM_BOT_TOKEN) {
    return Response.json({ reason: 'notConfigured', message: 'Telegram alerts are not set up on this server.' }, { status: 503 });
  }
  const text = await req.text();
  if (text.length > MAX_BYTES) return Response.json({ reason: 'tooLarge', message: 'Export is too large.' }, { status: 413 });

  let ex;
  try {
    ex = parseExport(text);
  } catch (e) {
    const message = e instanceof ExportParseError ? e.message : 'Could not read this export.';
    return Response.json({ reason: 'badExport', message }, { status: 400 });
  }
  if (normalizeTag(ex.tag) !== owner || typeof ex.timestamp !== 'number') {
    return Response.json({ reason: 'otherAccount', message: 'Alerts are only sent for the owner’s account.' }, { status: 403 });
  }

  // Keep the newest export when an older one is pasted again.
  try {
    const prev = JSON.parse(await readFile(ALERTS_FILE, 'utf8')) as { export?: { timestamp?: number } };
    if ((prev.export?.timestamp ?? 0) > ex.timestamp) return Response.json({ ok: true, kept: 'newer' });
  } catch {
    // no saved export yet
  }

  await mkdir(path.dirname(ALERTS_FILE), { recursive: true });
  const tmp = `${ALERTS_FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify({ savedAt: Math.floor(Date.now() / 1000), export: ex }));
  await rename(tmp, ALERTS_FILE);
  return Response.json({ ok: true });
}
