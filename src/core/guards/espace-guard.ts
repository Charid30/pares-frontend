// src/core/guards/espace-guard.ts
// Chaque profil a son interface : admin, agent ou candidat. Un utilisateur qui ouvre l'espace
// d'un autre profil (ex. un admin qui saisit /dashboard/agent/… dans l'adresse) est renvoyé
// vers le sien — même règle que la connexion (AuthService.getDashboardRoute).
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

const PREFIXES: Record<string, string> = {
  admin:    '/admin',
  agent:    '/dashboard/agent',
  candidat: '/dashboard/candidat',
};

export const espaceGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    return router.createUrlTree(['/auth/login']);
  }

  const accueil = authService.getDashboardRoute();
  const prefixe = PREFIXES[route.data['espace'] as string];
  return prefixe && accueil.startsWith(prefixe) ? true : router.parseUrl(accueil);
};
