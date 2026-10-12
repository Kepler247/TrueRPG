import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AdventureCollection } from './adventure-collection';

@Component({
  selector: 'app-character-creator',
  imports: [AdventureCollection],
  template: '<app-adventure-collection kind="characters" [creatorOnly]="true" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharacterCreatorPage {}
