import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { formatCompact, formatNumber, tagSlug } from '@/lib/format';
import type { ApiPlayer } from '@/lib/village';
import { Badge } from './ui/display';

const ROLE: Record<string, string> = { leader: 'Leader', coLeader: 'Co-Leader', admin: 'Elder', member: 'Member' };

export function PlayerHeader({ player, demo }: { player: ApiPlayer; demo: boolean }) {
  const league = player.leagueTier ?? player.league;
  const leagueIcon = league?.iconUrls?.small ?? league?.iconUrls?.medium;
  const stats: [string, string][] = [
    ['Trophies', formatNumber(player.trophies)],
    ['Best', formatNumber(player.bestTrophies)],
    ['War stars', formatNumber(player.warStars)],
    ['Donated', formatNumber(player.donations)],
    ['Received', formatNumber(player.donationsReceived)],
    ['Capital gold', formatCompact(player.clanCapitalContributions ?? 0)],
  ];
  return (
    <section className="mb-2 flex flex-col gap-6 pb-4 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Image
          src={`/game/home/town-hall/normal/level-${Math.min(player.townHallLevel, 18)}.webp`}
          alt={`Town Hall ${player.townHallLevel}`}
          width={64}
          height={64}
          className="h-16 w-16 shrink-0 object-contain drop-shadow-[0_4px_16px_rgba(240,180,41,0.25)]"
          priority
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="break-words text-2xl font-semibold tracking-tight">{player.name}</h1>
            {demo && <Badge tone="warning">Demo data</Badge>}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-3">
            <span className="font-mono text-brand">{player.tag}</span>
            <span aria-hidden>·</span>
            <span>Town Hall {player.townHallLevel}</span>
            {player.builderHallLevel ? (
              <>
                <span aria-hidden>·</span>
                <span>Builder Hall {player.builderHallLevel}</span>
              </>
            ) : null}
            <span aria-hidden>·</span>
            <span>XP {player.expLevel}</span>
            {!demo && (
              <a
                href={`https://link.clashofclans.com/en?action=OpenPlayerProfile&tag=${encodeURIComponent(player.tag)}`}
                target="_blank"
                rel="noreferrer"
                className="ml-1 inline-flex items-center gap-1 hover:text-ink"
              >
                Open in game <ExternalLink size={12} aria-hidden />
              </a>
            )}
          </p>
          {player.clan && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px]">
              {player.clan.badgeUrls.small && <Image src={player.clan.badgeUrls.small} alt="" width={18} height={18} />}
              <Link href={`/clan/${demo ? 'DEMO' : tagSlug(player.clan.tag)}`} className="font-medium text-ink hover:underline">
                {player.clan.name}
              </Link>
              {player.role && <span className="text-ink-3">{ROLE[player.role] ?? player.role}</span>}
              {league && (
                <span className="inline-flex items-center gap-1.5 text-ink-3">
                  <span aria-hidden>·</span>
                  {leagueIcon && <Image src={leagueIcon} alt="" width={18} height={18} />}
                  {league.name}
                </span>
              )}
            </p>
          )}
        </div>
      </div>
      <dl className="grid shrink-0 grid-cols-3 gap-x-6 gap-y-3 sm:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="truncate text-xs text-ink-3">{label}</dt>
            <dd className="tnum mt-0.5 text-[15px] font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
