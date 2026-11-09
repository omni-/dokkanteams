import { describe, expect, it } from 'vitest';
import {
  bestLeadersFor,
  commonLeaders,
  linkEdges,
  linkingPartners,
  possibleTeams,
  sharedLinks,
  teamLinkCounts,
  unitsBoostedBy,
} from './analysis.ts';
import { makeUnit } from './test-helpers.ts';

const CATEGORY_LEADER = '"Pure Saiyans" Category Ki +3 and HP, ATK & DEF +170%, '
  + 'plus an additional HP, ATK & DEF +30% for characters who also belong to the "Movie Heroes" Category';

describe('sharedLinks', () => {
  it('lists links both units have', () => {
    const a = makeUnit({ links: ['Super Saiyan', 'Kamehameha', 'Prepared for Battle'] });
    const b = makeUnit({ links: ['Kamehameha', 'Prepared for Battle', 'Fierce Battle'] });

    const result = sharedLinks(a, b);

    expect(result).toEqual(['Kamehameha', 'Prepared for Battle']);
  });

  it('gives nothing for two cards of the same character', () => {
    const a = makeUnit({ name: 'Goku', links: ['Kamehameha', 'Super Saiyan'] });
    const b = makeUnit({ name: 'Goku', links: ['Kamehameha', 'Super Saiyan'] });

    const result = sharedLinks(a, b);

    expect(result).toEqual([]);
  });
});

describe('linkingPartners', () => {
  it('groups partners by shared link count and drops single-link partners', () => {
    const unit = makeUnit({ links: ['A', 'B', 'C'] });
    const three = makeUnit({ links: ['A', 'B', 'C'] });
    const two = makeUnit({ links: ['A', 'B'] });
    const one = makeUnit({ links: ['A'] });

    const groups = linkingPartners(unit, [unit, three, two, one]);

    expect(groups.map(group => [group.count, group.units.map(member => member.id)])).toEqual([
      [3, [three.id]],
      [2, [two.id]],
    ]);
  });
});

describe('leader rankings', () => {
  const strong = makeUnit({ leaderSkill: CATEGORY_LEADER, categories: ['Pure Saiyans'] });
  const weak = makeUnit({ leaderSkill: 'All Types Ki +3 and HP, ATK & DEF +100%' });
  const saiyan = makeUnit({ categories: ['Pure Saiyans', 'Movie Heroes'] });
  const human = makeUnit({ categories: ['Earthlings'] });
  const units = [strong, weak, saiyan, human];

  it('ranks the leaders that boost a unit', () => {
    const ranked = bestLeadersFor(saiyan, units);

    expect(ranked.map(entry => [entry.leader.id, entry.boost])).toEqual([[strong.id, 200], [weak.id, 100]]);
  });

  it('groups the units a leader boosts by boost', () => {
    const groups = unitsBoostedBy(strong, units);

    expect(groups.map(group => [group.boost, group.units.map(entry => entry.unit.id)])).toEqual([[200, [saiyan.id]]]);
  });

  it('finds leaders that cover the whole team at their weakest boost', () => {
    const ranked = commonLeaders([saiyan, human], units);

    expect(ranked.map(entry => [entry.leader.id, entry.boost])).toEqual([[weak.id, 100]]);
  });

  it('skips transformed forms as leaders', () => {
    const form = makeUnit({ leaderSkill: 'All Types Ki +3 and HP, ATK & DEF +150%', formOf: strong.id });

    const ranked = bestLeadersFor(human, [...units, form]);

    expect(ranked.map(entry => entry.leader.id)).toEqual([weak.id]);
  });
});

describe('possibleTeams', () => {
  it('shows who each added leader boosts and the categories they share', () => {
    const leader = makeUnit({ leaderSkill: CATEGORY_LEADER, categories: ['Pure Saiyans', 'Movie Heroes', 'Full Power'] });
    const a = makeUnit({ categories: ['Pure Saiyans', 'Movie Heroes'] });
    const b = makeUnit({ categories: ['Pure Saiyans', 'Full Power', 'Movie Heroes'] });
    const outsider = makeUnit({ categories: ['Earthlings'] });

    const teams = possibleTeams([leader, a, b, outsider]);

    expect(teams).toHaveLength(1);
    expect(teams[0].groups.map(group => [group.boost, group.units.length])).toEqual([[200, 2]]);
    expect(teams[0].sharedCategories).toEqual(['Pure Saiyans', 'Movie Heroes']);
  });
});

describe('team links', () => {
  it('keeps pairs that meet the minimum and counts widely held links', () => {
    const a = makeUnit({ links: ['A', 'B', 'C'] });
    const b = makeUnit({ links: ['A', 'B'] });
    const c = makeUnit({ links: ['A', 'Z'] });

    const edges = linkEdges([a, b, c], 2);
    const counts = teamLinkCounts([a, b, c]);

    expect(edges).toEqual([{ source: a.id, target: b.id, links: ['A', 'B'] }]);
    expect(counts.map(entry => [entry.link, entry.units.length])).toEqual([['A', 3], ['B', 2]]);
  });
});
