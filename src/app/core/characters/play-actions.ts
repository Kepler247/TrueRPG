import { CharacterCore, currentHitPoints } from './character-core';
import { CharacterRuleset } from './character-ruleset';
import { rollDie } from './dice';

export function availableHitDice(core: CharacterCore): number {
  return Math.max(0, core.level - (core.hitDiceSpent ?? 0));
}
export function completeRest(
  core: CharacterCore,
  rules: CharacterRuleset,
  kind: 'short' | 'long',
  spend = false,
  dieRoll: (sides: number) => number = rollDie,
): CharacterCore {
  if (!rules.rest) throw new Error('This system has no rest rules.');
  rules.rest.before?.(core, kind);
  const hp = currentHitPoints(core);
  if (hp === null) throw new Error('Set maximum HP before resting.');
  if (kind === 'long' && hp < 1)
    throw new Error('A long rest requires at least 1 HP at its start.');
  let next = { ...core };
  if (kind === 'short' && spend) {
    const sides = rules.hitDie?.(core);
    if (!sides || availableHitDice(core) < 1) throw new Error('No available Hit Die to spend.');
    const rolled = dieRoll(sides);
    if (!Number.isInteger(rolled) || rolled < 1 || rolled > sides)
      throw new Error('Invalid Hit Die result.');
    next.hpCurrent = Math.min(
      core.hpMax!,
      hp +
        Math.max(rules.rest.minimumHealing ?? 0, rolled + rules.abilityModifier(core.scores.con)),
    );
    next.hitDiceSpent = (core.hitDiceSpent ?? 0) + 1;
  }
  if (kind === 'long') {
    next.hpCurrent = core.hpMax!;
    next.hitDiceSpent = Math.max(
      0,
      (core.hitDiceSpent ?? 0) - rules.rest.recoverHitDice(core.level),
    );
    const resource = rules.classResource?.(core);
    if (resource?.resetsOnLongRest) next = resource.setCurrent(next, 0);
  }
  const uses = { ...core.abilityUses };
  for (const ability of core.abilities) {
    if (ability.recharge === 'short-rest' || (kind === 'long' && ability.recharge === 'long-rest'))
      uses[ability.id] = 0;
  }
  next.abilityUses = uses;
  next.lastRest = {
    kind,
    recordedAt: new Date().toISOString(),
    healing: (next.hpCurrent ?? hp) - hp,
  };
  return rules.rest.finish?.(next, kind) ?? next;
}
export function inventoryAction(
  core: CharacterCore,
  id: string,
  action: 'equip' | 'add' | 'remove',
): CharacterCore {
  const entry = core.inventory.find((item) => item.id === id);
  if (!entry) throw new Error('Item is no longer in inventory.');
  return {
    ...core,
    inventory: core.inventory.flatMap((item) => {
      if (item.id !== id) return [item];
      if (action === 'equip') return [{ ...item, equipped: !item.equipped }];
      if (action === 'remove' && item.quantity === 1) return [];
      return [{ ...item, quantity: item.quantity + (action === 'add' ? 1 : -1) }];
    }),
  };
}
