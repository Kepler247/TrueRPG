import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../core/auth/auth.service';
import { CampaignService } from '../core/campaigns/campaign.service';
import { CampaignInvitations } from './campaign-invitations';
describe('Player campaign invitations', () => {
  const user = signal<{ id: string } | null>({ id: 'player' });
  const invitation = {
    id: 'invitation',
    campaign_id: 'campaign',
    campaign_name: 'Long Road',
    system_name: '501 Rads',
  };
  const service = { invitations: vi.fn(), accept: vi.fn(), decline: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    user.set({ id: 'player' });
    service.invitations.mockResolvedValue([invitation]);
    service.accept.mockResolvedValue('campaign');
    service.decline.mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [CampaignInvitations],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user } },
        { provide: CampaignService, useValue: service },
      ],
    });
  });
  async function create() {
    const fixture = TestBed.createComponent(CampaignInvitations);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  it('accepts only after the server confirms membership and opens the campaign', async () => {
    const page = (await create()).componentInstance;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await page.accept('invitation');
    expect(service.accept).toHaveBeenCalledWith('invitation');
    expect(page.invites()).toHaveLength(0);
    expect(navigate).toHaveBeenCalledWith(['/campaigns', 'campaign']);
  });
  it('keeps an invitation on failed acceptance and avoids reload on session refresh', async () => {
    const fixture = await create();
    service.accept.mockRejectedValueOnce(new Error('Unavailable'));
    await fixture.componentInstance.accept('invitation');
    expect(fixture.componentInstance.invites()).toHaveLength(1);
    user.set({ id: 'player' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(service.invitations).toHaveBeenCalledTimes(1);
  });
});
