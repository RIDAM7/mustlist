import { describe, expect, it } from 'vitest';
import {
  CARD_STATUS,
  CHECKS_STATE,
  LABEL_PILL,
  markForLabel,
  PROPOSAL_STATUS,
  REQUEST_STATUS,
  REVIEW_VERDICT,
  type PillStyle,
} from '@/lib/status';

const families: Record<string, Record<string, PillStyle>> = {
  card: CARD_STATUS,
  request: REQUEST_STATUS,
  proposal: PROPOSAL_STATUS,
  checks: CHECKS_STATE,
  review: REVIEW_VERDICT,
};

describe('status marks', () => {
  it('gives every status a mark', () => {
    for (const [family, map] of Object.entries(families)) {
      for (const [key, style] of Object.entries(map)) {
        expect(style.glyph, `${family}.${key}`).toBeDefined();
      }
    }
  });

  it('never repeats a mark inside one family, so a status reads without colour', () => {
    for (const [family, map] of Object.entries(families)) {
      const marks = Object.values(map).map((s) => s.glyph);
      expect(new Set(marks).size, family).toBe(marks.length);
    }
  });

  it('keeps one mark per label across families', () => {
    const seen = new Map<string, string | undefined>();
    for (const map of [...Object.values(families), LABEL_PILL]) {
      for (const style of Object.values(map) as PillStyle[]) {
        if (seen.has(style.label)) expect(style.glyph, style.label).toBe(seen.get(style.label));
        seen.set(style.label, style.glyph);
      }
    }
  });

  it('finds the mark from the label alone', () => {
    expect(markForLabel('Verified')).toBe('tick');
    expect(markForLabel('Running')).toBe('spinner');
    expect(markForLabel('Not in library')).toBe('ring');
    expect(markForLabel('Sample data')).toBeUndefined();
  });
});
