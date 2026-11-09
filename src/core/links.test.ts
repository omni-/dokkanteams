import { describe, expect, it } from 'vitest';
import { formatLinkStats, linkSkillFromDokkanStats, linkStatTotals } from './links.ts';
import type { LinkSkill } from './types.ts';

describe('linkSkillFromDokkanStats', () => {
  it('keeps the level 10 effect and stats, and reports stats it does not know', () => {
    const link = {
      id: 42,
      name: 'Infighter',
      description: "ATK +10% and all enemies' DEF -10% (Lv 1) -> ATK +15% and all enemies' DEF -15% (Lv 10)",
      atk_percent_min: 10,
      atk_percent_max: 15,
      def_percent_max: 0,
      enemy_def_down_min: 10,
      enemy_def_down_max: 15,
      speed_max: 3,
    };

    const { skill, unknownFields } = linkSkillFromDokkanStats(link);

    expect(skill).toEqual({ effect: "ATK +15% and all enemies' DEF -15%", stats: { atk: 15, enemyDefDown: 15 } });
    expect(unknownFields).toEqual(['speed_max']);
  });
});

describe('link stat totals', () => {
  it('adds up the stats of the active links in a fixed order and skips unknown links', () => {
    const skills: Record<string, LinkSkill> = {
      'Fierce Battle': { effect: 'ATK +20%', stats: { atk: 20 } },
      'Super Saiyan': { effect: 'ATK +10%', stats: { atk: 10 } },
      'Prepared for Battle': { effect: 'Ki +2 and DEF +10%', stats: { ki: 2, def: 10 } },
      'Tough as Nails': { effect: 'DEF +20% and reduces damage received by 5%', stats: { def: 20, damageReduction: 5 } },
    };

    const totals = linkStatTotals(['Tough as Nails', 'Fierce Battle', 'Super Saiyan', 'Prepared for Battle', 'Unknown'], skills);

    expect(formatLinkStats(totals)).toBe('Ki +2, ATK +30%, DEF +30%, damage reduction +5%');
  });

  it('gives no text when the links have no stats', () => {
    const text = formatLinkStats(linkStatTotals(['Unknown'], {}));

    expect(text).toBe('');
  });
});
