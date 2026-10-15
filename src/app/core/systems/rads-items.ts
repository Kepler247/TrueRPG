import { RADS_CONSUMABLES } from './rads-consumables';
import { CharacterCore, currentHitPoints } from '../characters/character-core';
import { rollDie } from '../characters/dice';
import {
  addEffect,
  RadsEffect,
  RadsModifier,
  radsState,
  withRads,
  consumeAction,
  hasFeat,
  resolveIncomingDamage,
  queueRadsConsequence,
  advanceRadsTime,
} from './rads-engine';
import {
  RADS_MUTATIONS,
  acquiredMutations,
  awardMutation,
  drawMutation,
  recovering,
} from './rads-mutations';
import { damageDice } from './rads-combat';
export function changeRadsHP(core: CharacterCore, hp: number): CharacterCore {
  if (!Number.isSafeInteger(hp) || hp < 0 || core.hpMax === null || hp > core.hpMax)
    throw new Error('HP must be within the character maximum.');
  if (recovering(core) && hp !== 0)
    throw new Error('Finish the 30-minute reconstitution before ordinary healing.');
  let state = radsState(core);
  if (hp === 0 && !recovering(core)) {
    if (hasFeat(core, 'Built Different') && !state.uses?.['Built Different'])
      return withRads(
        { ...core, hpCurrent: 1 },
        { ...state, uses: { ...state.uses, 'Built Different': 1 } },
      );
    return awardMutation({ ...core, hpCurrent: 0 }, drawMutation(core, 'negative'), true);
  }
  return { ...core, hpCurrent: hp };
}
export function radiationEffect(core: CharacterCore, number: number): CharacterCore {
  const s = radsState(core),
    base = {
      id: 'radiation-' + number,
      name: [
        'Glowstick',
        'Nuclear Hiccups',
        'Magnetic Personality',
        'Bone Rattle',
        'Radioactive Flatulence',
        'Third Eye',
        'Meat Magnet',
        'Unscheduled Growth',
        'Geiger Counter',
        'Sudden Evolution',
        'Atomic Sneeze',
        'Critical Mass',
      ][number - 1],
      modifiers: [] as RadsModifier[],
    };
  if (!base.name) throw new Error('Radiation result must be 1-12.');
  const turn = (n: number, mods: RadsModifier[], note = '') =>
    addEffect(core, { ...base, modifiers: mods, expiresTurn: s.turn + n, contextNote: note });
  switch (number) {
    case 1:
      return turn(3, [], 'Glow green; cannot hide in darkness or benefit from invisibility.');
    case 2:
      return turn(3, [{ scope: 'check', kind: 'disadvantage', skill: 'stealth' }]);
    case 3:
      return turn(2, [{ scope: 'speed', kind: 'flat', value: -10 }]);
    case 4:
      return addEffect(core, {
        ...base,
        modifiers: [{ scope: 'attack', kind: 'disadvantage' }],
        contextNote: 'Only the next attack roll; end after it resolves.',
      });
    case 5:
      return turn(
        1,
        [],
        '10-ft cloud: creatures inside make CON save or Poisoned until end of next turn. Use the originating effect save DC.',
      );
    case 6:
      return turn(3, [{ scope: 'check', kind: 'advantage', skill: 'perception' }]);
    case 7:
      return addEffect(core, {
        ...base,
        modifiers: [],
        contextNote:
          'Enemies have advantage on their next attack against you; end after that attack.',
      });
    case 8:
      return turn(3, [
        { scope: 'damage', kind: 'flat', family: 'melee', value: 2 },
        { scope: 'check', kind: 'disadvantage', stat: 'dex' },
      ]);
    case 9:
      return turn(3, [], 'Loud clicking reveals your approximate location.');
    case 10:
      return turn(
        2,
        [{ scope: 'speed', kind: 'flat', value: 10 }],
        'Next movement must be in a straight line.',
      );
    case 11:
      return addEffect(core, {
        ...base,
        modifiers: [],
        contextNote:
          'Atomic Sneeze: every creature within 5 ft, including allies, takes 1d4 radiation damage. Resolve each target.',
      });
    default:
      return addEffect(core, {
        ...base,
        modifiers: [],
        contextNote:
          'Take 1d6 radiation damage; roll again, excluding Critical Mass. Resolve before ending this entry.',
      });
  }
}
export function consumeRadsItem(
  core: CharacterCore,
  id: string,
  roll: (sides: number) => number = rollDie,
): { core: CharacterCore; message: string } {
  const item = core.inventory.find((i) => i.id === id),
    name = item?.['radsConsumable'];
  if (!item || typeof name !== 'string' || !RADS_CONSUMABLES.some((e) => e.name === name))
    throw new Error('Select a ruleset consumable.');
  if (recovering(core) || currentHitPoints(core) === 0)
    throw new Error('Ordinary consumables cannot revive a dead character.');
  let next = consumeAction(core, 'bonus');
  next = {
    ...next,
    inventory: next.inventory.flatMap((i) =>
      i.id === id ? (i.quantity === 1 ? [] : [{ ...i, quantity: i.quantity - 1 }]) : [i],
    ),
  };
  const s = radsState(next),
    base = {
      id: 'drug-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name,
      modifiers: [] as RadsModifier[],
    };
  const buff = (turns: number, mods: RadsModifier[], extra: Partial<RadsEffect> = {}) => {
    next = addEffect(next, { ...base, modifiers: mods, expiresTurn: s.turn + turns, ...extra });
  };
  const timed = (seconds: number, mods: RadsModifier[], extra: Partial<RadsEffect> = {}) => {
    next = addEffect(next, {
      ...base,
      modifiers: mods,
      expiresSecond: s.seconds + seconds,
      ...extra,
    });
  };
  const heals: Record<string, string> = {
    'Dirty Bandages': '1d4',
    'First Aid Kit': '1d6+2',
    'Nutrocorp Stimpak': '2d6+2',
    'Military Trauma Injector': '4d6+4',
    'Burn Gel': '1d4',
    'Surgical Foam': '2d8',
    'Nutrocorp Rejuvenation Serum': '3d8',
  };
  if (heals[name])
    next = changeRadsHP(
      next,
      Math.min(
        core.hpMax!,
        currentHitPoints(core)! + Math.max(0, damageDice(heals[name], false, 0, roll)),
      ),
    );
  const clear = (conditions: string[]) => {
    const state = radsState(next);
    next = withRads(next, {
      ...state,
      conditions: state.conditions.filter((c) => !conditions.includes(c)),
      effects:
        name === 'RadAway' || name === 'Nutrocorp Miracle Cure'
          ? state.effects.filter((e) => !e.id.startsWith('radiation-'))
          : state.effects.map((e) => ({
              ...e,
              conditions: e.conditions?.filter((c) => !conditions.includes(c)),
            })),
    });
  };
  switch (name) {
    case 'Antidote':
      clear(['Poisoned']);
      break;
    case 'Burn Gel':
      clear(['Burning']);
      break;
    case 'Adrenaline Shot':
      clear(['Stunned']);
      break;
    case 'RadAway':
      clear(['Irradiated']);
      break;
    case 'Nutrocorp Miracle Cure':
      next = changeRadsHP(next, core.hpMax!);
      clear(['Poisoned', 'Burning', 'Irradiated']);
      next = queueRadsConsequence(next, name, { kind: 'radiation' });
      break;
    case 'Nutrocorp Experimental Stimulant':
      next = queueRadsConsequence(queueRadsConsequence(next, name, { kind: 'radiation' }), name, {
        kind: 'radiation',
      });
      next = addEffect(next, {
        ...base,
        expiresTurn: s.turn + 2,
        extraActionTurn: s.turn + 1,
        contextNote:
          'One additional standard Action on your next turn, not a Bonus or Skill Action or Reaction.',
      });
      break;
    case 'Canned Mystery Meat':
      next = addEffect(next, {
        ...base,
        restFood: true,
        contextNote:
          'At the next rest: short rest restores an extra 1d4 HP; long rest grants 4 temporary HP.',
      });
      break;
    case 'Purified Water':
      timed(3600, [{ scope: 'save', stat: 'con', kind: 'advantage', context: 'heat-exhaustion' }], {
        contextNote:
          'Ends after your next CON save against heat/exhaustion. Ordinary dehydration is removed; GM confirms.',
      });
      break;
    case 'Military Ration Pack':
      timed(86400, [{ scope: 'check', skill: 'survival', kind: 'flat', value: 1 }], {
        contextNote: 'Ends after the next Survival check. Sustains one person for a day.',
      });
      break;
    case 'Caffeine Tablets':
      timed(3600, [], {
        contextNote:
          'Ignore ordinary fatigue penalties for 1 hour. End the aftermath after the next CON check to resist fatigue.',
        after: [{ scope: 'check', stat: 'con', kind: 'disadvantage', context: 'fatigue' }],
      });
      break;
    case 'Rajin':
      buff(3, [{ scope: 'damage', kind: 'flat', family: 'melee', value: 2 }], {
        after: [{ scope: 'check', kind: 'disadvantage', stat: 'int' }],
        afterSeconds: 600,
      });
      break;
    case 'BulletTime':
      buff(
        3,
        [
          { scope: 'speed', kind: 'flat', value: 10 },
          { scope: 'check', kind: 'flat', context: 'initiative', value: 2 },
        ],
        { after: [{ scope: 'speed', kind: 'flat', value: -10 }], afterTurns: 2 },
      );
      break;
    case 'Buffout':
      timed(
        600,
        [
          { scope: 'check', kind: 'flat', stat: 'str', value: 2 },
          { scope: 'save', kind: 'flat', stat: 'str', value: 2 },
        ],
        { after: [{ scope: 'check', kind: 'disadvantage', stat: 'dex' }], afterSeconds: 600 },
      );
      break;
    case 'Med-X':
      buff(3, [{ scope: 'incoming', kind: 'reduce', value: 2 }], {
        after: [{ scope: 'check', kind: 'disadvantage', skill: 'perception' }],
        afterSeconds: 600,
      });
      break;
    case 'Overdrive':
      buff(
        3,
        [
          { scope: 'attack', kind: 'flat', value: 2 },
          { scope: 'damage', kind: 'flat', value: 2 },
        ],
        {
          afterEvents: [{ kind: 'damage', expression: '2d6' }],
          contextNote: 'When benefit ends, take 2d6 damage.',
        },
      );
      break;
    case 'Berserker Serum':
      buff(2, [{ scope: 'damage', kind: 'multiply', family: 'melee', value: 2 }], {
        contextNote: 'Cannot willingly retreat from a visible enemy.',
        afterConditions: ['Stunned'],
        afterTurns: 1,
      });
      break;
    case 'Anti-Rad Tablets':
      buff(3, [{ scope: 'incoming', kind: 'resistance', damageType: 'Radiation' }]);
      break;
    case 'Glow Juice':
      timed(
        600,
        [
          {
            scope: 'check',
            kind: 'advantage',
            skill: 'intimidation',
            context: 'ordinary-wastelander',
          },
          { scope: 'check', kind: 'disadvantage', skill: 'stealth' },
        ],
        { contextNote: 'Glow brightly for 10 minutes.' },
      );
      break;
    case 'Mutagen Cocktail': {
      const owned = new Set([
        ...acquiredMutations(next).map((m) => m.id),
        ...radsState(next)
          .effects.filter((e) => e.mutationMode === 'temporary')
          .map((e) => e.mutationId),
      ]);
      const pool = RADS_MUTATIONS.filter((m) => m.polarity === 'positive' && !owned.has(m.id));
      if (!pool.length) throw new Error('No unowned temporary positive mutation remains.');
      const mutation = pool[pool.length === 1 ? 0 : roll(pool.length) - 1];
      next = addEffect(next, {
        id: 'temporary-' + mutation.id,
        name: mutation.name,
        mutationId: mutation.id,
        mutationMode: 'temporary',
        modifiers: [],
        expiresSecond: s.seconds + 600,
        afterEvents: [{ kind: 'radiation' }],
        contextNote: mutation.description + ' After expiry, roll a radiation side effect.',
      });
      break;
    }
    case 'Nutrocorp Genesis Serum':
      next = awardMutation(next, drawMutation(next, 'positive'));
      break;
    case 'Nutrocorp Rejuvenation Serum':
      buff(3, [{ scope: 'speed', kind: 'flat', value: 10 }], {
        afterEvents: [{ kind: 'damage', expression: '1d8', damageType: 'Radiation' }],
        contextNote: 'When this effect ends, suffer 1d8 radiation damage.',
      });
      break;
    default:
      if (!heals[name]) throw new Error('This consumable has no supported self-use rule.');
      break;
  }
  return {
    core: next,
    message: `${name} consumed. Its defined self effects were applied; resolve any target-dependent or explicitly GM-decided effects using the displayed rule text.`,
  };
}

