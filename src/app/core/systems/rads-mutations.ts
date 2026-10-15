import { activeEffects, addEffect, radsState, endRadsEffect } from './rads-engine';
import { z } from 'zod';
import { CharacterCore } from '../characters/character-core';
import { rollDie } from '../characters/dice';
import catalog from './rads-mutations.json';
export type MutationPolarity = 'positive' | 'negative';
export interface MutationDefinition {
  id: string;
  number: number;
  polarity: MutationPolarity;
  name: string;
  description: string;
}
const acquiredSchema = z
  .object({
    id: z.string(),
    number: z.number().int().min(1).max(100),
    polarity: z.enum(['positive', 'negative']),
    name: z.string(),
    description: z.string(),
    awardedAt: z.string().datetime(),
    revision: z.string(),
  })
  .passthrough();
export type AcquiredMutation = z.infer<typeof acquiredSchema>;
const recoverySchema = z
  .object({ minutes: z.literal(30), startedAt: z.string().datetime(), mutationId: z.string() })
  .passthrough();
export interface MutationView extends MutationDefinition {
  temporary: boolean;
  states: { id: string; name: string; mode: string; seconds?: number }[];
}
export type MutationTreatment = 'suppress' | 'amplify' | 'donate' | 'receive';
export interface MutationRules {
  views?: (core: CharacterCore) => MutationView[];
  treat?: (core: CharacterCore, id: string, treatment: MutationTreatment) => CharacterCore;
  endTreatment?: (core: CharacterCore, id: string) => CharacterCore;
  catalog: readonly MutationDefinition[];
  acquired: (core: CharacterCore) => AcquiredMutation[];
  draw: (core: CharacterCore, polarity: MutationPolarity) => MutationDefinition;
  award: (core: CharacterCore, mutation: MutationDefinition, death: boolean) => CharacterCore;
  recovering: (core: CharacterCore) => boolean;
  remove: (core: CharacterCore, id: string) => CharacterCore;
  finishRecovery: (core: CharacterCore) => CharacterCore;
}
export const RADS_MUTATIONS: readonly MutationDefinition[] = catalog as MutationDefinition[];
export function acquiredMutations(core: CharacterCore): AcquiredMutation[] {
  return z
    .array(acquiredSchema)
    .parse(core['radsMutations'] === undefined ? [] : core['radsMutations']);
}
function mutationHistory(core: CharacterCore): string[] {
  return z
    .array(z.string())
    .parse(core['radsMutationHistory'] === undefined ? [] : core['radsMutationHistory']);
}
export function removeMutation(core: CharacterCore, id: string): CharacterCore {
  const acquired = acquiredMutations(core);
  if (!acquired.some((m) => m.id === id)) throw new Error('Mutation is no longer present.');
  if (recovering(core) && recoverySchema.parse(core['radsReconstitution']).mutationId === id)
    throw new Error('Finish reconstitution before removing its mutation.');
  return {
    ...core,
    radsMutations: acquired.filter((m) => m.id !== id),
    radsMutationHistory: [...new Set([...mutationHistory(core), ...acquired.map((m) => m.id)])],
  };
}
export function drawMutation(
  core: CharacterCore,
  polarity: MutationPolarity,
  roll: (sides: number) => number = rollDie,
): MutationDefinition {
  const owned = new Set([
    ...mutationHistory(core),
    ...acquiredMutations(core).map((m) => m.id),
    ...activeEffects(core)
      .filter((e) => e.mutationMode === 'temporary')
      .map((e) => e.mutationId),
  ]);
  const pool = RADS_MUTATIONS.filter((m) => m.polarity === polarity && !owned.has(m.id));
  if (!pool.length)
    throw new Error(`You already have every ${polarity} mutation. No duplicate can be granted.`);
  const index = pool.length === 1 ? 0 : roll(pool.length) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= pool.length)
    throw new Error('Invalid mutation roll.');
  return pool[index];
}
export function recovering(core: CharacterCore): boolean {
  return core['radsReconstitution'] !== undefined && core['radsReconstitution'] !== null;
}
export function awardMutation(
  core: CharacterCore,
  mutation: MutationDefinition,
  death = false,
): CharacterCore {
  const definition = RADS_MUTATIONS.find((m) => m.id === mutation.id);
  if (!definition) throw new Error('Unknown mutation.');
  if (recovering(core)) throw new Error('Finish the current reconstitution first.');
  const acquired = acquiredMutations(core);
  if (acquired.some((m) => m.id === definition.id) || mutationHistory(core).includes(definition.id))
    throw new Error('This mutation is already present.');
  if (death && (definition.polarity !== 'negative' || core.hpMax === null))
    throw new Error('Death requires a negative mutation and a defined HP maximum.');
  const now = new Date().toISOString();
  return {
    ...core,
    radsMutationHistory: [
      ...new Set([...mutationHistory(core), ...acquired.map((m) => m.id), definition.id]),
    ],
    radsMutations: [...acquired, { ...definition, awardedAt: now, revision: 'mutations-1' }],
    ...(death
      ? {
          hpCurrent: 0,
          radsReconstitution: { minutes: 30, startedAt: now, mutationId: definition.id },
        }
      : {}),
  };
}
export function finishReconstitution(core: CharacterCore): CharacterCore {
  if (!recovering(core)) throw new Error('No reconstitution is pending.');
  recoverySchema.parse(core['radsReconstitution']);
  if (core.hpMax === null) throw new Error('Set maximum HP first.');
  return {
    ...core,
    hpCurrent: 1,
    radsReconstitution: null,
    radsReconstitutedAt: new Date().toISOString(),
  };
}
export function validateMutations(core: CharacterCore): void {
  const history = mutationHistory(core);
  if (
    history.some((id) => !RADS_MUTATIONS.some((m) => m.id === id)) ||
    new Set(history).size !== history.length
  )
    throw new Error('Saved mutation history is invalid or unsupported.');
  const acquired = acquiredMutations(core),
    ids = new Set<string>();
  for (const item of acquired) {
    const definition = RADS_MUTATIONS.find((m) => m.id === item.id);
    if (!definition || definition.polarity !== item.polarity || definition.number !== item.number)
      throw new Error('Saved mutation data is not supported by this rules revision.');
    if (ids.has(item.id)) throw new Error('Duplicate mutations are not allowed.');
    ids.add(item.id);
  }
  if (recovering(core)) {
    const recovery = recoverySchema.parse(core['radsReconstitution']);
    if (!acquired.some((m) => m.id === recovery.mutationId && m.polarity === 'negative'))
      throw new Error('Reconstitution must reference an acquired negative mutation.');
    if (core.hpCurrent !== 0)
      throw new Error(
        'A reconstituting character stays at 0 HP until 30 game minutes have elapsed.',
      );
  }
}
export const RADS_MUTATION_RULES: MutationRules = {
  views: mutationViews,
  treat: applyMutationTreatment,
  endTreatment: endRadsEffect,
  catalog: RADS_MUTATIONS,
  acquired: acquiredMutations,
  draw: drawMutation,
  award: awardMutation,
  recovering,
  remove: removeMutation,
  finishRecovery: finishReconstitution,
};

