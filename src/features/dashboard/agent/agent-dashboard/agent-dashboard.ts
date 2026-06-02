// src/features/dashboard/agent/agent-dashboard/agent-dashboard.ts
import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

// ── Métadonnées par module ────────────────────────────────────────────────────
interface ModuleMeta {
  label: string;
  icon: string;
  route: string;
  color: string;
  bgColor: string;
  accentClass: string;
}

const MODULE_META: Record<string, ModuleMeta> = {
  RECRUTEMENT: {
    label: 'Recrutements',
    icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    route: '/dashboard/agent/recrutements',
    color: 'text-blue-600', bgColor: 'bg-blue-50', accentClass: 'bg-blue-500',
  },
  CANDIDATURES: {
    label: 'Candidatures',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    route: '/dashboard/agent/candidatures',
    color: 'text-orange-600', bgColor: 'bg-orange-50', accentClass: 'bg-orange-400',
  },
  CANDIDATS: {
    label: 'Candidats',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    route: '/dashboard/agent/candidats',
    color: 'text-indigo-600', bgColor: 'bg-indigo-50', accentClass: 'bg-indigo-500',
  },
  STAGE: {
    label: 'Stages',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    route: '/dashboard/agent/stages',
    color: 'text-emerald-600', bgColor: 'bg-emerald-50', accentClass: 'bg-emerald-500',
  },
  SUIVI_STAGE: {
    label: 'Suivi des Stages',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    route: '/dashboard/agent/suivi-stages',
    color: 'text-teal-600', bgColor: 'bg-teal-50', accentClass: 'bg-teal-500',
  },
  OFFRE: {
    label: 'Offres Commerciales',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    route: '/dashboard/agent/offres',
    color: 'text-amber-600', bgColor: 'bg-amber-50', accentClass: 'bg-amber-400',
  },
  AIDE: {
    label: 'Aides Sociales',
    icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    route: '/dashboard/agent/aides',
    color: 'text-rose-600', bgColor: 'bg-rose-50', accentClass: 'bg-rose-400',
  },
  DEMANDE_AUDIENCE: {
    label: "Demandes d'Audience",
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    route: '/dashboard/agent/audiences',
    color: 'text-purple-600', bgColor: 'bg-purple-50', accentClass: 'bg-purple-400',
  },
  AGENTS: {
    label: 'Agents',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    route: '/dashboard/agent/agents',
    color: 'text-gray-600', bgColor: 'bg-gray-50', accentClass: 'bg-gray-400',
  },
  SERVICES: {
    label: 'Services',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    route: '/dashboard/agent/services',
    color: 'text-cyan-600', bgColor: 'bg-cyan-50', accentClass: 'bg-cyan-400',
  },
};

// ── Interfaces ───────────────────────────────────────────────────────────────
interface StatCard {
  module: string;
  label: string;
  value: number;
  subText: string;
  icon: string;
  color: string;
  bgColor: string;
  accentClass: string;
  route: string;
}

interface PendingItem {
  module: string;
  label: string;
  count: number;
  route: string;
  priority: 'high' | 'medium' | 'low';
}

interface QuickLink {
  label: string;
  description: string;
  icon: string;
  route: string;
  color: string;
  bgColor: string;
}

