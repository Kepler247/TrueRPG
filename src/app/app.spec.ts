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
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Characters');
  });

  it('opens the lazy campaign page', async () => {
    const harness = await RouterTestingHarness.create('/campaigns');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Campaigns');
  });

  it('redirects a signed-out player to sign-in', async () => {
    user.set(null);
    const harness = await RouterTestingHarness.create('/characters');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Welcome back');
  });
});
