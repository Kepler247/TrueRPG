import {
  BASE_5E_RULES,
  CHARACTER_RULESETS,
  extendRuleset,
} from '../core/characters/character-ruleset';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from '../core/auth/auth.service';
import { AdventureContext, AdventureService } from '../core/adventures/adventure.service';
import { AdventureCollection } from './adventure-collection';

const player = { id: 'player-id' };
const campaign = {
  id: 'campaign-id',
  name: 'The Long Road',
  owner_id: player.id,
  system_id: 'wasteland',
  description: 'Across the wastes.',
};
const character = {
  id: 'character-id',
  name: 'Courier',
  owner_id: player.id,
  system_id: 'wasteland',
  campaign_id: null,
};
const context: AdventureContext = {
  systems: [
    { id: 'wasteland', name: 'Wasteland' },
    { id: 'fantasy', name: 'Fantasy' },
  ],
  profiles: [{ id: player.id, username: 'kepler', display_name: '' }],
  campaigns: [
    campaign,
    { ...campaign, id: 'wrong-system', system_id: 'fantasy' },
    { ...campaign, id: 'not-a-member' },
  ],
  characters: [],
  memberCampaignIds: [campaign.id, 'wrong-system'],
};
describe('Adventure creation and lists', () => {
  const user = signal<typeof player | null>(player);
  const adventures = { load: vi.fn(), createCampaign: vi.fn(), createCharacter: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    user.set(player);
    // Exercise accidental reactive tracking through service methods too.
    adventures.load.mockImplementation(async () => {
      user();
      return structuredClone(context);
    });
    adventures.createCampaign.mockResolvedValue(campaign);
    adventures.createCharacter.mockResolvedValue(character);
    TestBed.configureTestingModule({
      imports: [AdventureCollection],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user } },
        { provide: AdventureService, useValue: adventures },
      ],
    });
  });
  async function create(kind: 'campaigns' | 'characters' = 'characters') {
    const fixture = TestBed.createComponent(AdventureCollection);
    fixture.componentRef.setInput('kind', kind);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  it('shows usernames and system names for saved campaigns', async () => {
    const fixture = await create('campaigns');
    expect(fixture.nativeElement.textContent).toContain('@kepler');
    expect(fixture.nativeElement.textContent).toContain('Wasteland');
    expect(fixture.nativeElement.textContent).toContain('The Long Road');
  });
  it('offers only matching campaigns where the player is a member', async () => {
    const fixture = await create();
    fixture.componentInstance.startCreate();
    expect(fixture.componentInstance.eligibleCampaigns().map((c) => c.id)).toEqual([campaign.id]);
    fixture.componentInstance.form.controls.campaignId.setValue(campaign.id);
    fixture.componentInstance.form.controls.systemId.setValue('fantasy');
    fixture.componentInstance.changeSystem();
    expect(fixture.componentInstance.form.controls.campaignId.value).toBe('');
    expect(fixture.componentInstance.eligibleCampaigns().map((c) => c.id)).toEqual([
      'wrong-system',
    ]);
  });
  it('creates an independent character and shows its confirmed row', async () => {
    const fixture = await create();
    const page = fixture.componentInstance;
    page.startCreate();
    page.form.controls.name.setValue('  Courier  ');
    await page.create();
    fixture.detectChanges();
    expect(adventures.createCharacter).toHaveBeenCalledWith(
      'Courier',
      'wasteland',
      null,
      expect.objectContaining({ level: 1, inventory: [], abilities: [] }),
    );
    expect(fixture.nativeElement.textContent).toContain('Courier');
    expect(fixture.nativeElement.textContent).toContain('No campaign');
    expect(page.creating()).toBe(false);
  });
  it('stores physical details and point-buy scores in the new sheet', async () => {
    const fixture = await create();
    const page = fixture.componentInstance;
    page.startCreate();
    page.pointBuyScores.set({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 });
    page.form.patchValue({
      name: 'Courier',
      description: 'From the wastes',
      heightInches: 72,
      bodyWeightPounds: 180,
    });
    await page.create();
    expect(adventures.createCharacter).toHaveBeenCalledWith(
      'Courier',
      'wasteland',
      null,
      expect.objectContaining({
        description: 'From the wastes',
        heightInches: 72,
        bodyWeightPounds: 180,
        scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
      }),
    );
  });
  it('shows and saves race/class choices only when the system supplies them', async () => {
    TestBed.overrideProvider(CHARACTER_RULESETS, {
      useValue: {
        base5e: extendRuleset(BASE_5E_RULES, { creator: { races: ['Human'], classes: ['Scout'] } }),
      },
    });
    const fixture = await create();
    const page = fixture.componentInstance;
    page.startCreate();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Race');
    page.form.patchValue({ name: 'Courier', race: 'Human', class: 'Scout' });
    await page.create();
    expect(adventures.createCharacter).toHaveBeenCalledWith(
      'Courier',
      'wasteland',
      null,
      expect.objectContaining({ race: 'Human', class: 'Scout' }),
    );
  });
  it('does not submit whitespace-only names', async () => {
    const fixture = await create();
    fixture.componentInstance.startCreate();
    fixture.componentInstance.form.controls.name.setValue('   ');
    await fixture.componentInstance.create();
    expect(adventures.createCharacter).not.toHaveBeenCalled();
  });
  it('blocks a forged campaign selection before submission', async () => {
    const fixture = await create();
    const page = fixture.componentInstance;
    page.startCreate();
    page.form.controls.name.setValue('Courier');
    page.form.controls.campaignId.setValue('not-a-member');
    await page.create();
    expect(adventures.createCharacter).not.toHaveBeenCalled();
    expect(page.error()).toContain('same system');
  });
  it('creates a campaign and preserves its description', async () => {
    const fixture = await create('campaigns');
    const page = fixture.componentInstance;
    page.startCreate();
    page.form.controls.name.setValue('The Long Road');
    page.form.controls.description.setValue('Across the wastes.');
    await page.create();
    expect(adventures.createCampaign).toHaveBeenCalledWith(
      'The Long Road',
      'wasteland',
      'Across the wastes.',
    );
    expect(page.message()).toContain('GM');
  });
  it('preserves the form after failed creation for retry', async () => {
    adventures.createCharacter.mockRejectedValue(
      new Error('Could not create the character. Please retry.'),
    );
    const fixture = await create();
    const page = fixture.componentInstance;
    page.startCreate();
    page.form.controls.name.setValue('Courier');
    await page.create();
    expect(page.creating()).toBe(true);
    expect(page.form.controls.name.value).toBe('Courier');
    expect(page.saving()).toBe(false);
  });
  it('prevents duplicate submissions while creation is pending', async () => {
    let resolve!: (value: typeof character) => void;
    adventures.createCharacter.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const fixture = await create();
    const page = fixture.componentInstance;
    page.startCreate();
    page.form.controls.name.setValue('Courier');
    const pending = page.create();
    await page.create();
    expect(adventures.createCharacter).toHaveBeenCalledTimes(1);
    resolve(character);
    await pending;
  });
  it('keeps a creation draft during a session refresh', async () => {
    const fixture = await create();
    const page = fixture.componentInstance;
    page.startCreate();
    page.form.controls.name.setValue('Draft');
    user.set({ ...player });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(adventures.load).toHaveBeenCalledTimes(1);
    expect(page.form.controls.name.value).toBe('Draft');
  });
  it('provides a retry path after failed loading', async () => {
    adventures.load.mockRejectedValue(new Error('Could not load your adventures. Please retry.'));
    const fixture = await create();
    expect(fixture.nativeElement.textContent).toContain('Retry loading');
    expect(fixture.componentInstance.loaded()).toBe(false);
  });
});