@Component({
  selector: 'app-agent-dashboard',
  imports: [CommonModule, RouterModule],
  template: `
    <div class="space-y-5 pb-4">

      <!-- ── En-tête ──────────────────────────────────────────────────────── -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="h-0.5 bg-gradient-to-r from-red-600 via-red-500 to-red-400"></div>
        <div class="p-5 sm:p-6 flex items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center
                        text-white font-bold text-lg flex-shrink-0 shadow">
              {{ initial }}
            </div>
            <div>
              <h2 class="text-lg font-bold text-gray-900 leading-tight">Bonjour, {{ username }}</h2>
              <div class="flex items-center gap-2 mt-1 flex-wrap">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700
                             text-xs font-semibold rounded-md border border-red-100">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {{ roleDescription }}
                </span>
                <span *ngIf="!isLoading" class="text-xs text-gray-400">
                  {{ statCards.length }} module(s) avec données
                </span>
              </div>
            </div>
          </div>
          <div class="hidden sm:flex flex-col items-end text-right flex-shrink-0">
            <p class="text-sm font-semibold text-gray-800">{{ todayDate }}</p>
            <p class="text-xs text-gray-400 mt-0.5">SONABHY Portail</p>
          </div>
        </div>
      </div>

      <!-- ── Skeleton de chargement ────────────────────────────────────────── -->
      <div *ngIf="isLoading" class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div *ngFor="let i of [1,2,3,4]"
             class="bg-white rounded-2xl border border-gray-100 shadow-sm h-36 animate-pulse">
          <div class="h-full p-5 space-y-3">
            <div class="flex justify-between">
              <div class="w-10 h-10 bg-gray-100 rounded-xl"></div>
            </div>
            <div class="w-14 h-8 bg-gray-100 rounded"></div>
            <div class="w-28 h-3 bg-gray-50 rounded"></div>
            <div class="w-20 h-2 bg-gray-50 rounded"></div>
          </div>
        </div>
      </div>

      <!-- ── Cartes de statistiques par module ─────────────────────────── -->
      <div *ngIf="!isLoading && statCards.length > 0"
           class="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <a *ngFor="let card of statCards"
           [routerLink]="card.route"
           class="group relative bg-white rounded-2xl shadow-sm border border-gray-100
                  hover:shadow-md hover:-translate-y-0.5 transition-all duration-200
                  cursor-pointer overflow-hidden">

          <!-- Bandeau coloré à gauche -->
          <div class="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
               [ngClass]="card.accentClass"></div>

          <div class="p-4 sm:p-5 pl-5 sm:pl-6">
            <div class="flex items-start justify-between mb-4">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                   [ngClass]="card.bgColor">
                <svg class="w-[18px] h-[18px]" [ngClass]="card.color"
                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75"
                        [attr.d]="card.icon" />
                </svg>
              </div>
            </div>

            <!-- Valeur principale -->
            <p class="text-3xl sm:text-4xl font-bold text-gray-900 tabular-nums leading-none">
              {{ card.value | number }}
            </p>
            <p class="text-xs sm:text-sm text-gray-500 font-medium mt-2 leading-snug">
              {{ card.label }}
            </p>

            <!-- Sous-texte -->
            <div class="mt-3 pt-3 border-t border-gray-50">
              <span class="text-xs text-gray-400">{{ card.subText }}</span>
            </div>
          </div>
        </a>
      </div>

      <!-- ── Section inférieure ────────────────────────────────────────────── -->
      <div *ngIf="!isLoading" class="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <!-- À traiter (1/3) -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div class="flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"></span>
              <h2 class="text-sm font-semibold text-gray-800">À traiter</h2>
            </div>
            <span class="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5
                         text-xs font-bold rounded-full"
                  [ngClass]="pendingItems.length > 0
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-400'">
              {{ pendingItems.length }}
            </span>
          </div>

          <div class="flex-1 divide-y divide-gray-50 overflow-y-auto">
            <a *ngFor="let item of pendingItems"
               [routerLink]="item.route"
               class="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/60 transition-colors cursor-pointer">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                   [ngClass]="getModuleBg(item.module)">
                <svg class="w-4 h-4" [ngClass]="getModuleColor(item.module)"
                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75"
                        [attr.d]="getModuleIcon(item.module)" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-900 truncate">{{ item.label }}</p>
                <span class="inline-flex mt-1 px-1.5 py-0.5 text-xs font-semibold rounded-md border"
                      [ngClass]="getPriorityClass(item.priority)">
                  {{ getPriorityLabel(item.priority) }}
                </span>
              </div>
              <span class="text-sm font-bold tabular-nums flex-shrink-0"
                    [ngClass]="getModuleColor(item.module)">
                {{ item.count }}
              </span>
            </a>

            <!-- Vide -->
            <div *ngIf="pendingItems.length === 0"
                 class="flex flex-col items-center justify-center py-10 text-center">
              <div class="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-3">
                <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p class="text-sm font-medium text-gray-500">Tout est à jour !</p>
              <p class="text-xs text-gray-300 mt-1">Aucun élément en attente</p>
            </div>
          </div>
        </div>

        <!-- Accès rapide (2/3) -->
        <div class="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div class="flex items-center gap-2 mb-4">
            <span class="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>
            <h2 class="text-sm font-semibold text-gray-800">Accès rapide</h2>
            <span class="ml-auto text-xs text-gray-400">{{ quickLinks.length }} modules</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-1">
            <a *ngFor="let link of quickLinks"
               [routerLink]="link.route"
               class="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-transparent
                      hover:border-gray-100 hover:bg-gray-50 transition-all group cursor-pointer">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                   [ngClass]="link.bgColor">
                <svg class="w-4 h-4" [ngClass]="link.color"
                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75"
                        [attr.d]="link.icon" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-800 group-hover:text-gray-900 truncate">
                  {{ link.label }}
                </p>
                <p class="text-xs text-gray-400 truncate">{{ link.description }}</p>
              </div>
              <svg class="w-4 h-4 text-gray-200 group-hover:text-gray-400 flex-shrink-0 transition-colors"
                   fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </a>

            <!-- Vide -->
            <div *ngIf="quickLinks.length === 0"
                 class="col-span-2 flex flex-col items-center justify-center py-10 text-center">
              <div class="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                <svg class="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p class="text-sm font-medium text-gray-400">Aucun module accessible</p>
              <p class="text-xs text-gray-300 mt-1">Contactez l'administrateur</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  `,
})
export class AgentDashboard implements OnInit {

  username      = '';
  initial       = '';
  roleDescription = '';
  todayDate     = '';
  isLoading     = true;

