// src/environments/environment.ts — Développement local
// Ce fichier est automatiquement remplacé par environment.prod.ts lors de : ng build
export const environment = {
  production: false,
  // Passe par le proxy de ng serve (proxy.conf.json) : fonctionne depuis localhost comme depuis une autre machine.
  apiUrl: '/api',
  appName: 'PARES (dev)',
  appVersion: '2.0.0',
};