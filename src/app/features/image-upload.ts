import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ImageChange, ImageService } from '../core/images/image.service';
@Component({
  selector: 'app-image-upload',
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="picture">
      @if (url()) {
        <img
          [src]="url()"
          [alt]="kind() === 'profiles' ? 'Profile picture' : 'Character portrait'"
        />
      }
    </div>
    @if (canEdit()) {
      <label class="upload"
        >{{
          busy()
            ? 'Uploading...'
            : kind() === 'profiles'
              ? 'Choose profile picture'
              : 'Choose character portrait'
        }}<input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          [disabled]="busy()"
          (change)="upload($event)"
      /></label>
      @if (path()) {
        <button mat-button (click)="remove()" [disabled]="busy()">Remove picture</button>
      }
      <p class="hint">JPEG, PNG, or WebP, up to 5 MB. Uploads save immediately.</p>
    }
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    }`,
  styles: `
    :host {
      display: block;
      margin-block: 0.75rem;
    }
    .picture img {
      display: block;
      width: 8rem;
      height: 8rem;
      object-fit: cover;
      border-radius: 0.75rem;
    }
    .upload {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      min-height: 44px;
      font-size: 16px;
    }
    input {
      font-size: 16px;
      max-width: 100%;
      min-height: 44px;
    }
    .hint {
      font-size: 0.8rem;
      color: #5e685f;
    }
    [role='alert'] {
      color: #8b2620;
    }
  `,
})
export class ImageUpload {
  private readonly images = inject(ImageService);
  readonly kind = input.required<'profiles' | 'characters'>();
  readonly entityId = input.required<string>();
  readonly path = input<string | null>(null);
  readonly stamp = input<string>();
  readonly canEdit = input(false);
  readonly changed = output<ImageChange>();
  readonly url = signal('');
  readonly error = signal('');
  readonly busy = signal(false);
  constructor() {
    effect((onCleanup) => {
      const path = this.path();
      let active = true;
      onCleanup(() => (active = false));
      this.url.set('');
      if (path)
        void this.images
          .url(path)
          .then((url) => {
            if (active) this.url.set(url);
          })
          .catch(() => {
            if (active) this.error.set('Picture could not be loaded.');
          });
    });
  }
  async upload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.canEdit() || this.busy()) return;
    const id = this.entityId();
    this.busy.set(true);
    this.error.set('');
    try {
      const change = await this.images.upload(this.kind(), id, file, this.path(), this.stamp());
      if (this.entityId() === id) this.changed.emit(change);
    } catch (error) {
      if (this.entityId() === id)
        this.error.set(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      this.busy.set(false);
      input.value = '';
    }
  }
  async remove(): Promise<void> {
    const path = this.path();
    if (!path || !this.canEdit() || this.busy()) return;
    const id = this.entityId();
    this.busy.set(true);
    this.error.set('');
    try {
      const change = await this.images.remove(this.kind(), id, path, this.stamp());
      if (this.entityId() === id) this.changed.emit(change);
    } catch (error) {
      if (this.entityId() === id)
        this.error.set(error instanceof Error ? error.message : 'Could not remove picture.');
    } finally {
      this.busy.set(false);
    }
  }
}
