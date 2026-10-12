import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../core/auth/auth.service';
import { AuthPage } from './auth.page';

describe('Account form', () => {
  const auth = {
    user: signal(null),
    initializing: signal(false),
    initializationError: signal(null),
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  };
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      imports: [AuthPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
  });

  it('retains a typed password when the keyboard field loses focus', () => {
    const fixture = TestBed.createComponent(AuthPage);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="password"]');
    input.value = 'typed-password';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(input.value).toBe('typed-password');
    expect(fixture.componentInstance.form.controls.password.value).toBe('typed-password');
    // Intentional deletion must still work.
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(fixture.componentInstance.form.controls.password.value).toBe('');
  });

  it('captures a password on blur even when Safari omitted its input event', () => {
    const fixture = TestBed.createComponent(AuthPage);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="password"]');
    input.value = 'autofilled-password';
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(input.value).toBe('autofilled-password');
    expect(fixture.componentInstance.form.controls.password.value).toBe('autofilled-password');
  });

  it('reads autofilled credentials at submission without requiring input events', async () => {
    auth.signIn.mockRejectedValue(new Error('Test rejection'));
    const fixture = TestBed.createComponent(AuthPage);
    fixture.detectChanges();
    const email: HTMLInputElement = fixture.nativeElement.querySelector('input[type="email"]');
    const password: HTMLInputElement =
      fixture.nativeElement.querySelector('input[type="password"]');
    email.value = 'player@example.com';
    password.value = 'autofilled-password';
    await fixture.componentInstance.submit(email, password);
    expect(auth.signIn).toHaveBeenCalledWith('player@example.com', 'autofilled-password');
    expect(password.value).toBe('autofilled-password');
  });

  it('does not submit invalid credentials', async () => {
    const fixture = TestBed.createComponent(AuthPage);
    await fixture.componentInstance.submit();
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('shows the email confirmation message without navigating', async () => {
    auth.signUp.mockResolvedValue(false);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const fixture = TestBed.createComponent(AuthPage);
    const page = fixture.componentInstance;
    page.toggleMode();
    page.form.setValue({ email: 'player@example.com', password: 'long-password' });
    await page.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'Check your email',
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(page.form.controls.password.value).toBe('');
  });

  it('shows a failed sign-in and allows retry', async () => {
    auth.signIn.mockRejectedValue(new Error('Invalid login credentials'));
    const fixture = TestBed.createComponent(AuthPage);
    const page = fixture.componentInstance;
    page.form.setValue({ email: 'player@example.com', password: 'wrong' });
    await page.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Invalid login credentials',
    );
    expect(page.busy()).toBe(false);
  });
});
