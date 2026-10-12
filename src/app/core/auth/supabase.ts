import { InjectionToken } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from './supabase.config';

export const SUPABASE = new InjectionToken<SupabaseClient>('Supabase client', {
  providedIn: 'root',
  factory: () =>
    createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }),
});
