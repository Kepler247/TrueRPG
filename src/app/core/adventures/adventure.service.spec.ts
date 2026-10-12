import { createCore, CHARACTER_DATA_VERSION } from '../characters/character-core';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AdventureService } from './adventure.service';
import { AuthService } from '../auth/auth.service';
import { SUPABASE } from '../auth/supabase';

describe('Adventure persistence', () => {
  const user = signal<{ id: string } | null>({ id: 'player-id' });
  const query = {
    insert: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    returns: vi.fn(),
    single: vi.fn(),
  };
  const client = { from: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    user.set({ id: 'player-id' });
    client.from.mockReturnValue(query);
    for (const method of ['insert', 'select', 'eq', 'order'] as const)
      query[method].mockReturnValue(query);
    query.returns.mockResolvedValue({ data: [], error: null });
    query.single.mockResolvedValue({ data: { id: 'created-id' }, error: null });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user } },
        { provide: SUPABASE, useValue: client },
      ],
    });
  });
  it('uses the signed-in account as campaign owner', async () => {
    await TestBed.inject(AdventureService).createCampaign(
      '  Road  ',
      'wasteland',
      '  Description  ',
    );
    expect(client.from).toHaveBeenCalledWith('campaigns');
    expect(query.insert).toHaveBeenCalledWith({
      owner_id: 'player-id',
      system_id: 'wasteland',
      name: 'Road',
      description: 'Description',
    });
  });
  it('creates a character without requiring a campaign or inventing game stats', async () => {
    await TestBed.inject(AdventureService).createCharacter('  Courier  ', 'wasteland', null);
    expect(query.insert).toHaveBeenCalledWith({
      owner_id: 'player-id',
      system_id: 'wasteland',
      campaign_id: null,
      data: { core: createCore() },
      data_version: CHARACTER_DATA_VERSION,
      name: 'Courier',
    });
  });
  it('loads memberships filtered to the current owner', async () => {
    const result = await TestBed.inject(AdventureService).load('characters');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'player-id');
    expect(client.from).toHaveBeenCalledWith('characters');
    expect(result.memberCampaignIds).toEqual([]);
  });
  it('does not treat failed reads as an empty collection', async () => {
    query.returns.mockResolvedValue({ data: null, error: { message: 'Unavailable' } });
    await expect(TestBed.inject(AdventureService).load('characters')).rejects.toThrow(
      'Could not load',
    );
  });
  it('handles membership changing before character submission', async () => {
    query.single.mockResolvedValue({ data: null, error: { code: '23503' } });
    await expect(
      TestBed.inject(AdventureService).createCharacter('Courier', 'wasteland', 'removed-campaign'),
    ).rejects.toThrow('no longer available');
  });
  it('does not insert when signed out', async () => {
    user.set(null);
    await expect(
      TestBed.inject(AdventureService).createCampaign('Road', 'wasteland', ''),
    ).rejects.toThrow('Sign in');
    expect(query.insert).not.toHaveBeenCalled();
  });
});
