import { describe, expect, it } from 'vitest';
import { cardMarker, cardOf, fieldOf, proposerOf } from '@/lib/community/markers';

describe('markers', () => {
  it('round-trips the card a discussion is about', () => {
    const body = [cardMarker('auth/nextjs-postgres'), 'Questions, problems and ideas.'].join('\n');
    expect(cardOf(body)).toBe('auth/nextjs-postgres');
    expect(cardOf('A discussion with no marker')).toBeUndefined();
    expect(cardOf(null)).toBeUndefined();
  });

  it('reads the proposer and the field', () => {
    expect(proposerOf('<!-- mustlist-proposer: ada-l -->', 'mustlist-library[bot]')).toBe('ada-l');
    expect(fieldOf(['<!-- mustlist-field: checklist -->', 'Too vague.'].join('\n'))).toEqual({
      field: 'checklist',
      text: 'Too vague.',
    });
  });
});