export function takeRadsDamage(
  core: CharacterCore,
  amount: number,
  type: string,
  tags: string[] = [],
): CharacterCore {
  const mitigated = resolveIncomingDamage(core, amount, type, tags),
    s = radsState(core),
    absorbed = Math.min(s.temporaryHP, mitigated);
  const next = withRads(core, { ...s, temporaryHP: s.temporaryHP - absorbed });
  return changeRadsHP(next, Math.max(0, currentHitPoints(core)! - (mitigated - absorbed)));
}

export function resolveRadsConsequence(
  core: CharacterCore,
  id: string,
  roll: (sides: number) => number = rollDie,
  choice?: number,
): { core: CharacterCore; message: string } {
  const state = radsState(core),
    event = state.pending?.find((e) => e.id === id);
  if (!event) throw new Error('This consequence has already been resolved.');
  if (event.kind === 'radiation' && hasFeat(core, 'Rad Enthusiast') && !event.options) {
    const options = [roll(event.maximum ?? 12), roll(event.maximum ?? 12)];
    return {
      core: withRads(core, {
        ...state,
        pending: state.pending!.map((e) => (e.id === id ? { ...e, options } : e)),
      }),
      message: 'Rad Enthusiast: choose one of your two saved radiation results.',
    };
  }
  if (event.options && (choice === undefined || !event.options.includes(choice)))
    throw new Error('Choose one of the two saved radiation results.');
  let next = withRads(core, { ...state, pending: state.pending!.filter((e) => e.id !== id) });
  if (event.kind === 'damage') {
    const damage = Math.max(0, damageDice(event.expression!, false, 0, roll));
    next = takeRadsDamage(next, damage, event.damageType ?? 'Untyped');
    return {
      core: next,
      message: `${event.source}: ${event.expression} = ${damage} ${event.damageType ?? ''} damage before mitigation.`,
    };
  }
  const result = event.options ? choice! : roll(event.maximum ?? 12);
  if (result === 12) {
    next = takeRadsDamage(next, roll(6), 'Radiation');
    next = queueRadsConsequence(next, 'Critical Mass', { kind: 'radiation', maximum: 11 });
  } else {
    next = radiationEffect(next, result);
    if (result === 11) next = takeRadsDamage(next, roll(4), 'Radiation');
  }
  return {
    core: next,
    message: `${event.source}: radiation result ${result}. See Active effects; resolve nearby creatures with the GM.`,
  };
}

export function finishRadsRest(
  core: CharacterCore,
  kind: 'short' | 'long',
  roll: (sides: number) => number = rollDie,
): CharacterCore {
  const food = radsState(core).effects.some((e) => e['restFood'] === true);
  let next = advanceRadsTime(core, kind === 'long' ? 28800 : 3600);
  let state = radsState(next);
  if (kind === 'long') state = { ...state, uses: {}, temporaryHP: food ? 4 : 0 };
  if (food) {
    state = { ...state, effects: state.effects.filter((e) => e['restFood'] !== true) };
    if (kind === 'short')
      next = { ...next, hpCurrent: Math.min(next.hpMax!, currentHitPoints(next)! + roll(4)) };
  }
  return withRads(next, state);
}
