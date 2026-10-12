import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GAME_SYSTEMS } from '../core/models/game-systems';

@Component({
  selector: 'app-systems',
  template: `
    <p class="eyebrow">WORLDS AND RULES</p>
    <h1>Systems</h1>
    <p class="intro">Each system gives its campaigns and characters a shared set of rules.</p>
    @for (system of systems; track system.id) {
      <article class="empty-state" [attr.aria-labelledby]="system.slug + '-title'">
        <h2 [id]="system.slug + '-title'">{{ system.name }}</h2>
        <p>{{ system.description }}</p>
      </article>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SystemsPage {
  readonly systems = GAME_SYSTEMS;
}
