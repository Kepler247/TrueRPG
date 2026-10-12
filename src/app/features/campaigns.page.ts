import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-campaigns',
  template: `
    <p class="eyebrow">SHARED ADVENTURES</p>
    <h1>Campaigns</h1>
    <p class="intro">Gather your players and keep the party's characters together.</p>
    <section class="empty-state" aria-labelledby="empty-title">
      <span class="emblem" aria-hidden="true">&#9820;</span>
      <h2 id="empty-title">Every adventure needs a gathering place</h2>
      <p>Campaigns you run or join will appear here once campaign management is available.</p>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignsPage {}
