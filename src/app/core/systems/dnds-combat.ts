import { z } from 'zod';
import {
  CharacterCore,
  InventoryEntry,
  abilityModifier,
  proficiencyBonus,
} from '../characters/character-core';
import {
  WeaponReference,
  signedFormula,
  undefinedWeaponReference,
} from '../characters/weapon-reference';
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
export interface PlayActionResult {
  core: CharacterCore;
  message: string;
}
export function dndsWeaponReference(
  core: CharacterCore,
  entry: InventoryEntry,
): WeaponReference | null {
  if (!entry['weapon']) return undefinedWeaponReference(core, entry);
  const w = weaponSchema.parse(entry['weapon']),
    dex = abilityModifier(core.scores.dex);
  const proficient = entry['attackProficient'] !== false;
  const ranger =
    core.class === 'Ranger' && /pistol|sniper|longlas|submachine|stormbolter/i.test(entry.name);
  const attack = signedFormula(
    'd20',
    dex +
      (proficient ? proficiencyBonus(core.level) * (ranger ? 2 : 1) : 0) -
      (entry['dualWield'] === true ? 2 : 0),
  );
  const parts = w.damage.map((d) => `${d.count}d${d.sides} ${d.type}`);
  const ammoTypes: Record<string, string> = {
    Incendiary: 'Fire',
    Shock: 'Lightning',
    Cryo: 'Cold',
    Radioactive: 'Poison',
    Corrosive: 'Acid',
    Psychoactive: 'Psychic',
  };
  const ammo = typeof entry['loadedAmmo'] === 'string' ? entry['loadedAmmo'] : 'Standard';
  if (ammoTypes[ammo]) parts.push(`1d${w.damage[0].sides} ${ammoTypes[ammo]}`);
  const burst = !!w.recoil && !!w.rateOfFire;
  let damage = signedFormula(burst ? `(${parts.join(' + ')}) x hits` : parts.join(' + '), dex);
  if (entry['suppressed'] === true && core.class !== 'Rogue')
    damage = `(${damage}) x 0.75 (round down)`;
  const notes = [
    'Roll physical dice; resolve critical hits, jams and situational properties at the table.',
    'Dexterity damage is added once per attack. Manually track firing actions and reloads.',
  ];
  if (burst)
    notes.push(
      `Burst dice are per hit. Determine hits at the table using recoil ${w.recoil} and rate of fire ${w.rateOfFire}.`,
    );
  return {
    attack,
    damage,
    notes,
    ammunition: {
      current: Number(entry['chargesRemaining'] ?? w.reload),
      maximum: w.reload,
      label: 'Firing actions remaining',
    },
  };
}
export function adjustDndsAmmo(core: CharacterCore, id: string, delta: number): PlayActionResult {
  const entry = core.inventory.find((e) => e.id === id);
  if (!entry) throw new Error('Weapon not found.');
  const w = weaponSchema.parse(entry['weapon']),
    value = Number(entry['chargesRemaining'] ?? w.reload) + delta;
  if (!Number.isSafeInteger(delta) || !Number.isSafeInteger(value) || value < 0 || value > w.reload)
    throw new Error('Firing actions must be within reload capacity.');
  return {
    core: {
      ...core,
      inventory: core.inventory.map((e) => (e.id === id ? { ...e, chargesRemaining: value } : e)),
    },
    message: 'Firing actions saved.',
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
