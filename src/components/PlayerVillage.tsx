'use client';

import Link from 'next/link';
import { FileCheck2 } from 'lucide-react';
import { useMemo } from 'react';
import { useNow, useStoredJson } from '@/lib/client-store';
import { formatDuration } from '@/lib/format';
import { mergeVillages, parseExport, villageFromApi, villageFromExport, type ApiPlayer } from '@/lib/village';
import { Dashboard } from './dashboard/Dashboard';

type SavedExports = Record<string, { text: string; savedAt: number }>;

/** Live API profile; if this browser has an export for the same tag, its buildings and timers are added. */
export function PlayerVillage({ player }: { player: ApiPlayer }) {
  const [exports] = useStoredJson<SavedExports>('coc-stats:exports');
  const now = useNow();
  const saved = exports?.[player.tag];
  const village = useMemo(() => {
    const api = villageFromApi(player);
    if (!saved) return api;
    try {
      return mergeVillages(api, villageFromExport(parseExport(saved.text)));
    } catch {
      return api;
    }
  }, [player, saved]);

  const notice =
    village.source === 'export' && village.timestamp ? (
      <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-line bg-panel px-4 py-2.5 text-[13px] text-ink-2">
        <FileCheck2 size={15} className="text-good" aria-hidden />
        Buildings and upgrade timers from your village export{now ? `, copied ${formatDuration(now - village.timestamp)} ago` : ''}.
        <Link href="/tracker" className="font-medium text-ink hover:underline">
          Update it
        </Link>
      </p>
    ) : undefined;

  return <Dashboard village={village} notice={notice} />;
}
