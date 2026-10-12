import { AutofillEvent, CdkAutofill } from '@angular/cdk/text-field';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { ProfileEditor } from './profile-editor';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-auth',
  imports: [
    ProfileEditor,
    CdkAutofill,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    RouterLink,
  ],
  templateUrl: './auth.page.html',
  styleUrl: './auth.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPage {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly mode = signal<'signin' | 'signup'>('signin');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    if (params.has('error') || query.has('error')) {
      this.error.set(
        'The email confirmation link could not be verified. It may have expired; try signing in or registering again.',
      );
      window.history.replaceState(null, '', window.location.pathname);
    }
  }

  toggleMode(): void {
    this.mode.update((mode) => (mode === 'signin' ? 'signup' : 'signin'));
    const password = this.form.controls.password;
    password.setValidators(
      this.mode() === 'signup'
        ? [Validators.required, Validators.minLength(8)]
        : [Validators.required],
    );
    password.updateValueAndValidity();
    password.reset();
    this.form.markAsUntouched();
    this.error.set(null);
    this.message.set(null);
  }

  syncInput(field: 'email' | 'password', input: HTMLInputElement): void {
    const control = this.form.controls[field];
    if (control.value !== input.value) {
      // Safari/autofill can change the DOM without the input event Angular expects.
      // Do not write back into the secure field while focus/keyboard is changing.
      control.setValue(input.value, { emitModelToViewChange: false });
    }
  }

  syncAutofill(field: 'email' | 'password', event: AutofillEvent): void {
    if (event.isAutofilled) this.syncInput(field, event.target as HTMLInputElement);
  }

  async submit(emailInput?: HTMLInputElement, passwordInput?: HTMLInputElement): Promise<void> {
    if (this.busy() || this.auth.initializing()) return;
    if (emailInput) this.syncInput('email', emailInput);
    if (passwordInput) this.syncInput('password', passwordInput);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    const { email, password } = this.form.getRawValue();
    try {
      if (this.mode() === 'signup') {
        const signedIn = await this.auth.signUp(email.trim(), password);
        if (signedIn) await this.router.navigateByUrl('/characters');
        else
          this.message.set(
            'Check your email for a confirmation link. After confirming, you can sign in here.',
          );
      } else {
        await this.auth.signIn(email.trim(), password);
        await this.router.navigateByUrl('/characters');
      }
      this.form.controls.password.reset();
    } catch (error) {
      this.error.set(
        error instanceof Error
          ? error.message
          : 'Could not reach the sign-in service. Please try again.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  async signOut(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    try {
      await this.auth.signOut();
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Could not sign out. Please try again.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
