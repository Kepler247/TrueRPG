import { createCore } from '../characters/character-core';
import { BASE_5E_RULES } from '../characters/character-ruleset';
import { makeDndsRules } from './dnds-rules';
import { DNDS_CATALOG } from './dnds-catalog';
import { catalogInventory } from './system-catalog';
import { attackDnds, reloadDnds } from './dnds-combat';
describe('D&DS character and equipment rules', () => {
  const rules = makeDndsRules(BASE_5E_RULES);
  it('maps named races and classes, including Half-Eldar choices and Technology', () => {
    const c = rules.initialize!({
      ...createCore(),
      race: 'Half-Eldar (Half-Elf)',
      class: 'Battle Medic (Cleric)',
      raceBoosts: ['str', 'dex'],
    });
    expect(c.scores.cha).toBe(12);
    expect(c.scores.str).toBe(11);
    expect(c.saves.wis.proficient).toBe(true);
    expect(c.class).toBe('Battle Medic (Cleric)');
    expect(c['dndsProficiencies']).toEqual(['Power Armors']);
    expect(rules.skills.some((s) => s.id === 'technology')).toBe(true);
    expect(rules.skills.some((s) => s.id === 'arcana')).toBe(false);
  });
  it('uses Drow bonuses, Artificer HP, and Monk Technology training', () => {
    const drow = rules.initialize!({
      ...createCore(),
      race: 'Drukhari (Drow)',
      class: 'Artificer',
    });
    expect(drow.scores).toEqual({ str: 10, dex: 12, con: 10, int: 10, wis: 10, cha: 11 });
    expect(drow.hpMax).toBe(8);
    expect(drow.saves.int.proficient).toBe(true);
    expect(drow.saves.con.proficient).toBe(true);
    const monk = rules.initialize!({ ...createCore(), class: 'Monk' });
    expect(monk.skills['technology'].proficiency).toBe('proficient');
    expect(monk.abilities.find((a) => a.name === 'Monk-Warlock Synergy')?.recharge).toBe(
      'long-rest',
    );
  });
  it('keeps D&DS features idempotent through advancement and retains 5E level limits', () => {
    const c = rules.initialize!({ ...createCore(), class: 'Ranger', race: 'Orak-Hai (Half-Orc)' });
    expect(c.scores.str).toBe(12);
    expect(rules.maxLevel).toBe(20);
    const next = rules.advance!({ ...c, level: 2 });
    expect(next.abilities.filter((a) => a.name === 'Firearm Mastery')).toHaveLength(1);
    expect(next.race).toBe(c.race);
    expect(rules.hitDie!(next)).toBe(10);
  });
  function armed(name = 'Submachine Gun') {
    const c = { ...createCore(), class: 'Fighter', hpMax: 20 };
    c.scores.dex = 14;
    const item = catalogInventory(
      DNDS_CATALOG.find((e) => e.name === name)!,
      'dnds',
    );
    item.equipped = true;
    c.inventory = [item];
    return c;
  }
  const settings = {
    targetAC: 10,
    distance: 30,
    proficient: false,
    advantage: 'normal' as const,
    dualWield: false,
    mounted: false,
  };
  it('uses floor recoil, Rate of Fire and Dexterity damage exactly once', () => {
    const c = armed();
    const result = attackDnds(c, rules, c.inventory[0].id, settings, (s) => (s === 20 ? 14 : 1));
    // total16, excess6/recoil2 -> 4 hits x RoF2 = 8. Eight d4 rolls of1 plus dex2.
    expect(result.message).toContain('8 hits');
    expect(result.message).toContain('10 damage');
    expect(result.core.inventory[0]['chargesRemaining']).toBe(2);
    expect(c.inventory[0]['chargesRemaining']).toBe(3);
  });
  it('reports a jam and expends one firing action without persistent jam state', () => {
    const c = armed();
    const result = attackDnds(c, rules, c.inventory[0].id, settings, () => 2);
    expect(result.message).toContain('JAM');
    expect(result.core.inventory[0]['chargesRemaining']).toBe(2);
  });
  it('doubles critical damage dice, not the Dexterity modifier', () => {
    const c = armed('Pistol');
    const result = attackDnds(c, rules, c.inventory[0].id, settings, (s) => (s === 20 ? 20 : 1));
    expect(result.message).toContain('6 damage');
    expect(result.message).toContain('critical');
  });
  it('rejects missing heavy training, empty magazines, and targets beyond range', () => {
    const c = armed('Minigun');
    expect(() => attackDnds(c, rules, c.inventory[0].id, settings)).toThrow('Heavy weapons');
    const p = armed('Pistol');
    p.inventory[0]['chargesRemaining'] = 0;
    expect(() => attackDnds(p, rules, p.inventory[0].id, settings)).toThrow('Reload');
    p.inventory[0]['chargesRemaining'] = 1;
    expect(() => attackDnds(p, rules, p.inventory[0].id, { ...settings, distance: 10000 })).toThrow(
      'range',
    );
  });
  it('reloads free standard ammo and consumes one special ammunition reload', () => {
    const c = armed('Pistol');
    c.inventory[0]['chargesRemaining'] = 0;
    const ammo = catalogInventory(
      DNDS_CATALOG.find((e) => e.ammoType === 'Shock')!,
      'dnds',
    );
    c.inventory.push(ammo);
    const result = reloadDnds(c, c.inventory[0].id, ammo.id);
    expect(result.core.inventory).toHaveLength(1);
    expect(result.core.inventory[0]['chargesRemaining']).toBe(10);
    expect(result.core.inventory[0]['loadedAmmo']).toBe('Shock');
    expect(c.inventory).toHaveLength(2);
    expect(reloadDnds(result.core, c.inventory[0].id).core.inventory[0]['loadedAmmo']).toBe(
      'Standard',
    );
  });
  it('calculates estimated armor AC and preserves resistance labels', () => {
    const c = armed();
    const armor = catalogInventory(
      DNDS_CATALOG.find((e) => e.name === 'Ceramite')!,
      'dnds',
    );
    armor.equipped = true;
    c.inventory.push(armor);
    expect(rules.armorSummary!(c, rules)).toContain('AC 18');
    expect(rules.armorSummary!(c, rules)).toContain('Laser, Fire');
  });
  it('imports all 41 personal weapons and no spaceship stats', () => {
    expect(DNDS_CATALOG.filter((e) => e.weapon)).toHaveLength(41);
    expect(DNDS_CATALOG.some((e) => /Tempest|Hydra Class/.test(e.name))).toBe(false);
  });
  it('adds special ammunition dice but still adds Dexterity only once', () => {
    const c = armed('Pistol');
    c.inventory[0]['loadedAmmo'] = 'Shock';
    const result = attackDnds(c, rules, c.inventory[0].id, settings, (s) => (s === 20 ? 10 : 1));
    expect(result.message).toContain('5 damage');
    expect(result.message).toContain('1 Lightning');
  });
  it('heavy weapons work in Power Armor and Ranger pistol mastery doubles proficiency', () => {
    const c = armed('Minigun');
    const armor = catalogInventory(
      DNDS_CATALOG.find((e) => e.name === 'Power Armor')!,
      'dnds',
    );
    armor.equipped = true;
    c.inventory.push(armor);
    expect(() =>
      attackDnds(c, rules, c.inventory[0].id, settings, (s) => (s === 20 ? 10 : 1)),
    ).not.toThrow();
    const ranger = armed('Pistol');
    ranger.class = 'Ranger';
    expect(
      attackDnds(ranger, rules, ranger.inventory[0].id, { ...settings, proficient: true }, (s) =>
        s === 20 ? 10 : 1,
      ).message,
    ).toContain('= 16');
  });
  it('heavy armor ignores negative Dexterity modifiers', () => {
    const c = armed();
    c.scores.dex = 8;
    const armor = catalogInventory(
      DNDS_CATALOG.find((e) => e.name === 'Power Armor')!,
      'dnds',
    );
    armor.equipped = true;
    c.inventory.push(armor);
    expect(rules.armorSummary!(c, rules)).toContain('AC 18');
  });
});
