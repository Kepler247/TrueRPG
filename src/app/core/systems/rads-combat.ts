import {
  CharacterCore,
  InventoryEntry,
  abilityModifier,
  StatKey,
} from '../characters/character-core';
import {
  signedFormula,
  WeaponReference,
  undefinedWeaponReference,
} from '../characters/weapon-reference';
import { rollDie } from '../characters/dice';
import { RadsWeapon } from './rads-catalog';
import {
  radsState,
  resolveRadsRoll,
  activeEffects,
  hasFeat,
  modifierFamilyMatches,
} from './rads-engine';
export function damageDice(
  expression: string,
  critical = false,
  extraDice = 0,
  roll: (sides: number) => number = rollDie,
): number {
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(expression);
  if (!m) {
    if (expression === '0') return 0;
    throw new Error('Unsupported source damage expression.');
  }
  const count = Number(m[1]) * (critical ? 2 : 1) + extraDice,
    sides = Number(m[2]);
  if (count > 1000) throw new Error('Too many damage dice.');
  return (
    Array.from({ length: count }, () => roll(sides)).reduce((a, b) => a + b, 0) + Number(m[3] ?? 0)
  );
}

const circumstance: Record<string, string> = {
  'obsessed-target': 'against the Jericho target',
  'judged-target': 'against the Judgment Day target',
  sight: 'when the attack relies on sight',
  'distracted-target': 'against the eligible distracted target',
  'heretic-target': 'on the first attack against the marked heretic',
  'retribution-target': 'against the creature that harmed your ally',
  'coordinated-assault': 'for the immediate Coordinated Assault attack',
};
export function radsWeaponReference(
  core: CharacterCore,
  entry: InventoryEntry,
): WeaponReference | null {
  const w = entry['radsWeapon'] as RadsWeapon | undefined;
  if (!w) return undefinedWeaponReference(core, entry);
  const category = radsState(core).weapons[w.category] ?? 'none',
    training = category === 'expertise' ? 2 : category === 'proficient' ? 1 : 0;
  const stat: StatKey =
    w.family === 'melee' ? (w.finesse && core.scores.dex > core.scores.str ? 'dex' : 'str') : 'dex';
  const result = resolveRadsRoll(
    core,
    { scope: 'attack', stat, family: w.family },
    training,
    w.accuracy,
  );
  let attack =
    signedFormula('d20', result.modifier) +
    result.dice.map((d) => ` + 1d${d.sides}`).join('') +
    (result.mode === 'normal' ? '' : `, ${result.mode}`);
  const match = /^(\d+d\d+)([+-]\d+)?$/.exec(w.damage);
  let bonus = Number(match?.[2] ?? 0) + abilityModifier(core.scores[stat]);
  if (core.class === 'Gunslinger' && ['pistol', 'revolver'].includes(w.family)) bonus++;
  if (core.class === 'Psycho' && w.family === 'melee') bonus++;
  if (core.class === 'Soldier' && ['rifle', 'heavy'].includes(w.family)) bonus++;
  const effects = activeEffects(core).flatMap((e) =>
    e.modifiers.map((m) => ({ source: e.name, m })),
  );
  const damageMods = effects.filter(
    ({ m }) =>
      m.scope === 'damage' &&
      modifierFamilyMatches(m.family, w.family) &&
      (!m.stat || m.stat === stat) &&
      (!m.damageType || m.damageType === w.damageType),
  );
  const unconditional = damageMods.filter(({ m }) => !m.context);
  bonus += unconditional
    .filter(({ m }) => m.kind === 'flat')
    .reduce((n, { m }) => n + (m.value ?? 0), 0);
  let damage = match ? signedFormula(match[1], bonus) : 'No damage';
  if (match) {
    damage += unconditional
      .filter(({ m }) => m.kind === 'die' && m.sides)
      .map(({ m }) => ` + 1d${m.sides}`)
      .join('');
    const multiplier = unconditional
      .filter(({ m }) => m.kind === 'multiply')
      .reduce((n, { m }) => n * (m.value ?? 1), 1);
    if (multiplier !== 1) damage = `(${damage}) x ${multiplier}`;
    damage += ` ${w.damageType}`;
  }
  for (const { source, m } of effects.filter(
    ({ m }) =>
      m.scope === 'attack' &&
      !!m.context &&
      modifierFamilyMatches(m.family, w.family) &&
      (!m.stat || m.stat === stat),
  )) {
    const value =
      m.kind === 'flat'
        ? signedFormula('', m.value ?? 0).trim()
        : m.kind === 'die'
          ? `+1d${m.sides}`
          : m.kind;
    attack += `; ${value} ${circumstance[m.context!] ?? 'when ' + m.context} (${source})`;
  }
  if (match)
    for (const { source, m } of damageMods.filter(({ m }) => !!m.context)) {
      const value =
        m.kind === 'multiply'
          ? `x ${m.value}`
          : m.kind === 'flat'
            ? signedFormula('', m.value ?? 0).trim()
            : m.kind;
      damage += `; ${value} ${circumstance[m.context!] ?? 'when ' + m.context} (${source})`;
    }
  const tracked = w.family !== 'throwable' && (w.tracked || entry['ammoTracked'] === true);
  return {
    attack,
    damage,
    notes: [
      'Roll physical dice. Damage cannot fall below 0. Resolve critical hits and situational weapon properties at the table.',
      'Manually spend ammunition/actions and End next-attack effects after use.',
    ],
    ...(tracked
      ? { ammunition: { current: Number(entry['ammoRemaining'] ?? 0), label: 'Ammunition' } }
      : {}),
  };
}
export function adjustRadsAmmo(core: CharacterCore, id: string, delta: number) {
  const entry = core.inventory.find((e) => e.id === id);
  if (!entry || !radsWeaponReference(core, entry)?.ammunition)
    throw new Error('This weapon does not track individual ammunition.');
  const value = Number(entry['ammoRemaining'] ?? 0) + delta;
  if (!Number.isSafeInteger(delta) || !Number.isSafeInteger(value) || value < 0)
    throw new Error('Ammunition must be a nonnegative whole number.');
  return {
    core: {
      ...core,
      inventory: core.inventory.map((e) => (e.id === id ? { ...e, ammoRemaining: value } : e)),
    },
    message: 'Ammunition saved.',
  };
}
