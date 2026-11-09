import { describe, expect, it } from 'vitest';
import { buildDataset, resolveObtain } from './dataset.ts';
import type { ScrapedCharacter } from './dataset.ts';

function scraped(overrides: Partial<ScrapedCharacter> = {}): ScrapedCharacter {
  return {
    id: 1032311,
    name: 'Third Eye Gomah',
    title: 'Threat of the Third Eye',
    rarity: 'LR',
    class: 'Extreme',
    type: 'AGL',
    cost: 77,
    releaseDate: '2025-11-13',
    leaderSkill: '"Demonic Power" or "Terrifying Conquerors" Category Ki +3 and HP, ATK & DEF +200%',
    superAttack: 'Causes colossal damage',
    ultraSuperAttack: 'Causes mega-colossal damage',
    passive: 'Ki +5',
    links: ['Fierce Battle', 'Legendary Power'],
    categories: ['Demonic Power', 'Giant Form'],
    maxLevelHP: 16263,
    freeDupeHP: 18263,
    rainbowHP: 20863,
    rainbowAttack: 20785,
    rainbowDefence: 15163,
    transformations: [{
      transformedID: 4032311,
      transformedName: 'Giant Gomah',
      transformedClass: 'Extreme',
      transformedType: 'AGL',
      transformedSuperAttack: 'Error',
      transformedPassive: 'ATK 333%',
      transformedLinks: [],
      transformedCategories: ['Giant Form'],
    }],
    ...overrides,
  };
}

describe('buildDataset', () => {
  it('flattens transformed forms into units that point at their base', () => {
    const { dataset } = buildDataset([scraped()], 'test.json');

    const [base, form] = dataset.units;
    expect(base.forms).toEqual([4032311]);
    expect(form).toMatchObject({
      id: 4032311,
      name: 'Giant Gomah',
      formOf: 1032311,
      teamKey: base.teamKey,
      categories: ['Giant Form'],
      cost: 77,
      releaseDate: '2025-11-13',
      leader: null,
    });
    expect(form.base.superAttack).toBe('');
  });

  it('parses the EZA leader skill when there is one', () => {
    const character = scraped({
      leaderSkill: '"Demonic Power" Category Ki +3 and HP, ATK & DEF +150%',
      ezaLeaderSkill: '"Demonic Power" Category Ki +3 and HP, ATK & DEF +170%',
      transformations: [],
    });

    const { dataset } = buildDataset([character], 'test.json');

    expect(dataset.units[0].maxBoost).toBe(170);
    expect(dataset.units[0].eza?.leaderSkill).toContain('+170%');
  });

  it('falls back to lower stat tiers and skips unreadable cards', () => {
    const missingRainbow = scraped({ id: 1, rainbowHP: null, transformations: [] });
    const unreadable = scraped({ id: 2, rarity: 'SSR', transformations: [] });

    const { dataset, skipped } = buildDataset([missingRainbow, unreadable], 'test.json');

    expect(dataset.units.map(unit => [unit.id, unit.hp])).toEqual([[1, 18263]]);
    expect(skipped).toHaveLength(1);
  });

  it('counts how many fieldable units each leader reaches', () => {
    const leader = scraped({ transformations: [] });
    const member = scraped({ id: 2, name: 'Janemba', categories: ['Terrifying Conquerors'], transformations: [] });
    const outsider = scraped({ id: 3, name: 'Krillin', categories: ['Earthlings'], transformations: [] });

    const { dataset } = buildDataset([leader, member, outsider], 'test.json');

    expect(dataset.units.find(unit => unit.id === 1032311)?.leaderReach).toBe(2);
  });
});

describe('buildDataset obtain and awakening dates', () => {
  it("marks cards premium or F2P and gives forms their base card's value", () => {
    const obtain = new Map([[1032311, 'f2p' as const]]);

    const { dataset } = buildDataset([scraped()], 'test.json', { obtain });

    expect(dataset.units.map(unit => unit.obtain)).toEqual(['f2p', 'f2p']);
  });

  it('keeps EZA dates only for cards with an EZA', () => {
    const awakened = scraped({ ezaPassive: 'ATK 300%', ezaReleaseDate: '2026-11-02', superEzaReleaseDate: '2026-11-05' });
    const plain = scraped({ id: 1, name: 'Other', ezaReleaseDate: '2026-11-02', transformations: [] });

    const { dataset } = buildDataset([awakened, plain], 'test.json');

    const byId = new Map(dataset.units.map(unit => [unit.id, unit]));
    expect(byId.get(1032311)).toMatchObject({ ezaReleaseDate: '2026-11-02', superEzaReleaseDate: '2026-11-05' });
    expect(byId.get(1)).toMatchObject({ ezaReleaseDate: null, superEzaReleaseDate: null });
  });
});

describe('resolveObtain', () => {
  it('gives alt-art cards their original value and counts other cards without banners as F2P', () => {
    const original = scraped({ id: 1012931, name: 'Super Gogeta', title: 'Fused Fighting Force' });
    const altArt = scraped({ id: 1034751, name: 'Super Gogeta', title: 'Fused Fighting Force' });
    const eventUnit = scraped({ id: 1034611, name: 'Cell Jr.', title: 'Treacherous Clone' });
    const unchecked = scraped({ id: 1, name: 'Unchecked', title: 'New' });
    const recorded = { 1012931: 'premium', 1034751: 'no-banner', 1034611: 'no-banner' } as const;

    const obtain = resolveObtain([original, altArt, eventUnit, unchecked], recorded);

    expect([...obtain]).toEqual([[1012931, 'premium'], [1034751, 'premium'], [1034611, 'f2p']]);
  });
});
