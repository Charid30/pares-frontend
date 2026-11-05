// confirm.service.ts — Confirmation avant toute action qui modifie des données, commune à toute
// l'application. Affichée par <app-confirm-dialog> (monté une seule fois dans app.html).
//
//   if (!(await this.confirm.demander({ titre: 'Supprimer l\'agent', message: '…', confirmer: 'Supprimer', danger: true }))) return;
import { Injectable, signal } from '@angular/core';

export interface OptionsConfirmation {
  titre: string;
  message: string;
  /** Ligne mise en avant sous le message (ex. nom du candidat) */
  detail?: string;
  /** Libellé du bouton de confirmation (défaut : « Confirmer ») */
  confirmer?: string;
  /** Action destructrice ou irréversible : bouton rouge et icône d'alerte */
  danger?: boolean;
}

interface Demande extends OptionsConfirmation { resoudre: (ok: boolean) => void }

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly demande = signal<Demande | null>(null);

  demander(options: OptionsConfirmation): Promise<boolean> {
    this.demande()?.resoudre(false); // une seule confirmation à la fois
    return new Promise(resolve => this.demande.set({ ...options, resoudre: resolve }));
  }

  repondre(ok: boolean): void {
    const d = this.demande();
    if (!d) return;
    this.demande.set(null);
    d.resoudre(ok);
  }
}