  statCards:    StatCard[]    = [];
  pendingItems: PendingItem[] = [];
  quickLinks:   QuickLink[]   = [];

  private readonly apiUrl = `${environment.apiUrl}/agent-dashboard`;

  constructor(
    private authService: AuthService,
    private http:        HttpClient,
    private cdr:         ChangeDetectorRef,
    private ngZone:      NgZone,
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.username        = user.username;
      this.initial         = user.username.charAt(0).toUpperCase();
      this.roleDescription = user.roleDescription || user.role;
    }

    this.todayDate = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    this.loadStats();
  }

  loadStats(): void {
    this.isLoading = true;
    this.http.get<any>(`${this.apiUrl}/stats`, { withCredentials: true }).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            const { stats, accessibleModules, pendingItems } = response.data;
            this.buildStatCards(stats, accessibleModules);
            this.buildQuickLinks(accessibleModules);
            this.pendingItems = pendingItems || [];
          }
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          // Fallback : afficher les liens depuis le token sans stats
          const modules = this.authService.getAccessibleModules();
          this.buildQuickLinks(modules);
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  // ── Builders ──────────────────────────────────────────────────────────────

  private buildStatCards(stats: any, modules: string[]): void {
    this.statCards = [];

    const add = (module: string, value: number, subText: string) => {
      const m = MODULE_META[module];
      if (!m) return;
      this.statCards.push({
        module, label: m.label, value, subText,
        icon: m.icon, color: m.color, bgColor: m.bgColor,
        accentClass: m.accentClass, route: m.route,
      });
    };

    if ((modules.includes('STAGE') || modules.includes('SUIVI_STAGE')) && stats.stages) {
      add('STAGE', stats.stages.total,
        `${stats.stages.enAttente} en attente · ${stats.stages.enCours} en cours`);
    }
    if (modules.includes('RECRUTEMENT') && stats.recrutements) {
      add('RECRUTEMENT', stats.recrutements.campagnesActives,
        `campagnes actives · ${stats.recrutements.totalCampagnes} au total`);
    }
    if (modules.includes('CANDIDATURES') && stats.candidatures) {
      add('CANDIDATURES', stats.candidatures.total,
        `${stats.candidatures.enAttente} en attente`);
    }
    if (modules.includes('CANDIDATS') && stats.candidats) {
      add('CANDIDATS', stats.candidats.total, 'candidats inscrits');
    }
    if (modules.includes('OFFRE') && stats.offres) {
      add('OFFRE', stats.offres.total,
        `${stats.offres.enAttente} en attente · ${stats.offres.validees} validées`);
    }
    if (modules.includes('AIDE') && stats.aides) {
      add('AIDE', stats.aides.total,
        `${stats.aides.enAttente} en attente · ${stats.aides.validees} validées`);
    }
    if (modules.includes('DEMANDE_AUDIENCE') && stats.audiences) {
      add('DEMANDE_AUDIENCE', stats.audiences.total,
        `${stats.audiences.enAttente} en attente`);
    }
  }

  private buildQuickLinks(modules: string[]): void {
    const descriptions: Record<string, string> = {
      RECRUTEMENT:      'Gérer les campagnes de recrutement',
      CANDIDATURES:     'Traiter les candidatures reçues',
      CANDIDATS:        'Consulter et gérer les profils',
      STAGE:            'Gérer les demandes de stage',
      SUIVI_STAGE:      'Suivre les stages en cours',
      OFFRE:            'Gérer les offres et candidatures',
      AIDE:             "Traiter les demandes d'aides",
      DEMANDE_AUDIENCE: "Traiter les demandes d'audience",
      AGENTS:           'Gérer les comptes agents',
      SERVICES:         'Gérer les services',
    };

    this.quickLinks = modules
      .filter(m => MODULE_META[m])
      .map(m => ({
        label:       MODULE_META[m].label,
        description: descriptions[m] ?? '',
        icon:        MODULE_META[m].icon,
        route:       MODULE_META[m].route,
        color:       MODULE_META[m].color,
        bgColor:     MODULE_META[m].bgColor,
      }));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  getModuleIcon(module: string): string {
    return MODULE_META[module]?.icon ?? '';
  }

  getModuleColor(module: string): string {
    return MODULE_META[module]?.color ?? 'text-gray-500';
  }

  getModuleBg(module: string): string {
    return MODULE_META[module]?.bgColor ?? 'bg-gray-50';
  }

  getPriorityClass(priority: string): string {
    return ({
      high:   'bg-red-100 text-red-700 border-red-200',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      low:    'bg-green-100 text-green-700 border-green-200',
    } as Record<string, string>)[priority] ?? 'bg-gray-100 text-gray-500 border-gray-200';
  }

  getPriorityLabel(priority: string): string {
    return ({ high: 'Urgent', medium: 'Normal', low: 'Faible' } as Record<string, string>)[priority] ?? 'Normal';
  }
}
