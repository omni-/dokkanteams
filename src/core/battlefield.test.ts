import { describe, expect, it } from 'vitest';
import {
  addToBattlefield,
  clearBattlefieldTeam,
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
  const byId = new Map(units.map(unit => [unit.id, unit]));
  let battlefield: Battlefield = emptyBattlefield();
  for (const unit of units) {
    const result = addToBattlefield(battlefield, teamIndex, unit, byId);
    if (result.ok) battlefield = result.battlefield;
  }
  return { battlefield, byId };
}

describe('addToBattlefield', () => {
  it('fills both leader slots before the followers', () => {
    const units = [makeUnit(), makeUnit(), makeUnit()];

    const { battlefield } = fill(units);

    expect(battlefield[0]).toEqual({ leader1: units[0].id, leader2: units[1].id, followers: [units[2].id] });
  });

  it('refuses an eighth unit', () => {
    const units = Array.from({ length: 7 }, () => makeUnit());
    const { battlefield, byId } = fill(units);
    const extra = makeUnit();
    byId.set(extra.id, extra);

    const result = addToBattlefield(battlefield, 0, extra, byId);

    expect(result).toEqual({ ok: false, reason: 'full' });
  });

  it('refuses a card already used in another team', () => {
    const unit = makeUnit();
    const { battlefield, byId } = fill([unit], 0);

    const result = addToBattlefield(battlefield, 1, unit, byId);

    expect(result).toEqual({ ok: false, reason: 'used' });
  });

  it('refuses a second card of the same character in one team', () => {
    const first = makeUnit({ name: 'Goku' });
    const { battlefield, byId } = fill([first]);
    const second = makeUnit({ name: 'Goku' });
    byId.set(second.id, second);

    const result = addToBattlefield(battlefield, 0, second, byId);

    expect(result).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('refuses transformed forms', () => {
    const form = makeUnit({ formOf: 1 });

    const result = addToBattlefield(emptyBattlefield(), 0, form, new Map([[form.id, form]]));

    expect(result).toEqual({ ok: false, reason: 'form' });
  });
});

describe('placeOnBattlefield', () => {
  it('puts a new unit on the exact slot it was dropped on', () => {
    const units = [makeUnit(), makeUnit()];
    const { battlefield, byId } = fill(units);
    const newcomer = makeUnit();
    byId.set(newcomer.id, newcomer);

    const result = placeOnBattlefield(battlefield, { team: 0, slot: 4 }, newcomer, byId);

    expect(result.ok && result.battlefield[0]).toEqual({ leader1: units[0].id, leader2: units[1].id, followers: [newcomer.id] });
  });

  it('swaps two placed units, even across teams', () => {
    const first = [makeUnit(), makeUnit(), makeUnit()];
    const second = [makeUnit()];
    const byId = new Map([...first, ...second].map(unit => [unit.id, unit]));
    let battlefield = fill(first).battlefield;
    battlefield = (addToBattlefield(battlefield, 1, second[0], byId) as { battlefield: Battlefield }).battlefield;

    const result = placeOnBattlefield(battlefield, { team: 1, slot: 0 }, first[2], byId);

    expect(result.ok && result.battlefield[0].followers).toEqual([second[0].id]);
    expect(result.ok && result.battlefield[1].leader1).toBe(first[2].id);
  });

  it('replaces the occupant when the unit comes from outside the Battlefield', () => {
    const units = [makeUnit(), makeUnit()];
    const { battlefield, byId } = fill(units);
    const newcomer = makeUnit();
    byId.set(newcomer.id, newcomer);

    const result = placeOnBattlefield(battlefield, { team: 0, slot: 0 }, newcomer, byId);

    expect(result.ok && result.battlefield[0].leader1).toBe(newcomer.id);
    expect(result.ok && usedUnitIds(result.battlefield).has(units[0].id)).toBe(false);
  });

  it('moves a unit to the next open slot of another team', () => {
    const units = [makeUnit(), makeUnit()];
    const { battlefield, byId } = fill(units);

    const result = placeOnBattlefield(battlefield, { team: 3, slot: null }, units[1], byId);

    expect(result.ok && result.battlefield[0].leader2).toBeNull();
    expect(result.ok && result.battlefield[3].leader1).toBe(units[1].id);
  });

  it('refuses a swap that would put the same character in a team twice', () => {
    const goku = makeUnit({ name: 'Goku' });
    const otherGoku = makeUnit({ name: 'Goku' });
    const vegeta = makeUnit({ name: 'Vegeta' });
    const byId = new Map([goku, otherGoku, vegeta].map(unit => [unit.id, unit]));
    let battlefield = fill([goku, vegeta]).battlefield;
    battlefield = (addToBattlefield(battlefield, 1, otherGoku, byId) as { battlefield: Battlefield }).battlefield;

    const result = placeOnBattlefield(battlefield, { team: 0, slot: 1 }, otherGoku, byId);

    expect(result).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('finds where a unit sits', () => {
    const units = [makeUnit(), makeUnit(), makeUnit()];
    const { battlefield } = fill(units, 2);

    const found = locateUnit(battlefield, units[2].id);

    expect(found).toEqual({ team: 2, slot: 2 });
  });
});

describe('removing units', () => {
  it('frees a unit and can clear a team', () => {
    const units = [makeUnit(), makeUnit(), makeUnit()];
    const { battlefield } = fill(units);

    const removed = removeFromBattlefield(battlefield, units[1].id);
    const cleared = clearBattlefieldTeam(removed, 0);

    expect(removed[0]).toEqual({ leader1: units[0].id, leader2: null, followers: [units[2].id] });
    expect(usedUnitIds(cleared).size).toBe(0);
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
