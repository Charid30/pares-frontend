// Fenêtre affichée avant de valider une offre, une aide ou une audience (2026-11-05) :
// « Cette demande concerne-t-elle votre direction ? » — Oui : la validation continue ;
// Non : l'agent choisit la direction concernée et la demande y est redirigée, sans être validée.
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface DirectionChoix { iddirection: number; nom: string; accronyme: string; }

@Component({
  selector: 'app-direction-concernee',
  imports: [FormsModule],
  template: `
    @if (ouvert) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true"
           aria-labelledby="direction-concernee-titre">
        <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div class="px-5 py-4" style="background: linear-gradient(135deg, #c0392b, #96281b)">
            <h3 id="direction-concernee-titre" class="text-base font-bold text-white">
              {{ etape === 'question' ? 'Avant de valider' : 'Rediriger la demande' }}
            </h3>
          </div>

          <div class="p-5 space-y-4">
            @if (etape === 'question') {
              <p class="text-sm text-gray-700">
                Cette demande est adressée à <strong>{{ libelleDirection(directionActuelleId) }}</strong>.
              </p>
              <p class="text-sm font-semibold text-gray-900">Concerne-t-elle votre direction ?</p>
              <p class="text-xs text-gray-500">
                Si elle concerne une autre direction, redirigez-la sans la valider : cette direction pourra la traiter.
              </p>
            } @else {
              <label class="block text-xs font-semibold text-gray-700" for="direction-concernee-choix">
                Direction concernée <span class="text-red-500">*</span>
              </label>
              <select id="direction-concernee-choix" [(ngModel)]="directionCibleId"
                      class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900
                             focus:border-red-400 focus:bg-white focus:outline-none">
                <option [ngValue]="null">Sélectionner la direction</option>
                @for (d of directionsCibles; track d.iddirection) {
                  <option [ngValue]="d.iddirection">{{ d.accronyme }} — {{ d.nom }}</option>
                }
              </select>
              <p class="text-xs text-gray-500">La demande garde son statut « En attente » et la direction choisie est prévenue, ainsi que le candidat.</p>
            }

            @if (erreur) {
              <div class="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">{{ erreur }}</div>
            }
          </div>

          <div class="px-5 pb-5 flex flex-wrap justify-end gap-2">
            <button type="button" (click)="annuler.emit()" [disabled]="soumission"
                    class="text-xs py-2 px-3 min-h-[44px] lg:min-h-[36px] rounded-xl bg-gray-100 text-gray-700
                           [@media(hover:hover)]:hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-[#c0392b] disabled:opacity-50">
              Annuler
            </button>
            @if (etape === 'question') {
              <button type="button" (click)="etape = 'choix'; directionCibleId = null"
                      class="text-xs py-2 px-3 min-h-[44px] lg:min-h-[36px] rounded-xl border border-[#c0392b] text-[#c0392b] bg-white
                             [@media(hover:hover)]:hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-[#c0392b]">
                Non, rediriger
              </button>
              <button type="button" (click)="oui.emit()"
                      class="text-xs py-2 px-3 min-h-[44px] lg:min-h-[36px] rounded-xl bg-[#c0392b] text-white font-semibold
                             [@media(hover:hover)]:hover:bg-[#96281b] focus-visible:ring-2 focus-visible:ring-[#c0392b]">
                Oui, valider
              </button>
            } @else {
              <button type="button" (click)="rediriger.emit(directionCibleId!)" [disabled]="!directionCibleId || soumission"
                      class="text-xs py-2 px-3 min-h-[44px] lg:min-h-[36px] rounded-xl bg-[#c0392b] text-white font-semibold
                             [@media(hover:hover)]:hover:bg-[#96281b] focus-visible:ring-2 focus-visible:ring-[#c0392b] disabled:opacity-50">
                {{ soumission ? 'Redirection…' : 'Rediriger' }}
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class DirectionConcernee implements OnChanges {
  @Input() ouvert = false;
  @Input() directionActuelleId: number | null | undefined = null;
  @Input() directions: DirectionChoix[] = [];
  @Input() soumission = false;
  @Input() erreur = '';
  @Output() oui = new EventEmitter<void>();
  @Output() rediriger = new EventEmitter<number>();
  @Output() annuler = new EventEmitter<void>();

  etape: 'question' | 'choix' = 'question';
  directionCibleId: number | null = null;

  /** Toute réouverture repart de la question. */
  ngOnChanges(): void {
    if (!this.ouvert) { this.etape = 'question'; this.directionCibleId = null; }
  }

  get directionsCibles(): DirectionChoix[] {
    return this.directions.filter(d => d.iddirection !== this.directionActuelleId);
  }

  libelleDirection(id: number | null | undefined): string {
    const d = this.directions.find(x => x.iddirection === id);
    return d ? `${d.accronyme} — ${d.nom}` : 'aucune direction';
  }
}
