import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../core/auth/auth.service';
import { createCore } from '../core/characters/character-core';
import { CharacterSheetService, SheetRecord } from '../core/characters/character-sheet.service';
import { CharacterSummaryPage } from './character-summary.page';

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
  it('displays stats, skills, inventory, and abilities without any edit controls', async () => {
    const fixture = await create();
    expect(
      fixture.nativeElement.querySelectorAll(
        'input,textarea,select,mat-select,mat-checkbox,[contenteditable]',
      ).length,
    ).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.stat-tile').length).toBe(6);
    expect(fixture.nativeElement.querySelectorAll('.skill-row').length).toBe(18);
    expect(fixture.nativeElement.textContent).toContain('Courier');
    expect(fixture.nativeElement.textContent).toContain('Water');
    expect(fixture.nativeElement.textContent).toContain('Scavenger');
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
});
