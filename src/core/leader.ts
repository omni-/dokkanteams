import type { LeaderBonus, LeaderClause, LeaderTarget, ParsedLeader, StatBoost, UnitClass, UnitType } from './types.ts';

/** The unit fields a leader skill looks at. */
export type LeaderTraits = { categories: readonly string[]; class: UnitClass; type: UnitType };

const TYPE_NAME = '(?:AGL|TEQ|INT|STR|PHY)';
const CATEGORY_LIST = /((?:"[^"]+"(?:, |,? or ))*"[^"]+") Categor(?:y|ies)/y;
const ALL_TYPES = /[Aa]ll Types/y;
const CLASS_ONLY = /(Super|Extreme) Class/y;
const CLASS_AND_TYPES = new RegExp(`(?:(Super|Extreme) )?(${TYPE_NAME}(?:(?:, | & | and |,? or )${TYPE_NAME})*) Types?`, 'y');
const TARGET_SEPARATOR = /(?:,? or |, )/y;

const KI = /Ki \+(\d+)/y;
const STAT_GROUP = /((?:HP|ATK|DEF)(?:(?:, | & )(?:HP|ATK|DEF))*) \+(\d+)%/y;
const BOOST_SEPARATOR = /(?:, and |, | and )/y;

const CLAUSE = /^(.*?(?:Category|Categories|Types?|Class)) ((?:Ki|HP|ATK|DEF)\b.*)$/;
const BONUS = /^(.+?) for characters who (?:also belong to the |are also )(.+)$/;
const EXCLUSION = /\s*\((.+) characters excluded\)$/;

/**
 * Reads the unconditional boosts out of a leader skill, such as
 * `"Pure Saiyans" Category Ki +3 and HP, ATK & DEF +170%, plus an additional HP, ATK & DEF +30%
 * for characters who also belong to the "Movie Heroes" Category`.
 * Clauses it can't read completely (conditions, enemy debuffs, healing) are skipped rather than guessed at.
 */
export function parseLeaderSkill(text: string | null | undefined): ParsedLeader | null {
  if (!text) return null;

  const clauses = normalize(text)
    .split(/;\s*(?:or\s+)?/)
    .map(parseClause)
    .filter((clause): clause is LeaderClause => clause != null);

  return clauses.length > 0 ? { clauses } : null;
}

/** The highest HP, ATK or DEF boost a leader gives a unit. 0 when it doesn't apply. */
export function leaderBoost(leader: ParsedLeader | null, unit: LeaderTraits): number {
  if (!leader) return 0;

  let best = 0;
  for (const clause of leader.clauses) {
    if (!matchesAny(clause.targets, unit)) continue;
    if (clause.excluded && matchesAny(clause.excluded, unit)) continue;

    best = Math.max(best, peakStatBoost(clause, unit));
  }

  return best;
}

/** The highest boost the leader can give anyone, assuming they qualify for every bonus. */
export function maxLeaderBoost(leader: ParsedLeader | null): number {
  if (!leader) return 0;

  return Math.max(0, ...leader.clauses.map(clause => peakStatBoost(clause)));
}

export function matchesAny(targets: readonly LeaderTarget[], unit: LeaderTraits): boolean {
  return targets.some(target => {
    switch (target.kind) {
      case 'all':
        return true;
      case 'category':
        return unit.categories.includes(target.category);
      case 'filter':
        return (!target.class || target.class === unit.class) && (!target.types || target.types.includes(unit.type));
    }
  });
}

function peakStatBoost(clause: LeaderClause, unit?: LeaderTraits): number {
  let { hp, atk, def } = clause.boost;
  for (const bonus of clause.bonuses) {
    if (unit && !matchesAny(bonus.targets, unit)) continue;
    hp += bonus.boost.hp;
    atk += bonus.boost.atk;
    def += bonus.boost.def;
  }
  return Math.max(hp, atk, def);
}

function normalize(text: string) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseClause(text: string): LeaderClause | null {
  let clauseText = text.trim();
  let excluded: LeaderTarget[] | null = null;
  const exclusion = EXCLUSION.exec(clauseText);
  if (exclusion) {
    excluded = parseTargets(exclusion[1]);
    if (!excluded) return null;
    clauseText = clauseText.slice(0, exclusion.index);
  }

  const match = CLAUSE.exec(clauseText);
  if (!match) return null;

  const targets = parseTargets(match[1]);
  if (!targets) return null;

  const [mainText, ...bonusTexts] = match[2].split(/, plus an additional /);
  const boost = parseBoost(mainText);
  if (!boost) return null;

  const bonuses: LeaderBonus[] = [];
  for (const bonusText of bonusTexts) {
    const bonus = parseBonus(bonusText);
    if (!bonus) return null;
    bonuses.push(bonus);
  }

  return excluded ? { targets, boost, bonuses, excluded } : { targets, boost, bonuses };
}

function parseBonus(text: string): LeaderBonus | null {
  const match = BONUS.exec(text);
  if (!match) return null;

  const boost = parseBoost(match[1]);
  const targets = parseTargets(match[2]);
  return boost && targets ? { targets, boost } : null;
}

/** Reads text like `"A", "B" or "C" Category or Super TEQ Type`. Returns null unless every word is understood. */
export function parseTargets(text: string): LeaderTarget[] | null {
  const targets: LeaderTarget[] = [];
  let position = 0;

  while (position < text.length) {
    if (targets.length > 0) {
      const separator = matchAt(TARGET_SEPARATOR, text, position);
      if (!separator) return null;
      position += separator[0].length;
    }

    const categories = matchAt(CATEGORY_LIST, text, position);
    if (categories) {
      for (const name of categories[1].matchAll(/"([^"]+)"/g)) {
        targets.push({ kind: 'category', category: name[1] });
      }
      position += categories[0].length;
      continue;
    }

    const all = matchAt(ALL_TYPES, text, position);
    if (all) {
      targets.push({ kind: 'all' });
      position += all[0].length;
      continue;
    }

    const classOnly = matchAt(CLASS_ONLY, text, position);
    if (classOnly) {
      targets.push({ kind: 'filter', class: classOnly[1] as UnitClass });
      position += classOnly[0].length;
      continue;
    }

    const classAndTypes = matchAt(CLASS_AND_TYPES, text, position);
    if (classAndTypes) {
      const types = classAndTypes[2].match(new RegExp(TYPE_NAME, 'g')) as UnitType[];
      targets.push({
        kind: 'filter',
        ...(classAndTypes[1] ? { class: classAndTypes[1] as UnitClass } : {}),
        types,
      });
      position += classAndTypes[0].length;
      continue;
    }

    return null;
  }

  return targets.length > 0 ? targets : null;
}

/** Reads text like `Ki +3, HP +200% and ATK & DEF +170%`. Returns null unless every word is understood. */
export function parseBoost(text: string): StatBoost | null {
  const boost: StatBoost = { ki: 0, hp: 0, atk: 0, def: 0 };
  const trimmed = text.trim();
  let position = 0;
  let parts = 0;

  while (position < trimmed.length) {
    if (parts > 0) {
      const separator = matchAt(BOOST_SEPARATOR, trimmed, position);
      if (!separator) return null;
      position += separator[0].length;
    }

    const ki = parts === 0 ? matchAt(KI, trimmed, position) : null;
    if (ki) {
      boost.ki = Number(ki[1]);
      position += ki[0].length;
      parts++;
      continue;
    }

    const group = matchAt(STAT_GROUP, trimmed, position);
    if (!group) return null;

    const value = Number(group[2]);
    for (const stat of group[1].match(/HP|ATK|DEF/g) ?? []) {
      boost[stat.toLowerCase() as 'hp' | 'atk' | 'def'] = value;
    }
    position += group[0].length;
    parts++;
  }

  return parts > 0 ? boost : null;
}

function matchAt(pattern: RegExp, text: string, position: number) {
  pattern.lastIndex = position;
  return pattern.exec(text);
}
