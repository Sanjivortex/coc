import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ApiError } from '@/components/ApiError';
import { PlayerHeader } from '@/components/PlayerHeader';
import { PlayerVillage } from '@/components/PlayerVillage';
import { DEMO_TAG, getPlayer } from '@/lib/coc-api';
import { normalizeTag, tagSlug } from '@/lib/format';

function slugFromParam(raw: string): string | null {
  if (raw.toUpperCase() === DEMO_TAG) return DEMO_TAG;
  const tag = normalizeTag(raw);
  return tag ? tagSlug(tag) : null;
}

export async function generateMetadata({ params }: PageProps<'/player/[tag]'>): Promise<Metadata> {
  const slug = slugFromParam((await params).tag);
  if (!slug) return { title: 'Player not found' };
  const res = await getPlayer(slug);
  if (!res.ok) return { title: `#${slug}` };
  const p = res.data;
  return {
    title: `${p.name} (${p.tag}) · TH${p.townHallLevel}`,
    description: `${p.name}'s Clash of Clans progress: heroes, pets, equipment, troops and time to max Town Hall ${p.townHallLevel}.`,
  };
}

export default function PlayerPage({ params }: PageProps<'/player/[tag]'>) {
  return <Suspense fallback={<ProfileSkeleton />}>{params.then(({ tag }) => <PlayerContent raw={tag} />)}</Suspense>;
}

async function PlayerContent({ raw }: { raw: string }) {
  const slug = slugFromParam(raw);
  if (!slug) notFound();
  const res = await getPlayer(slug);
  if (!res.ok) return <ApiError reason={res.reason} message={res.message} tag={slug} />;
  return (
    <>
      <PlayerHeader player={res.data} demo={slug === DEMO_TAG} />
      <PlayerVillage player={res.data} />
    </>
  );
}

function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading player">
      <div className="flex items-center gap-4 pb-4">
        <div className="h-16 w-16 rounded-xl bg-panel" />
        <div className="space-y-2">
          <div className="h-6 w-48 rounded bg-panel" />
          <div className="h-4 w-72 rounded bg-panel" />
        </div>
      </div>
      <div className="h-11 border-b border-line" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[5fr_7fr]">
        <div className="h-64 rounded-xl border border-line bg-panel" />
        <div className="h-64 rounded-xl border border-line bg-panel" />
      </div>
    </div>
  );
}
