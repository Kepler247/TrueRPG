import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AdventureCollection } from './adventure-collection';

@Component({
  selector: 'app-campaigns',
  imports: [AdventureCollection],
  template: `<app-adventure-collection kind="campaigns" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignsPage {}
