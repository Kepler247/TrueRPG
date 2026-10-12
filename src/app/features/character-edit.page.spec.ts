import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../core/auth/auth.service';
import { createCore } from '../core/characters/character-core';
import { CharacterSheetService, SheetRecord } from '../core/characters/character-sheet.service';
import { CharacterEditPage } from './character-edit.page';

const record: SheetRecord = {
  row: {
    id: 'character',
    name: 'Courier',
    owner_id: 'player',
    system_id: 'wasteland',
    campaign_id: null,
    data: { core: createCore() },
    data_version: 2,
    updated_at: 'timestamp',
  },
  core: createCore(),
  canEdit: true,
  canManageCarryRules: false,
  enforceCarryWeight: true,
  ownerLabel: '@kepler',
  systemName: 'Wasteland',
};
describe('Character sheet', () => {
  const service = { load: vi.fn(), save: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    service.load.mockResolvedValue(structuredClone(record));
    service.save.mockImplementation(
      async (record: SheetRecord, name: string, core: SheetRecord['core']) => ({
        ...record,
        core,
        row: { ...record.row, name, data: { core }, updated_at: 'new-timestamp' },
      }),
    );
    TestBed.configureTestingModule({
      imports: [CharacterEditPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user: signal({ id: 'player' }) } },
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
    const fixture = TestBed.createComponent(CharacterEditPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  it('shows all six stats and 18 skills with the owner label', async () => {
    const fixture = await create();
    expect(fixture.nativeElement.textContent).toContain('@kepler');
    expect(fixture.componentInstance.stats).toHaveLength(6);
    expect(fixture.componentInstance.skills()).toHaveLength(18);
    expect(fixture.nativeElement.textContent).toContain('Sleight of Hand');
  });
  it('prevents editing a read-only party sheet', async () => {
    service.load.mockResolvedValue({ ...record, canEdit: false });
    const fixture = await create();
    const page = fixture.componentInstance;
    page.score('str', 18);
    page.addItem();
    await page.save();
    expect(page.core().scores.str).toBe(10);
    expect(page.core().inventory).toHaveLength(0);
    expect(service.save).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Read-only');
  });
  it('adds inventory and abilities and persists the sheet', async () => {
    const fixture = await create();
    const page = fixture.componentInstance;
    page.addItem();
    page.item(page.core().inventory[0].id, { name: 'Water', quantity: 2, weight: 3 });
    page.addAbility();
    page.ability(page.core().abilities[0].id, { name: 'Scavenger', kind: 'perk' });
    const updated = { ...record, core: structuredClone(page.core()) };
    service.save.mockResolvedValue(updated);
    await page.save();
    expect(service.save).toHaveBeenCalled();
    expect(page.dirty()).toBe(false);
    expect(page.weight()).toBe(6);
  });
  it('saves a level-up immediately and recalculates proficiency', async () => {
    const fixture = await create();
    const page = fixture.componentInstance;
    page.patch({ level: 4, hpMax: 20 });
    page.beginLevelUp();
    page.hpGain.set(5);
    page.newFeature.set('New perk');
    await page.applyLevelUp();
    expect(page.core().level).toBe(5);
    expect(page.core().hpMax).toBe(25);
    expect(page.pb()).toBe(3);
    expect(page.core().abilities[0].name).toBe('New perk');
    expect(page.dirty()).toBe(false);
    expect(service.save).toHaveBeenCalledTimes(1);
  });
  it('preserves edits when saving fails', async () => {
    const fixture = await create();
    const page = fixture.componentInstance;
    page.score('str', 18);
    service.save.mockRejectedValue(new Error('Conflict'));
    await page.save();
    expect(page.core().scores.str).toBe(18);
    expect(page.dirty()).toBe(true);
    expect(page.saving()).toBe(false);
  });
  it('requires the 501 Rads feat and applies stat increases, d10 HP, and retroactive Constitution', async () => {
    const core = createCore();
    core.class = 'Gunslinger';
    core.level = 2;
    core.hpMax = 20;
    core.scores.con = 13;
    service.load.mockResolvedValue({ ...record, rulesetKey: '501-rads', core });
    const fixture = await create();
    const page = fixture.componentInstance;
    page.beginLevelUp();
    page.allocate('con', 2);
    await page.applyLevelUp();
    expect(page.core().level).toBe(2);
    expect(page.error()).toContain('feat');
    page.newFeature.set('Test Feat (placeholder)');
    await page.applyLevelUp();
    expect(page.core().level).toBe(3);
    expect(page.core().scores.con).toBe(15);
    expect(page.core().hpMax).toBe(30);
    expect(page.core().abilities.some((a) => a.name === 'Dual Wield')).toBe(true);
    expect(page.dirty()).toBe(false);
    expect(service.save).toHaveBeenCalledTimes(1);
  });
  it('caps gains, multiplies only Heat gains, and blocks unaffordable costs', async () => {
    const core = createCore();
    core.class = 'Gunslinger';
    core.level = 7;
    core['heat'] = 7;
    service.load.mockResolvedValue({ ...record, rulesetKey: '501-rads', core });
    const page = (await create()).componentInstance;
    page.heatAmount.set(2);
    page.changeHeat(1);
    expect(page.heat()).toBe(9);
    page.changeHeat(-1);
    expect(page.heat()).toBe(7);
    page.heatAmount.set(8);
    page.changeHeat(-1);
    expect(page.heat()).toBe(7);
    expect(page.error()).toContain('Not enough');
    page.patch({ level: 12 });
    page.beginLevelUp();
    expect(page.leveling()).toBe(false);
  });
  it('retains an unsaved level-up after failure and prevents advancing twice on retry', async () => {
    const page = (await create()).componentInstance;
    page.patch({ hpMax: 20 });
    page.beginLevelUp();
    page.hpGain.set(5);
    service.save.mockRejectedValueOnce(new Error('Network failure'));
    await page.applyLevelUp();
    expect(page.core().level).toBe(2);
    expect(page.dirty()).toBe(true);
    expect(page.pendingLevelUp()).toBe(true);
    page.beginLevelUp();
    expect(page.leveling()).toBe(false);
    await page.save();
    expect(page.core().level).toBe(2);
    expect(page.core().hpMax).toBe(25);
    expect(page.pendingLevelUp()).toBe(false);
  });
});
