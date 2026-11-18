import { describe, expect, it } from 'vitest';
import {
  addToBattlefield,
  clearBattlefieldTeam,
  describeTeamBoosts,
  emptyBattlefield,
  locateUnit,
  placeOnBattlefield,
  removeFromBattlefield,
  restoreBattlefield,
  usedUnitIds,
} from './battlefield.ts';
import type { Battlefield } from './battlefield.ts';
import { makeUnit } from './test-helpers.ts';
import type { Unit } from './types.ts';

function fill(units: Unit[], teamIndex = 0) {
  let battlefield: Battlefield = emptyBattlefield();
  for (const unit of units) {
    const result = addToBattlefield(battlefield, teamIndex, unit);
    if (result.ok) battlefield = result.battlefield;
  }
  return battlefield;
}

describe('addToBattlefield', () => {
  it('fills both leader slots before the followers', () => {
    const units = [makeUnit(), makeUnit(), makeUnit()];

    const battlefield = fill(units);

    expect(battlefield[0]).toEqual({ leader1: units[0].id, leader2: units[1].id, followers: [units[2].id] });
  });

  it('refuses an eighth unit', () => {
    const units = Array.from({ length: 7 }, () => makeUnit());
    const battlefield = fill(units);

    const result = addToBattlefield(battlefield, 0, makeUnit());

    expect(result).toEqual({ ok: false, reason: 'full' });
  });

  it('refuses a card already used in another team', () => {
    const unit = makeUnit();
    const battlefield = fill([unit], 0);

    const result = addToBattlefield(battlefield, 1, unit);

    expect(result).toEqual({ ok: false, reason: 'used' });
  });

  it('lets cards of the same character share a team', () => {
    const battlefield = fill([makeUnit({ name: 'Goku', title: 'Saiyan Raised on Earth' })]);
    const otherGoku = makeUnit({ name: 'Goku', title: 'Kaioken Gamble' });

    const result = addToBattlefield(battlefield, 0, otherGoku);

    expect(result.ok && result.battlefield[0].leader2).toBe(otherGoku.id);
  });

  it('refuses transformed forms', () => {
    const form = makeUnit({ formOf: 1 });

    const result = addToBattlefield(emptyBattlefield(), 0, form);

    expect(result).toEqual({ ok: false, reason: 'form' });
  });
});

describe('placeOnBattlefield', () => {
  it('puts a new unit on the exact slot it was dropped on', () => {
    const units = [makeUnit(), makeUnit()];
    const battlefield = fill(units);
    const newcomer = makeUnit();

    const result = placeOnBattlefield(battlefield, { team: 0, slot: 4 }, newcomer);

    expect(result.ok && result.battlefield[0]).toEqual({ leader1: units[0].id, leader2: units[1].id, followers: [newcomer.id] });
  });

  it('swaps two placed units, even across teams', () => {
    const first = [makeUnit(), makeUnit(), makeUnit()];
    const second = [makeUnit()];
    let battlefield = fill(first);
    battlefield = (addToBattlefield(battlefield, 1, second[0]) as { battlefield: Battlefield }).battlefield;

    const result = placeOnBattlefield(battlefield, { team: 1, slot: 0 }, first[2]);

    expect(result.ok && result.battlefield[0].followers).toEqual([second[0].id]);
    expect(result.ok && result.battlefield[1].leader1).toBe(first[2].id);
  });

  it('replaces the occupant when the unit comes from outside the Battlefield', () => {
    const units = [makeUnit(), makeUnit()];
    const battlefield = fill(units);
    const newcomer = makeUnit();

    const result = placeOnBattlefield(battlefield, { team: 0, slot: 0 }, newcomer);

    expect(result.ok && result.battlefield[0].leader1).toBe(newcomer.id);
    expect(result.ok && usedUnitIds(result.battlefield).has(units[0].id)).toBe(false);
  });

  it('moves a unit to the next open slot of another team', () => {
    const units = [makeUnit(), makeUnit()];
    const battlefield = fill(units);

    const result = placeOnBattlefield(battlefield, { team: 3, slot: null }, units[1]);

    expect(result.ok && result.battlefield[0].leader2).toBeNull();
    expect(result.ok && result.battlefield[3].leader1).toBe(units[1].id);
  });

  it('lets a swap put two cards of the same character in one team', () => {
    const goku = makeUnit({ name: 'Goku', title: 'Saiyan Raised on Earth' });
    const otherGoku = makeUnit({ name: 'Goku', title: 'Kaioken Gamble' });
    const vegeta = makeUnit({ name: 'Vegeta' });
    let battlefield = fill([goku, vegeta]);
    battlefield = (addToBattlefield(battlefield, 1, otherGoku) as { battlefield: Battlefield }).battlefield;

    const result = placeOnBattlefield(battlefield, { team: 0, slot: 1 }, otherGoku);

    expect(result.ok && result.battlefield[0]).toEqual({ leader1: goku.id, leader2: otherGoku.id, followers: [] });
    expect(result.ok && result.battlefield[1].leader1).toBe(vegeta.id);
  });

  it('finds where a unit sits', () => {
    const units = [makeUnit(), makeUnit(), makeUnit()];
    const battlefield = fill(units, 2);

    const found = locateUnit(battlefield, units[2].id);

    expect(found).toEqual({ team: 2, slot: 2 });
  });
});

describe('removing units', () => {
  it('frees a unit and can clear a team', () => {
    const units = [makeUnit(), makeUnit(), makeUnit()];
    const battlefield = fill(units);

    const removed = removeFromBattlefield(battlefield, units[1].id);
    const cleared = clearBattlefieldTeam(removed, 0);

    expect(removed[0]).toEqual({ leader1: units[0].id, leader2: null, followers: [units[2].id] });
    expect(usedUnitIds(cleared).size).toBe(0);
  });
});

describe('describeTeamBoosts', () => {
  it("names the unit and what the team's leader and friend give it", () => {
    const unit = makeUnit({ name: 'Goku', title: 'Earth' });
    const leader = makeUnit({ name: 'Vegeta', title: 'Prince', leaderSkill: 'All Types Ki +3 and HP, ATK & DEF +170%' });

    const text = describeTeamBoosts(unit, leader, null);

    expect(text).toBe('[Earth] Goku\nLeader ([Prince] Vegeta): up to +170%\nFriend: empty');
  });
});

describe('restoreBattlefield', () => {
  it('drops unknown, repeated and malformed entries', () => {
    const saved = [{ leader1: 1, leader2: 99, followers: [2, 2, 'x'] }, null, 'junk'];

    const restored = restoreBattlefield(saved, new Set([1, 2]));

    expect(restored).toHaveLength(16);
    expect(restored[0]).toEqual({ leader1: 1, leader2: null, followers: [2] });
    expect(restored[1]).toEqual({ leader1: null, leader2: null, followers: [] });
  });
});
