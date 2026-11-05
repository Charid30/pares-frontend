// confirm-dialog.ts — Fenêtre de confirmation de ConfirmService (montée une seule fois dans app.html).
import { Component, HostListener, inject } from '@angular/core';
import { ConfirmService } from '../../../core/services/confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    @if (confirm.demande(); as d) {
      <div class="fixed inset-0 z-[150] flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm fond" (click)="confirm.repondre(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden fenetre">
          <div class="px-6 pt-6 pb-4 flex flex-col items-center text-center gap-3">
            <div class="w-14 h-14 rounded-full flex items-center justify-center"
                 [class]="d.danger ? 'w-14 h-14 rounded-full flex items-center justify-center bg-red-50 text-[#c0392b]' : 'w-14 h-14 rounded-full flex items-center justify-center bg-gray-100 text-gray-700'">
              <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                @if (d.danger) {
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                } @else {
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                }
              </svg>
            </div>
            <h3 class="text-base font-bold text-gray-900">{{ d.titre }}</h3>
            <p class="text-sm text-gray-500 leading-relaxed whitespace-pre-line">{{ d.message }}</p>
            @if (d.detail) {
              <p class="text-sm font-semibold text-gray-900 bg-gray-50 rounded-lg px-3 py-2 w-full">{{ d.detail }}</p>
            }
          </div>
          <div class="flex gap-2 px-6 pb-6">
            <button type="button" (click)="confirm.repondre(false)"
                    class="flex-1 text-xs py-2.5 px-3 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200">Annuler</button>
            <button type="button" (click)="confirm.repondre(true)" autofocus
                    class="flex-1 text-xs py-2.5 px-3 rounded-lg bg-[#c0392b] hover:bg-[#96281b] text-white font-semibold">
              {{ d.confirmer || 'Confirmer' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .fond { animation: fondu 150ms ease-out both; }
    .fenetre { animation: apparition 180ms cubic-bezier(.2,.8,.2,1) both; }
    @keyframes fondu { from { opacity: 0; } to { opacity: 1; } }
    @keyframes apparition { from { opacity: 0; transform: scale(.95) translateY(8px); } to { opacity: 1; transform: none; } }
  `],
})
export class ConfirmDialog {
  readonly confirm = inject(ConfirmService);

  @HostListener('document:keydown.escape')
  echap(): void { this.confirm.repondre(false); }
}
