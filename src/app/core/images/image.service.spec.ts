import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SUPABASE } from '../auth/supabase';
import { ImageService } from './image.service';
describe('Private image persistence', () => {
  const storage = { upload: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn() };
  const query = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() };
  const client = { storage: { from: vi.fn() }, from: vi.fn() };
  const id = '10000000-0000-4000-8000-000000000002';
  const file = {
    type: 'image/png',
    size: 16,
    slice: () => ({
      arrayBuffer: async () => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).buffer,
    }),
  } as unknown as File;
  beforeEach(() => {
    vi.resetAllMocks();
    client.storage.from.mockReturnValue(storage);
    client.from.mockReturnValue(query);
    query.update.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.select.mockReturnValue(query);
    storage.upload.mockResolvedValue({ error: null });
    storage.remove.mockResolvedValue({ error: null });
    query.maybeSingle.mockResolvedValue({
      data: { avatar_path: 'new-path', updated_at: 'new-stamp' },
      error: null,
    });
    TestBed.configureTestingModule({ providers: [{ provide: SUPABASE, useValue: client }] });
  });
  it('uploads first, attaches with concurrency checking, and removes the old picture', async () => {
    const result = await TestBed.inject(ImageService).upload(
      'profiles',
      id,
      file,
      'old-path',
      'old-stamp',
    );
    expect(storage.upload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^profiles/${id}/[0-9a-f-]+\\.png$`)),
      file,
      expect.objectContaining({ upsert: false }),
    );
    expect(query.eq).toHaveBeenCalledWith('updated_at', 'old-stamp');
    expect(result.updated_at).toBe('new-stamp');
    expect(storage.remove).toHaveBeenCalledWith(['old-path']);
  });
  it('cleans up an unlinked upload and preserves the existing picture after a conflict', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(
      TestBed.inject(ImageService).upload('profiles', id, file, 'old-path', 'stale'),
    ).rejects.toThrow('record changed');
    expect(storage.remove).toHaveBeenCalledTimes(1);
    expect(storage.remove.mock.calls[0][0]).not.toEqual(['old-path']);
  });
  it('rejects unsupported formats and mismatched signatures before upload', async () => {
    await expect(
      TestBed.inject(ImageService).upload(
        'profiles',
        id,
        { ...file, type: 'image/svg+xml' } as File,
        null,
      ),
    ).rejects.toThrow('JPEG');
    await expect(
      TestBed.inject(ImageService).upload(
        'profiles',
        id,
        { ...file, type: 'image/jpeg' } as File,
        null,
      ),
    ).rejects.toThrow('format');
    expect(storage.upload).not.toHaveBeenCalled();
  });
  it('loads private images through short-lived signed URLs', async () => {
    storage.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.test/signed-image' },
      error: null,
    });
    expect(await TestBed.inject(ImageService).url('owned-path')).toBe(
      'https://example.test/signed-image',
    );
    expect(storage.createSignedUrl).toHaveBeenCalledWith('owned-path', 600);
  });
});
