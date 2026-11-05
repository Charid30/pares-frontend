// toast.service.ts — Notifications après une action (succès, erreur…), communes à toute l'application.
// Affichées par <app-toast-container> (monté une seule fois dans app.html) : elles glissent depuis la
// droite, puis repartent vers la droite à leur fermeture (automatique ou au clic).
import { Injectable, signal } from '@angular/core';

export type TypeToast = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  type: TypeToast;
  titre: string;
  message: string;
  sortie: boolean; // animation de sortie en cours
}

const DUREES: Record<TypeToast, number> = { success: 4500, info: 5000, warning: 6000, error: 7000 };
const DUREE_SORTIE = 300; // ms — doit correspondre à l'animation de toast-container

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private compteur = 0;

  succes(titre: string, message = ''): void { this.afficher('success', titre, message); }
  erreur(titre: string, message = ''): void { this.afficher('error', titre, message); }
  avertissement(titre: string, message = ''): void { this.afficher('warning', titre, message); }
  info(titre: string, message = ''): void { this.afficher('info', titre, message); }

  afficher(type: TypeToast, titre: string, message = ''): void {
    const toast: Toast = { id: ++this.compteur, type, titre, message, sortie: false };
    this.toasts.update(liste => [...liste.slice(-4), toast]); // 5 à l'écran au plus
    setTimeout(() => this.fermer(toast.id), DUREES[type]);
  }

  fermer(id: number): void {
    const toast = this.toasts().find(t => t.id === id);
    if (!toast || toast.sortie) return;
    this.toasts.update(liste => liste.map(t => (t.id === id ? { ...t, sortie: true } : t)));
    setTimeout(() => this.toasts.update(liste => liste.filter(t => t.id !== id)), DUREE_SORTIE);
  }
}
