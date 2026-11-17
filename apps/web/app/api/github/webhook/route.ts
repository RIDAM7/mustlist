import { after } from 'next/server';
import { revalidateTag } from 'next/cache';
import { appWritesEnabled, installationToken } from '@/lib/community/github/app';
import { REFRESH_EVENTS, verifySignature } from '@/lib/community/github/webhook';
import { addComment, closeRequest, getDiscussion } from '@/lib/community/github/write';
import { REQUESTS_CATEGORY } from '@/lib/community/links';
import { COMMUNITY_TAG } from '@/lib/community/load';

/**
 * POST /library/api/github/webhook: GitHub calls this when a discussion, pull
 * request, review or check changes. A valid signature marks the community data
 * stale, so the next visit reads GitHub again. When a proposal that names a
 * request on its own line ("Request: #12", as the site and the PR template
 * write it) is merged, that request is closed as resolved.
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

  if (event === 'pull_request' && appWritesEnabled) {
    const payload = JSON.parse(body) as MergedPayload;
    const pr = payload.pull_request;
    if (payload.action === 'closed' && pr?.merged) after(() => resolveRequests(pr));
  }
  return Response.json({ ok: true, event, refreshed: refresh });
}

interface MergedPayload {
  action: string;
  pull_request?: { number: number; merged: boolean; body: string | null; html_url: string };
}

/** Close the requests a merged proposal names, with a note pointing at it. */
async function resolveRequests(pr: NonNullable<MergedPayload['pull_request']>): Promise<void> {
  const numbers = [...(pr.body ?? '').matchAll(/^Request: #(\d+)\s*$/gm)].map((m) => Number(m[1]));
  if (numbers.length === 0) return;
  try {
    const token = await installationToken();
    for (const number of numbers) {
      const discussion = await getDiscussion(token, number).catch(() => undefined);
      if (!discussion || discussion.closed || discussion.category !== REQUESTS_CATEGORY) continue;
      await addComment(
        token,
        discussion.id,
        `Resolved by proposal #${pr.number}, now accepted: ${pr.html_url}`,
      );
      await closeRequest(token, discussion.id, 'RESOLVED');
    }
    revalidateTag(COMMUNITY_TAG, { expire: 0 });
  } catch (error) {
    console.error('[webhook] could not resolve linked requests', error);
  }
}
