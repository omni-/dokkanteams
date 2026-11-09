import type { LinkSkill, LinkStat } from './types.ts';

/** One entry of DokkanStats' link list (`/api/data/en/links`). */
export interface DokkanStatsLink {
  name: string;
  description: string;
  [field: string]: unknown;
}

// The DokkanStats field holding each stat's level 10 value.
const DOKKANSTATS_FIELDS: Record<string, LinkStat> = {
  ki_max: 'ki',
  atk_percent_max: 'atk',
  def_percent_max: 'def',
  crit_chance_max: 'crit',
  evasion_chance_max: 'evasion',
  damage_reduction_max: 'damageReduction',
  hp_recovery_max: 'recovery',
  enemy_def_down_max: 'enemyDefDown',
};

/** Reads one DokkanStats link. `unknownFields` lists level 10 stats this doesn't know about yet. */
export function linkSkillFromDokkanStats(link: DokkanStatsLink): { skill: LinkSkill; unknownFields: string[] } {
  const stats: LinkSkill['stats'] = {};
  const unknownFields: string[] = [];
  for (const [field, value] of Object.entries(link)) {
    if (!field.endsWith('_max')) continue;
    const stat = DOKKANSTATS_FIELDS[field];
    if (!stat) unknownFields.push(field);
    else if (typeof value === 'number' && value !== 0) stats[stat] = value;
  }

  // "ATK +15% (Lv 1) -> ATK +20% (Lv 10)" becomes "ATK +20%".
  const effect = /->\s*(.+?)\s*\(Lv 10\)\s*$/.exec(link.description)?.[1] ?? link.description;
  return { skill: { effect, stats }, unknownFields };
}

const STAT_LABELS: Record<LinkStat, (value: number) => string> = {
  ki: value => `Ki +${value}`,
  atk: value => `ATK +${value}%`,
  def: value => `DEF +${value}%`,
  crit: value => `crit chance +${value}%`,
  evasion: value => `evasion +${value}%`,
  damageReduction: value => `damage reduction +${value}%`,
  recovery: value => `recovers ${value}% HP`,
  enemyDefDown: value => `enemy DEF -${value}%`,
};

/** What a set of active links adds up to. Links missing from `skills` count for nothing. */
export function linkStatTotals(links: readonly string[], skills: Readonly<Record<string, LinkSkill>>): LinkSkill['stats'] {
  const totals: LinkSkill['stats'] = {};
  for (const link of links) {
    for (const [stat, value] of Object.entries(skills[link]?.stats ?? {}) as Array<[LinkStat, number]>) {
      totals[stat] = (totals[stat] ?? 0) + value;
    }
  }
  return totals;
}

/** Stats as text in a fixed order, like "Ki +4, ATK +55%, DEF +20%". Empty when there are none. */
export function formatLinkStats(stats: LinkSkill['stats']): string {
  return (Object.keys(STAT_LABELS) as LinkStat[])
    .flatMap(stat => (stats[stat] ? [STAT_LABELS[stat](stats[stat])] : []))
    .join(', ');
}
