// src/shared/components/stat-card/stat-card.ts
// Carte statistique réutilisable (style SIGEC) :
// barre d'accent colorée en haut, label, grand chiffre, sous-texte, icône estompée en coin.
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type StatAccent =
  | 'blue' | 'amber' | 'emerald' | 'rose' | 'red'
  | 'indigo' | 'violet' | 'slate' | 'orange' | 'teal';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative bg-white rounded-xl border shadow-sm overflow-hidden transition-shadow h-full hover:shadow-md"
         [ngClass]="active ? 'ring-2 ' + ringClass + ' border-transparent' : 'border-gray-100'">
      <div class="h-1.5 w-full" [ngClass]="barClass"></div>
      <div class="relative p-3 md:p-5">
        <!-- Icône décorative : petite sur mobile, plus grande sur desktop -->
        <svg *ngIf="iconPath"
             class="absolute right-2.5 md:right-5 top-1/2 -translate-y-1/2 w-6 h-6 sm:w-8 sm:h-8 md:w-11 md:h-11"
             [ngClass]="iconClass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" [attr.d]="iconPath"></path>
        </svg>
        <p class="text-[11px] md:text-sm text-gray-500 leading-tight pr-8 md:pr-12 truncate">{{ label }}</p>
        <p class="text-xl md:text-3xl font-bold text-gray-900 mt-1 leading-none tabular-nums">{{ value }}</p>
        <!-- Sous-texte : masqué sous md pour rester compact (comme le dashboard) -->
        <p *ngIf="sublabel" class="hidden md:block text-xs text-gray-400 mt-2 pr-12 truncate">{{ sublabel }}</p>
      </div>
    </div>
  `,
})
export class StatCard {
  @Input() label = '';
  @Input() value: string | number = 0;
  @Input() sublabel?: string;
  @Input() accent: StatAccent = 'blue';
  @Input() iconPath?: string;
  /** Pour les cartes-filtres : ajoute un anneau de sélection */
  @Input() active = false;

  private static readonly BAR: Record<StatAccent, string> = {
    blue: 'bg-blue-500', amber: 'bg-amber-500', emerald: 'bg-emerald-500',
    rose: 'bg-rose-500', red: 'bg-red-500', indigo: 'bg-indigo-500',
    violet: 'bg-violet-500', slate: 'bg-slate-400', orange: 'bg-orange-500',
    teal: 'bg-teal-500',
  };
  private static readonly ICON: Record<StatAccent, string> = {
    blue: 'text-blue-100', amber: 'text-amber-100', emerald: 'text-emerald-100',
    rose: 'text-rose-100', red: 'text-red-100', indigo: 'text-indigo-100',
    violet: 'text-violet-100', slate: 'text-slate-100', orange: 'text-orange-100',
    teal: 'text-teal-100',
  };
  private static readonly RING: Record<StatAccent, string> = {
    blue: 'ring-blue-300', amber: 'ring-amber-300', emerald: 'ring-emerald-300',
    rose: 'ring-rose-300', red: 'ring-red-300', indigo: 'ring-indigo-300',
    violet: 'ring-violet-300', slate: 'ring-slate-300', orange: 'ring-orange-300',
    teal: 'ring-teal-300',
  };

  get barClass(): string { return StatCard.BAR[this.accent] || StatCard.BAR.blue; }
  get iconClass(): string { return StatCard.ICON[this.accent] || StatCard.ICON.blue; }
  get ringClass(): string { return StatCard.RING[this.accent] || StatCard.RING.blue; }
}
