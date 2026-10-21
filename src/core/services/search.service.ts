// search.service.ts — Service de recherche globale contextuelle
import { Injectable, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router, NavigationStart } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private termSubject = new BehaviorSubject<string>('');
  readonly term$ = this.termSubject.asObservable();

  /**
   * La page affichée utilise la recherche du header (elle a appelé activer()).
   * L'espace agent n'affiche la barre « Rechercher… » que dans ce cas, tant que
   * toutes ses pages n'ont pas migré depuis leur champ de recherche local.
   */
  readonly disponible = signal(false);

  constructor(private router: Router) {
    // Réinitialiser le terme à chaque changement de page
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.termSubject.next('');
        this.disponible.set(false);
      }
    });
  }

  /** À appeler par une page qui s'abonne à term$ (après chaque navigation vers elle). */
  activer(): void {
    this.disponible.set(true);
  }

  setTerm(term: string): void {
    this.termSubject.next(term);
  }

  clear(): void {
    this.termSubject.next('');
  }

  get current(): string {
    return this.termSubject.getValue();
  }
}
