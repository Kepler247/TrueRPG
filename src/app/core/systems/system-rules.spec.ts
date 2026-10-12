import { describe, expect, it } from 'vitest';
import { BASE_5E_RULES } from '../characters/character-ruleset';
import { coreSchema, createCore } from '../characters/character-core';
import {
  currentHeat,
  heatCapacity,
  heatMultiplier,
  make501Rules,
  makePlain5eRules,
  validateSystemCore,
} from './system-rules';

describe('501 Rads author-defined rules', () => {
  const rules = make501Rules(BASE_5E_RULES);
  it('replaces Arcana with Hacking while retaining the shared calculations', () => {
    expect(rules.skills).toHaveLength(18);
    expect(rules.skills.find((s) => s.id === 'hacking')?.stat).toBe('int');
    expect(rules.skills.some((s) => s.id === 'arcana')).toBe(false);
    expect(rules.abilityModifier(22)).toBe(6);
    expect(rules.proficiencyBonus(12)).toBe(4);
  });
  it('permits scores above 30 but rejects levels above 12', () => {
    const core = createCore();
    core.scores.str = 37;
    expect(coreSchema.safeParse(core).success).toBe(true);
    expect(() => validateSystemCore(core, rules)).not.toThrow();
    core.level = 13;
    expect(() => validateSystemCore(core, rules)).toThrow('12');
    core.level = 1;
    expect(() => validateSystemCore(core, BASE_5E_RULES)).toThrow('30');
  });
  it('uses Ranger-like d10 HP without inventing Gunslinger saving proficiencies', () => {
    const core = createCore();
    core.class = 'Gunslinger';
    core.scores.con = 16;
    const initialized = rules.initialize!(core);
    expect(initialized.hpMax).toBe(13);
    expect(rules.hitDie!(initialized)).toBe(10);
    expect(initialized.saves.dex.proficient).toBe(false);
    expect(currentHeat(initialized)).toBe(0);
  });
  it('uses finite Heat caps through 10, then unlimited; level 12 triples base gains', () => {
    expect(Array.from({ length: 12 }, (_, i) => heatCapacity(i + 1))).toEqual([
      3,
      3,
      5,
      5,
      7,
      7,
      9,
      9,
      11,
      11,
      null,
      null,
    ]);
    expect([heatMultiplier(6), heatMultiplier(7), heatMultiplier(12)]).toEqual([1, 2, 3]);
  });
  it('adds unlocked features once and preserves custom abilities and unknown data', () => {
    let core = createCore();
    core.class = 'Gunslinger';
    core.level = 12;
    core['futureMechanic'] = { keep: true };
    core['heat'] = 29;
    core.abilities = [
      {
        id: 'custom',
        name: 'Custom',
        kind: 'feature',
        description: 'mine',
        spellLevel: null,
        usesMax: null,
      },
    ];
    core = rules.advance!(core);
    const count = core.abilities.length;
    expect(rules.advance!(core).abilities).toHaveLength(count);
    expect(core['futureMechanic']).toEqual({ keep: true });
    expect(currentHeat(core)).toBe(29);
    expect(core.abilities.find((a) => a.name === 'Fan the Hammer')?.description).toContain(
      '2 Heat',
    );
    expect(core.abilities.some((a) => a.name === 'Divine Intervention')).toBe(true);
  });
  it('schedules two points every level and shared feats every third level', () => {
    expect(rules.statPoints!(createCore(), 2)).toBe(2);
    expect([2, 3, 6, 9, 12].map((l) => rules.featRequired!(l))).toEqual([
      false,
      true,
      true,
      true,
      true,
    ]);
  });
});
describe('Plain 5E SRD foundation', () => {
  const rules = makePlain5eRules(BASE_5E_RULES);
  it('provides all twelve open classes and applies race and class initialization once', () => {
    expect(rules.creator.classes).toHaveLength(12);
    const core = createCore();
    core.race = 'Hill Dwarf';
    core.class = 'Ranger';
    core.scores.con = 14;
    const result = rules.initialize!(core);
    expect(result.scores.con).toBe(16);
    expect(result.scores.wis).toBe(11);
    expect(result.hpMax).toBe(14);
    expect(result.speed.distance).toBe(25);
    expect(result.saves.str.proficient).toBe(true);
    expect(result.saves.dex.proficient).toBe(true);
    expect(rules.advance!(result).scores).toEqual(result.scores);
  });
  it('requires valid distinct Half-Elf racial choices', () => {
    const core = createCore();
    core.race = 'Half-Elf';
    core['raceBoosts'] = ['dex', 'cha'];
    expect(() => rules.initialize!(core)).toThrow();
    core['raceBoosts'] = ['dex', 'wis'];
    const result = rules.initialize!(core);
    expect(result.scores.dex).toBe(11);
    expect(result.scores.wis).toBe(11);
    expect(result.scores.cha).toBe(12);
  });
  it('uses Fighter and Rogue extra improvement levels', () => {
    const core = createCore();
    core.class = 'Fighter';
    expect(rules.statPoints!(core, 6)).toBe(2);
    core.class = 'Rogue';
    expect(rules.statPoints!(core, 10)).toBe(2);
    core.class = 'Wizard';
    expect(rules.statPoints!(core, 10)).toBe(0);
  });
  it('applies Bard Jack of All Trades to untrained skills and initiative', () => {
    const core = createCore();
    core.class = 'Bard';
    core.level = 5;
    const skill = rules.skills.find((s) => s.id === 'arcana')!;
    expect(rules.skillBonus(core, skill, rules)).toBe(1);
    expect(rules.initiative(core, rules)).toBe(1);
    core.skills['arcana'].proficiency = 'proficient';
    expect(rules.skillBonus(core, skill, rules)).toBe(3);
  });
  it('applies Primal Champion once, including retroactive HP', () => {
    const core = createCore();
    core.class = 'Barbarian';
    core.level = 20;
    core.scores.str = 20;
    core.scores.con = 20;
    core.hpMax = 220;
    const next = rules.advance!(core);
    expect(next.scores.str).toBe(24);
    expect(next.scores.con).toBe(24);
    expect(next.hpMax).toBe(260);
    expect(rules.advance!(next)).toEqual(next);
  });
});
