import { CharacterSheetService } from './core/characters/character-sheet.service';
import { createCore } from './core/characters/character-core';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from './core/auth/auth.service';
import { AdventureService } from './core/adventures/adventure.service';
import { routes } from './app.routes';

describe('Feature navigation', () => {
  const user = signal<{ email: string } | null>(null);
  beforeEach(() => {
    user.set({ email: 'player@example.com' });
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        {
          provide: CharacterSheetService,
          useValue: {
            load: async () => ({
              row: {
                id: 'character',
                name: 'Courier',
                owner_id: 'player',
                system_id: 'wasteland',
                campaign_id: null,
                data: {},
                data_version: 1,
                updated_at: 'timestamp',
              },
              core: createCore(),
              canEdit: true,
              canManageCarryRules: false,
              enforceCarryWeight: true,
              ownerLabel: '@kepler',
              systemName: 'Wasteland',
            }),
          },
        },
        {
          provide: AdventureService,
          useValue: {
            load: async () => ({
              systems: [],
              profiles: [],
              campaigns: [],
              characters: [],
              memberCampaignIds: [],
            }),
          },
        },
        {
          provide: AuthService,
          useValue: {
            user,
            ready: Promise.resolve(),
            initializing: signal(false),
            initializationError: signal(null),
          },
        },
      ],
    });
  });

  it('opens characters by default for a signed-in player', async () => {
    const harness = await RouterTestingHarness.create('/');
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent?.trim()).toBe('Characters');
  });

  it('opens the lazy campaign page', async () => {
    const harness = await RouterTestingHarness.create('/campaigns');
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent?.trim()).toBe('Campaigns');
  });

  it('opens the read-only summary for the main character URL', async () => {
    const harness = await RouterTestingHarness.create('/characters/character');
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Courier');
    expect(harness.routeNativeElement?.querySelector('textarea')).toBeNull();
  });
  it('opens the character creator instead of treating new as a character ID', async () => {
    const harness = await RouterTestingHarness.create('/characters/new');
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent?.trim()).toBe(
      'Character creator',
    );
  });
  it('opens controls only on the dedicated edit URL', async () => {
    const harness = await RouterTestingHarness.create('/characters/character/edit');
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Edit Courier');
    expect(harness.routeNativeElement?.querySelector('input')).not.toBeNull();
  });
  it('opens the level-up workflow on the edit page from its summary action', async () => {
    const harness = await RouterTestingHarness.create('/characters/character/edit?levelUp=1');
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Advance to level 2');
  });

  it('redirects a signed-out player to sign-in', async () => {
    user.set(null);
    const harness = await RouterTestingHarness.create('/characters');
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Welcome back');
  });
});
