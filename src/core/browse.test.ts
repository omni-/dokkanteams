import { describe, expect, it } from 'vitest';
import { emptyFilters, filterUnits, sortLabel, sortUnits, titledName } from './browse.ts';
import { makeUnit } from './test-helpers.ts';

describe('sortUnits by release date', () => {
  const old = makeUnit({ releaseDate: '2019-07-07' });
  const recent = makeUnit({ releaseDate: '2026-10-29' });
  const middle = makeUnit({ releaseDate: '2023-01-27' });
  const unknown = makeUnit({ releaseDate: null });

  it('puts the newest first when descending', () => {
    const sorted = sortUnits([old, unknown, recent, middle], 'release', 'desc');

    expect(sorted.map(unit => unit.releaseDate)).toEqual(['2026-10-29', '2023-01-27', '2019-07-07', null]);
  });

  it('puts the oldest first when ascending, still leaving unknown dates last', () => {
    const sorted = sortUnits([old, unknown, recent, middle], 'release', 'asc');

    expect(sorted.map(unit => unit.releaseDate)).toEqual(['2019-07-07', '2023-01-27', '2026-10-29', null]);
  });

  it('labels tiles with the release month', () => {
    const label = sortLabel(recent, 'release');

    expect(label).toBe('Oct 2026');
  });
});

describe('sortUnits by leader', () => {
  it('breaks equal boosts by how many units the leader reaches', () => {
    const narrow = makeUnit({ maxBoost: 200, leaderReach: 10 });
    const wide = makeUnit({ maxBoost: 200, leaderReach: 90 });
    const weak = makeUnit({ maxBoost: 130, leaderReach: 300 });

    const sorted = sortUnits([narrow, weak, wide], 'leader', 'desc');

    expect(sorted.map(unit => unit.id)).toEqual([wide.id, narrow.id, weak.id]);
  });
});

describe('titledName', () => {
  it('puts the bracketed title before the name', () => {
    const unit = makeUnit({ name: 'Third Eye Gomah', title: 'Threat of the Third Eye' });

    const result = titledName(unit);

    expect(result).toBe('[Threat of the Third Eye] Third Eye Gomah');
  });

  it('leaves out empty brackets when there is no title', () => {
    const unit = makeUnit({ name: 'Giant Gomah', title: '' });

    const result = titledName(unit);

    expect(result).toBe('Giant Gomah');
  });
});

describe('filterUnits', () => {
  const goku = makeUnit({ name: 'Super Saiyan Goku', title: 'Warrior of Hope', type: 'TEQ', categories: ['Pure Saiyans', 'Movie Heroes'] });
  const vegeta = makeUnit({ name: 'Vegeta', type: 'AGL', categories: ['Pure Saiyans'] });
  const form = makeUnit({ name: 'Giant Gomah', formOf: 1 });

  it('matches every word of the search against name and title', () => {
    const filters = { ...emptyFilters(), name: 'goku hope' };

    const result = filterUnits([goku, vegeta], filters, new Set());

    expect(result).toEqual([goku]);
  });

  it('supports any and all category matching', () => {
    const any = { ...emptyFilters(), categories: ['Pure Saiyans', 'Movie Heroes'], categoryMode: 'any' as const };
    const all = { ...any, categoryMode: 'all' as const };

    const results = [filterUnits([goku, vegeta], any, new Set()), filterUnits([goku, vegeta], all, new Set())];

    expect(results).toEqual([[goku, vegeta], [goku]]);
  });

  it('hides transformed forms, favorites-only misses and hidden ids', () => {
    const filters = { ...emptyFilters(), favoritesOnly: true };

    const result = filterUnits([goku, vegeta, form], filters, new Set([goku.id, vegeta.id]), new Set([vegeta.id]));

    expect(result).toEqual([goku]);
  });
});
