import { describe, expect, it } from 'vitest';
import { placeInTeam } from './team.ts';

describe('placeInTeam', () => {
  it('appends a new unit when there is no target', () => {
    const result = placeInTeam([1, 2], 3, null);

    expect(result).toEqual([1, 2, 3]);
  });

  it('inserts a new unit before the target', () => {
    const result = placeInTeam([1, 2, 3], 9, 2);

    expect(result).toEqual([1, 9, 2, 3]);
  });

  it('moves an existing unit instead of duplicating it', () => {
    const forward = placeInTeam([1, 2, 3, 4], 1, 4);
    const toEnd = placeInTeam([1, 2, 3, 4], 2, null);

    expect(forward).toEqual([2, 3, 1, 4]);
    expect(toEnd).toEqual([1, 3, 4, 2]);
  });

  it('leaves the order alone when a unit is dropped onto itself', () => {
    const result = placeInTeam([1, 2, 3], 2, 2);

    expect(result).toEqual([1, 2, 3]);
  });
});
