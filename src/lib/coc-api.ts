import 'server-only';
import { cacheLife } from 'next/cache';
import demoClan from '@/data/demo-clan.json';
import demoPlayer from '@/data/demo-player.json';
import type { ApiPlayer } from './village';

/**
 * Supercell keys are locked to the server's IP. On hosts without a fixed IP (Vercel, Netlify…)
 * set COC_API_BASE=https://cocproxy.royaleapi.dev/v1 and whitelist 45.79.218.79 on the key.
 */
const BASE = (process.env.COC_API_BASE ?? 'https://api.clashofclans.com/v1').replace(/\/$/, '');

export const DEMO_TAG = 'DEMO';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; reason: string; message: string };

export interface ApiClanMember {
  tag: string;
  name: string;
  role: 'member' | 'admin' | 'coLeader' | 'leader';
  townHallLevel: number;
  expLevel: number;
  trophies: number;
  builderBaseTrophies?: number;
  clanRank: number;
  donations: number;
  donationsReceived: number;
  league?: { name: string; iconUrls?: { small?: string; tiny?: string } };
}

export interface ApiClan {
  tag: string;
  name: string;
  type: string;
  description?: string;
  location?: { name: string };
  badgeUrls: { small: string; medium: string; large: string };
  clanLevel: number;
  clanPoints: number;
  clanBuilderBasePoints?: number;
  clanCapitalPoints?: number;
  requiredTrophies: number;
  warFrequency?: string;
  warWinStreak?: number;
  warWins?: number;
  warTies?: number;
  warLosses?: number;
  isWarLogPublic?: boolean;
  warLeague?: { name: string };
  capitalLeague?: { name: string };
  members: number;
  memberList: ApiClanMember[];
  labels?: { id: number; name: string; iconUrls: { small?: string } }[];
  clanCapital?: { capitalHallLevel?: number };
}

const MESSAGES: Record<string, string> = {
  notFound: 'No account exists with this tag. Check the tag and try again.',
  accessDenied: 'The API key was rejected. Check COC_API_TOKEN and that the key allows this server’s IP.',
  'accessDenied.invalidIp': 'The API key does not allow this server’s IP address. Add the IP on developer.clashofclans.com.',
  inMaintenance: 'Clash of Clans is in maintenance right now. Try again in a few minutes.',
  requestThrottled: 'Too many requests to the Clash of Clans API. Try again shortly.',
  noToken: 'COC_API_TOKEN is not set on the server. See README → "API key".',
  network: 'Could not reach the Clash of Clans API.',
};

async function cocFetch<T>(path: string): Promise<ApiResult<T>> {
  const token = process.env.COC_API_TOKEN;
  if (!token) return { ok: false, status: 0, reason: 'noToken', message: MESSAGES.noToken };
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  } catch {
    return { ok: false, status: 0, reason: 'network', message: MESSAGES.network };
  }
  if (res.ok) return { ok: true, data: (await res.json()) as T };
  let reason = res.status === 404 ? 'notFound' : 'error';
  try {
    const body = (await res.json()) as { reason?: string };
    if (body.reason) reason = body.reason;
  } catch {
    // body is not JSON
  }
  return { ok: false, status: res.status, reason, message: MESSAGES[reason] ?? `Clash of Clans API error (${res.status}).` };
}

/** `tag` without '#', already validated. */
export async function getPlayer(tag: string): Promise<ApiResult<ApiPlayer>> {
  'use cache';
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  if (tag === DEMO_TAG) return { ok: true, data: demoPlayer as unknown as ApiPlayer };
  return cocFetch<ApiPlayer>(`/players/${encodeURIComponent(`#${tag}`)}`);
}

export async function getClan(tag: string): Promise<ApiResult<ApiClan>> {
  'use cache';
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  if (tag === DEMO_TAG) return { ok: true, data: demoClan as unknown as ApiClan };
  return cocFetch<ApiClan>(`/clans/${encodeURIComponent(`#${tag}`)}`);
}
