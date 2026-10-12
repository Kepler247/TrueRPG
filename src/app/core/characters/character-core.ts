import { z } from 'zod';

export const STATS = [
  { key: 'str', name: 'Strength' },
  { key: 'dex', name: 'Dexterity' },
  { key: 'con', name: 'Constitution' },
  { key: 'int', name: 'Intelligence' },
  { key: 'wis', name: 'Wisdom' },
  { key: 'cha', name: 'Charisma' },
] as const;
export type StatKey = (typeof STATS)[number]['key'];
export interface SkillDefinition {
  id: string;
  name: string;
  stat: StatKey;
}
export const BASE_SKILLS: readonly SkillDefinition[] = [
  { id: 'acrobatics', name: 'Acrobatics', stat: 'dex' },
  { id: 'animal_handling', name: 'Animal Handling', stat: 'wis' },
  { id: 'arcana', name: 'Arcana', stat: 'int' },
  { id: 'athletics', name: 'Athletics', stat: 'str' },
  { id: 'deception', name: 'Deception', stat: 'cha' },
  { id: 'history', name: 'History', stat: 'int' },
  { id: 'insight', name: 'Insight', stat: 'wis' },
  { id: 'intimidation', name: 'Intimidation', stat: 'cha' },
  { id: 'investigation', name: 'Investigation', stat: 'int' },
  { id: 'medicine', name: 'Medicine', stat: 'wis' },
  { id: 'nature', name: 'Nature', stat: 'int' },
  { id: 'perception', name: 'Perception', stat: 'wis' },
  { id: 'performance', name: 'Performance', stat: 'cha' },
  { id: 'persuasion', name: 'Persuasion', stat: 'cha' },
  { id: 'religion', name: 'Religion', stat: 'int' },
  { id: 'sleight_of_hand', name: 'Sleight of Hand', stat: 'dex' },
  { id: 'stealth', name: 'Stealth', stat: 'dex' },
  { id: 'survival', name: 'Survival', stat: 'wis' },
];
const score = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const adjustment = z.number().int();
const save = z.object({ proficient: z.boolean(), bonus: adjustment }).passthrough();
const skill = z
  .object({ proficiency: z.enum(['none', 'proficient', 'expertise']), bonus: adjustment })
  .passthrough();
export const inventorySchema = z
  .object({
    id: z.string(),
    name: z.string().trim().min(1).max(150),
    quantity: z.number().int().min(1),
    weight: z.number().nonnegative(),
    description: z.string(),
  })
  .passthrough();
export const abilitySchema = z
  .object({
    id: z.string(),
    name: z.string().trim().min(1).max(150),
    kind: z.string().min(1),
    description: z.string(),
    spellLevel: z.number().int().min(0).max(9).nullable(),
    usesMax: z.number().int().nonnegative().nullable(),
  })
  .passthrough();
export const coreSchema = z
  .object({
    level: z.number().int().min(1).max(20),
    hpMax: z.number().int().min(1).nullable(),
    speed: z
      .object({
        distance: z.number().nonnegative(),
        unit: z.enum(['ft', 'm']),
        per: z.enum(['turn', 'action']),
      })
      .passthrough(),
    scores: z
      .object({ str: score, dex: score, con: score, int: score, wis: score, cha: score })
      .passthrough(),
    saves: z
      .object({ str: save, dex: save, con: save, int: save, wis: save, cha: save })
      .passthrough(),
    skills: z.record(z.string(), skill),
    initiativeBonus: adjustment,
    size: z.enum(['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']),
    carryCapacityOverride: z.number().nonnegative().nullable(),
    description: z.string(),
    heightInches: z.number().positive().nullable(),
    bodyWeightPounds: z.number().positive().nullable(),
    race: z.string().nullable(),
    class: z.string().nullable(),
    inventory: z.array(inventorySchema),
    abilities: z.array(abilitySchema),
  })
  .passthrough();
export type CharacterCore = z.infer<typeof coreSchema>;
export type InventoryEntry = z.infer<typeof inventorySchema>;
export type CharacterAbility = z.infer<typeof abilitySchema>;
export type SkillTraining = z.infer<typeof skill>;
export type SaveTraining = z.infer<typeof save>;
export const CHARACTER_DATA_VERSION = 2;

export function createCore(): CharacterCore {
  return {
    level: 1,
    hpMax: null,
    speed: { distance: 30, unit: 'ft', per: 'turn' },
    scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    saves: Object.fromEntries(
      STATS.map((stat) => [stat.key, { proficient: false, bonus: 0 }]),
    ) as CharacterCore['saves'],
    skills: Object.fromEntries(
      BASE_SKILLS.map((skill) => [skill.id, { proficiency: 'none', bonus: 0 }]),
    ),
    initiativeBonus: 0,
    size: 'medium',
    carryCapacityOverride: null,
    description: '',
    heightInches: null,
    bodyWeightPounds: null,
    race: null,
    class: null,
    inventory: [],
    abilities: [],
  };
}
export function readCore(data: Record<string, unknown>, version: number): CharacterCore {
  if (version > CHARACTER_DATA_VERSION)
    throw new Error('This character uses a newer sheet version. Update the app before editing.');
  if (!('core' in data)) return createCore();
  const result = coreSchema.safeParse(data['core']);
  if (!result.success)
    throw new Error('Saved character data is invalid. It has not been replaced; contact the GM.');
  return result.data;
}
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}
export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((level - 1) / 4);
}
export function savingThrow(core: CharacterCore, stat: StatKey): number {
  return (
    abilityModifier(core.scores[stat]) +
    (core.saves[stat].proficient ? proficiencyBonus(core.level) : 0) +
    core.saves[stat].bonus
  );
}
export function skillBonus(core: CharacterCore, definition: SkillDefinition): number {
  const training = core.skills[definition.id] ?? { proficiency: 'none', bonus: 0 };
  const multiplier =
    training.proficiency === 'expertise' ? 2 : training.proficiency === 'proficient' ? 1 : 0;
  return (
    abilityModifier(core.scores[definition.stat]) +
    multiplier * proficiencyBonus(core.level) +
    training.bonus
  );
}
export function initiative(core: CharacterCore): number {
  return abilityModifier(core.scores.dex) + core.initiativeBonus;
}
export function carryCapacity(core: CharacterCore): number {
  const factor = { tiny: 0.5, small: 1, medium: 1, large: 2, huge: 4, gargantuan: 8 }[core.size];
  return core.carryCapacityOverride ?? core.scores.str * 15 * factor;
}
export function inventoryWeight(core: CharacterCore): number {
  return core.inventory.reduce((sum, item) => sum + item.quantity * item.weight, 0);
}
// The resolver is independent of saved training; removing a skill never destroys its stored value.
export function resolveSkills(
  base: readonly SkillDefinition[],
  removed: readonly string[] = [],
  added: readonly SkillDefinition[] = [],
): SkillDefinition[] {
  const catalog = new Map(
    base.filter((skill) => !removed.includes(skill.id)).map((skill) => [skill.id, skill]),
  );
  for (const skill of added) catalog.set(skill.id, skill);
  return [...catalog.values()];
}
export const POINT_BUY_COST: Readonly<Record<number, number>> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};
export function pointBuyRemaining(scores: Record<StatKey, number>): number {
  const values = STATS.map((stat) => POINT_BUY_COST[scores[stat.key]]);
  return values.some((value) => value === undefined)
    ? -Infinity
    : 27 - values.reduce((sum, value) => sum + value, 0);
}

export function createEntryId(): string {
  // randomUUID requires HTTPS; getRandomValues also works during LAN HTTP phone testing.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
