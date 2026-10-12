import { TestBed } from '@angular/core/testing';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { AuthService } from './auth.service';
import { SUPABASE } from './supabase';

describe('Auth session lifecycle', () => {
  let listener: (event: AuthChangeEvent, session: Session | null) => void;
  const restored = { user: { id: 'player-id', email: 'player@example.com' } } as Session;
  const unsubscribe = vi.fn();
  const auth = {
    onAuthStateChange: vi.fn(),
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  };
  beforeEach(() => {
    vi.resetAllMocks();
    auth.onAuthStateChange.mockImplementation((callback) => {
      listener = callback;
      return { data: { subscription: { unsubscribe } } };
    });
    auth.getSession.mockImplementation(async () => {
      listener('INITIAL_SESSION', restored);
      return { data: { session: restored }, error: null };
    });
    TestBed.configureTestingModule({ providers: [{ provide: SUPABASE, useValue: { auth } }] });
  });

  it('restores a session and reacts to sign-out events', async () => {
    const service = TestBed.inject(AuthService);
    await service.ready;
    expect(service.user()?.id).toBe('player-id');
    expect(service.initializing()).toBe(false);
    listener('SIGNED_OUT', null);
    expect(service.user()).toBeNull();
    TestBed.resetTestingModule();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('finishes initialization after a storage failure', async () => {
    auth.getSession.mockRejectedValue(new Error('Storage unavailable'));
    const service = TestBed.inject(AuthService);
    await service.ready;
    expect(service.initializing()).toBe(false);
    expect(service.initializationError()).toContain('Could not restore');
  });

  it('keeps the session if sign-out fails', async () => {
    auth.signOut.mockResolvedValue({ error: new Error('Network failure') });
    const service = TestBed.inject(AuthService);
    await service.ready;
    await expect(service.signOut()).rejects.toThrow('Network failure');
    expect(service.user()?.id).toBe('player-id');
  });
});
