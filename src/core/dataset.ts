import { leaderBoost, maxLeaderBoost, parseLeaderSkill } from './leader.ts';
import { RARITIES, UNIT_CLASSES, UNIT_TYPES } from './types.ts';
import type { Dataset, Rarity, SkillText, Unit, UnitClass, UnitType } from './types.ts';

/** The fields of DokkanWebScraper's `Character` that the site reads. */
export interface ScrapedCharacter {
  id: number | string;
  name: string;
  title: string;
  rarity: string;
  class: string;
  type: string;
  cost?: number;
  releaseDate?: string;
  leaderSkill: string;
  ezaLeaderSkill?: string;
  superAttack: string;
  ezaSuperAttack?: string;
  ultraSuperAttack?: string;
  ezaUltraSuperAttack?: string;
  passive: string;
  ezaPassive?: string;
  superEzaPassive?: string;
  activeSkill?: string;
  activeSkillCondition?: string;
  ezaActiveSkill?: string;
  ezaActiveSkillCondition?: string;
  transformationCondition?: string;
  links: string[];
  categories: string[];
  maxLevelHP?: number | null;
  freeDupeHP?: number | null;
  rainbowHP?: number | null;
  maxLevelAttack?: number | null;
  freeDupeAttack?: number | null;
  rainbowAttack?: number | null;
  maxDefence?: number | null;
  freeDupeDefence?: number | null;
  rainbowDefence?: number | null;
  kiMultiplier?: string;
  transformations?: ScrapedTransformation[];
}

export interface ScrapedTransformation {
  transformedID: number | string;
  transformedName: string;
  transformedClass: string;
  transformedType: string;
  transformedSuperAttack?: string;
  transformedEZASuperAttack?: string;
  transformedUltraSuperAttack?: string;
  transformedEZAUltraSuperAttack?: string;
  transformedPassive?: string;
  transformedEZAPassive?: string;
  transformedActiveSkill?: string;
  transformedActiveSkillCondition?: string;
  transformedLinks: string[];
  transformedCategories?: string[];
}

export interface BuildResult {
  dataset: Dataset;
  /** Cards left out, with the reason. */
  skipped: string[];
}

/** Turns scraper output into the site's unit list, with transformed forms flattened into their own units. */
export function buildDataset(characters: readonly ScrapedCharacter[], source: string, now = new Date()): BuildResult {
  const units: Unit[] = [];
  const skipped: string[] = [];
  const seen = new Set<number>();

  for (const character of characters) {
    const id = Number(character.id);
    const traits = readTraits(character.rarity, character.class, character.type);
    if (!Number.isFinite(id) || !traits) {
      skipped.push(`${character.id} ${character.name}: unreadable id, rarity, class or type`);
      continue;
    }
    if (seen.has(id)) {
      skipped.push(`${id} ${character.name}: duplicate id`);
      continue;
    }
    seen.add(id);

    const base = baseUnit(character, id, traits);
    units.push(base);

    for (const transformation of character.transformations ?? []) {
      const formId = Number(transformation.transformedID);
      const formTraits = readTraits(traits.rarity, transformation.transformedClass, transformation.transformedType);
      if (!Number.isFinite(formId) || !formTraits) {
        skipped.push(`${transformation.transformedID} ${transformation.transformedName} (form of ${id}): unreadable id, class or type`);
        continue;
      }
      if (seen.has(formId)) {
        skipped.push(`${formId} ${transformation.transformedName} (form of ${id}): duplicate id`);
        continue;
      }
      seen.add(formId);
      units.push(formUnit(transformation, formId, formTraits, base, character));
      base.forms.push(formId);
    }
  }

  const fieldable = units.filter(unit => unit.formOf == null);
  for (const unit of units) {
    if (!unit.leader) continue;
    unit.maxBoost = maxLeaderBoost(unit.leader);
    unit.leaderReach = fieldable.filter(other => leaderBoost(unit.leader, other) > 0).length;
  }

  // Newest first, with each transformed form right after its base card.
  units.sort((a, b) =>
    (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '')
    || (b.formOf ?? b.id) - (a.formOf ?? a.id)
    || Number(a.formOf != null) - Number(b.formOf != null)
    || a.id - b.id,
  );

  return { dataset: { generatedAt: now.toISOString(), source, units }, skipped };
}

interface Traits {
  rarity: Rarity;
  class: UnitClass;
  type: UnitType;
}

function readTraits(rarity: string, unitClass: string, type: string): Traits | null {
  if (!RARITIES.includes(rarity as Rarity)) return null;
  if (!UNIT_CLASSES.includes(unitClass as UnitClass)) return null;
  if (!UNIT_TYPES.includes(type as UnitType)) return null;
  return { rarity: rarity as Rarity, class: unitClass as UnitClass, type: type as UnitType };
}

