'use server';

import { updateTag } from 'next/cache';
import { headers } from 'next/headers';
import * as z from 'zod';
import { stackTitle } from '@mustlist/schema/site';
import { getAuth } from '@/lib/auth';
import { topicName } from '@/lib/topics';
import * as gh from './github/write';
import { COMMUNITY_TAG } from './load';

/**
 * Server Actions for the community pages (D-021 step B). Each one checks the
 * input, gets the signed-in person's GitHub token from their session, writes to
 * GitHub as them, and marks the cached community data stale so they see their
 * own change at once. GitHub enforces who may do what (only maintainers can
 * close someone else's request, nobody can approve their own proposal).
 */

export type ActionResult<T extends object = object> =
  ({ ok: true } & T) | { ok: false; error: string; signIn?: boolean };

const SIGN_IN_AGAIN = 'Your GitHub sign-in has expired. Sign in again.';

async function githubToken(): Promise<{ token: string } | { fail: ActionResult<never> }> {
  const auth = getAuth();
  if (!auth) return { fail: { ok: false, error: 'Sign-in is not set up on this site.' } };
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return { fail: { ok: false, error: 'Sign in with GitHub first.', signIn: true } };
  try {
    // Refreshes the 8-hour token when needed; nextCookies() stores the new one.
    const { accessToken } = await auth.api.getAccessToken({
      body: { useAccountCookie: true },
      headers: requestHeaders,
    });
    if (!accessToken) return { fail: { ok: false, error: SIGN_IN_AGAIN, signIn: true } };
    return { token: accessToken };
  } catch {
    return { fail: { ok: false, error: SIGN_IN_AGAIN, signIn: true } };
  }
}

function failure(error: unknown): { ok: false; error: string; signIn?: boolean } {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  if (message === 'GitHub sign-in expired')
    return { ok: false, error: SIGN_IN_AGAIN, signIn: true };
  if (error instanceof gh.GitHubWriteError) return { ok: false, error: `GitHub: ${message}` };
  console.error('[community] write failed', error);
  return { ok: false, error: 'Could not reach GitHub. Try again.' };
}

/** Runs a write with the signed-in person's token, then refreshes the cached data. */
async function write<T extends object>(
  run: (token: string) => Promise<T>,
): Promise<ActionResult<T>> {
  const auth = await githubToken();
  if ('fail' in auth) return auth.fail;
  try {
    const result = await run(auth.token);
    updateTag(COMMUNITY_TAG);
    return { ok: true, ...result };
  } catch (error) {
    return failure(error);
  }
}

const invalid = (error: z.ZodError): { ok: false; error: string } => ({
  ok: false,
  error: error.issues[0]?.message ?? 'Invalid input',
});

const requestNumber = z.number().int().positive();
const text = (max: number, what: string) =>
  z
    .string()
    .trim()
    .min(1, `Write ${what} first.`)
    .max(max, `Keep ${what} under ${max} characters.`);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Pick a topic and a stack.');

// --- Requests -----------------------------------------------------------------

/** Whether the signed-in person already said "Need this too", and the live count. */
export async function getRequestViewerState(
  number: number,
): Promise<ActionResult<{ upvoted: boolean; upvotes: number }>> {
  const parsed = requestNumber.safeParse(number);
  if (!parsed.success) return invalid(parsed.error);
  const auth = await githubToken();
  if ('fail' in auth) return auth.fail;
  try {
    const { upvoted, upvotes } = await gh.getDiscussion(auth.token, parsed.data);
    return { ok: true, upvoted, upvotes };
  } catch (error) {
    return failure(error);
  }
}

const needInput = z.object({ request: requestNumber, on: z.boolean() });

export async function setNeed(
  input: z.infer<typeof needInput>,
): Promise<ActionResult<{ upvotes: number }>> {
  const parsed = needInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return write(async (token) => {
    const discussion = await gh.getDiscussion(token, parsed.data.request);
    if (discussion.upvoted === parsed.data.on) return { upvotes: discussion.upvotes };
    return { upvotes: await gh.setUpvote(token, discussion.id, parsed.data.on) };
  });
}

const commentInput = z.object({
  request: requestNumber,
  body: text(10_000, 'a comment'),
  replyTo: z.string().min(1).max(100).optional(),
});

export async function postComment(
  input: z.infer<typeof commentInput>,
): Promise<ActionResult<{ id: string; url: string; createdAt: string }>> {
  const parsed = commentInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return write(async (token) => {
    const discussion = await gh.getDiscussion(token, parsed.data.request);
    return gh.addComment(token, discussion.id, parsed.data.body, parsed.data.replyTo);
  });
}

const requestInput = z.object({
  topic: slug,
  stack: slug,
  what: text(600, 'what you are building'),
});

export async function createRequest(
  input: z.infer<typeof requestInput>,
): Promise<ActionResult<{ number: number; url: string }>> {
  const parsed = requestInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { topic, stack, what } = parsed.data;
  return write((token) =>
    gh.createRequest(token, {
      title: `${topicName(topic)} · ${stackTitle(stack)}`,
      topic,
      stack,
      what,
    }),
  );
}

const stateInput = z.object({
  request: requestNumber,
  state: z.enum(['resolved', 'duplicate', 'closed', 'open']),
  duplicateOf: requestNumber.optional(),
});

/** Maintainers: mark resolved, close (as duplicate or outdated), or reopen. */
export async function setRequestState(input: z.infer<typeof stateInput>): Promise<ActionResult> {
  const parsed = stateInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { request, state, duplicateOf } = parsed.data;
  if (state === 'duplicate' && !duplicateOf)
    return { ok: false, error: 'Which request is it a duplicate of?' };
  return write(async (token) => {
    const discussion = await gh.getDiscussion(token, request);
    if (state === 'open') {
      if (discussion.closed) await gh.reopenRequest(token, discussion.id);
      return {};
    }
    if (state === 'duplicate') {
      await gh.addComment(token, discussion.id, `Duplicate of #${duplicateOf}.`);
    }
    if (!discussion.closed) {
      const reason =
        state === 'resolved' ? 'RESOLVED' : state === 'duplicate' ? 'DUPLICATE' : 'OUTDATED';
      await gh.closeRequest(token, discussion.id, reason);
    }
    return {};
  });
}

// --- Proposals ----------------------------------------------------------------

const reviewInput = z
  .object({
    proposal: requestNumber,
    kind: z.enum(['approved', 'changes', 'comment']),
    body: z.string().trim().max(10_000, 'Keep the review under 10,000 characters.'),
  })
  .refine((value) => value.kind === 'approved' || value.body.length > 0, {
    message: 'Say what should change.',
  });

const REVIEW_EVENTS = {
  approved: 'APPROVE',
  changes: 'REQUEST_CHANGES',
  comment: 'COMMENT',
} as const;

export async function submitReview(
  input: z.infer<typeof reviewInput>,
): Promise<ActionResult<{ url: string }>> {
  const parsed = reviewInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { proposal, kind, body } = parsed.data;
  return write(async (token) => {
    const review = await gh.submitReview(token, proposal, REVIEW_EVENTS[kind], body);
    return { url: review.url };
  });
}
