import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AdventureCollection } from './adventure-collection';

@Component({
  selector: 'app-characters',
  imports: [AdventureCollection],
  template: `<app-adventure-collection kind="characters" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharactersPage {}
