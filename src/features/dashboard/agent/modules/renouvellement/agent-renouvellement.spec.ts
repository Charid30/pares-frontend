import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { AgentRenouvellement } from './agent-renouvellement';
import { AuthService } from '../../../../../core/services/auth.service';

// Régression du 2026-10-24 : l'abonnement aux données de la route était créé dans un initialiseur de champ,
// avant que le constructeur ait reçu http / authService → « En cours » et « Terminé » tournaient sans fin.
const STATS = { total: 2, enAttente: 0, enTraitement: 0, approuve: 0, accepte: 0, enCours: 0, expire: 1, termine: 1, rejete: 0 };

const ecrans = [
  { nom: 'En attente', data: { module: 'RENOUVELLEMENT', scope: 'global', statusFilter: 'EN_ATTENTE', allowedTransitions: ['APPROUVER', 'REJETE'] } },
  { nom: 'En cours (lecture seule)', data: { module: 'RENOUVELLEMENT', scope: 'global', statusFilter: 'ACCEPTE,EN_COURS', readOnly: true } },
  { nom: 'Terminé (lecture seule)', data: { module: 'RENOUVELLEMENT', scope: 'global', statusFilter: 'EXPIRE,TERMINE,RAPPORT_SOUMIS', readOnly: true } },
  { nom: 'Renouvellement de la direction', data: { module: 'RENOUVELLEMENT', scope: 'direction' } },
];

describe('AgentRenouvellement — chargement selon le sous-écran', () => {
  for (const ecran of ecrans) {
    it(`charge la liste puis arrête le chargement : ${ecran.nom}`, () => {
      const data$ = new BehaviorSubject<Record<string, unknown>>(ecran.data);
      TestBed.configureTestingModule({
        imports: [AgentRenouvellement],
        providers: [
          provideRouter([]),
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: ActivatedRoute, useValue: { data: data$, snapshot: { data: ecran.data } } },
          { provide: AuthService, useValue: { hasPermission: () => true, hasRole: () => false, getCurrentUser: () => ({ roles: [], directions: [] }) } },
        ],
      });
      const fixture = TestBed.createComponent(AgentRenouvellement);
      expect(() => fixture.detectChanges()).not.toThrow();

      const http = TestBed.inject(HttpTestingController);
      const req = http.expectOne(r => r.url.endsWith('/stages/renouvellements'));
      const statut = (ecran.data as { statusFilter?: string }).statusFilter;
      if (statut) expect(req.request.params.get('statusRenouvellement')).toBe(statut);
      req.flush({ success: true, data: { rows: [], total: 0, page: 1, limit: 15, totalPages: 0, stats: STATS } });
      fixture.detectChanges();

      expect(fixture.componentInstance.isLoading).toBe(false);
      expect(fixture.nativeElement.textContent).not.toContain('Chargement des renouvellements');
      http.verify();
    });
  }
});
