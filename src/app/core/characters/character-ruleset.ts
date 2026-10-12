import { inject, Injectable, InjectionToken } from '@angular/core';
import {
  abilityModifier,
  BASE_SKILLS,
  carryCapacity,
  CharacterCore,
  proficiencyBonus,
  SkillDefinition,
  StatKey,
} from './character-core';

export interface CharacterRuleset {
  skills: readonly SkillDefinition[];
  creator: { races: readonly string[]; classes: readonly string[] };
  abilityModifier: (score: number) => number;
  proficiencyBonus: (level: number) => number;
  savingThrow: (core: CharacterCore, stat: StatKey, rules: CharacterRuleset) => number;
  skillBonus: (core: CharacterCore, skill: SkillDefinition, rules: CharacterRuleset) => number;
  initiative: (core: CharacterCore, rules: CharacterRuleset) => number;
  carryCapacity: (core: CharacterCore) => number;
  levelUpPrompts: (core: CharacterCore, nextLevel: number) => readonly string[];
}

export const BASE_5E_RULES: CharacterRuleset = {
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
    factory: () => ({ base5e: BASE_5E_RULES, wasteland: BASE_5E_RULES }),
  },
);
@Injectable({ providedIn: 'root' })
export class RulesetService {
  private readonly rulesets = inject(CHARACTER_RULESETS);
  get(key: string | undefined): CharacterRuleset {
    return this.rulesets[key ?? 'base5e'] ?? BASE_5E_RULES;
  }
}
