// src/core/guards/no-auth-guard.ts
// Guard qui empêche un utilisateur déjà connecté d'accéder aux pages publiques/auth.
// Si connecté → redirige vers son dashboard selon son rôle.
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const noAuthGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    return true; // Non connecté → accès autorisé à la page publique/auth
  }

  // Connecté → rediriger vers le bon dashboard (tient compte des rôles multiples)
  router.navigate([authService.getDashboardRoute()]);
  return false;
};