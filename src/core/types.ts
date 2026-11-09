export type UnitClass = 'Super' | 'Extreme';
export type UnitType = 'AGL' | 'TEQ' | 'INT' | 'STR' | 'PHY';
export type Rarity = 'LR' | 'UR';

export const UNIT_CLASSES: readonly UnitClass[] = ['Super', 'Extreme'];
export const UNIT_TYPES: readonly UnitType[] = ['AGL', 'TEQ', 'INT', 'STR', 'PHY'];
export const RARITIES: readonly Rarity[] = ['LR', 'UR'];

/** Ki and percentage stat boosts from one leader skill clause or bonus. */
export interface StatBoost {
  ki: number;
  hp: number;
  atk: number;
  def: number;
}

/** Who a leader skill clause applies to. A unit is covered when it matches any target in the list. */
export type LeaderTarget =
  | { kind: 'category'; category: string }
  | { kind: 'all' }
  | { kind: 'filter'; class?: UnitClass; types?: UnitType[] };

/** An "plus an additional ... for characters who also ..." bonus on top of a clause. */
export interface LeaderBonus {
  targets: LeaderTarget[];
  boost: StatBoost;
}

export interface LeaderClause {
  targets: LeaderTarget[];
  boost: StatBoost;
  bonuses: LeaderBonus[];
  /** From a trailing `("X" Category characters excluded)`. */
  excluded?: LeaderTarget[];
}

/** The parts of a leader skill the parser understood. Unconditional boosts only. */
export interface ParsedLeader {
  clauses: LeaderClause[];
}

export interface SkillText {
  leaderSkill: string;
  superAttack: string;
  ultraSuperAttack: string | null;
  passive: string;
  activeSkill: string | null;
  activeSkillCondition: string | null;
}

/** One card as the site uses it. Transformed forms are separate units that point back at their base. */
export interface Unit {
  id: number;
  name: string;
  title: string;
  rarity: Rarity;
  class: UnitClass;
  type: UnitType;
  cost: number | null;
  /** YYYY-MM-DD, taken from the base card for transformed forms. */
  releaseDate: string | null;
  image: string;
  links: string[];
  categories: string[];
  hp: number;
  atk: number;
  def: number;
  kiMultiplier: string | null;
  base: SkillText;
  /** Extreme Z-Awakened text with any missing parts filled from the base text. */
  eza: SkillText | null;
  superEzaPassive: string | null;
  transformationCondition: string | null;
  /** Parsed from the EZA leader skill when the unit has one. */
  leader: ParsedLeader | null;
  /** The highest average HP/ATK/DEF boost this unit's leader skill can give. */
  maxBoost: number;
  /** How many fieldable units the leader skill boosts. Used to break ties when sorting by leader. */
  leaderReach: number;
  /** Two cards with the same team key can't be fielded together. */
  teamKey: string;
  formOf: number | null;
  forms: number[];
}

export interface Dataset {
  generatedAt: string;
  source: string;
  units: Unit[];
}
