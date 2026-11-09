import { maxLeaderBoost, parseLeaderSkill } from './leader.ts';
import type { Unit } from './types.ts';

let nextId = 1000;

/** A unit with sensible defaults; pass `leaderSkill` to get a parsed leader. */
export function makeUnit(overrides: Partial<Unit> & { leaderSkill?: string } = {}): Unit {
  const { leaderSkill = '', ...rest } = overrides;
  const id = rest.id ?? nextId++;
  const leader = parseLeaderSkill(leaderSkill);
  const name = rest.name ?? `Unit ${id}`;

  return {
    id,
    name,
    title: 'Title',
    rarity: 'LR',
    class: 'Super',
    type: 'AGL',
    cost: 77,
    releaseDate: '2026-01-01',
    ezaReleaseDate: null,
    superEzaReleaseDate: null,
    obtain: null,
    image: `images/thumbs/${id}.png`,
    links: [],
    categories: [],
    hp: 20000,
    atk: 20000,
    def: 15000,
    kiMultiplier: null,
    base: {
      leaderSkill,
      superAttack: '',
      ultraSuperAttack: null,
      passive: '',
      activeSkill: null,
      activeSkillCondition: null,
    },
    eza: null,
    superEzaPassive: null,
    transformationCondition: null,
    leader,
    maxBoost: maxLeaderBoost(leader),
    leaderReach: 0,
    teamKey: name.toLowerCase(),
    formOf: null,
    forms: [],
    ...rest,
  };
}
