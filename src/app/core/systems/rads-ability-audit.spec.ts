import { describe, it, expect } from 'vitest';
import { createCore, CharacterCore } from '../characters/character-core';
import { initializeRads } from './rads-rules';
import { activateRadsAbility } from './rads-abilities';
import { RADS_FEATURES } from './rads-definitions';
import { activeEffects, advanceRadsTime, endRadsEffect, resolveRadsRoll } from './rads-engine';
import {
  RADS_MUTATIONS,
  awardMutation,
  applyMutationTreatment,
  mutationViews,
} from './rads-mutations';
function medic(): CharacterCore {
  return { ...initializeRads({ ...createCore(), class: 'Medic', level: 12 }), malpractice: 100 };
}
function use(core: CharacterCore, name: string, choices: Record<string, string> = {}) {
  return activateRadsAbility(core, RADS_FEATURES.find((f) => f.name === name)!.id, choices);
}
describe('Medic choices and recipient isolation', () => {
  it('applies distinct self-prescription stats and expires after ten minutes', () => {
    const c = use(medic(), 'Questionable Prescription', { benefit: 'str', drawback: 'int' });
    expect(resolveRadsRoll(c, { scope: 'check', stat: 'str' }).mode).toBe('advantage');
    expect(resolveRadsRoll(c, { scope: 'check', stat: 'int' }).mode).toBe('disadvantage');
    expect(activeEffects(advanceRadsTime(c, 600)).length).toBe(0);
  });
  it('rejects identical stats without mutating the original', () => {
    const c = medic(),
      before = structuredClone(c);
    expect(() =>
      use(c, 'Questionable Prescription', { benefit: 'int', drawback: 'int' }),
    ).toThrow();
    expect(c).toEqual(before);
  });
  it('keeps received prescriptions secret and does not buff the Medic', () => {
    const c = use(medic(), 'Questionable Prescription', { recipient: 'other' });
    expect(c['malpractice']).toBe(98);
    expect(activeEffects(c).flatMap((e) => e.modifiers)).toEqual([]);
    expect(activeEffects(c)[0].contextNote).toContain('secret');
  });
});
describe('mutation treatment lifecycle', () => {
  const positive = RADS_MUTATIONS.find((m) => m.polarity === 'positive')!;
  const negative = RADS_MUTATIONS.find((m) => m.polarity === 'negative')!;
  function owned() {
    return awardMutation(awardMutation(medic(), positive), negative);
  }
  it('amplifies then disables then restores without removing the permanent mutation', () => {
    let c = applyMutationTreatment(owned(), positive.id, 'amplify');
    expect(mutationViews(c).find((m) => m.id === positive.id)!.states[0].mode).toBe('amplified');
    c = advanceRadsTime(c, 600);
    expect(mutationViews(c).find((m) => m.id === positive.id)!.states[0].mode).toBe('inactive');
    c = advanceRadsTime(c, 600);
    expect(mutationViews(c).find((m) => m.id === positive.id)!.states).toEqual([]);
  });
  it('manual End starts the required recovery phase', () => {
    let c = applyMutationTreatment(owned(), positive.id, 'amplify');
    c = endRadsEffect(c, 'amplified-' + positive.id);
    expect(mutationViews(c).find((m) => m.id === positive.id)!.states[0].mode).toBe('inactive');
  });
  it('borrowed mutations expire and cannot duplicate an existing characteristic', () => {
    const c = applyMutationTreatment(medic(), positive.id, 'receive');
    expect(() => applyMutationTreatment(c, positive.id, 'receive')).toThrow();
    expect(mutationViews(advanceRadsTime(c, 600))).toEqual([]);
    expect(() => applyMutationTreatment(owned(), positive.id, 'receive')).toThrow();
  });
  it('restricts suppression and donation to the source-defined polarity', () => {
    expect(() => applyMutationTreatment(owned(), positive.id, 'suppress')).toThrow();
    expect(() => applyMutationTreatment(owned(), negative.id, 'donate')).toThrow();
    expect(
      mutationViews(applyMutationTreatment(owned(), negative.id, 'suppress')).find(
        (m) => m.id === negative.id,
      )!.states[0].mode,
    ).toBe('suppressed');
  });
});

describe('all published active class abilities', () => {
  const resources: Record<string, string> = {
    Gunslinger: 'heat',
    Psycho: 'tolerance',
    Hacker: 'access',
    Medic: 'malpractice',
    Soldier: 'authority',
    Prophet: 'faith',
  };
  for (const feature of RADS_FEATURES.filter((f) => f.cost !== null)) {
    it(
      feature.class + ': ' + feature.name + ' spends its published cost and preserves unknown data',
      () => {
        let core: CharacterCore = {
          ...initializeRads({ ...createCore(), class: feature.class, level: 12 }),
          [resources[feature.class]]: 100,
          extensionForFuture: { keep: true },
        };
        core = awardMutation(
          core,
          RADS_MUTATIONS.find((m) => m.polarity === 'positive')!,
        );
        core = awardMutation(
          core,
          RADS_MUTATIONS.find((m) => m.polarity === 'negative')!,
        );
        const mutation = RADS_MUTATIONS.find(
          (m) => m.polarity === (feature.name === 'Mutational Medicine' ? 'negative' : 'positive'),
        )!;
        const next = activateRadsAbility(core, feature.id, {
          recipient: 'self',
          benefit: 'str',
          drawback: 'int',
          adaptation: 'night-vision',
          mutation: mutation.id,
        });
        expect(next[resources[feature.class]]).toBe(100 - feature.cost!);
        expect(next['extensionForFuture']).toEqual({ keep: true });
        expect(core[resources[feature.class]]).toBe(100);
      },
    );
  }
});
