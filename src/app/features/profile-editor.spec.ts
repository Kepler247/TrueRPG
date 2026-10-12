import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from '../core/auth/auth.service';
import { ProfileService } from '../core/profiles/profile.service';
import { ProfileEditor } from './profile-editor';
import { ImageService } from '../core/images/image.service';

const account = { id: 'player-id', email: 'player@example.com' };
const saved = { id: account.id, username: 'vault_dweller', display_name: 'Vault Dweller' };
describe('Profile editor', () => {
  const user = signal<typeof account | null>(account);
  const profiles = { load: vi.fn(), save: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    user.set(account);
    profiles.load.mockResolvedValue({ profile: { ...saved, username: null }, isSuperAdmin: true });
    TestBed.configureTestingModule({
      imports: [ProfileEditor],
      providers: [
        { provide: ImageService, useValue: { url: async () => '' } },
        { provide: AuthService, useValue: { user } },
        { provide: ProfileService, useValue: profiles },
      ],
    });
  });
  async function create() {
    const fixture = TestBed.createComponent(ProfileEditor);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  it('offers setup for an existing account without a username and shows its role', async () => {
    const fixture = await create();
    expect(fixture.nativeElement.textContent).toContain('Choose a username');
    expect(fixture.nativeElement.textContent).toContain('Super master');
  });
  it('keeps unsaved edits when the same account session refreshes', async () => {
    const fixture = await create();
    fixture.componentInstance.form.controls.username.setValue('unsaved_name');
    user.set({ ...account });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(profiles.load).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.form.controls.username.value).toBe('unsaved_name');
  });

  it('rejects invalid usernames before calling the server', async () => {
    const fixture = await create();
    fixture.componentInstance.form.controls.username.setValue('bad name');
    await fixture.componentInstance.save();
    expect(profiles.save).not.toHaveBeenCalled();
  });
  it('saves a valid profile and displays the confirmed server value', async () => {
    profiles.save.mockResolvedValue(saved);
    const fixture = await create();
    const page = fixture.componentInstance;
    page.form.setValue({ username: 'Vault_Dweller', displayName: 'Vault Dweller' });
    await page.save();
    fixture.detectChanges();
    expect(profiles.save).toHaveBeenCalledWith('Vault_Dweller', 'Vault Dweller');
    expect(page.form.controls.username.value).toBe('vault_dweller');
    expect(fixture.nativeElement.textContent).toContain('Profile saved.');
  });
  it('preserves edits when a username is taken and permits retry', async () => {
    profiles.save.mockRejectedValue(new Error('That username is taken. Choose another one.'));
    const fixture = await create();
    const page = fixture.componentInstance;
    page.form.controls.username.setValue('taken_name');
    await page.save();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('taken');
    expect(page.form.controls.username.value).toBe('taken_name');
    expect(page.saving()).toBe(false);
  });
  it('shows a retry action when profile loading fails', async () => {
    profiles.load.mockRejectedValue(new Error('Could not load your profile. Please retry.'));
    const fixture = await create();
    expect(fixture.nativeElement.textContent).toContain('Retry loading profile');
    profiles.load.mockResolvedValue({ profile: saved, isSuperAdmin: false });
    await fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.username.value).toBe(saved.username);
    expect(fixture.nativeElement.textContent).not.toContain('Super master');
  });
  it('ignores a response for an account that signed out while loading', async () => {
    let resolve!: (value: unknown) => void;
    profiles.load.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const fixture = TestBed.createComponent(ProfileEditor);
    fixture.detectChanges();
    user.set(null);
    resolve({ profile: saved, isSuperAdmin: true });
    await fixture.whenStable();
    expect(fixture.componentInstance.loaded()).toBe(false);
    expect(fixture.componentInstance.isSuperAdmin()).toBe(false);
  });
});
