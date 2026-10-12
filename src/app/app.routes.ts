import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'characters' },
  { path: 'characters', title: 'Characters | RPG Companion', loadComponent: () => import('./features/characters.page').then(m => m.CharactersPage) },
  { path: 'campaigns', title: 'Campaigns | RPG Companion', loadComponent: () => import('./features/campaigns.page').then(m => m.CampaignsPage) },
  { path: '**', redirectTo: 'characters' },
];
