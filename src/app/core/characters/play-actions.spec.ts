import { CharacterCore, createCore } from './character-core';
import { BASE_5E_RULES } from './character-ruleset';
import { make501Rules } from '../systems/system-rules';
import { availableHitDice, completeRest, inventoryAction } from './play-actions';

describe('Rest recovery and inventory actions', () => {
  const rules = make501Rules(BASE_5E_RULES);
  function core(): CharacterCore {
    return {
      ...createCore(),
      class: 'Gunslinger',
      level: 5,
      hpMax: 40,
      hpCurrent: 8,
      heat: 5,
      hitDiceSpent: 3,
    };
  }
  it('spends one die, adds Constitution, and clamps healing to maximum HP', () => {
    const c = core();
    c.scores.con = 14;
    const next = completeRest(c, rules, 'short', true, () => 8);
    expect(next.hpCurrent).toBe(18);
    expect(next.hitDiceSpent).toBe(4);
    expect(availableHitDice(next)).toBe(1);
    expect(next['heat']).toBe(5);
    expect(completeRest({ ...c, hpCurrent: 39 }, rules, 'short', true, () => 8).hpCurrent).toBe(40);
    expect(c.hitDiceSpent).toBe(3);
  });
  it('negative Constitution never damages a character during a rest', () => {
    const c = core();
    c.scores.con = 1;
    expect(completeRest(c, rules, 'short', true, () => 1).hpCurrent).toBe(9);
  });
  it('long rest restores HP and all spent dice, and resets Heat', () => {
    const next = completeRest(core(), rules, 'long');
    expect(next.hpCurrent).toBe(40);
    expect(next.hitDiceSpent).toBe(0);
    expect(next['heat']).toBe(0);
    expect(completeRest({ ...core(), level: 1, hitDiceSpent: 1 }, rules, 'long').hitDiceSpent).toBe(
      0,
    );
  });
  it('rejects exhausted dice and zero-HP long rests', () => {
    expect(() => completeRest({ ...core(), hitDiceSpent: 5 }, rules, 'short', true)).toThrow(
      'No available',
    );
    expect(() => completeRest({ ...core(), hpCurrent: 0 }, rules, 'long')).toThrow('reconstitute');
  });
  it('only recharges explicitly configured abilities and preserves lifetime counts', () => {
    const c = core();
    c.abilities = ['short-rest', 'long-rest', 'manual'].map((recharge, index) => ({
      id: String(index),
      name: 'Test',
      kind: 'test',
      description: '',
      spellLevel: null,
      usesMax: 2,
      recharge: recharge as 'short-rest' | 'long-rest' | 'manual',
    }));
    const data = {
      ...c,
      abilityUses: { '0': 2, '1': 1, '2': 2, lifetime: 12 },
      custom: { keep: true },
    };
    expect(completeRest(data, rules, 'short').abilityUses).toEqual({
      '0': 0,
      '1': 1,
      '2': 2,
      lifetime: 12,
    });
    const long = completeRest(data, rules, 'long');
    expect(long.abilityUses).toEqual({ '0': 0, '1': 0, '2': 2, lifetime: 12 });
    expect(long['custom']).toEqual({ keep: true });
  });
  it('equipping preserves metadata and removing the final unit removes its entry', () => {
    const c = core();
    c.inventory = [
      { id: 'test', name: 'Test', quantity: 1, weight: 2, description: '', custom: 'keep' },
    ];
    const equipped = inventoryAction(c, 'test', 'equip');
    expect(equipped.inventory[0].equipped).toBe(true);
    expect(equipped.inventory[0]['custom']).toBe('keep');
    expect(inventoryAction(c, 'test', 'remove').inventory).toEqual([]);
    expect(inventoryAction(c, 'test', 'add').inventory[0].quantity).toBe(2);
  });
});
