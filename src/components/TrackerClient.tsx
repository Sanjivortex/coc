'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useNow, useStoredJson } from '@/lib/client-store';
import { formatDuration, tagSlug } from '@/lib/format';
import { ExportParseError, parseExport, villageFromExport } from '@/lib/village';
import { VillageView } from './village/VillageView';

type Saved = Record<string, { text: string; savedAt: number }>;

export function TrackerClient() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [storedExports, setSaved] = useStoredJson<Saved>('coc-stats:exports');
  const [selected, setSelected] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
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
    } catch (e) {
      setError(e instanceof ExportParseError ? e.message : 'Could not read this export.');
    }
  };

  const pasteFromClipboard = async () => {
    try {
      importText(await navigator.clipboard.readText());
    } catch {
      setError('Clipboard access was blocked. Paste into the box instead (long-press → Paste).');
    }
  };

  const remove = (tag: string) => {
    const next = { ...saved };
    delete next[tag];
    setSaved(next);
    if (selected === tag) setSelected(null);
  };

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h1 className="font-display text-3xl tracking-wide">Upgrade Tracker</h1>
        <p className="mt-1 text-sm text-muted">
          In the game: <span className="text-ink">Settings → More Settings → Data Export → Copy</span>. Then paste it here. The export stays in
          your browser.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='{"tag":"#…","timestamp":…,"buildings":[…]}'
          className="mt-4 h-28 w-full resize-y rounded-xl border border-line bg-bg p-3 font-mono text-xs outline-none focus:border-accent"
          spellCheck={false}
          aria-label="Village export"
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => importText(text)}
            disabled={!text.trim()}
            className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink hover:brightness-110 disabled:opacity-40"
          >
            Import village
          </button>
          <button type="button" onClick={pasteFromClipboard} className="rounded-xl bg-surface-2 px-5 py-2.5 hover:text-accent">
            Paste from clipboard
          </button>
          <button
            type="button"
            onClick={() =>
              fetch('/demo-export.json')
                .then((r) => r.text())
                .then(importText)
                .catch(() => setError('Could not load the demo village.'))
            }
            className="rounded-xl px-4 py-2.5 text-sm text-muted hover:text-ink"
          >
            Try a demo TH18 village
          </button>
        </div>
        {Object.keys(saved).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(saved).map(([tag, s]) => (
              <span key={tag} className={`flex items-center rounded-full text-xs ${tag === active ? 'bg-accent text-accent-ink' : 'bg-surface-2'}`}>
                <button type="button" onClick={() => setSelected(tag)} className="py-1 pl-3 pr-2 font-mono">
                  {names[tag] ?? tag}
                  {now && <span className="ml-1 font-sans opacity-70">· {formatDuration(now - s.savedAt / 1000)} ago</span>}
                </button>
                <button type="button" onClick={() => remove(tag)} className="py-1 pr-3 opacity-70 hover:opacity-100" aria-label={`Remove ${tag}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {village && (
        <>
          <section className="card flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-sm">
            <span className="font-display text-2xl tracking-wide">{names[village.tag] ?? village.tag}</span>
            <span className="text-muted">
              <span className="font-mono">{village.tag}</span> · TH{village.townHall}
              {village.builderHall > 0 && ` · BH${village.builderHall}`}
              {village.timestamp && now && ` · exported ${formatDuration(now - village.timestamp)} ago`}
            </span>
            <Link href={`/player/${tagSlug(village.tag)}`} className="ml-auto text-accent underline-offset-4 hover:underline">
              Live profile →
            </Link>
          </section>
          <VillageView key={village.tag} village={village} />
        </>
      )}
    </div>
  );
}
