import { leaderBoost } from './leader.ts';
import type { Unit } from './types.ts';

/** Links two units share. Empty when they can't be on the same team. */
export function sharedLinks(a: Unit, b: Unit): string[] {
  if (!canShareTeam(a, b)) return [];
  return a.links.filter(link => b.links.includes(link));
}

/** Cards of the same character (same base card or same name) can't be fielded together. */
export function canShareTeam(a: Unit, b: Unit): boolean {
  return a.teamKey !== b.teamKey;
}

/** Transformed forms ride along with their base card; they can't lead or be picked on their own. */
export function isFieldable(unit: Unit): boolean {
  return unit.formOf == null;
}

export interface LinkGroup {
  count: number;
  units: Unit[];
}

/** Every unit that shares at least two links with `unit`, most shared links first. */
export function linkingPartners(unit: Unit, units: readonly Unit[]): LinkGroup[] {
  const groups = new Map<number, Unit[]>();
  for (const other of units) {
    const count = sharedLinks(unit, other).length;
    if (count < 2) continue;
    const group = groups.get(count) ?? [];
    group.push(other);
    groups.set(count, group);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => b - a)
    .map(([count, group]) => ({ count, units: group }));
}

export interface RankedLeader {
  leader: Unit;
  boost: number;
  sharedLinks: number;
}

export interface BoostGroup {
  boost: number;
  units: Array<{ unit: Unit; sharedLinks: number }>;
}

/** Every leader that boosts `unit`, grouped by boost, strongest first, then by links shared with `unit`. */
export function bestLeadersFor(unit: Unit, units: readonly Unit[]): BoostGroup[] {
  const groups = new Map<number, BoostGroup['units']>();
  for (const leader of units) {
    if (!leader.leader || !isFieldable(leader)) continue;
    const boost = leaderBoost(leader.leader, unit);
    if (boost <= 0) continue;
    const group = groups.get(boost) ?? [];
    group.push({ unit: leader, sharedLinks: sharedLinks(leader, unit).length });
    groups.set(boost, group);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => b - a)
    .map(([boost, group]) => ({
      boost,
      units: group.sort((a, b) => b.sharedLinks - a.sharedLinks || b.unit.leaderReach - a.unit.leaderReach),
    }));
}

/** Fieldable units the leader boosts, grouped by boost and sorted by links shared with the leader. */
export function unitsBoostedBy(leader: Unit, units: readonly Unit[]): BoostGroup[] {
  if (!leader.leader) return [];

  const groups = new Map<number, BoostGroup['units']>();
  for (const unit of units) {
    if (!isFieldable(unit) || unit.id === leader.id) continue;
    const boost = leaderBoost(leader.leader, unit);
    if (boost <= 0) continue;
    const group = groups.get(boost) ?? [];
    group.push({ unit, sharedLinks: sharedLinks(leader, unit).length });
    groups.set(boost, group);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => b - a)
    .map(([boost, group]) => ({ boost, units: group.sort((a, b) => b.sharedLinks - a.sharedLinks) }));
}

/** Leaders that boost every unit in `team`, ranked by the smallest boost they give any of them. */
export function commonLeaders(team: readonly Unit[], units: readonly Unit[]): RankedLeader[] {
  if (team.length === 0) return [];

  const ranked: RankedLeader[] = [];
  for (const leader of units) {
    if (!leader.leader || !isFieldable(leader)) continue;

    let lowest = Infinity;
    for (const member of team) {
      lowest = Math.min(lowest, leaderBoost(leader.leader, member));
      if (lowest === 0) break;
    }
    if (lowest > 0) {
      const links = team.reduce((total, member) => total + sharedLinks(leader, member).length, 0);
      ranked.push({ leader, boost: lowest, sharedLinks: links });
    }
  }

  return ranked.sort((a, b) => b.boost - a.boost || b.sharedLinks - a.sharedLinks);
}

export interface PossibleTeam {
  leader: Unit;
  groups: BoostGroup[];
  /** Categories the leader and every boosted teammate have in common. */
  sharedCategories: string[];
  boostedCount: number;
}