function baseUnit(character: ScrapedCharacter, id: number, traits: Traits): Unit {
  const base: SkillText = {
    leaderSkill: text(character.leaderSkill) ?? '',
    superAttack: text(character.superAttack) ?? '',
    ultraSuperAttack: text(character.ultraSuperAttack),
    passive: text(character.passive) ?? '',
    activeSkill: text(character.activeSkill),
    activeSkillCondition: text(character.activeSkillCondition),
  };
  const hasEza = [character.ezaLeaderSkill, character.ezaSuperAttack, character.ezaPassive].some(value => text(value));
  const eza: SkillText | null = hasEza
    ? {
        leaderSkill: text(character.ezaLeaderSkill) ?? base.leaderSkill,
        superAttack: text(character.ezaSuperAttack) ?? base.superAttack,
        ultraSuperAttack: text(character.ezaUltraSuperAttack) ?? base.ultraSuperAttack,
        passive: text(character.ezaPassive) ?? base.passive,
        activeSkill: text(character.ezaActiveSkill) ?? base.activeSkill,
        activeSkillCondition: text(character.ezaActiveSkillCondition) ?? base.activeSkillCondition,
      }
    : null;

  return {
    id,
    name: text(character.name) ?? `Card ${id}`,
    title: text(character.title) ?? '',
    ...traits,
    cost: typeof character.cost === 'number' ? character.cost : null,
    releaseDate: text(character.releaseDate),
    image: thumbPath(id),
    links: [...character.links],
    categories: [...character.categories],
    hp: firstNumber(character.rainbowHP, character.freeDupeHP, character.maxLevelHP),
    atk: firstNumber(character.rainbowAttack, character.freeDupeAttack, character.maxLevelAttack),
    def: firstNumber(character.rainbowDefence, character.freeDupeDefence, character.maxDefence),
    kiMultiplier: text(character.kiMultiplier),
    base,
    eza,
    superEzaPassive: text(character.superEzaPassive),
    transformationCondition: text(character.transformationCondition),
    leader: parseLeaderSkill(eza?.leaderSkill ?? base.leaderSkill),
    maxBoost: 0,
    leaderReach: 0,
    teamKey: teamKey(character.name),
    formOf: null,
    forms: [],
  };
}

function formUnit(
  transformation: ScrapedTransformation,
  id: number,
  traits: Traits,
  base: Unit,
  character: ScrapedCharacter,
): Unit {
  const skills: SkillText = {
    // The leader skill stays the base card's after transforming.
    leaderSkill: base.base.leaderSkill,
    superAttack: text(transformation.transformedSuperAttack) ?? '',
    ultraSuperAttack: text(transformation.transformedUltraSuperAttack),
    passive: text(transformation.transformedPassive) ?? '',
    activeSkill: text(transformation.transformedActiveSkill),
    activeSkillCondition: text(transformation.transformedActiveSkillCondition),
  };
  const hasEza = [transformation.transformedEZASuperAttack, transformation.transformedEZAPassive].some(value => text(value));
  const eza: SkillText | null = base.eza && hasEza
    ? {
        ...skills,
        leaderSkill: base.eza.leaderSkill,
        superAttack: text(transformation.transformedEZASuperAttack) ?? skills.superAttack,
        ultraSuperAttack: text(transformation.transformedEZAUltraSuperAttack) ?? skills.ultraSuperAttack,
        passive: text(transformation.transformedEZAPassive) ?? skills.passive,
      }
    : null;
  const categories = transformation.transformedCategories?.length ? transformation.transformedCategories : character.categories;

  return {
    ...base,
    id,
    name: text(transformation.transformedName) ?? base.name,
    ...traits,
    image: thumbPath(id),
    links: [...transformation.transformedLinks],
    categories: [...categories],
    kiMultiplier: null,
    base: skills,
    eza,
    superEzaPassive: null,
    transformationCondition: null,
    leader: null,
    formOf: base.id,
    forms: [],
  };
}

function thumbPath(id: number) {
  return `images/thumbs/${id}.png`;
}

function teamKey(name: string) {
  return name.trim().toLowerCase();
}

// The scraper writes "Error" or "-" when DokkanStats had nothing for a field.
function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed !== 'Error' && trimmed !== '-' ? trimmed : null;
}

function firstNumber(...values: Array<number | null | undefined>) {
  return values.find((value): value is number => typeof value === 'number' && Number.isFinite(value)) ?? 0;
}
