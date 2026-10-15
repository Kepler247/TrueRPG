import { describe, it, expect } from 'vitest';
import { createCore, CharacterCore } from '../characters/character-core';
import { BASE_5E_RULES } from '../characters/character-ruleset';
import { initializeRads } from './rads-rules';
import { radsWeaponReference, adjustRadsAmmo } from './rads-combat';
import { dndsWeaponReference, adjustDndsAmmo } from './dnds-combat';
import { addEffect, radsState, withRads, endRadsEffect } from './rads-engine';
import { classEffect } from './rads-abilities';
import { RADS_CATALOG } from './rads-catalog';
import { DNDS_CATALOG } from './dnds-catalog';
import { catalogInventory, systemCatalog } from './system-catalog';

function rads(name = 'Gunslinger'): CharacterCore {
  return initializeRads({
    ...createCore(),
    class: name,
    level: 12,
    scores: { str: 16, dex: 16, con: 14, int: 10, wis: 10, cha: 10 },
  });
}
const item = (name: string) =>
  catalogInventory(
    RADS_CATALOG.find((e) => e.name === name)!,
    '501-rads',
  );
describe('Physical-dice weapon references', () => {
  it('combines ability, class proficiency, accuracy and training without rolling or mutating the sheet', () => {
    const c = rads(),
      weapon = item('9mm Service Pistol'),
      before = structuredClone(c);
    expect(radsWeaponReference(c, weapon)).toMatchObject({
      attack: 'd20 + 9',
      damage: '1d8 + 4 Ballistic',
    });
    expect(c).toEqual(before);
  });
  it('includes weapon expertise only once and omits proficiency for an untrained category', () => {
    const c = rads(),
      s = radsState(c),
      weapon = item('9mm Service Pistol');
    expect(
      radsWeaponReference(withRads(c, { ...s, weapons: { Sidearms: 'expertise' } }), weapon)!
        .attack,
    ).toBe('d20 + 13');
    expect(radsWeaponReference(withRads(c, { ...s, weapons: {} }), weapon)!.attack).toBe('d20 + 5');
  });
  it('Fan the Hammer changes the formula until manually ended and never consumes itself during display', () => {
    const c = rads(),
      weapon = item('9mm Service Pistol');
    let next = addEffect(c, classEffect('Fan the Hammer', c)!);
    next = addEffect(next, {
      id: 'damage',
      name: 'Damage bonus',
      modifiers: [{ scope: 'damage', kind: 'flat', value: 2 }],
    });
    for (let i = 0; i < 3; i++)
      expect(radsWeaponReference(next, weapon)!.damage).toBe('(1d8 + 6) x 3 Ballistic');
    expect(radsState(next).effects.some((e) => e.id === 'fan-the-hammer')).toBe(true);
    expect(radsWeaponReference(endRadsEffect(next, 'fan-the-hammer'), weapon)!.damage).toBe(
      '1d8 + 6 Ballistic',
    );
  });
  it('combines own buffs and drawbacks, cancelling advantage normally while retaining damage buffs', () => {
    let c = rads('Psycho');
    for (const name of ['Meth', 'UltraSoldier']) c = addEffect(c, classEffect(name, c)!);
    c = withRads(c, { ...radsState(c), conditions: ['Blinded', 'Poisoned'] });
    const reference = radsWeaponReference(c, item('Combat Knife'))!;
    expect(reference.attack).toBe('d20 + 11');
    expect(reference.damage).toBe('1d6 + 8 Piercing');
  });
  it('shows active target-dependent benefits as conditional notes without selecting or calculating an enemy', () => {
    let c = rads('Prophet');
    c = addEffect(c, classEffect('Judgment Day', c)!);
    const ranged = radsWeaponReference(c, item('Scrapheap Rifle'))!,
      melee = radsWeaponReference(c, item('Combat Knife'))!;
    expect(ranged.attack).toContain('advantage against the Judgment Day target');
    expect(ranged.damage).toContain('x 2 against the Judgment Day target');
    expect(melee.attack).not.toContain('Judgment');
    expect(melee.damage).not.toContain('x 2');
  });
  it('leaves sniper aiming and repeated-target rifle rules to the table instead of assuming a distance or movement state', () => {
    expect(radsWeaponReference(rads(), item('Rusty Hunting Rifle'))!.attack).toBe('d20 + 1');
    expect(radsWeaponReference(rads(), item('Scrapheap Rifle'))!.attack).toBe('d20 + 4');
  });
  it('combines negative weapon adjustments and does not give smoke damage', () => {
    const c = { ...rads('Psycho'), scores: { ...rads('Psycho').scores, str: 6 } };
    expect(radsWeaponReference(c, item('Rebar Shiv'))!.damage).toBe('1d6 - 3 Piercing');
    expect(radsWeaponReference(c, item('Rustbucket Smoke Bomb'))!.damage).toBe('No damage');
  });
  it('adjusts only the requested ammo count and rejects spending below zero', () => {
    const weapon = { ...item('M72 Rocket Launcher'), ammoRemaining: 2 };
    const c = { ...rads(), inventory: [weapon] };
    const next = adjustRadsAmmo(c, weapon.id, -1).core;
    expect(next.inventory[0]['ammoRemaining']).toBe(1);
    expect(radsState(next)).toEqual(radsState(c));
    expect(c.inventory[0]['ammoRemaining']).toBe(2);
    expect(() => adjustRadsAmmo(c, weapon.id, -3)).toThrow('nonnegative');
  });
  it('does not fabricate stats for 5E test fixtures', () => {
    const weapon = catalogInventory(
      systemCatalog('base5e').find((e) => e.name === 'Test sword')!,
      'base5e',
    );
    expect(BASE_5E_RULES.weaponReference!(createCore(), weapon)).toMatchObject({
      attack: 'Not defined for this item',
      damage: 'Not defined for this item',
    });
  });
});

