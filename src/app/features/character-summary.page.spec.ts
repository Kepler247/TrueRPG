import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../core/auth/auth.service';
import { createCore } from '../core/characters/character-core';
import { CharacterSheetService, SheetRecord } from '../core/characters/character-sheet.service';
import { CharacterSummaryPage } from './character-summary.page';
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
        'textarea,select,mat-select,mat-checkbox,[contenteditable]',
      ).length,
    ).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('input').length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.stat-tile').length).toBe(6);
    expect(fixture.nativeElement.querySelectorAll('.skill-row').length).toBe(18);
    expect(fixture.nativeElement.textContent).toContain('Courier');
    expect(fixture.nativeElement.textContent).toContain('Water');
    expect(fixture.nativeElement.textContent).toContain('Scavenger');
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
    fixture.nativeElement.querySelector('button[aria-label="Roll Strength check"]').click();
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
    const gunslinger = rules.initialize!({ ...core, class: 'Gunslinger', heat: 3 });
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
    const gunslinger = rules.initialize!({ ...core, class: 'Gunslinger', heat: 3 });
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
    const gunslinger = rules.initialize!({ ...core, class: 'Gunslinger', heat: 3 });
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
});
