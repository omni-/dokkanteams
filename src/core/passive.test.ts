import { describe, expect, it } from 'vitest';
import { parsePassive, passiveParts } from './passive.ts';

describe('passiveParts', () => {
  it('splits the once and forever icons out of an effect, in order', () => {
    const effect = '{passiveImg:once}{passiveImg:forever}ATK & DEF +250% for {passiveImg:once}allies';

    const parts = passiveParts(effect);

    expect(parts).toEqual([
      { icon: 'once' },
      { icon: 'forever' },
      { text: 'ATK & DEF +250% for ' },
      { icon: 'once' },
      { text: 'allies' },
    ]);
  });

  it('returns plain text as one part', () => {
    const effect = 'Ki +3 and ATK +100%';

    const parts = passiveParts(effect);

    expect(parts).toEqual([{ text: 'Ki +3 and ATK +100%' }]);
  });
});

describe('parsePassive', () => {
  it('groups effects under the condition that starts them', () => {
    const text = 'Basic effect(s)- ATK & DEF 200%\nReceives an additional Ki +2 per Type Ki Sphere obtained\nWhen attacking- ATK 200%';

    const groups = parsePassive(text);

    expect(groups).toEqual([
      { heading: 'Basic effect(s)', effects: ['ATK & DEF 200%', 'Receives an additional Ki +2 per Type Ki Sphere obtained'] },
      { heading: 'When attacking', effects: ['ATK 200%'] },
    ]);
  });

  it('keeps dashes inside an effect', () => {
    const text = 'The more HP remaining- Chance of performing a critical hit (10% - 40%)';

    const groups = parsePassive(text);

    expect(groups).toEqual([{ heading: 'The more HP remaining', effects: ['Chance of performing a critical hit (10% - 40%)'] }]);
  });

  it('leaves effects before any condition without a heading', () => {
    const text = 'Ki +5\n\nFor every attack received- DEF 30%';

    const groups = parsePassive(text);

    expect(groups).toEqual([
      { heading: null, effects: ['Ki +5'] },
      { heading: 'For every attack received', effects: ['DEF 30%'] },
    ]);
  });
});