describe('D&DS physical-dice references and manual ammo', () => {
  const c = () => ({
    ...createCore(),
    class: 'Fighter',
    scores: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
  });
  const weapon = (name: string) =>
    catalogInventory(
      DNDS_CATALOG.find((e) => e.name === name)!,
      'dnds',
    );
  it('adds attack proficiency and Dexterity damage, with Ranger mastery and per-weapon proficiency choices', () => {
    const pistol = weapon('Pistol');
    expect(dndsWeaponReference(c(), pistol)).toMatchObject({
      attack: 'd20 + 4',
      damage: '2d6 Piercing + 2',
    });
    expect(dndsWeaponReference({ ...c(), class: 'Ranger' }, pistol)!.attack).toBe('d20 + 6');
    expect(dndsWeaponReference(c(), { ...pistol, attackProficient: false })!.attack).toBe(
      'd20 + 2',
    );
    expect(dndsWeaponReference(c(), { ...pistol, dualWield: true })!.attack).toBe('d20 + 2');
  });
  it('shows burst dice per hit with Dexterity once; special ammo contributes its own dice', () => {
    expect(dndsWeaponReference(c(), weapon('Submachine Gun'))!.damage).toBe(
      '(1d4 Piercing) x hits + 2',
    );
    expect(dndsWeaponReference(c(), { ...weapon('Pistol'), loadedAmmo: 'Shock' })!.damage).toBe(
      '2d6 Piercing + 1d6 Lightning + 2',
    );
  });
  it('includes a suppressor multiplier for other classes but not Rogues', () => {
    const pistol = { ...weapon('Pistol'), suppressed: true };
    expect(dndsWeaponReference(c(), pistol)!.damage).toBe('(2d6 Piercing + 2) x 0.75 (round down)');
    expect(dndsWeaponReference({ ...c(), class: 'Rogue' }, pistol)!.damage).toBe(
      '2d6 Piercing + 2',
    );
  });
  it('keeps displaying formulas at zero ammo and updates ammo only on explicit manual changes', () => {
    const pistol = { ...weapon('Pistol'), chargesRemaining: 0 };
    const core = { ...c(), inventory: [pistol] };
    expect(dndsWeaponReference(core, pistol)!.attack).toBe('d20 + 4');
    expect(pistol.chargesRemaining).toBe(0);
    expect(() => adjustDndsAmmo(core, pistol.id, -1)).toThrow('reload capacity');
    expect(adjustDndsAmmo(core, pistol.id, 1).core.inventory[0]['chargesRemaining']).toBe(1);
  });
});
