import { createCore, CharacterCore } from '../characters/character-core';
import {
  acquiredMutations,
  awardMutation,
  drawMutation,
  removeMutation,
  finishReconstitution,
  RADS_MUTATIONS,
  validateMutations,
} from './rads-mutations';
describe('501 Rads mutations', () => {
  function core(): CharacterCore {
    return { ...createCore(), hpMax: 12, hpCurrent: 12, future: { keep: true } };
  }
  it('contains exactly 100 distinct positive and 100 distinct negative entries', () => {
    expect(RADS_MUTATIONS.filter((m) => m.polarity === 'positive')).toHaveLength(100);
    expect(RADS_MUTATIONS.filter((m) => m.polarity === 'negative')).toHaveLength(100);
    expect(new Set(RADS_MUTATIONS.map((m) => m.id)).size).toBe(200);
    expect(RADS_MUTATIONS.every((m) => m.description.length > 50)).toBe(true);
    expect(RADS_MUTATIONS.some((m) => m.description.includes('Well, dear reader'))).toBe(false);
  });
  it('draws only from unowned entries with no repeat and no arbitrary mutation cap', () => {
    let c = core();
    for (let i = 0; i < 100; i++) {
      const m = drawMutation(c, 'positive', () => 1);
      expect(m.number).toBe(i + 1);
      c = awardMutation(c, m);
    }
    expect(acquiredMutations(c)).toHaveLength(100);
    expect(() => drawMutation(c, 'positive')).toThrow('every positive');
    const negative = drawMutation(c, 'negative', () => 100);
    c = awardMutation(c, negative);
    expect(acquiredMutations(c)).toHaveLength(101);
    expect(c['future']).toEqual({ keep: true });
  });
  it('rejects duplicate awards and malformed duplicate saved data', () => {
    const m = RADS_MUTATIONS[0],
      c = awardMutation(core(), m);
    expect(() => awardMutation(c, m)).toThrow('already present');
    expect(() =>
      validateMutations({
        ...c,
        radsMutations: [...acquiredMutations(c), ...acquiredMutations(c)],
      }),
    ).toThrow('Duplicate');
  });
  it('death awards a negative mutation and stays at zero HP until confirmed recovery', () => {
    const negative = RADS_MUTATIONS.find((m) => m.polarity === 'negative')!;
    const c = awardMutation(core(), negative, true);
    expect(c.hpCurrent).toBe(0);
    expect(c['radsReconstitution']).toMatchObject({ minutes: 30, mutationId: negative.id });
    validateMutations(c);
    expect(() => validateMutations({ ...c, hpCurrent: 1 })).toThrow('stays at 0');
    expect(() => awardMutation(c, RADS_MUTATIONS[0])).toThrow('Finish');
    const restored = finishReconstitution(c);
    expect(restored.hpCurrent).toBe(1);
    expect(restored['radsReconstitution']).toBeNull();
    expect(acquiredMutations(restored)).toHaveLength(1);
    expect(restored['future']).toEqual({ keep: true });
  });
  it('ordinary mutation awards do not change HP and positive mutations cannot replace death', () => {
    expect(awardMutation(core(), RADS_MUTATIONS[0]).hpCurrent).toBe(12);
    expect(() => awardMutation(core(), RADS_MUTATIONS[0], true)).toThrow('negative');
    expect(() => finishReconstitution(core())).toThrow('No reconstitution');
  });
  it('removes a mutation while preserving history and excluding it from future draws', () => {
    const mutation = RADS_MUTATIONS[0];
    const removed = removeMutation(awardMutation(core(), mutation), mutation.id);
    expect(acquiredMutations(removed)).toEqual([]);
    expect(drawMutation(removed, 'positive', () => 1).id).not.toBe(mutation.id);
    expect(() => awardMutation(removed, mutation)).toThrow('already present');
    expect(removed['future']).toEqual({ keep: true });
    validateMutations(removed);
  });
  it('cannot remove the mutation responsible for a pending reconstitution', () => {
    const mutation = RADS_MUTATIONS.find((m) => m.polarity === 'negative')!;
    const pending = awardMutation(core(), mutation, true);
    expect(() => removeMutation(pending, mutation.id)).toThrow('Finish reconstitution');
    expect(acquiredMutations(removeMutation(finishReconstitution(pending), mutation.id))).toEqual(
      [],
    );
  });
});
