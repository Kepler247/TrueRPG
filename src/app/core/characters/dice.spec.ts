import { afterEach, describe, expect, it, vi } from 'vitest';
import { rollDie, rollWithModifier } from './dice';

describe('Lightweight dice rolls', () => {
  afterEach(() => vi.restoreAllMocks());
  it('adds positive and negative modifiers to the die result', () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      (array as Uint32Array)[0] = 19;
      return array;
    });
    expect(rollWithModifier('Strength', 3)).toEqual({
      label: 'Strength',
      sides: 20,
      die: 20,
      modifier: 3,
      total: 23,
    });
    expect(rollWithModifier('Wisdom', -2).total).toBe(18);
    expect(rollWithModifier('Hit die', 2, 10).die).toBe(10);
  });
  it('rejects the modulo-bias tail before accepting a valid sample', () => {
    const random = vi
      .spyOn(crypto, 'getRandomValues')
      .mockImplementationOnce((array) => {
        (array as Uint32Array)[0] = 0xffffffff;
        return array;
      })
      .mockImplementationOnce((array) => {
        (array as Uint32Array)[0] = 0;
        return array;
      });
    expect(rollDie(20)).toBe(1);
    expect(random).toHaveBeenCalledTimes(2);
  });
  it('rejects invalid dice and modifiers', () => {
    expect(() => rollDie(1)).toThrow();
    expect(() => rollDie(2.5)).toThrow();
    expect(() => rollWithModifier('Check', NaN)).toThrow();
  });
});
