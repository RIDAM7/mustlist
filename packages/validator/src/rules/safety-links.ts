import type { Diagnostic, Rule } from '../types';
import { cardUrls } from '../urls';
import { diagnostic } from '../util';

/** File types that should never be linked from a card. */
export const BLOCKED_EXTENSIONS: readonly string[] = [
  '.exe',
  '.msi',
  '.dmg',
  '.pkg',
  '.deb',
  '.rpm',
  '.apk',
  '.appimage',
  '.run',
  '.bin',
  '.iso',
  '.jar',
  '.sh',
  '.bash',
  '.zsh',
  '.ps1',
  '.psm1',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.vbs',
  '.zip',
  '.tar',
  '.tar.gz',
  '.tgz',
  '.gz',
  '.bz2',
  '.xz',
  '.7z',
  '.rar',
];

/** URL shorteners hide where a link goes. */
export const SHORTENER_HOSTS: readonly string[] = [
  'bit.ly',
  'buff.ly',
  'cutt.ly',
  'goo.gl',
  'is.gd',
  'lnkd.in',
  'ow.ly',
  'rb.gy',
  'rebrand.ly',
  's.id',
  'shorturl.at',
  't.co',
  't.ly',
  'tiny.cc',
  'tinyurl.com',
];

const IPV4_HOST = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/** Problems with one URL, or an empty list. */
export function linkProblems(url: string): string[] {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return [`"${url}" is not an absolute URL: links must start with https://`];
  }
  const problems: string[] = [];
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  if (parsed.protocol !== 'https:') problems.push(`"${url}" must use https://`);
  if (parsed.username !== '' || parsed.password !== '') {
    problems.push(`"${url}" contains a user name or password`);
  }
  if (IPV4_HOST.test(host) || host.startsWith('[') || host === 'localhost') {
    problems.push(`"${url}" points at a raw IP address or localhost`);
  }
  if (SHORTENER_HOSTS.some((shortener) => host === shortener || host.endsWith(`.${shortener}`))) {
    problems.push(`"${url}" uses a URL shortener: link to the real page`);
  }
  const extension = BLOCKED_EXTENSIONS.find((ext) => path.endsWith(ext));
  if (extension) problems.push(`"${url}" links to an executable, script or archive (${extension})`);
  return problems;
}

/** https only; no executables, archives, shorteners, raw IPs or credentials in links. */
export const safetyLinksRule: Rule = {
  id: 'safety-links',
  description: 'https only; no executables, archives, shorteners or raw IPs',
  check: (context) => {
    const found: Diagnostic[] = [];
    for (const { url, line } of cardUrls(context.card)) {
      for (const problem of linkProblems(url)) {
        found.push(diagnostic(context, 'safety-links', line, problem));
      }
    }
    return found;
  },
};
