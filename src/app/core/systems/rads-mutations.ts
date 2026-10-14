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
export interface MutationRules {
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
  const owned = new Set([...mutationHistory(core), ...acquiredMutations(core).map((m) => m.id)]);
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
  catalog: RADS_MUTATIONS,
  acquired: acquiredMutations,
  draw: drawMutation,
  award: awardMutation,
  recovering,
  remove: removeMutation,
  finishRecovery: finishReconstitution,
};
