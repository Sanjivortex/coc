'use client';

import Link from 'next/link';
import { ClipboardPaste, FileUp, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNow, useStoredJson } from '@/lib/client-store';
import { formatDuration, tagSlug } from '@/lib/format';
import { ExportParseError, parseExport, villageFromExport } from '@/lib/village';
import { Dashboard } from './dashboard/Dashboard';
import { Button } from './ui/controls';
import { buttonClass } from './ui/styles';

type Saved = Record<string, { text: string; savedAt: number }>;

export function TrackerClient() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [storedExports, setSaved] = useStoredJson<Saved>('coc-stats:exports');
  const [selected, setSelected] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [alertNote, setAlertNote] = useState<string | null>(null);
  const now = useNow();

  const saved = useMemo(() => storedExports ?? {}, [storedExports]);
  const latest = useMemo(() => Object.entries(saved).sort((a, b) => b[1].savedAt - a[1].savedAt)[0]?.[0] ?? null, [saved]);
  const active = selected && saved[selected] ? selected : latest;

  const village = useMemo(() => {
    if (!active) return null;
    try {
      return villageFromExport(parseExport(saved[active].text));
    } catch {
      return null;
    }
  }, [active, saved]);

  // Name and clan are not in the export; ask the API (silently skipped when no key is configured).
  useEffect(() => {
    if (!active) return;
    const ctrl = new AbortController();
    fetch(`/api/player/${tagSlug(active)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((p: { name?: string } | null) => {
        if (p?.name) setNames((n) => ({ ...n, [active]: p.name! }));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [active]);

  const importText = (raw: string) => {
    try {
      const ex = parseExport(raw);
      setSaved({ ...saved, [ex.tag]: { text: raw.trim(), savedAt: Date.now() } });
      setSelected(ex.tag);
      setText('');
      setError(null);
      setEditing(false);
      // Telegram builder alerts: the server keeps the owner's latest export. Other accounts (403)
      // and servers without Telegram (503) are skipped silently.
      setAlertNote(null);
      fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw.trim() })
        .then(async (r) => {
          if (r.ok) setAlertNote('Telegram alerts updated for this export.');
          else if (r.status !== 403 && r.status !== 503) {
            const body = (await r.json().catch(() => null)) as { message?: string } | null;
            setAlertNote(`Telegram alerts not updated: ${body?.message ?? `error ${r.status}`}`);
          }
        })
        .catch(() => setAlertNote('Telegram alerts not updated: server not reachable.'));
    } catch (e) {
      setError(e instanceof ExportParseError ? e.message : 'Could not read this export.');
    }
  };

  const pasteFromClipboard = async () => {
    try {
      importText(await navigator.clipboard.readText());
    } catch {
      setError('Clipboard access was blocked. Paste into the box instead.');
    }
  };

  const remove = (tag: string) => {
    const next = { ...saved };
    delete next[tag];
    setSaved(next);
    if (selected === tag) setSelected(null);
  };

  const showForm = !village || editing;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Upgrade Tracker</h1>
          <p className="mt-1 text-[13px] text-ink-3">Every building, trap, wall and running timer from the game&apos;s village export. Saved only in this browser.</p>
        </div>
        {Object.keys(saved).length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(saved).map(([tag, s]) => (
              <span key={tag} className={`flex items-center rounded-lg border text-[13px] ${tag === active ? 'border-line-strong bg-raised text-ink' : 'border-line text-ink-2'}`}>
                <button type="button" onClick={() => setSelected(tag)} className="py-1 pl-3 pr-2">
                  {names[tag] ?? <span className="font-mono">{tag}</span>}
                  {now && <span className="ml-1.5 text-xs text-ink-3">{formatDuration(now - s.savedAt / 1000)} ago</span>}
                </button>
                <button type="button" onClick={() => remove(tag)} className="py-1 pr-2 text-ink-3 hover:text-critical" aria-label={`Remove ${tag}`}>
                  <X size={14} />
                </button>
              </span>
            ))}
            {!showForm && (
              <Button size="sm" onClick={() => setEditing(true)}>
                <FileUp size={14} aria-hidden /> Import another
              </Button>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <section className="mb-6 grid gap-6 rounded-xl border border-line bg-panel p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='Paste the copied text here: {"tag":"#…","timestamp":…,"buildings":[…]}'
              className="h-32 w-full resize-y rounded-lg border border-line bg-bg p-3 font-mono text-xs outline-none placeholder:font-sans placeholder:text-ink-3 focus:border-line-strong"
              spellCheck={false}
              aria-label="Village export"
            />
            {error && <p className="mt-2 text-[13px] text-critical">{error}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => importText(text)} disabled={!text.trim()}>
                Import village
              </Button>
              <Button onClick={pasteFromClipboard}>
                <ClipboardPaste size={16} aria-hidden /> Paste from clipboard
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  fetch('/demo-export.json')
                    .then((r) => r.text())
                    .then(importText)
                    .catch(() => setError('Could not load the demo village.'))
                }
              >
                <Sparkles size={16} aria-hidden /> Try a demo TH18 village
              </Button>
              {village && (
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
          <ol className="space-y-2.5 text-[13px] text-ink-2 lg:border-l lg:border-line lg:pl-6">
            {['Open Settings in Clash of Clans', 'Tap More Settings', 'Scroll to Data Export, tap Copy', 'Paste it here'].map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span className="tnum grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line bg-raised text-xs">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </section>
      )}

      {village && (
        <Dashboard
          key={village.tag}
          village={village}
          notice={
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-panel px-4 py-2.5 text-[13px] text-ink-2">
              <span>
                <span className="font-medium text-ink">{names[village.tag] ?? village.tag}</span>
                <span className="mx-2" aria-hidden>
                  ·
                </span>
                Town Hall {village.townHall}
                {village.builderHall > 0 && ` · Builder Hall ${village.builderHall}`}
                {village.timestamp && now && ` · copied ${formatDuration(now - village.timestamp)} ago`}
                {alertNote && <span className="ml-2 text-ink-3">· {alertNote}</span>}
              </span>
              <Link href={`/player/${tagSlug(village.tag)}`} className={buttonClass('ghost', 'sm')}>
                Live profile
              </Link>
            </div>
          }
        />
      )}
    </div>
  );
}
