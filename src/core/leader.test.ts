import { describe, expect, it } from 'vitest';
import { leaderBoost, maxLeaderBoost, parseBoost, parseLeaderSkill, parseTargets } from './leader.ts';
import type { LeaderTraits } from './leader.ts';

const unit = (overrides: Partial<LeaderTraits> = {}): LeaderTraits => ({
  categories: [],
  class: 'Super',
  type: 'AGL',
  ...overrides,
});

describe('parseLeaderSkill', () => {
  it('reads a two-category leader', () => {
    const text = '"Demonic Power" or "Terrifying Conquerors" Category Ki +3 and HP, ATK & DEF +200%';

    const leader = parseLeaderSkill(text);

    expect(leader).toEqual({
      clauses: [{
        targets: [
          { kind: 'category', category: 'Demonic Power' },
          { kind: 'category', category: 'Terrifying Conquerors' },
        ],
        boost: { ki: 3, hp: 200, atk: 200, def: 200 },
        bonuses: [],
      }],
    });
  });

  it('reads split stats and a category bonus', () => {
    const text = '"Demonic Power" or "Pure Saiyans" Category Ki +3, HP +200% and ATK & DEF +170%, '
      + 'plus an additional HP, ATK & DEF +50% for characters who also belong to the '
      + '"Dragon Ball Seekers", "Time Travelers" or "Bond of Parent and Child" Category';

    const leader = parseLeaderSkill(text);

    expect(leader?.clauses[0].boost).toEqual({ ki: 3, hp: 200, atk: 170, def: 170 });
    expect(leader?.clauses[0].bonuses).toEqual([{
      targets: [
        { kind: 'category', category: 'Dragon Ball Seekers' },
        { kind: 'category', category: 'Time Travelers' },
        { kind: 'category', category: 'Bond of Parent and Child' },
      ],
      boost: { ki: 0, hp: 50, atk: 50, def: 50 },
    }]);
  });

  it('reads a class bonus', () => {
    const text = '"Planet Namek Saga" Category Ki +2 and HP, ATK & DEF +80%, '
      + 'plus an additional HP, ATK & DEF +60% for characters who are also Super Class';

    const leader = parseLeaderSkill(text);

    expect(leader?.clauses[0].bonuses[0].targets).toEqual([{ kind: 'filter', class: 'Super' }]);
  });

  it('reads "; or" clauses with type, class and all-type targets', () => {
    const text = '"Peppy Gals" Category Ki +3 and HP, ATK & DEF +170%; or Extreme STR Type Ki +3 and HP, ATK & DEF +100%; '
      + 'or all Types Ki +2 and HP, ATK & DEF +50%';

    const leader = parseLeaderSkill(text);

    expect(leader?.clauses.map(clause => clause.targets)).toEqual([
      [{ kind: 'category', category: 'Peppy Gals' }],
      [{ kind: 'filter', class: 'Extreme', types: ['STR'] }],
      [{ kind: 'all' }],
    ]);
  });

  it('reads type lists and mixed category-or-type targets', () => {
    const targets = parseTargets('"Peppy Gals" Category or Super AGL, TEQ & INT Types');

    expect(targets).toEqual([
      { kind: 'category', category: 'Peppy Gals' },
      { kind: 'filter', class: 'Super', types: ['AGL', 'TEQ', 'INT'] },
    ]);
  });

  it('attaches a trailing exclusion to its clause', () => {
    const text = '"Realm of Gods" Category Ki +3 and HP, ATK & DEF +170%; '
      + 'Extreme Class Ki +3 and HP, ATK & DEF +150% ("Realm of Gods" Category characters excluded)';

    const leader = parseLeaderSkill(text);

    expect(leader?.clauses[1].excluded).toEqual([{ kind: 'category', category: 'Realm of Gods' }]);
  });

  it('skips conditional, per-Ki-Sphere and enemy clauses', () => {
    const texts = [
      'Ki +2 and ATK & DEF +20% when HP is 30% or above',
      "All allies' Ki +2, HP +150% and ATK & DEF +100% when team includes Super & Extreme Classes",
      'PHY Type ATK +35% per PHY Ki Sphere obtained',
      "INT Type enemies' ATK & DEF -40%",
    ];

    const results = texts.map(parseLeaderSkill);

    expect(results).toEqual([null, null, null, null]);
  });

  it('keeps the readable clause when another clause is an enemy debuff', () => {
    const text = "PHY Type Ki +3 and HP, ATK & DEF +50%; INT Type enemies' ATK & DEF -30%";

    const leader = parseLeaderSkill(text);

    expect(leader?.clauses).toHaveLength(1);
    expect(leader?.clauses[0].targets).toEqual([{ kind: 'filter', types: ['PHY'] }]);
  });
});

describe('parseBoost', () => {
  it('rejects trailing text it does not understand', () => {
    const result = parseBoost('Ki +3 and ATK & DEF +30% when HP is 30% or above');

    expect(result).toBeNull();
  });
});

describe('leaderBoost', () => {
  const bonusLeader = parseLeaderSkill(
    '"Demonic Power" Category Ki +3, HP +200% and ATK & DEF +170%, '
    + 'plus an additional HP, ATK & DEF +50% for characters who also belong to the "Time Travelers" Category',
  );

  it('averages HP, ATK and DEF and adds a matching bonus', () => {
    const plain = unit({ categories: ['Demonic Power'] });
    const withBonus = unit({ categories: ['Demonic Power', 'Time Travelers'] });

    const results = [leaderBoost(bonusLeader, plain), leaderBoost(bonusLeader, withBonus)];

    expect(results).toEqual([180, 230]);
  });

  it('gives nothing to units outside the targets, even if they match the bonus', () => {
    const outsider = unit({ categories: ['Time Travelers'] });

    const result = leaderBoost(bonusLeader, outsider);

    expect(result).toBe(0);
  });

  it('takes the best clause a unit qualifies for and honours exclusions', () => {
    const leader = parseLeaderSkill(
      '"Realm of Gods" Category Ki +3 and HP, ATK & DEF +170%; '
      + 'Extreme Class Ki +3 and HP, ATK & DEF +150% ("Realm of Gods" Category characters excluded)',
    );
    const gods = unit({ categories: ['Realm of Gods'], class: 'Extreme' });
    const extreme = unit({ class: 'Extreme' });
    const superUnit = unit({ class: 'Super' });

    const results = [gods, extreme, superUnit].map(target => leaderBoost(leader, target));

    expect(results).toEqual([170, 150, 0]);
  });

  it('reports the best possible boost', () => {
    const result = maxLeaderBoost(bonusLeader);

    expect(result).toBe(230);
  });
});
