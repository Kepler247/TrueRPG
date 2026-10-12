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
  it('advances a draft level with HP input and recalculates proficiency', async () => {
    const fixture = await create();
    const page = fixture.componentInstance;
    page.patch({ level: 4, hpMax: 20 });
    page.beginLevelUp();
    page.hpGain.set(5);
    page.newFeature.set('New perk');
    page.applyLevelUp();
    expect(page.core().level).toBe(5);
    expect(page.core().hpMax).toBe(25);
    expect(page.pb()).toBe(3);
    expect(page.core().abilities[0].name).toBe('New perk');
    expect(page.dirty()).toBe(true);
    expect(service.save).not.toHaveBeenCalled();
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
});
