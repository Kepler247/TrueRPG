import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CampaignService } from '../core/campaigns/campaign.service';
import { CampaignDetailPage } from './campaign-detail.page';
import { createCore } from '../core/characters/character-core';
import { AuthService } from '../core/auth/auth.service';
import { signal } from '@angular/core';
describe('Campaign party management', () => {
  const detail = {
    campaign: {
      id: 'campaign',
      name: 'Long Road',
      owner_id: 'gm',
      system_id: 'rads',
      description: '',
    },
    systemName: '501 Rads',
    rulesetKey: '501-rads',
    canManage: true,
    members: [
      { user_id: 'gm', profiles: { username: 'gamemaster', display_name: '' } },
      { user_id: 'player', profiles: { username: 'player', display_name: '' } },
    ],
    characters: [
      {
        id: 'character',
        name: 'Courier',
        owner_id: 'player',
        core: { ...createCore(), class: 'Gunslinger', hpMax: 12, hpCurrent: 9, heat: 2 },
      },
    ],
  };
  const service = { load: vi.fn(), invite: vi.fn(), removeMember: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    service.load.mockResolvedValue(structuredClone(detail));
    service.invite.mockResolvedValue(undefined);
    service.removeMember.mockResolvedValue(undefined);
    const params = convertToParamMap({ id: 'campaign' });
    TestBed.configureTestingModule({
      imports: [CampaignDetailPage],
      providers: [
        { provide: AuthService, useValue: { user: signal({ id: 'gm' }) } },
        provideRouter([]),
        { provide: CampaignService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(params), snapshot: { paramMap: params } },
        },
      ],
    });
  });
  async function create() {
    const fixture = TestBed.createComponent(CampaignDetailPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  it('shows party HP/resources and lets the GM invite by username', async () => {
    const fixture = await create();
    expect(fixture.nativeElement.textContent).toContain('HP 9 / 12');
    expect(fixture.nativeElement.textContent).toContain('Heat 2 / 3');
    const page = fixture.componentInstance;
    page.username.set('new_player');
    await page.invite();
    expect(service.invite).toHaveBeenCalledWith('campaign', 'new_player');
  });
  it('prevents removing the GM and hides management controls from members', async () => {
    service.load.mockResolvedValue({ ...detail, canManage: false });
    const fixture = await create();
    await fixture.componentInstance.remove('player');
    expect(service.removeMember).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
  });
});
