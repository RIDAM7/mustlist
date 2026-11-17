/**
 * A small GitHub REST client for the repository's workflows (no dependencies).
 * Reads GITHUB_TOKEN; every call goes to api.github.com.
 */

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface GitHub {
  /** JSON from a REST path such as `/repos/o/r/pulls/1`. */
  get<T>(path: string): Promise<T>;
  /** Every item of a paginated list (follows `Link: rel="next"`). */
  list<T>(path: string): Promise<T[]>;
  /** A file's text at a ref, or `undefined` when it doesn't exist there. */
  file(repo: string, path: string, ref: string): Promise<string | undefined>;
  send<T>(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T>;
}

export function createGitHub(token = process.env['GITHUB_TOKEN']): GitHub {
  if (!token) throw new Error('GITHUB_TOKEN is not set');
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'mustlist-workflows',
  };
  const url = (path: string) =>
    path.startsWith('https://') ? path : `https://api.github.com${path}`;

  async function request(method: string, path: string, body?: unknown, accept?: string) {
    const response = await fetch(url(path), {
      method,
      headers: {
        ...headers,
        ...(accept ? { Accept: accept } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new GitHubError(
        `${method} ${path}: ${response.status} ${text.slice(0, 300)}`,
        response.status,
      );
    }
    return response;
  }

  return {
    async get<T>(path: string) {
      return (await (await request('GET', path)).json()) as T;
    },
    async list<T>(path: string) {
      const items: T[] = [];
      let next: string | undefined = `${path}${path.includes('?') ? '&' : '?'}per_page=100`;
      while (next) {
        const response = await request('GET', next);
        items.push(...((await response.json()) as T[]));
        next = /<([^>]+)>;\s*rel="next"/.exec(response.headers.get('link') ?? '')?.[1];
      }
      return items;
    },
    async file(repo: string, path: string, ref: string) {
      const encoded = path.split('/').map(encodeURIComponent).join('/');
      try {
        const response = await request(
          'GET',
          `/repos/${repo}/contents/${encoded}?ref=${encodeURIComponent(ref)}`,
          undefined,
          'application/vnd.github.raw+json',
        );
        return await response.text();
      } catch (error) {
        if (error instanceof GitHubError && error.status === 404) return undefined;
        throw error;
      }
    },
    async send<T>(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown) {
      const response = await request(method, path, body);
      return (response.status === 204 ? undefined : await response.json()) as T;
    },
  };
}

/** Writes a GitHub Actions job summary, or prints it outside Actions. */
export async function writeSummary(markdown: string): Promise<void> {
  const file = process.env['GITHUB_STEP_SUMMARY'];
  if (!file) {
    console.log(markdown);
    return;
  }
  const { appendFileSync } = await import('node:fs');
  appendFileSync(file, `${markdown}\n`);
}
