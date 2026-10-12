import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { SUPABASE } from './supabase';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly client = inject(SUPABASE);
  private readonly currentSession = signal<Session | null>(null);
  readonly user = computed(() => this.currentSession()?.user ?? null);
  readonly initializing = signal(true);
  readonly initializationError = signal<string | null>(null);
  readonly ready: Promise<void>;

  constructor() {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      // Keep this callback synchronous: awaiting auth calls here can deadlock.
      this.currentSession.set(session);
    });
    inject(DestroyRef).onDestroy(() => data.subscription.unsubscribe());
    this.ready = this.restoreSession();
  }

  private async restoreSession(): Promise<void> {
    try {
      const { error } = await this.client.auth.getSession();
      if (error) this.initializationError.set(error.message);
    } catch {
      this.initializationError.set('Could not restore your session. Please try signing in again.');
    } finally {
      this.initializing.set(false);
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.currentSession.set(data.session);
    this.initializationError.set(null);
  }

  async signUp(email: string, password: string): Promise<boolean> {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: new URL('/auth', window.location.origin).href },
    });
    if (error) throw error;
    if (data.session) this.currentSession.set(data.session);
    return data.session !== null;
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    this.currentSession.set(null);
  }
}
