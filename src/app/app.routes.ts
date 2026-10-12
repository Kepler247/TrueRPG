import { Routes } from '@angular/router';
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
  { path: '**', redirectTo: 'characters' },
];
