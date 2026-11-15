import { revalidateTag } from 'next/cache';
import { REFRESH_EVENTS, verifySignature } from '@/lib/community/github/webhook';
import { COMMUNITY_TAG } from '@/lib/community/load';

/**
 * POST /library/api/github/webhook: GitHub calls this when a discussion, pull
 * request, review or check changes. A valid signature marks the community data
 * stale, so the next visit reads GitHub again.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.MUSTLIST_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: 'Webhook is not configured' }, { status: 503 });

  const body = await request.text();
  if (!verifySignature(body, request.headers.get('x-hub-signature-256'), secret)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = request.headers.get('x-github-event') ?? '';
  const refresh = REFRESH_EVENTS.has(event);
  // Serve fresh data on the next request: a reply on GitHub should show up right away.
  if (refresh) revalidateTag(COMMUNITY_TAG, { expire: 0 });
  return Response.json({ ok: true, event, refreshed: refresh });
}
