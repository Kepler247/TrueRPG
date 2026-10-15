import { z } from 'zod';
import {
  CharacterCore,
  StatKey,
  abilityModifier,
  proficiencyBonus,
  currentHitPoints,
} from '../characters/character-core';
import { rollDie } from '../characters/dice';
export const RADS_REVISION = 'core-1';
const integer = z.number().int().safe();
const modifierSchema = z
  .object({
    kind: z.enum([
      'flat',
      'advantage',
      'disadvantage',
      'multiply',
      'reduce',
      'resistance',
      'immunity',
      'vulnerability',
      'die',
    ]),
    scope: z.enum(['check', 'save', 'attack', 'damage', 'incoming', 'speed', 'ac']),
    value: z.number().finite().optional(),
    stat: z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']).optional(),
    skill: z.string().optional(),
    family: z.string().optional(),
    damageType: z.string().optional(),
    context: z.string().optional(),
    sides: integer.min(2).max(100).optional(),
  })
  .passthrough();
export type RadsModifier = z.infer<typeof modifierSchema>;
const consequenceSchema = z.object({
  kind: z.enum(['damage', 'radiation']),
  expression: z.string().optional(),
  damageType: z.string().optional(),
  options: z.array(integer.min(1).max(12)).length(2).optional(),
  maximum: integer.min(1).max(12).optional(),
});
export type RadsConsequence = z.infer<typeof consequenceSchema>;
export const effectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    modifiers: z.array(modifierSchema),
    conditions: z.array(z.string()).optional(),
    afterConditions: z.array(z.string()).optional(),
    crashTurn: integer.nonnegative().optional(),
    crashSecond: integer.nonnegative().optional(),
    expiresTurn: integer.nonnegative().optional(),
    expiresSecond: integer.nonnegative().optional(),
    after: z.array(modifierSchema).optional(),
    afterTurns: integer.positive().optional(),
    afterSeconds: integer.positive().optional(),
    afterEvents: z.array(consequenceSchema).optional(),
    afterNote: z.string().optional(),
    contextNote: z.string().optional(),
    mutationId: z.string().optional(),
    mutationMode: z.enum(['temporary', 'suppressed', 'amplified', 'inactive']).optional(),
    afterMutationMode: z.literal('inactive').optional(),
  })
  .passthrough();
export type RadsEffect = z.infer<typeof effectSchema>;
const stateSchema = z
  .object({
    revision: z.literal(RADS_REVISION),
    abilityRounds: z.record(z.string(), integer.nonnegative()).optional(),
    turn: integer.nonnegative(),
    seconds: integer.nonnegative(),
    effects: z.array(effectSchema),
    conditions: z.array(
      z.enum([
        'Blinded',
        'Deafened',
        'Poisoned',
        'Prone',
        'Restrained',
        'Stunned',
        'Incapacitated',
        'Frightened',
        'Burning',
        'Irradiated',
        'Unconscious',
      ]),
    ),
    wallet: z
      .object({
        dollars: integer.nonnegative(),
        chips: integer.nonnegative(),
        fusionCells: integer.nonnegative(),
      })
      .passthrough(),
    weapons: z.record(z.string(), z.enum(['none', 'proficient', 'expertise'])),
    actions: z
      .object({
        action: integer.nonnegative(),
        bonus: integer.nonnegative(),
        skill: integer.nonnegative(),
        reaction: integer.nonnegative(),
        extra: integer.nonnegative(),
        extraSources: z.record(z.string(), integer.nonnegative()).optional(),
        movement: z.number().finite().nonnegative(),
      })
      .passthrough(),
    pending: z.array(consequenceSchema.extend({ id: z.string(), source: z.string() })).optional(),
    temporaryHP: integer.nonnegative(),
    inCombat: z.boolean(),
    started: z.boolean().optional(),
    uses: z.record(z.string(), integer.nonnegative()).optional(),
  })
  .passthrough();
