import type { CardContext, Diagnostic } from './types';
import { cardUrls } from './urls';
import { diagnostic } from './util';

export interface LinkCheckOptions {
  /** Injected for tests. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Requests in flight at once. */
  concurrency?: number;
  /** Retries after the first attempt, for network errors, 429 and 5xx. */
  retries?: number;
  timeoutMs?: number;
  /** First retry delay; doubles each retry. */
  backoffMs?: number;
}

export type LinkResult = { ok: true } | { ok: false; reason: string };

const DEFAULTS = { concurrency: 4, retries: 2, timeoutMs: 10_000, backoffMs: 500 };

// A generic user agent: some documentation sites reject requests without one.
const HEADERS = { 'user-agent': 'Mozilla/5.0 (compatible; link-checker)', accept: '*/*' };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isOk = (status: number) => status >= 200 && status < 400;
const isRetryable = (status: number) => status === 429 || status >= 500;

async function request(
  doFetch: typeof fetch,
  url: string,
  method: 'HEAD' | 'GET',
  timeoutMs: number,
): Promise<number> {
  const response = await doFetch(url, {
    method,
    redirect: 'manual',
    headers: HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
  });
  await response.body?.cancel();
  return response.status;
}

/** Check one URL: HEAD first, GET if HEAD is refused; retry on network errors, 429 and 5xx. */
export async function checkUrl(url: string, options: LinkCheckOptions = {}): Promise<LinkResult> {
  const { retries, timeoutMs, backoffMs } = { ...DEFAULTS, ...options };
  const doFetch = options.fetch ?? fetch;
  let reason = 'no response';

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(backoffMs * 2 ** (attempt - 1));
    try {
      let status = await request(doFetch, url, 'HEAD', timeoutMs);
      if (!isOk(status) && !isRetryable(status)) {
        status = await request(doFetch, url, 'GET', timeoutMs);
      }
      if (isOk(status)) return { ok: true };
      reason = `HTTP ${status}`;
      if (!isRetryable(status)) return { ok: false, reason };
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
    }
  }
  return { ok: false, reason };
}

/** Run `task` over `items` with at most `limit` tasks in flight; results keep input order. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Check every https URL in the given cards. Each URL is requested once. */
export async function checkLinks(
  cards: readonly CardContext[],
  options: LinkCheckOptions = {},
): Promise<Diagnostic[]> {
  const occurrences = cards.flatMap((context) =>
    cardUrls(context.card)
      .filter(({ url }) => url.startsWith('https://'))
      .map((found) => ({ context, ...found })),
  );
  const unique = [...new Set(occurrences.map((item) => item.url))].sort();
  const concurrency = options.concurrency ?? DEFAULTS.concurrency;
  const results = await mapWithConcurrency(unique, concurrency, (url) => checkUrl(url, options));
  const byUrl = new Map(unique.map((url, index) => [url, results[index]]));

  return occurrences.flatMap(({ context, url, line }) => {
    const result = byUrl.get(url);
    return result && !result.ok
      ? [diagnostic(context, 'links', line, `Link failed (${result.reason}): ${url}`)]
      : [];
  });
}
