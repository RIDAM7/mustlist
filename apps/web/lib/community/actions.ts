'use server';

import { updateTag } from 'next/cache';
import { headers } from 'next/headers';
import * as z from 'zod';
import { stackTitle } from '@mustlist/schema/site';
import { getAuth } from '@/lib/auth';
import { getCard } from '@/lib/data';
import { LIBRARY_URL } from '@/lib/site';
import { topicName } from '@/lib/topics';
import { appWritesEnabled, installationToken } from './github/app';
import * as proposals from './github/proposals';
import * as gh from './github/write';
import { COMMUNITY_TAG } from './load';
import { cardProblems, prepareSubmission } from './proposal-checks';

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

// --- Card discussions -----------------------------------------------------------

const cardCommentInput = z.object({
  cardId: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, 'Unknown card.'),
  body: text(10_000, 'a comment'),
});

/**
 * The first comment on a card's Discussion tab: finds or opens the card's Q&A
 * discussion (opened by the Mustlist Library app when it is set up, else by the
 * person), then posts the comment as the signed-in person.
 */
export async function startCardDiscussion(
  input: z.infer<typeof cardCommentInput>,
): Promise<
  ActionResult<{ number: number; threadUrl: string; id: string; url: string; createdAt: string }>
> {
  const parsed = cardCommentInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { cardId, body } = parsed.data;
  const card = getCard(cardId);
  if (!card) return { ok: false, error: 'Unknown card.' };
  return write(async (token) => {
    let thread = await gh.findCardDiscussion(token, cardId);
    if (!thread) {
      const opener = appWritesEnabled ? await installationToken() : token;
      thread = await gh.createCardDiscussion(opener, {
        cardId,
        title: card.title,
        url: `${LIBRARY_URL}/${cardId}`,
      });
    }
    const comment = await gh.addComment(token, thread.id, body);
    return { number: thread.number, threadUrl: thread.url, ...comment };
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

// --- Proposals from the editor (step C) ----------------------------------------

const submitInput = z.object({
  topic: slug,
  stack: slug,
  mode: z.enum(['new', 'change']),
  markdown: z.string().min(1).max(60_000, 'The card is too long.'),
  heading: text(200, 'a title'),
  note: z.string().trim().max(500, 'Keep the note under 500 characters.'),
  request: requestNumber.nullable(),
});

/**
 * Opens a proposal (a pull request) from the editor, or adds a revision to the
 * signed-in person's open proposal for the same card.
 */
export async function submitProposal(
  input: z.infer<typeof submitInput>,
): Promise<ActionResult<{ number: number; url: string; updated: boolean }>> {
  if (!appWritesEnabled)
    return { ok: false, error: 'Sending proposals from the site is not set up yet.' };
  const parsed = submitInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { topic, stack, mode, markdown, heading, note, request } = parsed.data;
  const cardId = `${topic}/${stack}`;
  return write(async (token) => {
    const me = await proposals.viewerIdentity(token);
    const prepared = prepareSubmission(cardId, markdown, mode, me.login);
    if (prepared.problems.length > 0) {
      throw new gh.GitHubWriteError(
        `Fix these first: ${prepared.problems.slice(0, 3).join(' · ')}`,
      );
    }
    return proposals.submitProposal(token, {
      cardId,
      markdown: prepared.text,
      mode,
      heading,
      note,
      request,
    });
  });
}

// --- Accept and field comments (step D) -----------------------------------------

const acceptInput = z.object({
  proposal: requestNumber,
  level: z.enum(['seed', 'community']),
});

/** Maintainers: approve, promote to Verified and merge once the checks pass. */
export async function acceptProposal(
  input: z.infer<typeof acceptInput>,
): Promise<ActionResult<{ merging: 'auto' | 'merged' | 'waiting'; cardId: string }>> {
  const parsed = acceptInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return write((token) =>
    proposals.acceptProposal(token, {
      number: parsed.data.proposal,
      level: parsed.data.level,
      date: new Date().toISOString().slice(0, 10),
      validate: cardProblems,
    }),
  );
}

const fieldInput = z.object({
  proposal: requestNumber,
  field: z.enum([
    'basics',
    'checklist',
    'decisions',
    'options',
    'versions',
    'verify',
    'sources',
    'body',
  ]),
  body: text(10_000, 'a comment'),
});

/** A review comment on one field of the card, on its lines in the file. */
export async function commentOnField(
  input: z.infer<typeof fieldInput>,
): Promise<ActionResult<{ url: string }>> {
  const parsed = fieldInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return write((token) =>
    proposals.commentOnField(token, {
      number: parsed.data.proposal,
      field: parsed.data.field,
      body: parsed.data.body,
    }),
  );
}
