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

/** Leaders that boost `unit`, strongest first. */
export function bestLeadersFor(unit: Unit, units: readonly Unit[], limit = 20): RankedLeader[] {
  const ranked: RankedLeader[] = [];
  for (const leader of units) {
    if (!leader.leader || !isFieldable(leader)) continue;
    const boost = leaderBoost(leader.leader, unit);
    if (boost > 0) ranked.push({ leader, boost, sharedLinks: sharedLinks(leader, unit).length });
  }

  return ranked
    .sort((a, b) => b.boost - a.boost || b.sharedLinks - a.sharedLinks || b.leader.leaderReach - a.leader.leaderReach)
    .slice(0, limit);
}

export interface BoostGroup {
  boost: number;
  units: Array<{ unit: Unit; sharedLinks: number }>;
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

export interface RotationPair {
  units: [Unit, Unit];
  links: string[];
}

export interface RotationPlan {
  rotations: RotationPair[];
  floaters: Unit[];
}

/** A rotation plan by unit id, kept when the viewer rearranges the rotations. */
export interface RotationLayout {
  rotations: Array<[number, number]>;
  floaters: number[];
}

function rotationPair(a: Unit, b: Unit): RotationPair {
  return { units: [a, b], links: sharedLinks(a, b) };
}

/** Every pair in `team` that can be fielded together, most shared links first. */
function rotationPairs(team: readonly Unit[]): RotationPair[] {
  const pairs: RotationPair[] = [];
  for (let i = 0; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      if (canShareTeam(team[i], team[j])) pairs.push(rotationPair(team[i], team[j]));
    }
  }
  return pairs.sort((a, b) => b.links.length - a.links.length);
}

/**
 * The two rotations (pairs that come in together every other turn) with the most shared links
 * between them, and everyone else as floaters. A team of two or three gets one rotation.
 */
export function bestRotations(team: readonly Unit[]): RotationPlan | null {
  const pairs = rotationPairs(team);
  if (pairs.length === 0) return null;

  let rotations = [pairs[0]];
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
  return { rotations, floaters: team.filter(unit => !rotating.has(unit)) };
}

export function layoutOf(plan: RotationPlan): RotationLayout {
  return {
    rotations: plan.rotations.map(({ units: [a, b] }) => [a.id, b.id]),
    floaters: plan.floaters.map(unit => unit.id),
  };
}

/** Swaps two units' places, within or between the rotations and the floaters. */
export function swapInLayout(layout: RotationLayout, a: number, b: number): RotationLayout {
  const swap = (id: number) => (id === a ? b : id === b ? a : id);
  return {
    rotations: layout.rotations.map(([first, second]) => [swap(first), swap(second)]),
    floaters: layout.floaters.map(swap),
  };
}

/** The plan `layout` describes, or null unless it holds exactly the members of `team`. */
export function planFromLayout(layout: RotationLayout, team: readonly Unit[]): RotationPlan | null {
  const byId = new Map(team.map(unit => [unit.id, unit]));
  const ids = [...layout.rotations.flat(), ...layout.floaters];
  if (ids.length !== byId.size || new Set(ids).size !== ids.length || !ids.every(id => byId.has(id))) return null;

  const unit = (id: number) => byId.get(id) as Unit;
  return {
    rotations: layout.rotations.map(([a, b]) => rotationPair(unit(a), unit(b))),
    floaters: layout.floaters.map(unit),
  };
}

/** Reads a saved layout, or null when it's malformed. */
export function restoreRotationLayout(saved: unknown): RotationLayout | null {
  if (!saved || typeof saved !== 'object') return null;
  const { rotations, floaters } = saved as Partial<RotationLayout>;
  const isId = (value: unknown) => typeof value === 'number';
  if (!Array.isArray(rotations) || !Array.isArray(floaters) || !floaters.every(isId)) return null;
  if (!rotations.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(isId))) return null;
  return { rotations, floaters };
}
