import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { RadsStatus } from './rads-status';
import { createCore, CharacterCore } from '../core/characters/character-core';
import { addEffect, radsState, withRads } from '../core/systems/rads-engine';
import { initializeRads } from '../core/systems/rads-rules';
import { classEffect } from '../core/systems/rads-abilities';

describe('Active effect presentation and controls', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [RadsStatus] }));
  function render(core: CharacterCore, canEdit = true) {
    const fixture = TestBed.createComponent(RadsStatus);
    fixture.componentRef.setInput('core', core);
    fixture.componentRef.setInput('canEdit', canEdit);
    fixture.detectChanges();
    return fixture;
  }
  const core = () => initializeRads({ ...createCore(), class: 'Psycho' });
  it('labels blue benefits, red drawbacks and gray contextual effects without depending on color', () => {
    let c = addEffect(core(), {
      id: 'benefit',
      name: 'Benefit',
      modifiers: [{ scope: 'attack', kind: 'advantage' }],
    });
    c = addEffect(c, {
      id: 'harm',
      name: 'Harm',
      modifiers: [{ scope: 'check', kind: 'disadvantage' }],
    });
    c = addEffect(c, {
      id: 'context',
      name: 'Context',
      modifiers: [],
      contextNote: 'GM chooses the target.',
    });
    const fixture = render(c);
    const cards = [...fixture.nativeElement.querySelectorAll('.effect')] as HTMLElement[];
    expect(cards[0].classList.contains('positive')).toBe(true);
    expect(cards[0].textContent).toContain('positive effect');
    expect(cards[1].classList.contains('negative')).toBe(true);
    expect(cards[1].textContent).toContain('negative effect');
    expect(cards[2].textContent).toContain('neutral effect');
    expect(cards[2].classList.contains('negative')).toBe(false);
  });
  it('shows both colors and the full original ability rule for mixed Meth effects', () => {
    const c = core();
    const fixture = render(addEffect(c, classEffect('Meth', c)!));
    const card = fixture.nativeElement.querySelector('.effect') as HTMLElement;
    expect(card.textContent).toContain('mixed effect');
    expect(card.querySelector('.modifier.positive')).not.toBeNull();
    expect(card.querySelector('.modifier.negative')).not.toBeNull();
    expect(card.querySelector('details')!.textContent).toContain('tolerance');
  });
  it('ending a SuperSoldier card emits its unconscious aftermath, rather than dropping the drawback', () => {
    const c = core(),
      fixture = render(addEffect(c, classEffect('SuperSoldier', c)!));
    let emitted: CharacterCore | undefined;
    fixture.componentInstance.action.subscribe((a) => (emitted = a.core));
    const button = [...fixture.nativeElement.querySelectorAll('button')].find((b: any) =>
      b.textContent.includes('End effect'),
    ) as HTMLButtonElement;
    button.click();
    expect(radsState(emitted!).effects[0].conditions).toContain('Unconscious');
  });
  it('read-only users cannot end effects, change conditions, or spend currency', () => {
    const fixture = render(core(), false);
    let emitted = false;
    fixture.componentInstance.action.subscribe(() => (emitted = true));
    fixture.componentInstance.money(1);
    fixture.componentInstance.conditionChange('Blinded', true);
    expect(emitted).toBe(false);
    expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(0);
  });
  it('rejects negative Receive amounts and grants temporary HP without stacking', () => {
    const c = withRads(core(), { ...radsState(core()), temporaryHP: 8 }),
      fixture = render(c);
    let emitted: CharacterCore | undefined;
    fixture.componentInstance.action.subscribe((a) => (emitted = a.core));
    fixture.componentInstance.amount = -5;
    fixture.componentInstance.money(1);
    expect(emitted).toBeUndefined();
    expect(fixture.componentInstance.error()).toContain('positive whole');
    fixture.componentInstance.temporaryHP = 3;
    fixture.componentInstance.grantTemporaryHP();
    expect(radsState(emitted!).temporaryHP).toBe(8);
  });
});
