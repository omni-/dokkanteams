/** One condition of a passive skill and the effects it grants. */
export interface PassiveGroup {
  /** e.g. "Basic effect(s)" or "When attacking". Null for effects listed before any condition. */
  heading: string | null;
  effects: string[];
}

/** The game's icons for an effect that activates only once, or that lasts for the rest of battle. */
export type PassiveIcon = 'once' | 'forever';

export type PassivePart = { text: string; icon?: never } | { icon: PassiveIcon; text?: never };

/** Splits one effect into text and the once/forever icons the scraper leaves as `{passiveImg:once}`. */
export function passiveParts(effect: string): PassivePart[] {
  return effect
    .split(/\{passiveImg:(once|forever)}/)
    .map((piece, index): PassivePart | null => {
      // split() puts each captured icon name at an odd index.
      if (index % 2 === 1) return { icon: piece as PassiveIcon };
      return piece ? { text: piece } : null;
    })
    .filter(part => part !== null);
}

/**
 * Splits passive text from the scraper into its conditions. Each condition starts a line as
 * "Heading- first effect", and any further effects of that condition follow on their own lines.
 */
export function parsePassive(text: string): PassiveGroup[] {
  const groups: PassiveGroup[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = /^(.+?)- (.+)$/.exec(trimmed);
    const current = groups.at(-1);
    if (match) groups.push({ heading: match[1], effects: [match[2]] });
    else if (current) current.effects.push(trimmed);
    else groups.push({ heading: null, effects: [trimmed] });
  }
  return groups;
}