/** For each unit in `team` with a leader skill, which of the others it boosts. Best coverage first. */
export function possibleTeams(team: readonly Unit[]): PossibleTeam[] {
  return team
    .filter(leader => leader.leader && isFieldable(leader))
    .map(leader => {
      const groups = unitsBoostedBy(leader, team.filter(member => canShareTeam(member, leader)));
      const boosted = groups.flatMap(group => group.units.map(entry => entry.unit));
      const sharedCategories = boosted.reduce(
        (categories, unit) => categories.filter(category => unit.categories.includes(category)),
        leader.categories,
      );
      return { leader, groups, sharedCategories, boostedCount: boosted.length };
    })
    .sort((a, b) =>
      b.boostedCount - a.boostedCount
      || totalBoost(b) - totalBoost(a)
      || b.leader.maxBoost - a.leader.maxBoost,
    );
}

function totalBoost(team: PossibleTeam) {
  return team.groups.reduce((total, group) => total + group.boost * group.units.length, 0);
}

export interface LinkEdge {
  source: number;
  target: number;
  links: string[];
}

/** Pairs in `team` that share at least `minimumLinks` links. */
export function linkEdges(team: readonly Unit[], minimumLinks: number): LinkEdge[] {
  const edges: LinkEdge[] = [];
  for (let i = 0; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      const links = sharedLinks(team[i], team[j]);
      if (links.length >= minimumLinks) edges.push({ source: team[i].id, target: team[j].id, links });
    }
  }
  return edges;
}

export interface LinkCount {
  link: string;
  units: Unit[];
}

/** Links held by at least two units in `team`, most widely held first. */
export function teamLinkCounts(team: readonly Unit[]): LinkCount[] {
  const byLink = new Map<string, Unit[]>();
  for (const unit of team) {
    for (const link of unit.links) {
      const holders = byLink.get(link) ?? [];
      holders.push(unit);
      byLink.set(link, holders);
    }
  }

  return [...byLink.entries()]
    .filter(([, holders]) => holders.length > 1)
    .map(([link, holders]) => ({ link, units: holders }))
    .sort((a, b) => b.units.length - a.units.length || a.link.localeCompare(b.link));
}

/** How many rotation pairs a team has. Everyone else floats. */
export const ROTATION_COUNT = 2;

/** One rotation spot is null while it's empty. */
export interface RotationPair {
  units: [Unit | null, Unit | null];
  links: string[];
}

export interface RotationPlan {
  rotations: RotationPair[];
  floaters: Unit[];
}

/** Rotations by unit id, with null for an empty spot. Always has `ROTATION_COUNT` pairs. */
export interface RotationLayout {
  rotations: Array<[number | null, number | null]>;
  floaters: number[];
}

/** Where a unit can be dropped in the rotations: onto a member, an empty spot, or the floaters. */
export type RotationSpot =
  | { kind: 'unit'; unitId: number }
  | { kind: 'slot'; rotation: number; position: number }
  | { kind: 'floaters' };

/** Every pair in `team` that can be fielded together, most shared links first. */
function rotationPairs(team: readonly Unit[]): Array<{ units: [Unit, Unit]; links: string[] }> {
  const pairs: Array<{ units: [Unit, Unit]; links: string[] }> = [];
  for (let i = 0; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      if (canShareTeam(team[i], team[j])) pairs.push({ units: [team[i], team[j]], links: sharedLinks(team[i], team[j]) });
    }
  }
  return pairs.sort((a, b) => b.links.length - a.links.length);
}

/**
 * The two rotations (pairs that come in together every other turn) with the most shared links
 * between them, and everyone else as floaters. A team of two or three gets one rotation.
 */
export function bestRotations(team: readonly Unit[]): RotationLayout {
  const pairs = rotationPairs(team);
  let rotations = pairs.slice(0, 1);
  let bestTotal = -1;
  let bestWeaker = -1;
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const [a, b] = [pairs[i], pairs[j]];
      if (b.units.some(unit => a.units.includes(unit))) continue;
      const total = a.links.length + b.links.length;
      // On a tie, two decent rotations beat one great and one poor.
      const weaker = Math.min(a.links.length, b.links.length);
      if (total > bestTotal || (total === bestTotal && weaker > bestWeaker)) {
        rotations = [a, b];
        bestTotal = total;
        bestWeaker = weaker;
      }
    }
  }

  const rotating = new Set(rotations.flatMap(pair => pair.units));
  return {
    rotations: Array.from({ length: ROTATION_COUNT }, (_, index): [number | null, number | null] => {
      const pair = rotations[index];
      return pair ? [pair.units[0].id, pair.units[1].id] : [null, null];
    }),
    floaters: team.filter(unit => !rotating.has(unit)).map(unit => unit.id),
  };
}

