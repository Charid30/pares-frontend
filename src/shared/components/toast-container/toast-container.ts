// toast-container.ts — Affiche les notifications de ToastService (monté une seule fois dans app.html).
import { Component, inject } from '@angular/core';
import { ToastService, TypeToast } from '../../../core/services/toast.service';

const STYLES: Record<TypeToast, { fond: string; icone: string }> = {
  success: { fond: 'bg-green-600', icone: 'M5 13l4 4L19 7' },
  error:   { fond: 'bg-[#c0392b]', icone: 'M6 18L18 6M6 6l12 12' },
  warning: { fond: 'bg-amber-500', icone: 'M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z' },
  info:    { fond: 'bg-slate-700', icone: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
};

@Component({
  selector: 'app-toast-container',
  standalone: true,
  template: `
    <div class="fixed top-4 right-4 z-[200] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none" aria-live="polite">
      @for (t of toastService.toasts(); track t.id) {
        <div class="toast pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl shadow-lg text-white {{ styles[t.type].fond }}"
             [class.toast-sortie]="t.sortie" role="status">
          <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="styles[t.type].icone" />
          </svg>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold">{{ t.titre }}</p>
            @if (t.message) { <p class="text-xs opacity-90 mt-0.5 break-words">{{ t.message }}</p> }
          </div>
          <button type="button" (click)="toastService.fermer(t.id)" class="p-1 -m-1 rounded-lg hover:bg-white/20" aria-label="Fermer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast { animation: toast-entree 300ms cubic-bezier(.2,.8,.2,1) both; }
    .toast-sortie { animation: toast-sortie 300ms ease-in both; }
    @keyframes toast-entree { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes toast-sortie { from { transform: translateX(0); opacity: 1; } to { transform: translateX(120%); opacity: 0; } }
  `],
})
export class ToastContainer {
  readonly toastService = inject(ToastService);
  readonly styles = STYLES;
}
