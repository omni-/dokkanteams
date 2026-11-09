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
 * Each card can only be used once across the Battlefield, and a team can't hold two cards of the same character.
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
  if (members.some(member => !canShareTeam(member, unit))) return { ok: false, reason: 'duplicate' };

  let updated: BattlefieldTeam;
  if (team.leader1 == null) updated = { ...team, leader1: unit.id };
  else if (team.leader2 == null) updated = { ...team, leader2: unit.id };
  else if (team.followers.length < FOLLOWERS_PER_TEAM) updated = { ...team, followers: [...team.followers, unit.id] };
  else return { ok: false, reason: 'full' };

  return { ok: true, battlefield: battlefield.map((existing, index) => (index === teamIndex ? updated : existing)) };
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