/**
 * `layout` brought in line with the team: members who left are taken out, leaving their spot empty, and
 * new members fill the first empty rotation spot, then the floaters. Nobody else moves.
 */
export function fitLayout(layout: RotationLayout | null, teamIds: readonly number[]): RotationLayout {
  const members = new Set(teamIds);
  const placed = new Set<number>();
  const keep = (id: number | null | undefined) => {
    if (id == null || !members.has(id) || placed.has(id)) return null;
    placed.add(id);
    return id;
  };

  const rotations = Array.from({ length: ROTATION_COUNT }, (_, index): [number | null, number | null] => {
    const pair = layout?.rotations[index];
    return [keep(pair?.[0]), keep(pair?.[1])];
  });
  const floaters = (layout?.floaters ?? []).map(keep).filter(id => id != null);

  for (const id of teamIds) {
    if (placed.has(id)) continue;
    placed.add(id);
    const pair = rotations.find(spots => spots.includes(null));
    if (pair) pair[pair.indexOf(null)] = id;
    else floaters.push(id);
  }
  return { rotations, floaters };
}

/** Moves a unit to `spot`, swapping with whoever is there. Returns `layout` itself when nothing changes. */
export function moveInLayout(layout: RotationLayout, unitId: number, spot: RotationSpot): RotationLayout {
  if (spot.kind === 'unit') return swapInLayout(layout, unitId, spot.unitId);

  if (spot.kind === 'slot') {
    const current = layout.rotations[spot.rotation]?.[spot.position];
    if (current === undefined) return layout;
    if (current != null) return swapInLayout(layout, unitId, current);
    const { rotations, floaters } = takeOut(layout, unitId);
    rotations[spot.rotation][spot.position] = unitId;
    return { rotations, floaters };
  }

  if (layout.floaters.includes(unitId)) return layout;
  const { rotations, floaters } = takeOut(layout, unitId);
  return { rotations, floaters: [...floaters, unitId] };
}

function swapInLayout(layout: RotationLayout, a: number, b: number): RotationLayout {
  if (a === b) return layout;
  const swap = (id: number | null) => (id === a ? b : id === b ? a : id);
  return {
    rotations: layout.rotations.map(([first, second]) => [swap(first), swap(second)]),
    floaters: layout.floaters.map(id => swap(id) as number),
  };
}

function takeOut(layout: RotationLayout, unitId: number): RotationLayout {
  const empty = (id: number | null) => (id === unitId ? null : id);
  return {
    rotations: layout.rotations.map(([first, second]) => [empty(first), empty(second)]),
    floaters: layout.floaters.filter(id => id !== unitId),
  };
}

/** The units and shared links `layout` describes. Ids that aren't in `team` show as empty spots. */
export function rotationPlan(layout: RotationLayout, team: readonly Unit[]): RotationPlan {
  const byId = new Map(team.map(unit => [unit.id, unit]));
  const unit = (id: number | null) => (id == null ? null : byId.get(id) ?? null);
  return {
    rotations: layout.rotations.map(([first, second]) => {
      const [a, b] = [unit(first), unit(second)];
      return { units: [a, b], links: a && b ? sharedLinks(a, b) : [] };
    }),
    floaters: layout.floaters.map(unit).filter(member => member != null),
  };
}

/** Reads a saved layout, or null when it's malformed. */
export function restoreRotationLayout(saved: unknown): RotationLayout | null {
  if (!saved || typeof saved !== 'object') return null;
  const { rotations, floaters } = saved as Partial<RotationLayout>;
  const isId = (value: unknown) => typeof value === 'number';
  if (!Array.isArray(rotations) || !Array.isArray(floaters) || !floaters.every(isId)) return null;
  if (!rotations.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(id => id === null || isId(id)))) return null;
  return { rotations, floaters };
}
