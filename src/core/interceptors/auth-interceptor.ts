// src/app/core/interceptors/auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // withCredentials : le navigateur envoie automatiquement le cookie HttpOnly
  let cloned = req.clone({ withCredentials: true });

  // Si un token est en mémoire (juste après login, avant rechargement de page),
  // on l'ajoute aussi en header Bearer pour compatibilité avec les clients API.
  const token = authService.getToken();
  if (token) {
    cloned = cloned.clone({
      headers: cloned.headers.set('Authorization', `Bearer ${token}`)
    });
  }

  return next(cloned);
};
