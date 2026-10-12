import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../core/auth/auth.service';
import { ProfileService } from '../core/profiles/profile.service';

@Component({
  selector: 'app-profile-editor',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './profile-editor.html',
  styleUrl: './profile-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileEditor {
  private readonly auth = inject(AuthService);
  private readonly profiles = inject(ProfileService);
  private readonly userId = computed(() => this.auth.user()?.id ?? null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loaded = signal(false);
  readonly isSuperAdmin = signal(false);
  readonly needsUsername = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly form = new FormGroup({
    username: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[a-zA-Z][a-zA-Z0-9_]{2,29}$/)],
    }),
    displayName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
  });

  constructor() {
    effect(() => {
      const userId = this.userId();
      if (userId) untracked(() => void this.load());
    });
  }

  async load(): Promise<void> {
    const userId = this.userId();
    this.loading.set(true);
    this.loaded.set(false);
    this.error.set(null);
    this.message.set(null);
    this.isSuperAdmin.set(false);
    this.form.reset();
    try {
      const result = await this.profiles.load();
      if (this.userId() !== userId) return;
      this.form.reset({
        username: result.profile.username ?? '',
        displayName: result.profile.display_name,
      });
      this.needsUsername.set(!result.profile.username);
      this.isSuperAdmin.set(result.isSuperAdmin);
      this.loaded.set(true);
    } catch (error) {
      if (this.userId() === userId)
        this.error.set(
          error instanceof Error ? error.message : 'Could not load your profile. Please retry.',
        );
    } finally {
      if (this.userId() === userId) this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    if (this.saving() || this.loading() || !this.loaded()) return;
    this.form.controls.username.setValue(this.form.controls.username.value.trim());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const userId = this.userId();
    const { username, displayName } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.message.set(null);
    try {
      const profile = await this.profiles.save(username, displayName);
      if (this.userId() !== userId) return;
      this.form.reset({ username: profile.username ?? '', displayName: profile.display_name });
      this.needsUsername.set(false);
      this.message.set('Profile saved.');
    } catch (error) {
      if (this.userId() === userId)
        this.error.set(
          error instanceof Error ? error.message : 'Could not save your profile. Please retry.',
        );
    } finally {
      this.saving.set(false);
    }
  }
}
