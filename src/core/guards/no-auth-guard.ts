// src/core/guards/no-auth-guard.ts
// Guard qui empêche un utilisateur déjà connecté d'accéder aux pages publiques/auth.
// Si connecté → redirige vers son dashboard selon son rôle.
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService, SYSTEM_AGENT_ROLES } from '../services/auth.service';

function getDashboardRoute(role: string): string {
  switch (role) {
    case 'CANDIDAT':        return '/dashboard/candidat';
    case 'ADMIN':           return '/admin/dashboard';
    case 'AGENT_RH':        return '/dashboard/rh';
    case 'AGENT_FINANCIER': return '/dashboard/financier';
    case 'AGENT_COMMERCIAL':return '/dashboard/commercial';
    default:
      // Rôle personnalisé → layout agent générique
      return '/dashboard/agent';
  }
}

export const noAuthGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    return true; // Non connecté → accès autorisé à la page publique/auth
  }

  // Connecté → rediriger vers le bon dashboard
  const user = authService.getCurrentUser();
  const route = user ? getDashboardRoute(user.role) : '/accueil';
  router.navigate([route]);
  return false;
};