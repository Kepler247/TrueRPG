import { describe, expect, it } from 'vitest';
import { BASE_5E_RULES, extendRuleset } from './character-ruleset';
import { BASE_SKILLS, createCore, resolveSkills } from './character-core';

describe('Ruleset overrides and additions', () => {
  it('propagates modifier and proficiency overrides to default derived values', () => {
    const rules = extendRuleset(BASE_5E_RULES, {
      abilityModifier: () => 2,
      proficiencyBonus: () => 10,
    });
    const core = createCore();
    core.saves.dex.proficient = true;
    core.skills['acrobatics'] = { proficiency: 'expertise', bonus: 0 };
    expect(rules.savingThrow(core, 'dex', rules)).toBe(12);
    expect(rules.skillBonus(core, BASE_SKILLS[0], rules)).toBe(22);
    expect(rules.initiative(core, rules)).toBe(2);
  });
  it('allows custom skill catalogs, creator choices, and level-specific prompts', () => {
    const rules = extendRuleset(BASE_5E_RULES, {
      skills: resolveSkills(
        BASE_SKILLS,
        ['arcana'],
        [{ id: 'science', name: 'Science', stat: 'int' }],
      ),
      creator: { races: ['Human', 'Other'], classes: ['Scout'] },
      levelUpPrompts: (_core, level) =>
        level === 3 ? ['Choose a specialization.'] : ['Review HP.'],
    });
    expect(rules.skills.some((skill) => skill.id === 'arcana')).toBe(false);
    expect(rules.skills.some((skill) => skill.id === 'science')).toBe(true);
    expect(rules.creator.classes).toEqual(['Scout']);
    expect(rules.levelUpPrompts(createCore(), 3)).toEqual(['Choose a specialization.']);
  });
});
