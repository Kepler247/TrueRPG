import { addEffect, endRadsEffect } from '../core/systems/rads-engine';
import { classEffect } from '../core/systems/rads-abilities';
import { RADS_CATALOG } from '../core/systems/rads-catalog';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../core/auth/auth.service';
import { createCore } from '../core/characters/character-core';
import { CharacterSheetService, SheetRecord } from '../core/characters/character-sheet.service';
import { CharacterSummaryPage } from './character-summary.page';
import { DNDS_CATALOG } from '../core/systems/dnds-catalog';
import { catalogInventory } from '../core/systems/system-catalog';
import { make501Rules } from '../core/systems/system-rules';
import { BASE_5E_RULES, CHARACTER_RULESETS } from '../core/characters/character-ruleset';

const core = createCore();
core.scores.str = 16;
core.hpMax = 20;
core.description = 'A traveler from the wastes.';
core.inventory = [
  { id: 'item', name: 'Water', quantity: 2, weight: 3, description: 'Clean water' },
];
core.abilities = [
  {
    id: 'ability',
    name: 'Scavenger',
    kind: 'perk',
    description: 'Find useful supplies.',
    spellLevel: null,
    usesMax: null,
  },
];
const record: SheetRecord = {
  row: {
    id: 'character',
    name: 'Courier',
    owner_id: 'player',
    system_id: 'wasteland',
    campaign_id: null,
    data: { core },
    data_version: 2,
    updated_at: 'timestamp',
  },
  core,
  canEdit: true,
  canManageCarryRules: false,
  enforceCarryWeight: true,
  ownerLabel: '@kepler',
  systemName: 'Wasteland',
};
describe('Read-only character summary', () => {
  const user = signal({ id: 'player' });
  const service = { load: vi.fn(), save: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    user.set({ id: 'player' });
    service.load.mockResolvedValue(structuredClone(record));
    service.save.mockImplementation(
      async (record: SheetRecord, _name: string, core: SheetRecord['core']) => ({
        ...record,
        core,
        row: { ...record.row, data: { ...record.row.data, core }, updated_at: 'new-timestamp' },
      }),
    );
    TestBed.configureTestingModule({
      imports: [CharacterSummaryPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user } },
        { provide: CharacterSheetService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'character' })),
            snapshot: { paramMap: convertToParamMap({ id: 'character' }) },
          },
        },
      ],
    });
  });
  async function create() {
    const fixture = TestBed.createComponent(CharacterSummaryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  it('keeps sheet fields informational while allowing quick HP changes', async () => {
    const fixture = await create();
    expect(
      fixture.nativeElement.querySelectorAll(
        'textarea,select:not(.inventory-lookup select),mat-select,mat-checkbox,[contenteditable]',
      ).length,
    ).toBe(0);
    expect(
      [...fixture.nativeElement.querySelectorAll('input')].filter(
        (input: Element) => !input.closest('.inventory-lookup'),
      ).length,
    ).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.stat-tile').length).toBe(6);
    expect(fixture.nativeElement.querySelectorAll('.skill-row').length).toBe(18);
    expect(fixture.nativeElement.textContent).toContain('Courier');
    expect(fixture.nativeElement.textContent).toContain('Water');
    expect(fixture.nativeElement.textContent).toContain('Scavenger');
    expect(service.save).not.toHaveBeenCalled();
  });
  it('looks up system items, previews their rules and saves the requested quantity', async () => {
    const fixture = await create(),
      page = fixture.componentInstance;
    page.itemQuery.set('test water');
    expect(page.itemMatches().map((item) => item.id)).toEqual(['test-water']);
    page.selectedItemId.set('test-water');
    page.itemQuantity.set(3);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.item-preview').textContent).toContain(
      'Testing placeholder',
    );
    await page.addCatalogItem();
    const added = page.record()!.core.inventory.at(-1)!;
    expect(added.quantity).toBe(3);
    expect(added['catalogId']).toBe('test-water');
    await page.consumeItem(added.id);
    expect(page.record()!.core.inventory.at(-1)!.quantity).toBe(2);
    expect(page.record()!.core.hpCurrent).toBe(core.hpCurrent);
  });
  it('retains the exact added item after a failed save and rejects invalid quantities', async () => {
    const fixture = await create(),
      page = fixture.componentInstance;
    page.selectedItemId.set('test-water');
    page.itemQuantity.set(0);
    await page.addCatalogItem();
    expect(service.save).not.toHaveBeenCalled();
    page.itemQuantity.set(2);
    service.save.mockRejectedValueOnce(new Error('Offline'));
    await page.addCatalogItem();
    const pending = page.pendingAction()!.core;
    await page.addCatalogItem();
    expect(service.save).toHaveBeenCalledTimes(1);
    await page.retryAction();
    expect(service.save.mock.calls[1][2]).toBe(pending);
    expect(
      page.record()!.core.inventory.filter((item) => item['catalogId'] === 'test-water'),
    ).toHaveLength(1);
  });
  it('prevents viewers from adding and consuming items', async () => {
    service.load.mockResolvedValue({ ...structuredClone(record), canEdit: false });
    const fixture = await create(),
      page = fixture.componentInstance;
    expect(fixture.nativeElement.querySelector('.inventory-lookup')).toBeNull();
    page.selectedItemId.set('test-water');
    await page.addCatalogItem();
    await page.consumeItem('item');
    expect(service.save).not.toHaveBeenCalled();
  });
  it('retains a failed rest result for retry and prevents intervening inventory writes', async () => {
    service.load.mockResolvedValue({
      ...structuredClone(record),
      rulesetKey: '501-rads',
      core: { ...structuredClone(core), class: 'Gunslinger', hpCurrent: 5 },
    });
    const fixture = await create();
    const page = fixture.componentInstance;
    page.restConfirmed.set(true);
    service.save.mockRejectedValueOnce(new Error('Offline'));
    await page.rest('short', true);
    const pending = page.pendingAction()!.core;
    expect(pending.hitDiceSpent).toBe(1);
    await page.inventoryAction('item', 'add');
    expect(service.save).toHaveBeenCalledTimes(1);
    await page.retryAction();
    expect(service.save.mock.calls[1][2]).toBe(pending);
    expect(page.pendingAction()).toBeNull();
    expect(page.record()!.core.hpCurrent).toBe(pending.hpCurrent);
  });
  it('prevents viewers from resting or changing inventory', async () => {
    service.load.mockResolvedValue({ ...structuredClone(record), canEdit: false });
    const fixture = await create();
    const page = fixture.componentInstance;
    page.restConfirmed.set(true);
    await page.rest('long');
    await page.inventoryAction('item', 'remove');
    expect(service.save).not.toHaveBeenCalled();
  });
  it('links edit and level-up actions to the dedicated edit route', async () => {
    const fixture = await create();
    const links: HTMLAnchorElement[] = [...fixture.nativeElement.querySelectorAll('a')];
    expect(
      links.find((link) => link.textContent?.trim() === 'Edit character')?.getAttribute('href'),
    ).toBe('/characters/character/edit');
    expect(
      links.find((link) => link.textContent?.trim() === 'Level up')?.getAttribute('href'),
    ).toBe('/characters/character/edit?levelUp=1');
  });
  it('hides edit actions for read-only party members', async () => {
    service.load.mockResolvedValue({ ...record, canEdit: false });
    const fixture = await create();
    expect(fixture.nativeElement.textContent).not.toContain('Edit character');
    expect(fixture.nativeElement.textContent).not.toContain('Level up');
    expect(fixture.nativeElement.querySelectorAll('input').length).toBe(0);
  });
  it('keeps campaign carrying rules informational on the main page', async () => {
    service.load.mockResolvedValue({
      ...record,
      canManageCarryRules: true,
      enforceCarryWeight: false,
    });
    const fixture = await create();
    expect(fixture.nativeElement.textContent).toContain('Carrying capacity is disabled');
    expect(fixture.nativeElement.querySelector('mat-checkbox')).toBeNull();
  });
  it('provides a retry when loading fails', async () => {
    service.load.mockRejectedValue(new Error('Character not found, or you do not have access.'));
    const fixture = await create();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Character not found',
    );
    expect(fixture.nativeElement.textContent).toContain('Retry loading');
  });
  it('saves damage and healing immediately while preserving other character data', async () => {
    const page = (await create()).componentInstance;
    page.hpAmount.set(7);
    await page.changeHp(-1);
    expect(page.hp()).toBe(13);
    expect(page.record()?.core.hpMax).toBe(20);
    expect(page.record()?.core.abilities).toEqual(core.abilities);
    page.hpAmount.set(100);
    await page.changeHp(-1);
    expect(page.hp()).toBe(0);
    await page.changeHp(1);
    expect(page.hp()).toBe(20);
    expect(service.save).toHaveBeenCalledTimes(3);
  });
  it('preserves entered values on a failed resource save', async () => {
    const page = (await create()).componentInstance;
    service.save.mockRejectedValueOnce(new Error('The character changed. Reload before saving.'));
    page.hpInput.set(4);
    await page.saveVitals();
    expect(page.hp()).toBe(20);
    expect(page.hpInput()).toBe(4);
    expect(page.saving()).toBe(false);
    await page.saveVitals();
    expect(page.hp()).toBe(4);
  });
  it('applies Heat multipliers/caps and spends without multiplying costs', async () => {
    service.load.mockResolvedValue({
      ...record,
      rulesetKey: '501-rads',
      core: { ...core, class: 'Gunslinger', level: 7, heat: 7 },
    });
    const page = (await create()).componentInstance;
    page.heatAmount.set(2);
    await page.changeHeat(1);
    expect(page.heat()).toBe(9);
    await page.changeHeat(-1);
    expect(page.heat()).toBe(7);
    page.heatAmount.set(8);
    await page.changeHeat(-1);
    expect(page.error()).toContain('Not enough');
    expect(service.save).toHaveBeenCalledTimes(2);
  });
  it('blocks invalid values and read-only resource writes', async () => {
    const page = (await create()).componentInstance;
    page.hpInput.set(21);
    await page.saveVitals();
    expect(service.save).not.toHaveBeenCalled();
    page.record.update((r) => (r ? { ...r, canEdit: false } : null));
    page.hpInput.set(2);
    await page.saveVitals();
    expect(service.save).not.toHaveBeenCalled();
  });
  it('rolls the displayed Strength modifier without saving sheet data', async () => {
    const fixture = await create();
    const random = vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      (array as Uint32Array)[0] = 19;
      return array;
    });
    fixture.nativeElement.querySelector('button[aria-label^="Roll Strength check"]').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.lastRoll()?.total).toBe(23);
    expect(fixture.nativeElement.querySelector('.roll-result').textContent).toContain(
      'd20 (20) +3 = 23',
    );
    expect(service.save).not.toHaveBeenCalled();
    random.mockRestore();
  });
  it('blocks repeated resource actions while a save is pending', async () => {
    let resolve!: (record: SheetRecord) => void;
    service.save.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const page = (await create()).componentInstance;
    page.hpAmount.set(3);
    const pending = page.changeHp(-1);
    await page.changeHp(-1);
    expect(service.save).toHaveBeenCalledTimes(1);
    resolve({ ...record, core: { ...core, hpCurrent: 17 } });
    await pending;
    expect(page.hp()).toBe(17);
  });
  it('uses adapter-defined names and storage for a different class resource', async () => {
    TestBed.overrideProvider(CHARACTER_RULESETS, {
      useValue: {
        base5e: {
          ...BASE_5E_RULES,
          classResource: () => ({
            id: 'test-focus',
            name: 'Focus',
            current: (core: SheetRecord['core']) => Number(core['focus'] ?? 0),
            setCurrent: (core: SheetRecord['core'], value: number) => ({ ...core, focus: value }),
            maximum: () => 5,
            gainMultiplier: () => 1,
            help: 'Test fixture only.',
          }),
        },
      },
    });
    service.load.mockResolvedValue({ ...record, core: { ...core, focus: 2 } });
    const fixture = await create();
    const page = fixture.componentInstance;
    page.heatAmount.set(2);
    await page.changeHeat(1);
    expect(page.record()?.core['focus']).toBe(4);
    expect(page.record()?.core['heat']).toBeUndefined();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Gain Focus');
  });
  it('charges Lucky Strike once and replaces the previous check with its reroll', async () => {
    const rules = make501Rules(BASE_5E_RULES);
    const gunslinger = { ...rules.initialize!({ ...core, class: 'Gunslinger' }), heat: 3 };
    service.load.mockResolvedValue({ ...record, rulesetKey: '501-rads', core: gunslinger });
    const page = (await create()).componentInstance;
    page.roll('Dexterity', 2);
    const id = page.record()!.core.abilities.find((ability) => ability.name === 'Lucky Strike')!.id;
    await page.useAbility(id);
    expect(page.heat()).toBe(2);
    expect(page.record()?.core.abilityUses?.[id]).toBe(1);
    expect(page.lastRoll()?.label).toBe('Dexterity');
    expect(service.save).toHaveBeenCalledTimes(1);
  });
  it('offers three results for Stroke of Genius without charging again when chosen', async () => {
    const rules = make501Rules(BASE_5E_RULES);
    const gunslinger = { ...rules.initialize!({ ...core, class: 'Gunslinger' }), heat: 3 };
    service.load.mockResolvedValue({ ...record, rulesetKey: '501-rads', core: gunslinger });
    const page = (await create()).componentInstance;
    const id = page
      .record()!
      .core.abilities.find((ability) => ability.name === 'Stroke of Genius')!.id;
    await page.useAbility(id);
    page.roll('Charisma', 4);
    expect(page.rollChoices()).toHaveLength(3);
    expect(page.heat()).toBe(0);
    const chosen = page.rollChoices()[1];
    page.chooseRoll(1);
    expect(page.lastRoll()).toEqual(chosen);
    expect(service.save).toHaveBeenCalledTimes(1);
  });
  it('does not spend resources or apply an ability roll after a failed save', async () => {
    const rules = make501Rules(BASE_5E_RULES);
    const gunslinger = { ...rules.initialize!({ ...core, class: 'Gunslinger' }), heat: 3 };
    service.load.mockResolvedValue({ ...record, rulesetKey: '501-rads', core: gunslinger });
    const page = (await create()).componentInstance;
    page.roll('Dexterity', 2);
    const previous = page.lastRoll();
    service.save.mockRejectedValueOnce(new Error('Conflict'));
    await page.useAbility(
      page.record()!.core.abilities.find((ability) => ability.name === 'Lucky Strike')!.id,
    );
    expect(page.heat()).toBe(3);
    expect(page.lastRoll()).toEqual(previous);
    expect(page.error()).toBe('Conflict');
  });
  it('preserves a failed manual ammunition change and retries the exact counter snapshot', async () => {
    const weapon = catalogInventory(
      DNDS_CATALOG.find((e) => e.name === 'Pistol')!,
      'dnds',
    );
    weapon.equipped = true;
    service.load.mockResolvedValue({
      ...structuredClone(record),
      rulesetKey: 'dnds',
      core: { ...structuredClone(core), inventory: [weapon] },
    });
    const page = (await create()).componentInstance;
    service.save.mockRejectedValueOnce(new Error('Offline'));
    await page.adjustWeaponAmmo(weapon.id, -1);
    const pending = page.pendingAction()!;
    expect(pending.core.inventory[0]['chargesRemaining']).toBe(9);
    expect(page.record()!.core.inventory[0]['chargesRemaining']).toBe(10);
    await page.retryAction();
    expect(service.save.mock.calls[1][2]).toBe(pending.core);
    expect(page.message()).toBe(pending.message);
    expect(page.record()!.core.inventory[0]['chargesRemaining']).toBe(9);
  });
  it('retains a death mutation on failed save and returns at 1 HP only after recovery', async () => {
    service.load.mockResolvedValue({ ...structuredClone(record), rulesetKey: '501-rads' });
    const page = (await create()).componentInstance;
    const rules = page.rules().mutations!,
      mutation = rules.draw(page.record()!.core, 'negative');
    const death = rules.award(page.record()!.core, mutation, true);
    service.save.mockRejectedValueOnce(new Error('Offline'));
    await page.savePlayAction(death, 'Reconstituting');
    expect(page.pendingAction()!.core).toBe(death);
    expect(page.record()!.core.hpCurrent).toBeUndefined();
    await page.retryAction();
    expect(page.record()!.core.hpCurrent).toBe(0);
    expect(page.recovering()).toBe(true);
    expect(rules.acquired(page.record()!.core)).toHaveLength(1);
    await page.savePlayAction(rules.finishRecovery(page.record()!.core), 'Returned');
    expect(page.record()!.core.hpCurrent).toBe(1);
    expect(page.recovering()).toBe(false);
    expect(rules.acquired(page.record()!.core)[0].id).toBe(mutation.id);
  });
  it('shows physical weapon formulas to party viewers without attack settings or save side effects', async () => {
    const rules = make501Rules(BASE_5E_RULES);
    const weapon = {
      ...catalogInventory(
        RADS_CATALOG.find((e) => e.name === '9mm Service Pistol')!,
        '501-rads',
      ),
      equipped: true,
    };
    const character = rules.initialize!({
      ...structuredClone(core),
      class: 'Gunslinger',
      scores: { ...core.scores, dex: 16 },
    });
    service.load.mockResolvedValue({
      ...structuredClone(record),
      canEdit: false,
      rulesetKey: '501-rads',
      core: { ...character, inventory: [weapon] },
    });
    const fixture = await create(),
      text = fixture.nativeElement.textContent;
    expect(text).toContain('Attack roll');
    expect(text).toContain('d20 + 7');
    expect(text).toContain('Damage roll');
    expect(text).toContain('1d8 + 4 Ballistic');
    expect(text).not.toContain('Weapon attack settings');
    expect(text).not.toContain('Target AC');
    expect(text).not.toContain('Distance (ft)');
    expect(
      [...fixture.nativeElement.querySelectorAll('button')].some(
        (b: any) => b.textContent.trim() === 'Attack',
      ),
    ).toBe(false);
    expect(service.save).not.toHaveBeenCalled();
  });
  it('hides every carry-weight total and warning in 501, including unspecified item weights', async () => {
    const rules = make501Rules(BASE_5E_RULES);
    const character = rules.initialize!({ ...structuredClone(core), class: 'Gunslinger' });
    service.load.mockResolvedValue({
      ...structuredClone(record),
      rulesetKey: '501-rads',
      core: {
        ...character,
        inventory: [{ ...character.inventory[0], weight: 99999, weightKnown: false }],
      },
    });
    const fixture = await create(),
      text = fixture.nativeElement.textContent.toLowerCase();
    expect(text).not.toContain('lb carried');
    expect(text).not.toContain('carrying capacity');
    expect(text).not.toContain('weight unspecified');
    expect(text).not.toContain('99999');
    expect(fixture.nativeElement.querySelector('.damage-type-control select')).not.toBeNull();
  });
  it('marks Meth-affected Intelligence stats and skills with D, leaves saves normal, and clears after End', async () => {
    const rules = make501Rules(BASE_5E_RULES);
    let character = rules.initialize!({
      ...structuredClone(core),
      class: 'Psycho',
      level: 4,
      scores: { ...core.scores, int: 12 },
    });
    character = addEffect(character, classEffect('Meth', character)!);
    service.load.mockResolvedValue({
      ...structuredClone(record),
      rulesetKey: '501-rads',
      core: character,
    });
    const fixture = await create();
    const stat = () =>
      [...fixture.nativeElement.querySelectorAll('.stat-tile')].find(
        (el: any) => el.querySelector('.stat-name')?.textContent === 'Intelligence',
      ) as HTMLElement;
    const hacking = () =>
      [...fixture.nativeElement.querySelectorAll('.skill-row')].find(
        (el: any) => el.querySelector('strong')?.textContent === 'Hacking',
      ) as HTMLElement;
    expect(stat().querySelector('.modifier')!.textContent!.trim()).toBe('+1 D');
    expect(hacking().querySelector('button')!.textContent!.trim()).toBe('+1 D');
    expect(hacking().querySelector('button')!.getAttribute('aria-label')).toContain('disadvantage');
    expect(hacking().querySelector('button')!.classList.contains('check-disadvantage')).toBe(true);
    expect(stat().querySelector('.save')!.textContent).not.toContain('D');
    await fixture.componentInstance.savePlayAction(endRadsEffect(character, 'meth'), 'Meth ended.');
    fixture.detectChanges();
    expect(stat().querySelector('.modifier')!.textContent!.trim()).toBe('+1');
    expect(hacking().querySelector('button')!.textContent!.trim()).toBe('+1');
  });
  it('shows A for an applicable advantage and removes it when opposing disadvantage cancels', async () => {
    const rules = make501Rules(BASE_5E_RULES);
    let character = rules.initialize!({
      ...structuredClone(core),
      class: 'Psycho',
      level: 4,
      scores: { ...core.scores, int: 12 },
    });
    character = addEffect(character, classEffect('IntelliBoostPro', character)!);
    service.load.mockResolvedValue({
      ...structuredClone(record),
      rulesetKey: '501-rads',
      core: character,
    });
    const fixture = await create();
    const hacking = () =>
      [...fixture.nativeElement.querySelectorAll('.skill-row')].find(
        (el: any) => el.querySelector('strong')?.textContent === 'Hacking',
      ) as HTMLElement;
    expect(hacking().querySelector('button')!.textContent!.trim()).toBe('+1 A');
    expect(hacking().querySelector('button')!.classList.contains('check-advantage')).toBe(true);
    await fixture.componentInstance.savePlayAction(
      addEffect(character, classEffect('Meth', character)!),
      'Meth activated.',
    );
    fixture.detectChanges();
    expect(hacking().querySelector('button')!.textContent!.trim()).toBe('+1');
    expect(hacking().querySelector('button')!.classList.contains('check-advantage')).toBe(false);
  });
});
