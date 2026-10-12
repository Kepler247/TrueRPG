import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SUPABASE } from '../auth/supabase';
import { AuthService } from '../auth/auth.service';
import { CharacterSheetService, SheetRecord, SheetRow } from './character-sheet.service';
import { createCore } from './character-core';

const row: SheetRow = {
  id: 'character',
  name: 'Courier',
  owner_id: 'player',
  system_id: 'wasteland',
  campaign_id: 'campaign',
  data: { systemNotes: 'preserved', core: createCore() },
  data_version: 2,
  updated_at: '2026-10-12T00:00:00Z',
};
describe('Sheet persistence and permissions', () => {
  const user = signal({ id: 'player' });
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    update: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
  };
  const client = { from: vi.fn(), rpc: vi.fn() };
  const data: Record<string, unknown> = {};
  beforeEach(() => {
    vi.resetAllMocks();
    user.set({ id: 'player' });
    Object.assign(data, {
      characters: structuredClone(row),
      profiles: { username: 'kepler', display_name: '' },
      systems: { name: 'Wasteland' },
      campaigns: { owner_id: 'gm' },
    });
    client.from.mockImplementation((table: string) => {
      const builder = { ...query };
      builder.select = vi.fn().mockReturnValue(builder);
      builder.eq = query.eq.mockReturnValue(builder);
      builder.update = query.update.mockReturnValue(builder);
      builder.maybeSingle = vi.fn(async () => ({ data: data[table], error: null }));
      builder.single = builder.maybeSingle;
      return builder;
    });
    client.rpc.mockResolvedValue({ data: false, error: null });
    TestBed.configureTestingModule({
      providers: [
        { provide: SUPABASE, useValue: client },
        { provide: AuthService, useValue: { user } },
      ],
    });
  });
  it('gives owners and GMs edit access, other members read-only access', async () => {
    const service = TestBed.inject(CharacterSheetService);
    expect((await service.load('character')).canEdit).toBe(true);
    user.set({ id: 'gm' });
    expect((await service.load('character')).canEdit).toBe(true);
    user.set({ id: 'other' });
    expect((await service.load('character')).canEdit).toBe(false);
  });
  it('recognizes the trusted database super-admin role', async () => {
    user.set({ id: 'admin' });
    client.rpc.mockResolvedValue({ data: true, error: null });
    expect((await TestBed.inject(CharacterSheetService).load('character')).canEdit).toBe(true);
  });
  it('preserves system data and uses an optimistic concurrency condition on saves', async () => {
    const service = TestBed.inject(CharacterSheetService);
    const record = await service.load('character');
    await service.save(record, 'Courier', createCore());
    expect(query.update).toHaveBeenCalledWith({
      name: 'Courier',
      data: { systemNotes: 'preserved', core: createCore() },
      data_version: 2,
    });
    expect(query.eq).toHaveBeenCalledWith('updated_at', row.updated_at);
  });
  it('refuses saves from read-only views before issuing UPDATE', async () => {
    user.set({ id: 'other' });
    const service = TestBed.inject(CharacterSheetService);
    const record = await service.load('character');
    await expect(service.save(record, 'Courier', createCore())).rejects.toThrow('read-only');
    expect(query.update).not.toHaveBeenCalled();
  });
  it('reports conflicts instead of silently overwriting another edit', async () => {
    const service = TestBed.inject(CharacterSheetService);
    const record = await service.load('character');
    data['characters'] = null;
    await expect(service.save(record, 'Courier', createCore())).rejects.toThrow('changed');
  });
});
