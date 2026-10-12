import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AdventureCollection } from './adventure-collection';
import { CampaignInvitations } from './campaign-invitations';

@Component({
  selector: 'app-campaigns',
  imports: [AdventureCollection, CampaignInvitations],
  template: `<app-campaign-invitations /><app-adventure-collection kind="campaigns" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignsPage {}
