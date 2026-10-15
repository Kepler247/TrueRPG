import type { MutationRules } from '../systems/rads-mutations';
import { inject, Injectable, InjectionToken } from '@angular/core';
import type { PlayActionResult } from '../systems/dnds-combat';
import { WeaponReference, undefinedWeaponReference } from './weapon-reference';
import { makeDndsRules } from '../systems/dnds-rules';
import { make501Rules, makePlain5eRules } from '../systems/system-rules';
import {
  abilityModifier,
  BASE_SKILLS,
  carryCapacity,
  CharacterCore,
  InventoryEntry,
  proficiencyBonus,
  SkillDefinition,
  StatKey,
} from './character-core';

export interface ClassResourceDefinition {
  id: string;
  name: string;
  current: (core: CharacterCore) => number;
  setCurrent: (core: CharacterCore, value: number) => CharacterCore;
  maximum: (core: CharacterCore) => number | null;
  gainMultiplier: (core: CharacterCore) => number;
  help: string;
  resetsOnLongRest?: boolean;
}
export interface CheckSummary {
  modifier: number;
  mode: 'normal' | 'advantage' | 'disadvantage';
  automaticFailure: boolean;
}
export type AbilityChoices = Record<string, string>;
export interface AbilityChoice {
  key: string;
  label: string;
  options: readonly { id: string; name: string }[];
}
export interface CharacterRuleset {
  abilityChoices?: (
    core: CharacterCore,
    id: string,
    choices?: AbilityChoices,
  ) => readonly AbilityChoice[];
  movementSpeed?: (core: CharacterCore) => number;
  checkSummary?: (core: CharacterCore, label: string, tags: string[]) => CheckSummary | null;
  tracksCarryWeight?: boolean;
  statusPanel?: boolean;
  managedAbility?: (ability: import('./character-core').CharacterAbility) => boolean;
  featChoices?: (
    name: string,
  ) => readonly { label: string; options: readonly { id: string; name: string }[] }[];
  completeCreation?: (
    core: CharacterCore,
    weaponId: string,
    chips: number,
    armor: boolean,
  ) => CharacterCore;
  consumeItem?: (core: CharacterCore, id: string) => { core: CharacterCore; message: string };
  migrate?: (core: CharacterCore) => CharacterCore;
  applyFeat?: (core: CharacterCore, name: string, choices?: string[]) => CharacterCore;
  checkRoll?: (
    core: CharacterCore,
    label: string,
    modifier: number,
    tags: string[],
    forcedSingle?: boolean,
  ) => import('./dice').DiceRoll;
  useClassAbility?: (core: CharacterCore, id: string, choices?: AbilityChoices) => CharacterCore;
  takeDamage?: (
    core: CharacterCore,
    amount: number,
    type: string,
    tags?: string[],
  ) => CharacterCore;
  healthChange?: (core: CharacterCore, hp: number) => CharacterCore;
  mutations?: MutationRules;
  extraProficiencies?: {
    names: readonly string[];
    current: (core: CharacterCore) => readonly string[];
    set: (core: CharacterCore, names: readonly string[]) => CharacterCore;
  };
  armorSummary?: (core: CharacterCore, rules: CharacterRuleset) => string;
  validate?: (core: CharacterCore) => void;
  weaponReference?: (core: CharacterCore, entry: InventoryEntry) => WeaponReference | null;
  adjustWeaponAmmo?: (core: CharacterCore, id: string, delta: number) => PlayActionResult;
  reloadWeapon?: (core: CharacterCore, id: string, ammoId?: string) => PlayActionResult;
  rest?: {
    before?: (core: CharacterCore, kind: 'short' | 'long') => void;
    minimumHealing?: number;
    finish?: (core: CharacterCore, kind: 'short' | 'long') => CharacterCore;
    shortHours: number;
    longHours: number;
    recoverHitDice: (level: number) => number;
  };
  abilityActions?: (core: CharacterCore) => readonly AbilityActionDefinition[];
  classResource?: (core: CharacterCore) => ClassResourceDefinition | null;
  maxLevel?: number;
  maxScore?: number;
  checkDie?: number;
  initialize?: (core: CharacterCore) => CharacterCore;
  advance?: (core: CharacterCore) => CharacterCore;
  hitDie?: (core: CharacterCore) => number | null;
  statPoints?: (core: CharacterCore, nextLevel: number) => number;
  featOnlyAtRequiredLevels?: boolean;
  featRequired?: (nextLevel: number) => boolean;
  heatCapacity?: (level: number) => number | null;
  heatGainMultiplier?: (level: number) => number;
  improvementMax?: number | null;
  hpPerLevelBonus?: (core: CharacterCore) => number;
  featReplacesPoints?: (core: CharacterCore, name: string) => boolean;
  featHelp?: string;
  heatHelp?: string;
  hasHeat?: (core: CharacterCore) => boolean;
  testFeatName?: string;
  characterNotes?: (core: CharacterCore) => readonly string[];
  skills: readonly SkillDefinition[];
  creator: {
    races: readonly string[];
    classes: readonly string[];
    startingSkills?: number;
    startingWeapons?: (className: string) => readonly { id: string; name: string }[];
    armorAlternative?: (className: string) => boolean;
    primarySkills?: number;
    primaryStats?: (className: string) => readonly StatKey[];
    classDescriptions?: Readonly<Record<string, string>>;
  };
  abilityModifier: (score: number) => number;
  proficiencyBonus: (level: number) => number;
  savingThrow: (
    core: CharacterCore,
    stat: StatKey,
    rules: CharacterRuleset,
    tags?: string[],
  ) => number;
  skillBonus: (
    core: CharacterCore,
    skill: SkillDefinition,
    rules: CharacterRuleset,
    tags?: string[],
  ) => number;
  initiative: (core: CharacterCore, rules: CharacterRuleset) => number;
  carryCapacity: (core: CharacterCore) => number;
  levelUpPrompts: (core: CharacterCore, nextLevel: number) => readonly string[];
}
export interface AbilityActionDefinition {
  abilityId: string;
  cost: number;
  rollMode?: 'reroll' | 'choose-three';
}

