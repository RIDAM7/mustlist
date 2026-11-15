/**
 * Constants shared by the schema, validator, build and website.
 * This module has no runtime dependencies, so browser code can import it.
 */

export { OFFICIAL_DOCS_DOMAINS, isOfficialDocsUrl } from './config/official-docs-domains';

export const LENSES = ['security', 'performance', 'ux', 'data', 'cost'] as const;
export type Lens = (typeof LENSES)[number];

/** Display names. Also the exact `###` headings under `## Lenses`, in this order. */
export const LENS_TITLES: Readonly<Record<Lens, string>> = {
  security: 'Security',
  performance: 'Performance & latency',
  ux: 'UX flows',
  data: 'Data model',
  cost: 'Cost',
};

export const STATUSES = ['draft', 'proposed', 'verified', 'stale'] as const;
export type Status = (typeof STATUSES)[number];

/** Statuses that are served to agents by default and indexed by search engines. */
export const PUBLIC_STATUSES: readonly Status[] = ['verified', 'stale'];

export const REVIEW_LEVELS = ['seed', 'community'] as const;
export type ReviewLevel = (typeof REVIEW_LEVELS)[number];

/** Minimum reviewers for each review level. */
export const MIN_REVIEWERS: Readonly<Record<ReviewLevel, number>> = { seed: 1, community: 2 };

export const CHECKLIST_LEVELS = ['must', 'should'] as const;
export type ChecklistLevel = (typeof CHECKLIST_LEVELS)[number];

export const VERIFY_TYPES = ['unit', 'integration', 'e2e', 'scan', 'manual'] as const;
export type VerifyType = (typeof VERIFY_TYPES)[number];

/** Slugs that cannot be used as a topic, because the site uses these paths. */
export const RESERVED_SLUGS = [
  'stacks',
  'connect',
  'contribute',
  'discuss',
  'changelog',
  'requests',
  'proposals',
  'propose',
  'review',
  'people',
  'how-it-works',
  'activity',
  'signin',
  'api',
  'mcp',
  'search',
  'about',
  'topics',
  'og',
  '_next',
  'llms.txt',
  'sitemap.xml',
  'robots.txt',
] as const;

/** Body `##` headings, in the only allowed order. */
export const SECTION_TITLES = {
  why: 'Why this approach',
  lenses: 'Lenses',
  mistakes: 'Common mistakes',
  reviewerNotes: 'Notes for reviewers',
  furtherReading: 'Further reading',
} as const;

export const SECTION_ORDER: readonly string[] = [
  SECTION_TITLES.why,
  SECTION_TITLES.lenses,
  SECTION_TITLES.mistakes,
  SECTION_TITLES.reviewerNotes,
  SECTION_TITLES.furtherReading,
];

export const REQUIRED_SECTIONS: readonly string[] = [
  SECTION_TITLES.why,
  SECTION_TITLES.lenses,
  SECTION_TITLES.mistakes,
];

/** Fenced code block languages allowed in cards (short illustrations only). */
export const ALLOWED_CODE_LANGS = ['ts', 'tsx', 'js', 'sql', 'json', 'yaml'] as const;

/** Shell languages get a specific error message; anything not allowed is rejected anyway. */
export const BLOCKED_CODE_LANGS = [
  'sh',
  'bash',
  'shell',
  'zsh',
  'fish',
  'powershell',
  'pwsh',
  'ps1',
  'cmd',
  'bat',
  'batch',
  'console',
  'shellsession',
] as const;

export const SIZE_LIMITS = {
  /** `summary` length in characters. */
  summaryChars: 300,
  /** Body (everything after the frontmatter) in words. */
  bodyWords: 1200,
  /** Each `###` lens section in words. */
  lensWords: 200,
  /** Lines per fenced code block. */
  codeBlockLines: 15,
  /** Warn when a size reaches this share of its limit. */
  warnRatio: 0.9,
} as const;

/** Inclusive [min, max] item counts for frontmatter lists and body bullets. */
export const COUNT_LIMITS = {
  stack: [1, 5],
  checklist: [3, 15],
  decisions: [1, 6],
  decisionOptions: [2, 6],
  options: [1, 4],
  versionNotes: [1, 5],
  verify: [3, 12],
  mistakes: [3, 10],
} as const;

export const MIN_SOURCES = 2;
export const MIN_VERSIONS = 1;

export const TEXT_LIMITS = {
  titleMin: 10,
  titleMax: 80,
  checklistText: 200,
  checklistWhy: 160,
  question: 200,
  label: 120,
  optionName: 80,
  listItem: 200,
  versionNote: 240,
  verifyCheck: 300,
  sourceTitle: 200,
  itemId: 60,
  slugMin: 2,
  slugMax: 40,
} as const;

/** Lowercase kebab-case. Used for topic and stack slugs and for item ids. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `<topic>/<stack>`. */
export const CARD_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** GitHub usernames: letters, digits and single inner hyphens, 1-39 chars. */
export const GITHUB_HANDLE_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

/** npm (optionally scoped) or PyPI-style package names. */
export const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[A-Za-z0-9][A-Za-z0-9._~-]*$/;

/**
 * Values that YAML 1.1 tools read as booleans or null. Even where our parser keeps
 * them as strings, other tools may not, so they are never valid ids.
 */
export const AMBIGUOUS_YAML_IDS: readonly string[] = [
  'yes',
  'no',
  'on',
  'off',
  'y',
  'n',
  'true',
  'false',
  'null',
];

export const CONTEXT7_URL_PREFIX = 'https://context7.com/';

/** Where the library is served. */
export const BASE_PATH = '/library';
export const DEFAULT_SITE_URL = 'https://ridamagrawal.com';
export const PRODUCT_NAME = 'Mustlist';
export const REPO_URL = 'https://github.com/RIDAM7/mustlist';
