import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-characters',
  template: `
    <p class="eyebrow">YOUR ADVENTURERS</p>
    <h1>Characters</h1>
    <p class="intro">A home for every character, with or without a campaign.</p>
    <section class="empty-state" aria-labelledby="empty-title">
      <span class="emblem" aria-hidden="true">&#9876;</span>
      <h2 id="empty-title">Your party awaits</h2>
      <p>Your characters will appear here once character creation is available.</p>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharactersPage {}