export const BASE_5E_RULES: CharacterRuleset = {
  weaponReference: undefinedWeaponReference,
  rest: {
    shortHours: 1,
    longHours: 8,
    recoverHitDice: (level) => Math.max(1, Math.floor(level / 2)),
  },
  maxLevel: 20,
  maxScore: 30,
  checkDie: 20,
  improvementMax: 20,
  skills: BASE_SKILLS,
  // These catalogs are supplied by the actual system, rather than assuming fantasy classes/races.
  creator: { races: [], classes: [] },
  abilityModifier,
  proficiencyBonus,
  savingThrow: (core, stat, rules) =>
    rules.abilityModifier(core.scores[stat]) +
    (core.saves[stat].proficient ? rules.proficiencyBonus(core.level) : 0) +
    core.saves[stat].bonus,
  skillBonus: (core, skill, rules) => {
    const training = core.skills[skill.id] ?? { proficiency: 'none', bonus: 0 };
    const multiplier =
      training.proficiency === 'expertise' ? 2 : training.proficiency === 'proficient' ? 1 : 0;
    return (
      rules.abilityModifier(core.scores[skill.stat]) +
      multiplier * rules.proficiencyBonus(core.level) +
      training.bonus
    );
  },
  initiative: (core, rules) => rules.abilityModifier(core.scores.dex) + core.initiativeBonus,
  carryCapacity,
  levelUpPrompts: () => [
    'Set your HP increase, including Constitution.',
    'Review new class or system features, feat choices, and ability-score changes.',
  ],
};
export function extendRuleset(
  base: CharacterRuleset,
  overrides: Partial<CharacterRuleset>,
): CharacterRuleset {
  return { ...base, ...overrides };
}
export const CHARACTER_RULESETS = new InjectionToken<Readonly<Record<string, CharacterRuleset>>>(
  'Character rulesets',
  {
    providedIn: 'root',
    factory: () => ({
      dnds: makeDndsRules(BASE_5E_RULES),
      base5e: BASE_5E_RULES,
      wasteland: make501Rules(BASE_5E_RULES),
      '501-rads': make501Rules(BASE_5E_RULES),
      '5e-2014': makePlain5eRules(BASE_5E_RULES),
    }),
  },
);
@Injectable({ providedIn: 'root' })
export class RulesetService {
  private readonly rulesets = inject(CHARACTER_RULESETS);
  get(key: string | undefined): CharacterRuleset {
    return this.rulesets[key ?? 'base5e'] ?? BASE_5E_RULES;
  }
}
