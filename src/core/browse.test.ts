import { describe, expect, it } from 'vitest';
import { emptyFilters, filterUnits, latestRelease, sortLabel, sortUnits, titledName } from './browse.ts';
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

  it('moves units up to their newest EZA or Super EZA date, like the game does', () => {
    const awakened = makeUnit({ releaseDate: '2018-05-01', ezaReleaseDate: '2026-11-02' });
    const superAwakened = makeUnit({ releaseDate: '2017-01-01', ezaReleaseDate: '2021-06-01', superEzaReleaseDate: '2026-11-05' });

    const sorted = sortUnits([recent, awakened, superAwakened], 'release', 'desc');

    expect(sorted.map(unit => unit.id)).toEqual([superAwakened.id, awakened.id, recent.id]);
    expect(latestRelease(superAwakened)).toBe('2026-11-05');
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

describe('transformed forms in sorted lists', () => {
  it('puts each form right after its base card, whatever its own value', () => {
    const base = makeUnit({ maxBoost: 200 });
    const other = makeUnit({ maxBoost: 170 });
    const form = makeUnit({ maxBoost: 0, formOf: base.id });

    const sorted = sortUnits([other, form, base], 'leader', 'desc');

    expect(sorted.map(unit => unit.id)).toEqual([base.id, form.id, other.id]);
  });

  it('sorts a form on its own value when its base card is filtered out', () => {
    const form = makeUnit({ maxBoost: 0, formOf: 1 });
    const other = makeUnit({ maxBoost: 170 });

    const sorted = sortUnits([form, other], 'leader', 'desc');

    expect(sorted.map(unit => unit.id)).toEqual([other.id, form.id]);
  });
});

describe('filterUnits by how a card is obtained', () => {
  it('keeps only premium or only F2P cards', () => {
    const premium = makeUnit({ obtain: 'premium' });
    const f2p = makeUnit({ obtain: 'f2p' });
    const unknown = makeUnit({ obtain: null });
    const filters = { ...emptyFilters(), obtain: 'f2p' as const };

    const result = filterUnits([premium, f2p, unknown], filters, new Set());

    expect(result).toEqual([f2p]);
  });
});
