import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ApiError } from '@/components/ApiError';
import { DEMO_TAG, getClan, type ApiClan } from '@/lib/coc-api';
import { formatNumber, normalizeTag, tagSlug } from '@/lib/format';

const ROLE: Record<string, string> = { leader: 'Leader', coLeader: 'Co-Leader', admin: 'Elder', member: 'Member' };

function slugFromParam(raw: string): string | null {
  if (raw.toUpperCase() === DEMO_TAG) return DEMO_TAG;
  const tag = normalizeTag(raw);
  return tag ? tagSlug(tag) : null;
}

export async function generateMetadata({ params }: PageProps<'/clan/[tag]'>): Promise<Metadata> {
  const slug = slugFromParam((await params).tag);
  if (!slug) return { title: 'Clan not found' };
  const res = await getClan(slug);
  return { title: res.ok ? `${res.data.name} (${res.data.tag}) · Clan` : `#${slug}` };
}

export default function ClanPage({ params }: PageProps<'/clan/[tag]'>) {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" aria-label="Loading clan" />}>
      {params.then(({ tag }) => (
        <ClanContent raw={tag} />
      ))}
    </Suspense>
  );
}

async function ClanContent({ raw }: { raw: string }) {
  const slug = slugFromParam(raw);
  if (!slug) notFound();
  const res = await getClan(slug);
  if (!res.ok) return <ApiError reason={res.reason} message={res.message} tag={slug} />;
  return <ClanView clan={res.data} demo={slug === DEMO_TAG} />;
}

function ClanView({ clan, demo }: { clan: ApiClan; demo: boolean }) {
  const thCounts = new Map<number, number>();
  for (const m of clan.memberList) thCounts.set(m.townHallLevel, (thCounts.get(m.townHallLevel) ?? 0) + 1);
  const stats: [string, string | number][] = [
    ['Clan level', clan.clanLevel],
    ['Members', `${clan.members}/50`],
    ['Clan points', clan.clanPoints],
    ['War league', clan.warLeague?.name ?? '—'],
    ['War wins', clan.warWins ?? '—'],
    ['Win streak', clan.warWinStreak ?? '—'],
    ['Capital Hall', clan.clanCapital?.capitalHallLevel ?? '—'],
    ['Required trophies', clan.requiredTrophies],
  ];
  return (
    <div className="space-y-4">
      <section className="card p-5">
        {demo && <p className="mb-4 rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">Demo data – a made-up clan.</p>}
        <div className="flex flex-wrap items-center gap-4">
          {clan.badgeUrls.medium && <Image src={clan.badgeUrls.medium} alt="" width={80} height={80} priority />}
          <div className="min-w-0 flex-1">
            <h1 className="font-display truncate text-3xl tracking-wide">{clan.name}</h1>
            <p className="text-sm text-muted">
              <span className="font-mono">{clan.tag}</span>
              {clan.location && ` · ${clan.location.name}`}
            </p>
            {clan.description && <p className="mt-2 max-w-2xl whitespace-pre-line text-sm text-muted">{clan.description}</p>}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-surface-2 px-3 py-2">
              <div className="num text-lg font-semibold">{typeof value === 'number' ? formatNumber(value) : value}</div>
              <div className="text-xs text-muted">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {[...thCounts.entries()]
            .sort((a, b) => b[0] - a[0])
            .map(([th, n]) => (
              <span key={th} className="rounded-full bg-surface-2 px-2.5 py-1">
                TH{th} × {n}
              </span>
            ))}
        </div>
      </section>

      <section className="card overflow-x-auto p-2 sm:p-4">
        <table className="num w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="px-2 py-2 font-medium">#</th>
              <th className="px-2 py-2 font-medium">Name</th>
              <th className="px-2 py-2 font-medium">TH</th>
              <th className="px-2 py-2 font-medium">Role</th>
              <th className="px-2 py-2 font-medium">Trophies</th>
              <th className="px-2 py-2 font-medium">Donated</th>
              <th className="px-2 py-2 font-medium">Received</th>
            </tr>
          </thead>
          <tbody>
            {clan.memberList.map((m) => (
              <tr key={`${m.tag}-${m.name}`} className="border-t border-line/60 hover:bg-surface-2/50">
                <td className="px-2 py-2 text-muted">{m.clanRank}</td>
                <td className="px-2 py-2">
                  <Link href={`/player/${demo ? 'DEMO' : tagSlug(m.tag)}`} className="font-medium hover:text-accent">
                    {m.name}
                  </Link>
                  <div className="font-mono text-[11px] text-muted">{m.tag}</div>
                </td>
                <td className="px-2 py-2">
                  <span className="flex items-center gap-1">
                    <Image src={`/game/home/town-hall/normal/level-${Math.min(m.townHallLevel, 18)}.webp`} alt="" width={24} height={24} />
                    {m.townHallLevel}
                  </span>
                </td>
                <td className="px-2 py-2">{ROLE[m.role] ?? m.role}</td>
                <td className="px-2 py-2">{formatNumber(m.trophies)}</td>
                <td className="px-2 py-2">{formatNumber(m.donations)}</td>
                <td className="px-2 py-2">{formatNumber(m.donationsReceived)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
