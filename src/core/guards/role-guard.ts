// src/app/core/guards/role.guard.ts
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Vérifier si l'utilisateur est connecté
  if (!authService.isLoggedIn()) {
    router.navigate(['/auth/login']);
    return false;
  }

  // Récupérer les rôles autorisés depuis les données de la route
  const allowedRoles = route.data['roles'] as string[];
  
  if (!allowedRoles || allowedRoles.length === 0) {
    return true; // Pas de restriction de rôle
  }

  // Vérifier si l'utilisateur a l'un des rôles autorisés
  if (authService.hasAnyRole(allowedRoles)) {
    return true;
  }

  // Rediriger vers une page "Accès refusé"
  router.navigate(['/access-denied']);
  return false;
};