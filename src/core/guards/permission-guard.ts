// src/core/guards/permission-guard.ts
// Guard qui vérifie qu'un utilisateur a accès à un module spécifique
// Utilisé pour les routes du dashboard agent générique
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const permissionGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/auth/login']);
    return false;
  }

  // Vérifier si un module est requis
  const requiredModule = route.data['module'] as string | undefined;

  if (!requiredModule) {
    return true; // Pas de module requis → accès libre
  }

  // ADMIN (principal ou additionnel) a accès à tout
  if (authService.hasRole('ADMIN')) return true;

  if (authService.hasModuleAccess(requiredModule)) {
    return true;
  }

  // Pas de permission → page accès refusé
  router.navigate(['/access-denied']);
  return false;
};