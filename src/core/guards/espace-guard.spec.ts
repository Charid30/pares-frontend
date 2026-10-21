import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { espaceGuard } from './espace-guard';
import { AuthService } from '../services/auth.service';

describe('espaceGuard — chaque profil reste dans son interface', () => {
  const accueils: Record<string, string> = {
    admin: '/admin/dashboard',
    agent: '/dashboard/agent',
    candidat: '/dashboard/candidat',
  };

  const executer = (profil: string | null, espace: string): boolean | UrlTree => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isLoggedIn: () => profil !== null,
            getDashboardRoute: () => (profil ? accueils[profil] : '/accueil'),
          },
        },
      ],
    });
    const route = { data: { espace } } as unknown as ActivatedRouteSnapshot;
    return TestBed.runInInjectionContext(() => espaceGuard(route, {} as RouterStateSnapshot)) as boolean | UrlTree;
  };

  const destination = (resultat: boolean | UrlTree): string =>
    resultat === true ? 'autorisé' : TestBed.inject(Router).serializeUrl(resultat as UrlTree);

  it('autorise chaque profil dans son propre espace', () => {
    expect(executer('admin', 'admin')).toBe(true);
    expect(executer('agent', 'agent')).toBe(true);
    expect(executer('candidat', 'candidat')).toBe(true);
  });

  it("renvoie l'admin vers son interface s'il ouvre l'espace agent ou candidat", () => {
    expect(destination(executer('admin', 'agent'))).toBe('/admin/dashboard');
    expect(destination(executer('admin', 'candidat'))).toBe('/admin/dashboard');
  });

  it("renvoie l'agent et le candidat vers leur interface", () => {
    expect(destination(executer('agent', 'admin'))).toBe('/dashboard/agent');
    expect(destination(executer('agent', 'candidat'))).toBe('/dashboard/agent');
    expect(destination(executer('candidat', 'agent'))).toBe('/dashboard/candidat');
    expect(destination(executer('candidat', 'admin'))).toBe('/dashboard/candidat');
  });

  it('renvoie vers la connexion si personne n\'est connecté', () => {
    expect(destination(executer(null, 'agent'))).toBe('/auth/login');
  });
});
