import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
@Component({
  selector: 'app-setting-map',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>{{ title() }}</h2>
    <p>Zoom in to read the labels. Scroll across the map to explore.</p>
    <div class="map-controls">
      <button
        type="button"
        (click)="zoom.set(Math.max(100, zoom() - 50))"
        [disabled]="zoom() === 100"
        aria-label="Zoom out"
      >
        &minus;
      </button>
      <label
        >Zoom
        <input
          type="range"
          min="100"
          max="400"
          step="25"
          [ngModel]="zoom()"
          (ngModelChange)="zoom.set(+$event)"
      /></label>
      <span aria-live="polite">{{ zoom() }}%</span>
      <button
        type="button"
        (click)="zoom.set(Math.min(400, zoom() + 50))"
        [disabled]="zoom() === 400"
        aria-label="Zoom in"
      >
        +
      </button>
      <button type="button" (click)="zoom.set(100)">Fit map</button>
      <a [href]="src()" target="_blank" rel="noopener">Open original map</a>
    </div>
    <div class="map-viewport" tabindex="0" role="region" aria-label="Scrollable setting map">
      <img [src]="src()" [alt]="description()" [style.width.%]="zoom()" />
    </div>
    <p>{{ description() }}</p>
  `,
  styles: `
    .map-controls {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-block: 1rem;
    }
    button,
    a,
    input {
      min-height: 44px;
      font: inherit;
    }
    button {
      min-width: 44px;
      cursor: pointer;
      padding: 0.5rem 0.75rem;
      border: 1px solid #245c47;
      border-radius: 0.5rem;
      background: #eef3e8;
    }
    a {
      display: inline-flex;
      align-items: center;
      color: #245c47;
    }
    label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      max-width: 100%;
    }
    .map-viewport {
      max-width: 100%;
      max-height: 75dvh;
      overflow: auto;
      border: 1px solid #b9b19a;
      border-radius: 0.75rem;
      background: #d5c5a1;
    }
    img {
      display: block;
      max-width: none;
      height: auto;
    }
  `,
})
export class SettingMap {
  readonly src = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly zoom = signal(100);
  readonly Math = Math;
}
