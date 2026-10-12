import { Routes } from '@angular/router';
import type { CharacterEditPage } from './features/character-edit.page';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'characters' },
  {
    path: 'auth',
    title: 'Account | RPG Companion',
    loadComponent: () => import('./features/auth.page').then((m) => m.AuthPage),
  },
  {
    path: 'characters',
    canActivate: [authGuard],
    title: 'Characters | RPG Companion',
    loadComponent: () => import('./features/characters.page').then((m) => m.CharactersPage),
  },
  {
    path: 'campaigns',
    canActivate: [authGuard],
    title: 'Campaigns | RPG Companion',
    loadComponent: () => import('./features/campaigns.page').then((m) => m.CampaignsPage),
  },
  {
    path: 'systems',
    title: 'Systems | RPG Companion',
    loadComponent: () => import('./features/systems.page').then((m) => m.SystemsPage),
  },
  {
    path: 'characters/:id/edit',
    canActivate: [authGuard],
    canDeactivate: [(component: CharacterEditPage) => component.canLeave()],
    title: 'Edit character | RPG Companion',
    loadComponent: () => import('./features/character-edit.page').then((m) => m.CharacterEditPage),
  },
  {
    path: 'characters/:id',
    canActivate: [authGuard],
    title: 'Character summary | RPG Companion',
    loadComponent: () =>
      import('./features/character-summary.page').then((m) => m.CharacterSummaryPage),
  },
  { path: '**', redirectTo: 'characters' },
];
