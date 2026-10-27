import { DEMO_TAG, getPlayer } from '@/lib/coc-api';
import { normalizeTag, tagSlug } from '@/lib/format';

/** JSON proxy for the official API, so the key never reaches the browser. */
export async function GET(_req: Request, ctx: RouteContext<'/api/player/[tag]'>) {
  const { tag } = await ctx.params;
  const normalized = tag.toUpperCase() === DEMO_TAG ? `#${DEMO_TAG}` : normalizeTag(tag);
  if (!normalized) return Response.json({ reason: 'badTag', message: 'Invalid player tag.' }, { status: 400 });
  const res = await getPlayer(tagSlug(normalized));
  if (!res.ok) {
    const status = res.status || (res.reason === 'noToken' ? 503 : 502);
    return Response.json({ reason: res.reason, message: res.message }, { status });
  }
  return Response.json(res.data);
}