export type RadsState = z.infer<typeof stateSchema>;
export function freshState(): RadsState {
  return {
    revision: RADS_REVISION,
    turn: 0,
    seconds: 0,
    effects: [],
    conditions: [],
    wallet: { dollars: 0, chips: 0, fusionCells: 0 },
    weapons: {},
    actions: { action: 1, bonus: 1, skill: 1, reaction: 1, extra: 0, movement: 0 },
    temporaryHP: 0,
    inCombat: false,
  };
}
export function radsState(core: CharacterCore): RadsState {
  return stateSchema.parse(core['rads'] === undefined ? freshState() : core['rads']);
}
export function withRads(core: CharacterCore, state: RadsState): CharacterCore {
  return { ...core, rads: stateSchema.parse(state) };
}
export function addEffect(core: CharacterCore, effect: RadsEffect): CharacterCore {
  effect = effectSchema.parse(effect);
  const s = radsState(core);
  if (effect.expiresTurn !== undefined && effect.expiresSecond === undefined)
    effect = { ...effect, expiresSecond: s.seconds + Math.max(0, effect.expiresTurn - s.turn) * 6 };
  if (effect.afterTurns !== undefined && effect.afterSeconds === undefined)
    effect = { ...effect, afterSeconds: effect.afterTurns * 6 };
  const old = s.effects.find((e) => e.id === effect.id);
  const hasAfter =
    !!effect.after?.length ||
    !!effect.afterConditions?.length ||
    !!effect.afterEvents?.length ||
    !!effect.afterNote;
  const first = {
    ...effect,
    ...(hasAfter ? { crashTurn: effect.expiresTurn, crashSecond: effect.expiresSecond } : {}),
  };
  const value = old
    ? {
        ...old,
        expiresTurn: effect.expiresTurn,
        expiresSecond: effect.expiresSecond,
        ...(core.class === 'Psycho' && hasAfter
          ? { crashTurn: effect.expiresTurn, crashSecond: effect.expiresSecond }
          : {}),
      }
    : first;
  return withRads(core, { ...s, effects: [...s.effects.filter((e) => e.id !== effect.id), value] });
}
export function activeConditions(core: CharacterCore): string[] {
  return [
    ...new Set([
      ...radsState(core).conditions,
      ...activeEffects(core).flatMap((e) => e.conditions ?? []),
    ]),
  ];
}
export function endRadsEffect(core: CharacterCore, id: string): CharacterCore {
  const state = radsState(core),
    effect = state.effects.find((e) => e.id === id);
  if (!effect) throw new Error('Effect is no longer active.');
  const effects = state.effects.filter((e) => e.id !== id);
  const extraSources = { ...state.actions.extraSources };
  delete extraSources[id];
  if (effect.after?.length || effect.afterConditions?.length || effect.afterNote)
    effects.push({
      id: id + ':after',
      name: effect.name + ' aftermath',
      modifiers: effect.after ?? [],
      conditions: effect.afterConditions,
      ...(effect.afterTurns ? { expiresTurn: state.turn + effect.afterTurns } : {}),
      ...(effect.afterSeconds ? { expiresSecond: state.seconds + effect.afterSeconds } : {}),
      mutationId: effect.mutationId,
      mutationMode: effect.afterMutationMode,
      contextNote: effect.afterNote ?? effect.contextNote,
    });
  const pending = [
    ...(state.pending ?? []),
    ...(effect.afterEvents ?? []).map((event, i) => ({
      ...event,
      id: effect.id + ':' + state.seconds + ':' + i,
      source: effect.name,
    })),
  ];
  return withRads(core, {
    ...state,
    effects,
    pending,
    actions: {
      ...state.actions,
      extraSources,
      extra: Object.values(extraSources).reduce((a, b) => a + b, 0),
    },
  });
}
export function hasFeat(core: CharacterCore, name: string): boolean {
  return core.abilities.some((a) => a.kind === 'feat' && a.name === name);
}
export function activeEffects(core: CharacterCore): RadsEffect[] {
  const s = radsState(core);
  return s.effects.filter(
    (e) =>
      (e.expiresTurn === undefined || e.expiresTurn > s.turn) &&
      (e.expiresSecond === undefined || e.expiresSecond > s.seconds),
  );
}
export interface RadsRollContext {
  scope: 'check' | 'save' | 'attack';
  stat: StatKey;
  skill?: string;
  family?: string;
  tags?: string[];
  target?: string;
  advantage?: boolean;
  disadvantage?: boolean;
  extra?: RadsModifier[];
}
export interface ModifierLine {
  source: string;
  value: number;
  kind: string;
}
export function resolveRadsRoll(
  core: CharacterCore,
  ctx: RadsRollContext,
  training: 0 | 1 | 2 = 0,
  bonus = 0,
) {
  const state = radsState(core),
    lines: ModifierLine[] = [
      {
        source: ctx.stat.toUpperCase(),
        value: abilityModifier(core.scores[ctx.stat]),
        kind: 'flat',
      },
    ];
  if (training)
    lines.push({
      source: training === 2 ? 'Expertise' : 'Proficiency',
      value: training * proficiencyBonus(core.level),
      kind: 'flat',
    });
  if (bonus) lines.push({ source: 'Sheet adjustment', value: bonus, kind: 'flat' });
  const modifiers: { source: string; modifier: RadsModifier }[] = activeEffects(core).flatMap((e) =>
    e.modifiers.map((modifier) => ({ source: e.name, modifier })),
  );
  for (const modifier of ctx.extra ?? [])
    modifiers.push({ source: 'Declared circumstance', modifier });
  if (ctx.advantage)
    modifiers.push({
      source: 'Declared advantage',
      modifier: { scope: ctx.scope, kind: 'advantage' },
    });
  if (ctx.disadvantage)
    modifiers.push({
      source: 'Declared disadvantage',
      modifier: { scope: ctx.scope, kind: 'disadvantage' },
    });
  for (const condition of activeConditions(core)) {
    if (
      (condition === 'Poisoned' || condition === 'Frightened') &&
      (ctx.scope === 'attack' || ctx.scope === 'check')
    )
      modifiers.push({
        source: condition,
        modifier: {
          scope: ctx.scope,
          kind: 'disadvantage',
          ...(condition === 'Frightened' ? { context: 'fear-visible' } : {}),
        },
      });
    if (
      (condition === 'Blinded' || condition === 'Restrained' || condition === 'Prone') &&
      ctx.scope === 'attack'
    )
      modifiers.push({ source: condition, modifier: { scope: 'attack', kind: 'disadvantage' } });
    if (condition === 'Restrained' && ctx.scope === 'save' && ctx.stat === 'dex')
      modifiers.push({
        source: condition,
        modifier: { scope: 'save', stat: 'dex', kind: 'disadvantage' },
      });
  }
  const featContexts: Record<string, string> = {
    'Medical Training': 'ordinary-injury',
    'Technical Training': 'ordinary-repair',
    'Investigative Training': 'container-search',
    'Diplomatic Training': 'trade',
    'Deception Training': 'false-identity',
    'Intimidation Training': 'interrogation',
    'OSHA Violation': 'unsafe-machinery',
  };
  for (const [feat, context] of Object.entries(featContexts))
    if (hasFeat(core, feat))
      modifiers.push({ source: feat, modifier: { scope: 'check', kind: 'advantage', context } });
  if (core.class === 'Gunslinger' && core.level >= 6) {
    for (const scope of ['check', 'attack'] as const)
      modifiers.push({
        source: 'Shrouded Attack',
        modifier: { scope, kind: 'advantage', context: 'undetected-harm' },
      });
  }
  if (core.class === 'Gunslinger' && core.level >= 8)
    modifiers.push({
      source: 'Master Gambler',
      modifier: { scope: 'check', kind: 'advantage', context: 'gambling' },
    });
  if (core.class === 'Soldier' && core.level >= 9)
    modifiers.push({
      source: 'Perfect Formation',
      modifier: { scope: 'check', kind: 'advantage', context: 'coordinated-movement' },
    });
  if (core.class === 'Hacker' && core.level >= 8)
    modifiers.push({
      source: 'Walking Encyclopedia',
      modifier: { scope: 'check', stat: 'int', kind: 'advantage', context: 'technical' },
    });
  if (core.class === 'Medic' && core.level >= 6)
    modifiers.push({
      source: 'Anatomical Expertise',
      modifier: { scope: 'check', kind: 'advantage', context: 'medical' },
    });
  if (core.class === 'Medic' && core.level >= 8)
    modifiers.push({
      source: "Doctor's Orders",
      modifier: { scope: 'check', stat: 'cha', kind: 'advantage', context: 'medical-professional' },
    });
  if (core.class === 'Prophet' && core.level >= 6)
    modifiers.push({
      source: 'Eye of Providence',
      modifier: { scope: 'check', stat: 'wis', kind: 'advantage', context: 'observation' },
    });
  if (core.class === 'Prophet' && core.level >= 8)
    modifiers.push({
      source: 'Unshakable Conviction',
      modifier: { scope: 'save', kind: 'advantage', context: 'fear' },
    });
  if (core.class === 'Soldier' && core.level >= 6)
    modifiers.push({
      source: "Veteran's Instinct",
      modifier: { scope: 'check', stat: 'wis', kind: 'advantage', context: 'tactical' },
    });
  const resource = Number(core.class === 'Psycho' ? (core['tolerance'] ?? 0) : 0);
  if (
    core.class === 'Psycho' &&
    core.level >= 6 &&
    ctx.scope === 'check' &&
    ctx.skill === 'intimidation'
  )
    lines.push({ source: 'Incredible Intimidation', kind: 'flat', value: 2 * resource });
  if (
    core.class === 'Psycho' &&
    core.level >= 9 &&
    ctx.scope === 'check' &&
    ['str', 'dex', 'int', 'wis'].includes(ctx.stat)
  )
    lines.push({
      source: 'Rage',
      kind: 'flat',
      value: ctx.stat === 'str' ? 2 * resource : -resource,
    });
  const tags = new Set(ctx.tags ?? []);
  if (core.class === 'Hacker' && ctx.scope === 'check' && tags.has('technical'))
    lines.push({ source: 'Hacker training', kind: 'flat', value: 1 });
  if (core.class === 'Medic' && ctx.scope === 'check' && tags.has('medical'))
    lines.push({ source: 'Medic training', kind: 'flat', value: 1 });
  if (
    core.class === 'Prophet' &&
    ctx.scope === 'check' &&
    ctx.stat === 'wis' &&
    (tags.has('observation') || tags.has('religious'))
  )
    lines.push({ source: 'Prophet training', kind: 'flat', value: 1 });
  if (ctx.scope === 'attack') {
    if (core.class === 'Gunslinger' && ['pistol', 'revolver'].includes(ctx.family ?? ''))
      lines.push({ source: 'Pistol Training', kind: 'flat', value: 1 });
    if (core.class === 'Psycho' && ctx.family === 'melee')
      lines.push({ source: 'Psycho training', kind: 'flat', value: 1 });
    if (core.class === 'Soldier' && ['rifle', 'heavy'].includes(ctx.family ?? ''))
      lines.push({ source: 'Soldier training', kind: 'flat', value: 1 });
    if (core.class === 'Prophet' && ctx.family === 'sniper')
      lines.push({ source: 'Prophet training', kind: 'flat', value: 1 });
    if (hasFeat(core, ctx.family === 'melee' ? 'Close-Quarters Training' : 'Sharpshooter Training'))
      lines.push({ source: 'Accuracy feat', kind: 'flat', value: 1 });
  }
  let advantage = false,
    disadvantage = false;
  const dice: { source: string; sides: number }[] = [];
  for (const { source, modifier: m } of modifiers) {
    if (
      m.scope !== ctx.scope ||
      (m.stat && m.stat !== ctx.stat) ||
      (m.skill && m.skill !== ctx.skill) ||
      !modifierFamilyMatches(m.family, ctx.family) ||
      (m.context && !tags.has(m.context))
    )
      continue;
    if (m.kind === 'flat') lines.push({ source, value: m.value ?? 0, kind: m.kind });
    if (m.kind === 'advantage') {
      advantage = true;
      lines.push({ source, value: 0, kind: m.kind });
    }
    if (m.kind === 'disadvantage') {
      disadvantage = true;
      lines.push({ source, value: 0, kind: m.kind });
    }
    if (m.kind === 'die' && m.sides) dice.push({ source, sides: m.sides });
  }
  const conditions = activeConditions(core);
  const automaticFailure =
    (ctx.scope === 'check' &&
      ((conditions.includes('Deafened') && tags.has('hearing')) ||
        (conditions.includes('Blinded') && tags.has('sight')))) ||
    (ctx.scope === 'save' &&
      ['str', 'dex'].includes(ctx.stat) &&
      conditions.some((c) => ['Stunned', 'Unconscious'].includes(c)));
  return {
    modifier: lines.filter((l) => l.kind === 'flat').reduce((n, l) => n + l.value, 0),
    mode:
      advantage === disadvantage
        ? ('normal' as const)
        : advantage
          ? ('advantage' as const)
          : ('disadvantage' as const),
    lines,
    dice,
    automaticFailure,
  };
}
export function rollRadsCheck(
  core: CharacterCore,
  ctx: RadsRollContext,
  training: 0 | 1 | 2 = 0,
  bonus = 0,
  roll: (sides: number) => number = rollDie,
  forcedSingle = false,
) {
  if (radsState(core).pending?.length)
    throw new Error('Resolve pending effect consequences before rolling.');
  const resolved = resolveRadsRoll(core, ctx, training, bonus),
    rolls = Array.from({ length: forcedSingle || resolved.mode === 'normal' ? 1 : 2 }, () =>
      roll(20),
    );
  const die = resolved.mode === 'advantage' ? Math.max(...rolls) : Math.min(...rolls);
  const extra = resolved.dice.map((d) => ({ ...d, value: roll(d.sides) }));
  return {
    ...resolved,
    rolls,
    die,
    total: resolved.automaticFailure
      ? null
      : die + resolved.modifier + extra.reduce((s, d) => s + d.value, 0),
    extra,
  };
}
export function consumeAction(
  core: CharacterCore,
  type: 'action' | 'bonus' | 'skill' | 'reaction',
  free = false,
): CharacterCore {
  const s = radsState(core);
  if (currentHitPoints(core) === 0) throw new Error('A dead character cannot take actions.');
  if (s.pending?.length) throw new Error('Resolve pending effect consequences first.');
  if (free) return core;
  if (activeConditions(core).some((c) => ['Stunned', 'Incapacitated', 'Unconscious'].includes(c)))
    throw new Error('This condition prevents that action.');
  if (!s.inCombat) return core;
  if (s.actions[type] > 0)
    return withRads(core, { ...s, actions: { ...s.actions, [type]: s.actions[type] - 1 } });
  if ((type === 'action' || type === 'bonus') && s.actions.extra > 0) {
    const extraSources = { ...s.actions.extraSources };
    const source = Object.keys(extraSources).find((id) => extraSources[id] > 0);
    if (source) extraSources[source]--;
    return withRads(core, {
      ...s,
      actions: { ...s.actions, extra: s.actions.extra - 1, extraSources },
    });
  }
  throw new Error(`No ${type} actions remain.`);
}
export function advanceRadsTime(core: CharacterCore, seconds: number, turn = false): CharacterCore {
  if (!Number.isSafeInteger(seconds) || seconds < 0)
    throw new Error('Game time must be a nonnegative whole number of seconds.');
  const s = radsState(core);
  if (s.pending?.length)
    throw new Error('Resolve pending effect consequences before advancing time.');
  const pending: NonNullable<RadsState['pending']> = [];
  const nextTurn = s.turn + (turn ? 1 : 0),
    nextSecond = s.seconds + seconds,
    effects: RadsEffect[] = [];
  for (const effect of s.effects) {
    const expired =
      (effect.expiresTurn !== undefined && effect.expiresTurn <= nextTurn) ||
      (effect.expiresSecond !== undefined && effect.expiresSecond <= nextSecond);
    const crashDue =
      (effect.crashTurn !== undefined && effect.crashTurn <= nextTurn) ||
      (effect.crashSecond !== undefined && effect.crashSecond <= nextSecond);
    if (!expired)
      effects.push(
        crashDue
          ? {
              ...effect,
              after: undefined,
              afterConditions: undefined,
              afterEvents: undefined,
              afterNote: undefined,
              afterMutationMode: undefined,
              crashTurn: undefined,
              crashSecond: undefined,
            }
          : effect,
      );
    if (crashDue)
      pending.push(
        ...(effect.afterEvents ?? []).map((event, i) => ({
          ...event,
          id: effect.id + ':' + nextSecond + ':' + i,
          source: effect.name,
        })),
      );
    if (crashDue && (effect.after?.length || effect.afterConditions?.length || effect.afterNote)) {
      const after: RadsEffect = {
        id: effect.id + ':after',
        name: effect.name + ' aftermath',
        modifiers: effect.after ?? [],
        conditions: effect.afterConditions,
        ...(effect.afterTurns
          ? { expiresTurn: (effect.crashTurn ?? nextTurn) + effect.afterTurns }
          : {}),
        ...(effect.afterSeconds
          ? { expiresSecond: (effect.crashSecond ?? nextSecond) + effect.afterSeconds }
          : {}),
        mutationId: effect.mutationId,
        mutationMode: effect.afterMutationMode,
        contextNote: effect.afterNote ?? effect.contextNote,
      };
      if (
        (after.expiresTurn === undefined || after.expiresTurn > nextTurn) &&
        (after.expiresSecond === undefined || after.expiresSecond > nextSecond)
      )
        effects.push(after);
    }
  }
  if (turn && activeConditions(core).includes('Burning') && currentHitPoints(core)! > 0)
    pending.push({
      id: 'burning:' + nextTurn,
      source: 'Burning',
      kind: 'damage',
      expression: '1d6',
      damageType: 'Fire',
    });
  const extraSources = Object.fromEntries(
    effects
      .filter((e) => ['supersoldier', 'ultrasoldier'].includes(e.id))
      .map((e) => [e.id, e.id === 'ultrasoldier' ? 2 : 1]),
  );
  const extra = Object.values(extraSources).reduce((a, b) => a + b, 0);
  return withRads(core, {
    ...s,
    turn: nextTurn,
    seconds: nextSecond,
    pending,
    effects: [...new Map(effects.map((e) => [e.id, e])).values()],
    actions: turn
      ? {
          action: 1 + effects.filter((e) => e['extraActionTurn'] === nextTurn).length,
          bonus: 1,
          skill: 1,
          reaction: 1,
          extra,
          extraSources,
          movement: s.actions.movement,
        }
      : {
          ...s.actions,
          extraSources: Object.fromEntries(
            Object.entries(s.actions.extraSources ?? {}).filter(([id]) =>
              effects.some((e) => e.id === id),
            ),
          ),
          extra: Object.entries(s.actions.extraSources ?? {})
            .filter(([id]) => effects.some((e) => e.id === id))
            .reduce((n, [, count]) => n + count, 0),
        },
  });
}
export function walletChange(
  core: CharacterCore,
  changes: Partial<RadsState['wallet']>,
): CharacterCore {
  const s = radsState(core),
    wallet = { ...s.wallet };
  for (const key of ['dollars', 'chips', 'fusionCells'] as const) {
    const n = changes[key] ?? 0;
    if (!Number.isSafeInteger(n) || !Number.isSafeInteger(wallet[key] + n) || wallet[key] + n < 0)
      throw new Error('Insufficient funds or invalid currency amount.');
    wallet[key] += n;
  }
  return withRads(core, { ...s, wallet });
}
export function convertCurrency(
  core: CharacterCore,
  from: 'dollars' | 'chips' | 'fusionCells',
  to: 'dollars' | 'chips' | 'fusionCells',
  amount: number,
): CharacterCore {
  const rate = { dollars: 1, chips: 100, fusionCells: 10000 };
  if (!Number.isSafeInteger(amount) || amount < 1 || from === to)
    throw new Error('Choose currencies and a positive whole amount.');
  const received = (amount * rate[from]) / rate[to];
  if (!Number.isSafeInteger(received)) throw new Error('Convert an exact whole denomination.');
  return walletChange(core, { [from]: -amount, [to]: received });
}
export function resolveIncomingDamage(
  core: CharacterCore,
  amount: number,
  type: string,
  tags: string[] = [],
) {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new Error('Damage must be a nonnegative whole number.');
  if (
    core.class === 'Psycho' &&
    core.level >= 8 &&
    ['Chemical', 'Poison'].includes(type) &&
    tags.some((t) => ['inhaled', 'ingested'].includes(t))
  )
    return 0;
  const modifiers = activeEffects(core)
    .flatMap((e) => e.modifiers)
    .filter(
      (m) =>
        m.scope === 'incoming' &&
        (!m.damageType || m.damageType === type) &&
        (!m.context || tags.includes(m.context)),
    );
  let value = amount;
  // Flat reduction precedes resistance, following the inherited 5E damage ordering.
  value = Math.max(
    0,
    value - modifiers.filter((m) => m.kind === 'reduce').reduce((n, m) => n + (m.value ?? 0), 0),
  );
  for (const m of modifiers.filter((m) => m.kind === 'multiply'))
    value = Math.floor(value * (m.value ?? 1));
  if (modifiers.some((m) => m.kind === 'resistance')) value = Math.floor(value / 2);
  if (modifiers.some((m) => m.kind === 'vulnerability')) value *= 2;
  if (modifiers.some((m) => m.kind === 'immunity')) value = 0;
  return value;
}

export function queueRadsConsequence(
  core: CharacterCore,
  source: string,
  event: RadsConsequence,
): CharacterCore {
  const state = radsState(core),
    pending = state.pending ?? [];
  let index = pending.length;
  while (pending.some((e) => e.id === `event:${state.seconds}:${index}`)) index++;
  return withRads(core, {
    ...state,
    pending: [
      ...pending,
      { ...consequenceSchema.parse(event), id: `event:${state.seconds}:${index}`, source },
    ],
  });
}

export function modifierFamilyMatches(
  required: string | undefined,
  actual: string | undefined,
): boolean {
  return (
    !required ||
    required === actual ||
    (required === 'ranged' && actual !== undefined && actual !== 'melee')
  );
}
