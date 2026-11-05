import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Shield } from 'lucide-react';
import { Suspense } from 'react';
import { ApiError } from '@/components/ApiError';
import { DEMO_TAG, getClan, type ApiClan } from '@/lib/coc-api';
import { Badge, Panel } from '@/components/ui/display';
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
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl border border-line bg-panel" aria-label="Loading clan" />}>
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
    ['Level', clan.clanLevel],
    ['Members', `${clan.members}/50`],
    ['Points', formatNumber(clan.clanPoints)],
    ['War league', clan.warLeague?.name ?? '—'],
    ['War wins', clan.warWins !== undefined ? formatNumber(clan.warWins) : '—'],
    ['Win streak', clan.warWinStreak ?? '—'],
    ['Capital Hall', clan.clanCapital?.capitalHallLevel ?? '—'],
    ['Required trophies', formatNumber(clan.requiredTrophies)],
  ];
  return (
    <div className="space-y-6">
      <section className="panel-ornate relative rounded-2xl border border-line bg-panel/70 p-5">
        <span className="ribbon mb-3">Clan Castle</span>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
          {clan.badgeUrls.medium ? (
            <Image src={clan.badgeUrls.medium} alt="" width={64} height={64} className="h-16 w-16 shrink-0" priority />
          ) : (
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-line bg-raised text-ink-3">
              <Shield size={26} aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="break-words text-2xl font-semibold tracking-tight">{clan.name}</h1>
              {demo && <Badge tone="warning">Demo data</Badge>}
            </div>
            <p className="mt-1 text-[13px] text-ink-3">
              <span className="font-mono text-ink-2">{clan.tag}</span>
              {clan.location && ` · ${clan.location.name}`}
            </p>
            {clan.description && <p className="mt-2 max-w-2xl whitespace-pre-line text-[13px] text-ink-2">{clan.description}</p>}
          </div>
        </div>
          <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {stats.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="truncate text-xs text-ink-3">{label}</dt>
                <dd className="tnum mt-0.5 truncate text-[15px] font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Panel
        title="Members"
        description={[...thCounts.entries()]
          .sort((a, b) => b[0] - a[0])
          .map(([th, n]) => `TH${th} × ${n}`)
          .join(' · ')}
        bodyClassName="overflow-x-auto"
      >
        <table className="tnum w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="text-left text-xs text-ink-3">
              <th className="px-5 py-2.5 font-medium">#</th>
              <th className="px-2 py-2.5 font-medium">Player</th>
              <th className="px-2 py-2.5 font-medium">Town Hall</th>
              <th className="px-2 py-2.5 font-medium">Role</th>
              <th className="px-2 py-2.5 text-right font-medium">Trophies</th>
              <th className="px-2 py-2.5 text-right font-medium">Donated</th>
              <th className="px-5 py-2.5 text-right font-medium">Received</th>
            </tr>
          </thead>
          <tbody>
            {clan.memberList.map((m) => (
              <tr key={`${m.tag}-${m.name}`} className="border-t border-line hover:bg-hover/60">
                <td className="px-5 py-2 text-ink-3">{m.clanRank}</td>
                <td className="px-2 py-2">
                  <Link href={`/player/${demo ? 'DEMO' : tagSlug(m.tag)}`} className="font-medium text-ink hover:underline">
                    {m.name}
                  </Link>
                  <div className="font-mono text-[11px] text-ink-3">{m.tag}</div>
                </td>
                <td className="px-2 py-2">
                  <span className="inline-flex items-center gap-2">
                    <Image src={`/game/home/town-hall/normal/level-${Math.min(m.townHallLevel, 18)}.webp`} alt="" width={22} height={22} />
                    {m.townHallLevel}
                  </span>
                </td>
                <td className="px-2 py-2 text-ink-2">{ROLE[m.role] ?? m.role}</td>
                <td className="px-2 py-2 text-right">{formatNumber(m.trophies)}</td>
                <td className="px-2 py-2 text-right text-ink-2">{formatNumber(m.donations)}</td>
                <td className="px-5 py-2 text-right text-ink-2">{formatNumber(m.donationsReceived)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
