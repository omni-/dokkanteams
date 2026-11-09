import { canShareTeam, isFieldable } from './analysis.ts';
import type { Unit } from './types.ts';

export const BATTLEFIELD_TEAM_COUNT = 16;
export const FOLLOWERS_PER_TEAM = 5;

/** Unit ids only, so the plan stays small in storage and survives data refreshes. */
export interface BattlefieldTeam {
  leader1: number | null;
  leader2: number | null;
  followers: number[];
}

export type Battlefield = BattlefieldTeam[];

export type AddResult =
  | { ok: true; battlefield: Battlefield }
  | { ok: false; reason: 'used' | 'full' | 'duplicate' | 'form' | 'no-team' };

export function emptyBattlefield(): Battlefield {
  return Array.from({ length: BATTLEFIELD_TEAM_COUNT }, emptyTeam);
}

export function emptyTeam(): BattlefieldTeam {
  return { leader1: null, leader2: null, followers: [] };
}

export function teamMemberIds(team: BattlefieldTeam): number[] {
  return [team.leader1, team.leader2, ...team.followers].filter((id): id is number => id != null);
}

export function usedUnitIds(battlefield: Battlefield): Set<number> {
  return new Set(battlefield.flatMap(teamMemberIds));
}

/**
 * Puts `unit` in the next open slot of team `teamIndex`: first leader, second leader, then followers.
 * Each card can only be used once across the Battlefield, and a team can't hold two cards of the same character,
 * except alt arts.
 */
export function addToBattlefield(
  battlefield: Battlefield,
  teamIndex: number,
  unit: Unit,
  unitsById: ReadonlyMap<number, Unit>,
): AddResult {
  const team = battlefield[teamIndex];
  if (!team) return { ok: false, reason: 'no-team' };
  if (!isFieldable(unit)) return { ok: false, reason: 'form' };
  if (usedUnitIds(battlefield).has(unit.id)) return { ok: false, reason: 'used' };

  const members = teamMemberIds(team).map(id => unitsById.get(id)).filter((member): member is Unit => member != null);
  if (members.some(member => !canShareBattlefieldTeam(member, unit))) return { ok: false, reason: 'duplicate' };

  let updated: BattlefieldTeam;
  if (team.leader1 == null) updated = { ...team, leader1: unit.id };
  else if (team.leader2 == null) updated = { ...team, leader2: unit.id };
  else if (team.followers.length < FOLLOWERS_PER_TEAM) updated = { ...team, followers: [...team.followers, unit.id] };
  else return { ok: false, reason: 'full' };

  return { ok: true, battlefield: battlefield.map((existing, index) => (index === teamIndex ? updated : existing)) };
}

export const SLOTS_PER_TEAM = 2 + FOLLOWERS_PER_TEAM;

/** A place on the Battlefield. Slot 0 is the leader, 1 the friend and 2 to 6 the other five. */
export interface SlotRef {
  team: number;
  slot: number;
}

export function locateUnit(battlefield: Battlefield, unitId: number): SlotRef | null {
  for (let team = 0; team < battlefield.length; team++) {
    const slot = toSlots(battlefield[team]).indexOf(unitId);
    if (slot >= 0) return { team, slot };
  }
  return null;
}

/**
 * Drops `unit` on a team, either on a given slot or, when `slot` is null, in the team's next open slot.
 * A unit already on the Battlefield moves, swapping places with whoever held the target slot.
 * A unit from outside the Battlefield replaces the target slot's occupant, which goes back to the pool.
 */
export function placeOnBattlefield(
  battlefield: Battlefield,
  target: { team: number; slot: number | null },
  unit: Unit,
  unitsById: ReadonlyMap<number, Unit>,
): AddResult {
  if (!battlefield[target.team]) return { ok: false, reason: 'no-team' };
  if (!isFieldable(unit)) return { ok: false, reason: 'form' };

  const from = locateUnit(battlefield, unit.id);
  if (target.slot == null) {
    if (from?.team === target.team) return { ok: true, battlefield };
    const without = from ? removeFromBattlefield(battlefield, unit.id) : battlefield;
    return addToBattlefield(without, target.team, unit, unitsById);
  }
  if (target.slot < 0 || target.slot >= SLOTS_PER_TEAM) return { ok: false, reason: 'no-team' };

  const slots = battlefield.map(toSlots);
  const occupant = slots[target.team][target.slot];
  if (occupant === unit.id) return { ok: true, battlefield };
  if (from) slots[from.team][from.slot] = occupant;
  slots[target.team][target.slot] = unit.id;

  const touched = from ? [target.team, from.team] : [target.team];
  if (touched.some(team => hasSameCharacterTwice(slots[team], unitsById))) return { ok: false, reason: 'duplicate' };

  return { ok: true, battlefield: slots.map(fromSlots) };
}

function toSlots(team: BattlefieldTeam): Array<number | null> {
  const followers = Array.from({ length: FOLLOWERS_PER_TEAM }, (_, index) => team.followers[index] ?? null);
  return [team.leader1, team.leader2, ...followers];
}

// Followers stay packed to the front, so a unit dropped on any empty follower slot lands after the others.
function fromSlots(slots: Array<number | null>): BattlefieldTeam {
  return {
    leader1: slots[0] ?? null,
    leader2: slots[1] ?? null,
    followers: slots.slice(2).filter((id): id is number => id != null),
  };
}

function hasSameCharacterTwice(ids: Array<number | null>, unitsById: ReadonlyMap<number, Unit>): boolean {
  const members = ids
    .map(id => (id == null ? undefined : unitsById.get(id)))
    .filter((member): member is Unit => member != null);
  return members.some((member, index) => members.slice(index + 1).some(other => !canShareBattlefieldTeam(member, other)));
}

// Unlike normal teams, the game lets a Battlefield team hold an alt art alongside its original.
// Alt arts share their original's title and name.
function canShareBattlefieldTeam(a: Unit, b: Unit): boolean {
  return canShareTeam(a, b) || (a.title === b.title && a.name === b.name);
}

export function removeFromBattlefield(battlefield: Battlefield, unitId: number): Battlefield {
  return battlefield.map(team => ({
    leader1: team.leader1 === unitId ? null : team.leader1,
    leader2: team.leader2 === unitId ? null : team.leader2,
    followers: team.followers.filter(id => id !== unitId),
  }));
}

export function clearBattlefieldTeam(battlefield: Battlefield, teamIndex: number): Battlefield {
  return battlefield.map((team, index) => (index === teamIndex ? emptyTeam() : team));
}

/** Reads a saved plan, dropping anything malformed or no longer in the data. */
export function restoreBattlefield(saved: unknown, knownIds: ReadonlySet<number>): Battlefield {
  if (!Array.isArray(saved)) return emptyBattlefield();

  const seen = new Set<number>();
  const keep = (id: unknown) => {
    if (typeof id !== 'number' || !knownIds.has(id) || seen.has(id)) return null;
    seen.add(id);
    return id;
  };

  return emptyBattlefield().map((_, index) => {
    const team = saved[index] as Partial<BattlefieldTeam> | undefined;
    if (!team || typeof team !== 'object') return emptyTeam();
    return {
      leader1: keep(team.leader1),
      leader2: keep(team.leader2),
      followers: (Array.isArray(team.followers) ? team.followers : [])
        .map(keep)
        .filter((id): id is number => id != null)
        .slice(0, FOLLOWERS_PER_TEAM),
    };
  });
}
