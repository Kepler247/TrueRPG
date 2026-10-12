import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from '../auth/auth.service';
import { SUPABASE } from '../auth/supabase';
import { ProfileService } from './profile.service';

describe('Profile persistence', () => {
  const user = signal<{ id: string } | null>({ id: 'player-id' });
  const profile = { id: 'player-id', username: 'vault_dweller', display_name: 'Vault Dweller' };
  const query = { select: vi.fn(), eq: vi.fn(), update: vi.fn(), single: vi.fn() };
  const client = { from: vi.fn(), rpc: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    user.set({ id: 'player-id' });
    client.from.mockReturnValue(query);
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.update.mockReturnValue(query);
    query.single.mockResolvedValue({ data: profile, error: null });
    client.rpc.mockResolvedValue({ data: true, error: null });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user } },
        { provide: SUPABASE, useValue: client },
      ],
    });
  });
  it('loads only the current profile and reads the database role', async () => {
    const result = await TestBed.inject(ProfileService).load();
    expect(query.eq).toHaveBeenCalledWith('id', 'player-id');
    expect(result).toEqual({ profile, isSuperAdmin: true });
    expect(client.rpc).toHaveBeenCalledWith('is_super_admin');
  });
  it('normalizes the username and updates only editable columns for the current account', async () => {
    await TestBed.inject(ProfileService).save(' Vault_Dweller ', ' Vault Dweller ');
    expect(query.update).toHaveBeenCalledWith({
      username: 'vault_dweller',
      display_name: 'Vault Dweller',
    });
    expect(query.eq).toHaveBeenCalledWith('id', 'player-id');
  });
  it('maps the database uniqueness error to a useful message', async () => {
    query.single.mockResolvedValue({ data: null, error: { code: '23505' } });
    await expect(TestBed.inject(ProfileService).save('taken', '')).rejects.toThrow(
      'That username is taken',
    );
  });
  it('does not query the database for signed-out users', async () => {
    user.set(null);
    await expect(TestBed.inject(ProfileService).save('vault_dweller', '')).rejects.toThrow(
      'Sign in',
    );
    expect(client.from).not.toHaveBeenCalled();
  });
});