export function mutationViews(core: CharacterCore): MutationView[] {
  const effects = activeEffects(core),
    ids = new Set(acquiredMutations(core).map((m) => m.id));
  for (const effect of effects)
    if (effect.mutationMode === 'temporary' && effect.mutationId) ids.add(effect.mutationId);
  return [...ids].map((id) => {
    const definition = RADS_MUTATIONS.find((m) => m.id === id);
    if (!definition) throw new Error('Saved temporary mutation is unknown to this rules revision.');
    return {
      ...definition,
      temporary: !acquiredMutations(core).some((m) => m.id === id),
      states: effects
        .filter((e) => e.mutationId === id)
        .map((e) => ({
          id: e.id,
          name: e.name,
          mode: e.mutationMode ?? 'active',
          ...(e.expiresSecond !== undefined
            ? { seconds: Math.max(0, e.expiresSecond - radsState(core).seconds) }
            : {}),
        })),
    };
  });
}
export function applyMutationTreatment(
  core: CharacterCore,
  id: string,
  treatment: MutationTreatment,
): CharacterCore {
  const definition = RADS_MUTATIONS.find((m) => m.id === id);
  if (!definition) throw new Error('Choose a known mutation.');
  if (recovering(core)) throw new Error('Complete reconstitution before mutation treatment.');
  const effects = activeEffects(core),
    owned = mutationViews(core).find((m) => m.id === id),
    seconds = radsState(core).seconds;
  if (treatment === 'receive') {
    if (definition.polarity !== 'positive' || owned)
      throw new Error('Organ Donation cannot grant a characteristic already possessed.');
    return addEffect(core, {
      id: 'borrowed-' + id,
      name: 'Organ Donation: ' + definition.name,
      mutationId: id,
      mutationMode: 'temporary',
      modifiers: [],
      expiresSecond: seconds + 600,
      contextNote:
        definition.description +
        ' Borrowed for 10 minutes. The donor records loss separately; GM approves eligibility.',
    });
  }
  if (!owned) throw new Error('The character does not currently possess this mutation.');
  if (
    owned.states.some(
      (e) =>
        ['suppressed', 'inactive'].includes(e.mode) &&
        !(treatment === 'suppress' && e.id === 'suppressed-' + id),
    )
  )
    throw new Error('This mutation is currently suppressed or inactive.');
  if (treatment === 'suppress') {
    if (definition.polarity !== 'negative')
      throw new Error('Mutational Medicine suppresses only negative mutations.');
    if (effects.some((e) => e['treatment'] === 'mutational-medicine' && e.mutationId !== id))
      throw new Error('Only one Mutational Medicine suppression may be active.');
    return addEffect(core, {
      id: 'suppressed-' + id,
      name: 'Mutational Medicine: ' + definition.name,
      treatment: 'mutational-medicine',
      mutationId: id,
      mutationMode: 'suppressed',
      modifiers: [],
      expiresSecond: seconds + 1800,
      contextNote:
        'Negative mutation suppressed after one minute of examination and treatment. It returns unchanged after 30 minutes.',
    });
  }
  if (treatment === 'donate' && definition.polarity !== 'positive')
    throw new Error('Organ Donation transfers only eligible beneficial characteristics.');
  if (treatment === 'donate')
    return addEffect(core, {
      id: 'donated-' + id,
      name: 'Organ Donation (donor): ' + definition.name,
      mutationId: id,
      mutationMode: 'suppressed',
      modifiers: [],
      expiresSecond: seconds + 600,
      contextNote:
        'This characteristic is unavailable to the donor for 10 minutes. Record its receipt on the recipient separately; GM approves eligibility.',
    });
  if (definition.polarity !== 'positive')
    throw new Error('Experimental Evolution amplifies only positive mutations.');
  return addEffect(core, {
    id: 'amplified-' + id,
    name: 'Experimental Evolution: ' + definition.name,
    mutationId: id,
    mutationMode: 'amplified',
    modifiers: [],
    expiresSecond: seconds + 600,
    afterSeconds: 600,
    afterMutationMode: 'inactive',
    afterNote: 'This positive mutation is inactive for 10 minutes while the body recovers.',
    contextNote:
      'GM determines a substantial, appropriate enhancement. No numerical bonus is invented. After the enhancement ends, this mutation is inactive for 10 minutes.',
  });
}
