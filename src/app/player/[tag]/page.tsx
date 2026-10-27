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
      <div className="card h-48" />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card h-64" />
        <div className="card h-96" />
      </div>
    </div>
  );
}
