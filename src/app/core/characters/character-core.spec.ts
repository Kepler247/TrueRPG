import { describe, expect, it } from 'vitest';
import {
  abilityModifier,
  BASE_SKILLS,
  carryCapacity,
  coreSchema,
  createCore,
  createEntryId,
  initiative,
  inventoryWeight,
  pointBuyRemaining,
  proficiencyBonus,
  readCore,
  resolveSkills,
  savingThrow,
  skillBonus,
} from './character-core';

describe('Shared 5E rules', () => {
  it.each([
    [1, -5],
    [8, -1],
    [9, -1],
    [10, 0],
    [11, 0],
    [16, 3],
    [20, 5],
    [30, 10],
  ])('score %s has modifier %s', (score, expected) =>
    expect(abilityModifier(score)).toBe(expected),
  );
  it.each([
    [1, 2],
    [4, 2],
    [5, 3],
    [9, 4],
    [13, 5],
    [17, 6],
    [20, 6],
  ])('level %s has proficiency %s', (level, expected) =>
    expect(proficiencyBonus(level)).toBe(expected),
  );
  it('adds proficiency once to saves and doubles it only for skill expertise', () => {
    const core = createCore();
    core.level = 5;
    core.scores.dex = 16;
    core.saves.dex = { proficient: true, bonus: 1 };
    core.skills['acrobatics'] = { proficiency: 'expertise', bonus: 1 };
    expect(savingThrow(core, 'dex')).toBe(7);
    expect(skillBonus(core, BASE_SKILLS[0])).toBe(10);
    expect(initiative(core)).toBe(3);
  });
  it('defines all 18 skills, including no Constitution skill', () => {
    expect(BASE_SKILLS).toHaveLength(18);
    expect(new Set(BASE_SKILLS.map((skill) => skill.id)).size).toBe(18);
    expect(BASE_SKILLS.some((skill) => skill.stat === 'con')).toBe(false);
  });
  it('supports removing, adding, and overriding skill definitions without mutating the base catalog', () => {
    const resolved = resolveSkills(
      BASE_SKILLS,
      ['arcana'],
      [
        { id: 'science', name: 'Science', stat: 'int' },
        { id: 'survival', name: 'Wasteland Survival', stat: 'wis' },
      ],
    );
    expect(resolved.some((skill) => skill.id === 'arcana')).toBe(false);
    expect(resolved.find((skill) => skill.id === 'survival')?.name).toBe('Wasteland Survival');
    expect(BASE_SKILLS.find((skill) => skill.id === 'survival')?.name).toBe('Survival');
  });
  it('calculates quantity-weight totals and size-aware capacity', () => {
    const core = createCore();
    core.scores.str = 12;
    core.inventory = [{ id: 'item', name: 'Water', quantity: 3, weight: 2.5, description: '' }];
    expect(inventoryWeight(core)).toBe(7.5);
    expect(carryCapacity(core)).toBe(180);
    core.size = 'large';
    expect(carryCapacity(core)).toBe(360);
    core.size = 'tiny';
    expect(carryCapacity(core)).toBe(90);
    core.carryCapacityOverride = 0;
    expect(carryCapacity(core)).toBe(0);
  });
  it('uses nonlinear 27-point purchase costs', () => {
    expect(pointBuyRemaining({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 })).toBe(0);
    expect(
      pointBuyRemaining({ str: 15, dex: 15, con: 15, int: 15, wis: 15, cha: 15 }),
    ).toBeLessThan(0);
    expect(pointBuyRemaining({ str: 16, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })).toBe(-Infinity);
  });
  it('reads legacy empty data without changing it and preserves extension fields', () => {
    const legacy = { systemNotes: 'keep me' };
    expect(readCore(legacy, 1).level).toBe(1);
    expect(legacy).toEqual({ systemNotes: 'keep me' });
    const core = { ...createCore(), newSystemField: 'keep me' };
    expect(readCore({ core }, 2)['newSystemField']).toBe('keep me');
  });
  it('rejects corrupt or future data instead of replacing it with defaults', () => {
    expect(() => readCore({ core: { level: 5 } }, 2)).toThrow('invalid');
    expect(() => readCore({}, 3)).toThrow('newer');
    expect(coreSchema.safeParse({ ...createCore(), level: 0 }).success).toBe(false);
    expect(
      coreSchema.safeParse({
        ...createCore(),
        inventory: [{ id: 'x', name: 'Item', quantity: -1, weight: 1, description: '' }],
      }).success,
    ).toBe(false);
  });
  it('creates unique entry IDs on LAN HTTP without using randomUUID', () => {
    const first = createEntryId();
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(createEntryId()).not.toBe(first);
  });
});
