import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * GitHub webhook checks. GitHub signs each delivery with HMAC-SHA256 of the raw
 * body, using the webhook secret, in the `X-Hub-Signature-256` header as
 * `sha256=<hex>`.
 */
export function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature?.startsWith('sha256=') || !secret) return false;
  const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(body).digest('hex')}`);
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** Events that change requests, proposals, reviews, checks or the people lists. */
export const REFRESH_EVENTS = new Set([
  'discussion',
  'discussion_comment',
  'pull_request',
  'pull_request_review',
  'pull_request_review_comment',
  'check_suite',
  'check_run',
  'status',
  'push',
]);
