import { z } from 'zod';
import { CharacterCore } from '../characters/character-core';
import { rollDie } from '../characters/dice';
import type { CharacterRuleset } from '../characters/character-ruleset';
export const weaponSchema = z
  .object({
    damage: z
      .array(
        z.object({
          count: z.number().int().min(1).max(20),
          sides: z.number().int().min(2).max(100),
          type: z.string(),
        }),
      )
      .min(1),
    reload: z.number().int().min(1).max(100),
    misfire: z.number().int().min(0).max(20),
    recoil: z.number().positive().optional(),
    rateOfFire: z.number().int().min(1).max(20).optional(),
    range: z.number().positive(),
    longRange: z.number().positive(),
    hands: z.number().int().min(1).max(2),
    family: z.string(),
    heavy: z.boolean().optional(),
    scoped: z.boolean().optional(),
    effectiveRange: z.number().positive().optional(),
    area: z.string().optional(),
    saveDC: z.number().int().positive().optional(),
  })
  .passthrough();
export interface WeaponAttackInput {
  targetAC: number;
  distance: number;
  proficient: boolean;
  advantage: 'normal' | 'advantage' | 'disadvantage';
  dualWield: boolean;
  mounted: boolean;
}
export interface PlayActionResult {
  core: CharacterCore;
  message: string;
}
export function attackDnds(
  core: CharacterCore,
  rules: CharacterRuleset,
  id: string,
  input: WeaponAttackInput,
  roll: (sides: number) => number = rollDie,
): PlayActionResult {
  const entry = core.inventory.find((e) => e.id === id);
  if (!entry?.equipped) throw new Error('Equip the weapon first.');
  const weapon = weaponSchema.parse(entry['weapon']);
  if (
    !Number.isFinite(input.targetAC) ||
    input.targetAC < 0 ||
    !Number.isFinite(input.distance) ||
    input.distance < 0
  )
    throw new Error('Enter valid target AC and distance.');
  const remaining =
    typeof entry['chargesRemaining'] === 'number' ? entry['chargesRemaining'] : weapon.reload;
  if (!Number.isSafeInteger(remaining) || remaining < 1)
    throw new Error('Reload this weapon first.');
  const powerArmor = core.inventory.some(
    (e) => e.equipped && (e['armor'] as { powerArmor?: boolean } | undefined)?.powerArmor,
  );
  if (
    weapon.heavy &&
    !powerArmor &&
    !input.mounted &&
    (!(core['dndsProficiencies'] as string[] | undefined)?.includes('Heavy Firearms') ||
      rules.abilityModifier(core.scores.str) < 2)
  )
    throw new Error(
      'Heavy weapons need Heavy Firearms training and Strength modifier +2, Power Armor, or a mount.',
    );
  const suppressed = entry['suppressed'] === true,
    rogue = core.class === 'Rogue';
  const rangeFactor = suppressed && !rogue ? 0.5 : 1;
  if (input.distance > weapon.longRange * rangeFactor)
    throw new Error('Target is outside maximum range.');
  let advantage = input.advantage === 'advantage',
    disadvantage = input.advantage === 'disadvantage';
  if (input.distance > weapon.range * rangeFactor) disadvantage = true;
  if (weapon.scoped && input.distance < 20) disadvantage = true;
  if (weapon.scoped && input.distance > 60) advantage = true;
  const a = roll(20),
    b = advantage !== disadvantage ? roll(20) : a;
  const natural =
    advantage && !disadvantage ? Math.max(a, b) : disadvantage && !advantage ? Math.min(a, b) : a;
  const dex = rules.abilityModifier(core.scores.dex),
    ranger =
      core.class === 'Ranger' && /pistol|sniper|longlas|submachine|stormbolter/i.test(entry.name);
  const modifier =
    dex +
    (input.proficient ? rules.proficiencyBonus(core.level) * (ranger ? 2 : 1) : 0) -
    (input.dualWield ? 2 : 0);
  const total = natural + modifier,
    jam = natural <= weapon.misfire;
  const coreAfter = {
    ...core,
    inventory: core.inventory.map((e) =>
      e.id === id ? { ...e, chargesRemaining: remaining - 1 } : e,
    ),
  };
  if (jam)
    return {
      core: coreAfter,
      message: `${entry.name}: d20 ${natural}, total ${total}. JAM occurred. Clear it using an Intelligence or Dexterity tinkering check (Artificers clear ordinary jams automatically).`,
    };
  if (weapon.area) {
    const damage =
      weapon.damage.reduce(
        (sum, d) =>
          sum + Array.from({ length: d.count }, () => roll(d.sides)).reduce((x, y) => x + y, 0),
        0,
      ) + dex;
    return {
      core: coreAfter,
      message: `${entry.name}: ${Math.max(0, damage)} damage (${weapon.damage.map((d) => d.type).join(' + ')}), ${weapon.area}${weapon.saveDC ? `; Dexterity save DC ${weapon.saveDC + rules.proficiencyBonus(core.level)}` : '; GM resolves target saves'}. Resolve saves, modifiers and target effects individually.`,
    };
  }
  const hit = natural === 20 || (natural !== 1 && total >= input.targetAC);
  if (!hit)
    return {
      core: coreAfter,
      message: `${entry.name}: d20 ${natural} ${modifier >= 0 ? '+' : ''}${modifier} = ${total}; miss.`,
    };
  const hits =
    weapon.recoil && weapon.rateOfFire
      ? (1 + Math.floor(Math.max(0, total - input.targetAC) / weapon.recoil)) * weapon.rateOfFire
      : 1;
  if (hits > 1000)
    throw new Error('Burst exceeds supported dice count; verify target AC and modifiers.');
  const critical = natural === 20;
  const parts = weapon.damage.map((d) => ({
    type: d.type,
    total: Array.from({ length: d.count * hits * (critical ? 2 : 1) }, () => roll(d.sides)).reduce(
      (x, y) => x + y,
      0,
    ),
  }));
  const ammoTypes: Record<string, string> = {
    Incendiary: 'Fire',
    Shock: 'Lightning',
    Cryo: 'Cold',
    Radioactive: 'Poison',
    Corrosive: 'Acid',
    Psychoactive: 'Psychic',
  };
  const ammo = typeof entry['loadedAmmo'] === 'string' ? entry['loadedAmmo'] : 'Standard';
  if (ammoTypes[ammo]) {
    const sides = weapon.damage[0].sides;
    parts.push({
      type: ammoTypes[ammo],
      total: Array.from({ length: hits * (critical ? 2 : 1) }, () => roll(sides)).reduce(
        (x, y) => x + y,
        0,
      ),
    });
  }
  let damage = Math.max(0, parts.reduce((s, d) => s + d.total, 0) + dex);
  if (weapon.effectiveRange && input.distance <= (weapon.effectiveRange * rangeFactor) / 2)
    damage = Math.floor(damage * 1.5);
  if (suppressed && !rogue) damage = Math.floor(damage * 0.75);
  return {
    core: coreAfter,
    message: `${entry.name}: d20 ${natural} ${modifier >= 0 ? '+' : ''}${modifier} = ${total}; ${hits} hit${hits === 1 ? '' : 's'}${critical ? ' (critical)' : ''}; ${damage} damage (${parts.map((p) => `${p.total} ${p.type}`).join(' + ')}, Dexterity ${dex >= 0 ? '+' : ''}${dex} once). Resolve armor, ammo and keyword effects with the GM.`,
  };
}
export function reloadDnds(core: CharacterCore, id: string, ammoId?: string): PlayActionResult {
  const entry = core.inventory.find((e) => e.id === id);
  if (!entry) throw new Error('Weapon not found.');
  const weapon = weaponSchema.parse(entry['weapon']);
  const ammo = ammoId ? core.inventory.find((e) => e.id === ammoId) : undefined;
  if (ammoId && !ammo?.['ammoType']) throw new Error('Select a special ammunition entry.');
  if (ammo && weapon.family === 'inferno')
    throw new Error('Inferno weapons use their standard fuel, not these ammunition variants.');
  const inventory = core.inventory.flatMap((e) =>
    e.id === id
      ? [{ ...e, chargesRemaining: weapon.reload, loadedAmmo: ammo?.['ammoType'] ?? 'Standard' }]
      : ammo && e.id === ammo.id
        ? e.quantity === 1
          ? []
          : [{ ...e, quantity: e.quantity - 1 }]
        : [e],
  );
  return {
    core: { ...core, inventory },
    message: `${entry.name} reloaded with ${ammo?.name ?? 'free standard ammunition'}. Costs ${weapon.heavy ? 2 : 1} action${weapon.heavy ? 's' : ''}; each dual-wielded weapon reloads separately. Special ammo effects are resolved with the GM.`,
  };
}
