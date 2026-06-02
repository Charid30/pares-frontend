import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 sur login/register = mauvais identifiants, ne pas déconnecter
      const isAuthEndpoint = req.url.includes('/auth/login') || req.url.includes('/auth/register');

      if (error.status === 401 && !isAuthEndpoint) {
        authService.logoutExpired();
      }

      // Enrichir le message pour les erreurs de sécurité
      if (error.status === 400 && error.error?.message?.includes('suspect')) {
        error = { ...error, error: { ...error.error, message: '⚠️ Contenu suspect détecté. Vos actions ont été enregistrées.' } };
      }
      if (error.status === 403 && error.error?.message?.includes('banni')) {
        error = { ...error, error: { ...error.error, message: '🚫 ' + (error.error?.message || 'Accès refusé.') } };
      }

      return throwError(() => error);
    })
  );
};
