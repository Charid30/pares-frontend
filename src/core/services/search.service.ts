// search.service.ts — Service de recherche globale contextuelle
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router, NavigationStart } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private termSubject = new BehaviorSubject<string>('');
  readonly term$ = this.termSubject.asObservable();

  constructor(private router: Router) {
    // Réinitialiser le terme à chaque changement de page
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.termSubject.next('');
      }
    });
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
