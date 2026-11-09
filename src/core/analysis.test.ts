import { describe, expect, it } from 'vitest';
import {
  bestLeadersFor,
  bestRotations,
  commonLeaders,
  fitLayout,
  linkEdges,
  linkingPartners,
  moveInLayout,
  possibleTeams,
  restoreRotationLayout,
  rotationPlan,
  sharedLinks,
  teamLinkCounts,
  unitsBoostedBy,
} from './analysis.ts';
import type { RotationLayout } from './analysis.ts';
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

  it('groups every leader that boosts a unit by boost, strongest first', () => {
    const groups = bestLeadersFor(saiyan, units);

    expect(groups.map(group => [group.boost, group.units.map(entry => entry.unit.id)])).toEqual([
      [200, [strong.id]],
      [100, [weak.id]],
    ]);
  });

  it('lists leaders with the same boost by links shared with the unit', () => {
    const unit = makeUnit({ links: ['A', 'B'] });
    const oneLink = makeUnit({ leaderSkill: 'All Types Ki +3 and HP, ATK & DEF +100%', links: ['A'] });
    const twoLinks = makeUnit({ leaderSkill: 'All Types Ki +3 and HP, ATK & DEF +100%', links: ['A', 'B'] });

    const groups = bestLeadersFor(unit, [oneLink, twoLinks]);

    expect(groups.map(group => group.units.map(entry => [entry.unit.id, entry.sharedLinks]))).toEqual([
      [[twoLinks.id, 2], [oneLink.id, 1]],
    ]);
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

    const groups = bestLeadersFor(human, [...units, form]);

    expect(groups.flatMap(group => group.units.map(entry => entry.unit.id))).toEqual([weak.id]);
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

describe('bestRotations', () => {
  it('picks the two pairs with the most shared links in total, not the single best pair', () => {
    // A+B share 5 but would leave C+D with 1; A+C and B+D share 4 each.
    const a = makeUnit({ links: ['1', '2', '3', '4', '5', 'a'] });
    const b = makeUnit({ links: ['1', '2', '3', '4', '5', 'b1', 'b2', 'b3', 'b4'] });
    const c = makeUnit({ links: ['a', '2', '3', '4', 'c'] });
    const d = makeUnit({ links: ['b1', 'b2', 'b3', 'b4', 'c'] });
    const floater = makeUnit({ links: [] });
    const team = [a, b, c, d, floater];

    const layout = bestRotations(team);

    expect(layout).toEqual({ rotations: [[a.id, c.id], [b.id, d.id]], floaters: [floater.id] });
    expect(rotationPlan(layout, team).rotations.map(pair => pair.links.length)).toEqual([4, 4]);
  });

  it('never pairs two cards of the same character', () => {
    const goku = makeUnit({ name: 'Goku', links: ['A', 'B', 'C'] });
    const otherGoku = makeUnit({ name: 'Goku', links: ['A', 'B', 'C'] });
    const vegeta = makeUnit({ name: 'Vegeta', links: ['A'] });

    const layout = bestRotations([goku, otherGoku, vegeta]);

    expect(layout).toEqual({ rotations: [[goku.id, vegeta.id], [null, null]], floaters: [otherGoku.id] });
  });
});

describe('arranging rotations', () => {
  it('fills a new team in the order members join', () => {
    const layout = fitLayout(null, [1, 2, 3, 4, 5, 6]);

    expect(layout).toEqual({ rotations: [[1, 2], [3, 4]], floaters: [5, 6] });
  });

  it('leaves everyone else in place when members leave and join', () => {
    const layout: RotationLayout = { rotations: [[1, 2], [3, 4]], floaters: [5] };

    const afterLeaving = fitLayout(layout, [1, 3, 4, 5]);
    const afterJoining = fitLayout(afterLeaving, [1, 3, 4, 5, 6, 7]);

    expect(afterLeaving).toEqual({ rotations: [[1, null], [3, 4]], floaters: [5] });
    expect(afterJoining).toEqual({ rotations: [[1, 6], [3, 4]], floaters: [5, 7] });
  });

  it('swaps a floater into a rotation and recounts its links', () => {
    const a = makeUnit({ links: ['A', 'B'] });
    const b = makeUnit({ links: ['A', 'B'] });
    const floater = makeUnit({ links: ['A'] });
    const layout: RotationLayout = { rotations: [[a.id, b.id], [null, null]], floaters: [floater.id] };

    const moved = moveInLayout(layout, b.id, { kind: 'unit', unitId: floater.id });

    const plan = rotationPlan(moved, [a, b, floater]);
    expect(plan.rotations[0]).toEqual({ units: [a, floater], links: ['A'] });
    expect(plan.floaters).toEqual([b]);
  });

  it('moves a unit into an open spot or the floaters and leaves its old spot open', () => {
    const layout: RotationLayout = { rotations: [[1, 2], [3, null]], floaters: [4] };

    const intoSpot = moveInLayout(layout, 4, { kind: 'slot', rotation: 1, position: 1 });
    const intoFloaters = moveInLayout(intoSpot, 1, { kind: 'floaters' });

    expect(intoSpot).toEqual({ rotations: [[1, 2], [3, 4]], floaters: [] });
    expect(intoFloaters).toEqual({ rotations: [[null, 2], [3, 4]], floaters: [1] });
  });

  it('changes nothing when a unit is dropped where it already is', () => {
    const layout: RotationLayout = { rotations: [[1, 2], [null, null]], floaters: [3] };

    const results = [
      moveInLayout(layout, 1, { kind: 'unit', unitId: 1 }),
      moveInLayout(layout, 2, { kind: 'slot', rotation: 0, position: 1 }),
      moveInLayout(layout, 3, { kind: 'floaters' }),
    ];

    expect(results.every(result => result === layout)).toBe(true);
  });

  it('reads saved layouts with open spots and rejects malformed ones', () => {
    const saved = [null, 'x', { rotations: [[1]], floaters: [] }, { rotations: [[1, 2]], floaters: ['3'] }, { rotations: [[1, 'x']], floaters: [] }];

    const restored = saved.map(restoreRotationLayout);

    expect(restored).toEqual([null, null, null, null, null]);
    expect(restoreRotationLayout({ rotations: [[1, null]], floaters: [3] })).toEqual({ rotations: [[1, null]], floaters: [3] });
  });
});
