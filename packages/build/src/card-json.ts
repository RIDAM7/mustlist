import {
  type CardFrontmatter,
  type CardJSON,
  LENSES,
  LENS_TITLES,
  type Lens,
  type ParsedCard,
  SECTION_TITLES,
  cardMarkdownUrl,
  cardUrl,
  findSection,
} from '@mustlist/schema';

function lensBodies(card: ParsedCard): Partial<Record<Lens, string>> {
  const lenses = findSection(card.sections, SECTION_TITLES.lenses);
  const bodies: Partial<Record<Lens, string>> = {};
  for (const lens of LENSES) {
    const section = lenses?.children.find((child) => child.title === LENS_TITLES[lens]);
    if (section) bodies[lens] = section.markdown;
  }
  return bodies;
}

function body(card: ParsedCard): CardJSON['body'] {
  const furtherReading = findSection(card.sections, SECTION_TITLES.furtherReading)?.markdown;
  return {
    why: findSection(card.sections, SECTION_TITLES.why)?.markdown ?? '',
    lenses: lensBodies(card),
    mistakes: findSection(card.sections, SECTION_TITLES.mistakes)?.markdown ?? '',
    ...(furtherReading ? { further_reading: furtherReading } : {}),
  };
}

/**
 * The structured card (CardJSON). Keys are written in a fixed order so the JSON
 * output is stable; list items keep the author's order.
 */
export function toCardJson(card: ParsedCard, data: CardFrontmatter, siteUrl: string): CardJSON {
  return {
    id: data.id,
    title: data.title,
    topic: data.topic,
    stack: data.stack,
    summary: data.summary,
    status: data.status,
    card_version: data.card_version,
    last_verified: data.last_verified,
    review_level: data.review_level,
    authors: data.authors,
    reviewers: data.reviewers,
    url: cardUrl(siteUrl, data.id),
    markdown_url: cardMarkdownUrl(siteUrl, data.id),
    applies_when: { app_types: data.applies_when.app_types, not_for: data.applies_when.not_for },
    related: data.related,
    checklist: data.checklist.map((item) => ({
      id: item.id,
      lens: item.lens,
      level: item.level,
      text: item.text,
      ...(item.why !== undefined ? { why: item.why } : {}),
    })),
    decisions: data.decisions.map((decision) => ({
      id: decision.id,
      question: decision.question,
      ...(decision.default !== undefined ? { default: decision.default } : {}),
      options: decision.options.map((option) => ({
        id: option.id,
        label: option.label,
        ...(option.points_to !== undefined ? { points_to: option.points_to } : {}),
      })),
    })),
    options: data.options.map((option) => ({
      id: option.id,
      name: option.name,
      ...(option.examples !== undefined ? { examples: option.examples } : {}),
      best_fit_when: option.best_fit_when,
      avoid_when: option.avoid_when,
      tradeoffs: option.tradeoffs,
    })),
    recommended: data.recommended,
    versions: data.versions.map((entry) => ({
      package: entry.package,
      range: entry.range,
      notes: entry.notes,
      docs: entry.docs,
      ...(entry.context7 !== undefined ? { context7: entry.context7 } : {}),
    })),
    verify: data.verify.map((check) => ({
      id: check.id,
      lens: check.lens,
      type: check.type,
      check: check.check,
    })),
    sources: data.sources.map((source) => ({ title: source.title, url: source.url })),
    body: body(card),
  };
}
