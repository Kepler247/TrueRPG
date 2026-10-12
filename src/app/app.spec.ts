import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';

describe('Feature navigation', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter(routes)] }));

  it('opens characters by default', async () => {
    const harness = await RouterTestingHarness.create('/');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Characters');
    expect(harness.routeNativeElement?.textContent).toContain('Your party awaits');
  });

  it('opens the lazy campaign page', async () => {
    const harness = await RouterTestingHarness.create('/campaigns');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Campaigns');
  });
});
