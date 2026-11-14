import type { ChecklistLevel, Lens, ReviewLevel, Status, VerifyType } from './constants';

/** One entry of `dist/index.json`. */
export interface CardIndexEntry {
  id: string;
  title: string;
  topic: string;
  stack: string[];
  summary: string;
  status: Status;
  last_verified: string | null;
  card_version: string;
  url: string;
}

/** The structured card served by the JSON API and MCP (`dist/cards/<topic>/<stack>.json`). */
export interface CardJSON {
  id: string;
  title: string;
  topic: string;
  stack: string[];
  summary: string;
  status: Status;
  card_version: string;
  last_verified: string | null;
  review_level: ReviewLevel | null;
  authors: string[];
  reviewers: string[];
  /** Canonical page URL. */
  url: string;
  /** Raw markdown URL. */
  markdown_url: string;
  applies_when: { app_types: string[]; not_for: string[] };
  related: string[];
  checklist: { id: string; lens: Lens; level: ChecklistLevel; text: string; why?: string }[];
  decisions: {
    id: string;
    question: string;
    default?: string;
    options: { id: string; label: string; points_to?: string }[];
  }[];
  options: {
    id: string;
    name: string;
    examples?: string[];
    best_fit_when: string[];
    avoid_when: string[];
    tradeoffs: string[];
  }[];
  recommended: string;
  versions: { package: string; range: string; notes: string[]; docs: string; context7?: string }[];
  verify: { id: string; lens: Lens; type: VerifyType; check: string }[];
  sources: { title: string; url: string }[];
  body: {
    why: string;
    lenses: Partial<Record<Lens, string>>;
    mistakes: string;
    further_reading?: string;
  };
}

export interface TopicEntry {
  topic: string;
  cards: string[];
}

export interface StackEntry {
  stack: string;
  cards: string[];
}
