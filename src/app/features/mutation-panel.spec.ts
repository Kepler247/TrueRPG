import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MutationPanel } from './mutation-panel';
import { createCore } from '../core/characters/character-core';
import { RADS_MUTATION_RULES } from '../core/systems/rads-mutations';
describe('Mutation picker', () => {
  function create(canEdit = true) {
    const fixture = TestBed.createComponent(MutationPanel);
    fixture.componentRef.setInput('core', { ...createCore(), hpMax: 12, hpCurrent: 12 });
    fixture.componentRef.setInput('rules', RADS_MUTATION_RULES);
    fixture.componentRef.setInput('canEdit', canEdit);
    fixture.detectChanges();
    return fixture;
  }
  it('reveals only after saved data contains the mutation and never redraws while pending', () => {
    vi.useFakeTimers();
    const f = create(),
      p = f.componentInstance;
    const emit = vi.spyOn(p.action, 'emit');
    p.begin('positive', false);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(p.saved()).toBe(false);
    expect(p.spinning()).toBe(true);
    p.begin('negative', false);
    expect(emit).toHaveBeenCalledTimes(1);
    const result = emit.mock.calls[0][0];
    f.componentRef.setInput('core', result.core);
    f.detectChanges();
    expect(p.saved()).toBe(true);
    vi.advanceTimersByTime(1800);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain(p.result()!.mutation.name);
    p.dismiss();
    expect(p.result()).toBeNull();
    f.destroy();
    vi.useRealTimers();
  });
  it('viewers and unsaved resource edits cannot grant a mutation', () => {
    const f = create(false),
      p = f.componentInstance,
      emit = vi.spyOn(p.action, 'emit');
    p.begin('positive', false);
    expect(emit).not.toHaveBeenCalled();
    f.componentRef.setInput('canEdit', true);
    f.componentRef.setInput('ready', false);
    f.detectChanges();
    p.begin('negative', true);
    expect(emit).not.toHaveBeenCalled();
    expect(p.error()).toContain('Save HP');
    f.destroy();
  });
  it('requires an explicit game-time confirmation to return at 1 HP', () => {
    const f = create(),
      p = f.componentInstance,
      emit = vi.spyOn(p.action, 'emit');
    const mutation = RADS_MUTATION_RULES.catalog.find((m) => m.polarity === 'negative')!;
    f.componentRef.setInput('core', RADS_MUTATION_RULES.award(p.core(), mutation, true));
    f.detectChanges();
    p.finish();
    expect(emit).not.toHaveBeenCalled();
    p.recoveryConfirmed.set(true);
    p.finish();
    expect(emit.mock.calls[0][0].core.hpCurrent).toBe(1);
    f.destroy();
  });
});
