import Image from 'next/image';
import Link from 'next/link';
import { formatNumber, tagSlug } from '@/lib/format';
import type { ApiPlayer } from '@/lib/village';

const ROLE: Record<string, string> = { leader: 'Leader', coLeader: 'Co-Leader', admin: 'Elder', member: 'Member' };

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <div className="num text-lg font-semibold">{typeof value === 'number' ? formatNumber(value) : value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

export function PlayerHeader({ player, demo }: { player: ApiPlayer; demo: boolean }) {
  const league = player.leagueTier ?? player.league;
  const leagueIcon = league?.iconUrls?.small ?? league?.iconUrls?.medium;
  const gameLink = `https://link.clashofclans.com/en?action=OpenPlayerProfile&tag=${encodeURIComponent(player.tag)}`;
  return (
    <section className="card mb-4 p-5">
      {demo && (
        <p className="mb-4 rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">
          Demo data – a made-up TH{player.townHallLevel} account so you can try the site without an API key.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Image
          src={`/game/home/town-hall/normal/level-${Math.min(player.townHallLevel, 18)}.webp`}
          alt={`Town Hall ${player.townHallLevel}`}
          width={88}
          height={88}
          className="h-20 w-20 object-contain"
          priority
        />
        <div className="min-w-0 flex-1">
          <h1 className="font-display break-words text-3xl tracking-wide">{player.name}</h1>
          <p className="text-sm text-muted">
            <span className="font-mono">{player.tag}</span> · TH{player.townHallLevel} · XP {player.expLevel}
            {player.builderHallLevel ? ` · BH${player.builderHallLevel}` : ''}
          </p>
          {player.clan && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm">
              {player.clan.badgeUrls.small && <Image src={player.clan.badgeUrls.small} alt="" width={20} height={20} />}
              <Link href={`/clan/${demo ? 'DEMO' : tagSlug(player.clan.tag)}`} className="text-accent underline-offset-4 hover:underline">
                {player.clan.name}
              </Link>
              <span className="text-muted">{player.role ? ROLE[player.role] ?? player.role : ''}</span>
            </p>
          )}
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {leagueIcon && <Image src={leagueIcon} alt="" width={40} height={40} />}
          {league && <span className="text-sm">{league.name}</span>}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="Trophies" value={player.trophies} />
        <Stat label="Best trophies" value={player.bestTrophies} />
        <Stat label="War stars" value={player.warStars} />
        <Stat label="Donated" value={player.donations} />
        <Stat label="Received" value={player.donationsReceived} />
        <Stat label="Capital gold given" value={player.clanCapitalContributions ?? 0} />
      </div>
      {!demo && (
        <a href={gameLink} className="mt-3 inline-block text-xs text-muted underline-offset-4 hover:text-ink hover:underline" target="_blank" rel="noreferrer">
          Open in Clash of Clans ↗
        </a>
      )}
    </section>
  );
}
