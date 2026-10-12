import { inject, Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { SUPABASE } from '../auth/supabase';

export interface Profile {
  id: string;
  username: string | null;
  display_name: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly client = inject(SUPABASE);
  private readonly auth = inject(AuthService);

  private userId(): string {
    const id = this.auth.user()?.id;
    if (!id) throw new Error('Sign in to manage your profile.');
    return id;
  }

  async load(): Promise<{ profile: Profile; isSuperAdmin: boolean }> {
    const id = this.userId();
    const [profile, role] = await Promise.all([
      this.client
        .from('profiles')
        .select('id,username,display_name')
        .eq('id', id)
        .single<Profile>(),
      this.client.rpc('is_super_admin'),
    ]);
    if (profile.error) throw new Error('Could not load your profile. Please retry.');
    if (role.error) throw new Error('Could not load account permissions. Please retry.');
    return { profile: profile.data, isSuperAdmin: role.data === true };
  }

  async save(username: string, displayName: string): Promise<Profile> {
    const id = this.userId();
    const { data, error } = await this.client
      .from('profiles')
      .update({ username: username.trim().toLowerCase(), display_name: displayName.trim() })
      .eq('id', id)
      .select('id,username,display_name')
      .single<Profile>();
    if (error?.code === '23505') throw new Error('That username is taken. Choose another one.');
    if (error) throw new Error('Could not save your profile. Please retry.');
    return data;
  }
}
