// src/features/dashboard/agent/agent-dashboard/agent-dashboard.ts
import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, ChangeDetectorRef, NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';
import { StatCard as StatCardComponent } from '../../../../shared/components/stat-card/stat-card';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

// ── Couleurs hex par module ───────────────────────────────────────────────────
const MODULE_HEX: Record<string, string> = {
  CANDIDATURES:     '#ea580c',
  CANDIDATS:        '#4f46e5',
  STAGE:            '#059669',
  SUIVI_STAGE:      '#0d9488',
  OFFRE:            '#d97706',
  AIDE:             '#e11d48',
  DEMANDE_AUDIENCE: '#9333ea',
  AGENTS:           '#4b5563',
  SERVICES:         '#0891b2',
};

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
  CANDIDATURES: {
    label: 'Candidatures',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    route: '/dashboard/agent/candidatures',
    color: 'text-orange-600', bgColor: 'bg-orange-50', accentClass: 'bg-orange-500',
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
  SUSPENSION_STAGE: {
    label: 'Suspensions / Annulations',
    icon: 'M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z',
    route: '/dashboard/agent/suspensions',
    color: 'text-orange-600', bgColor: 'bg-orange-50', accentClass: 'bg-orange-500',
  },
  OFFRE: {
    label: 'Offres Commerciales',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    route: '/dashboard/agent/offres',
    color: 'text-amber-600', bgColor: 'bg-amber-50', accentClass: 'bg-amber-500',
  },
  AIDE: {
    label: 'Aides Sociales',
    icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    route: '/dashboard/agent/aides',
    color: 'text-rose-600', bgColor: 'bg-rose-50', accentClass: 'bg-rose-500',
  },
  DEMANDE_AUDIENCE: {
    label: "Demandes d'Audience",
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    route: '/dashboard/agent/audiences',
    color: 'text-purple-600', bgColor: 'bg-purple-50', accentClass: 'bg-purple-500',
  },
  AGENTS: {
    label: 'Agents',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    route: '/dashboard/agent/agents',
    color: 'text-gray-600', bgColor: 'bg-gray-100', accentClass: 'bg-gray-500',
  },
  SERVICES: {
    label: 'Services',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    route: '/dashboard/agent/services',
    color: 'text-cyan-600', bgColor: 'bg-cyan-50', accentClass: 'bg-cyan-500',
  },
};

// ── Interfaces ────────────────────────────────────────────────────────────────
interface StatCard {
  module:        string;
  label:         string;
  value:         number;
  subText:       string;
  icon:          string;
  color:         string;
  bgColor:       string;
  accentClass:   string;
  route:         string;
  trend:         number | null;
  sparklineData: number[];
  sparklinePath: string;
  sparklineFill: string;
}

// Carte KPI affichée (répartition par statut), style unifié app-stat-card
interface KpiCard {
  label:    string;
  value:    number;
  sublabel: string;
  accent:   string;
  icon:     string;
  route:    string;
}

// Accent (couleur) principal par module pour la carte « Total »
const MODULE_ACCENT: Record<string, string> = {
  STAGE: 'emerald', SUIVI_STAGE: 'teal', SUSPENSION_STAGE: 'orange', CANDIDATURES: 'orange',
  CANDIDATS: 'indigo', OFFRE: 'violet', AIDE: 'rose', DEMANDE_AUDIENCE: 'blue',
};

// Icônes génériques par statut
const ICON_CLOCK = 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z';
const ICON_CHECK = 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
const ICON_PLAY  = 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4';

interface PendingItem {
  module:   string;
  label:    string;
  count:    number;
  route:    string;
  priority: 'high' | 'medium' | 'low';
}

interface QuickLink {
  label:       string;
  description: string;
  icon:        string;
  route:       string;
  color:       string;
  bgColor:     string;
}

// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-agent-dashboard',
  imports: [CommonModule, RouterModule, StatCardComponent],
  template: `
    <div class="space-y-4 pb-6">

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- EN-TÊTE                                                             -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl flex-shrink-0 shadow-sm
                      bg-gradient-to-br from-red-500 to-red-700
                      flex items-center justify-center
                      text-white font-extrabold text-lg select-none">
            {{ initial }}
          </div>
          <div>
            <h1 class="text-xl font-bold text-gray-900 leading-tight">Bonjour, {{ username }}</h1>
            <div class="flex items-center gap-2 mt-1 flex-wrap">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5
                           bg-red-50 border border-red-100 rounded-full
                           text-[11px] font-semibold text-red-600">
                <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd"
                        d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                        clip-rule="evenodd"/>
                </svg>
                {{ roleDescription }}
              </span>
              <span *ngIf="!isLoading && statCards.length > 0"
                    class="text-[11px] text-gray-400 font-medium">
                {{ statCards.length }} module(s) actif(s)
              </span>
            </div>
          </div>
        </div>
        <div class="hidden sm:flex flex-col items-end text-right flex-shrink-0">
          <p class="text-sm font-semibold text-gray-700 capitalize">{{ todayDate }}</p>
          <p class="text-[11px] text-gray-400 mt-0.5">SONABHY Portail</p>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- SKELETON                                                            -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <div *ngIf="isLoading" class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div *ngFor="let i of [1,2,3,4]"
             class="bg-white rounded-2xl border border-gray-100 animate-pulse p-5 space-y-4">
          <div class="flex items-center justify-between">
            <div class="w-10 h-10 bg-gray-100 rounded-xl"></div>
            <div class="w-12 h-5 bg-gray-100 rounded-full"></div>
          </div>
          <div class="w-16 h-9 bg-gray-100 rounded-lg"></div>
          <div class="w-full h-8 bg-gray-50 rounded-lg"></div>
          <div class="w-24 h-2.5 bg-gray-50 rounded"></div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- KPI CARDS — répartition par statut (style unifié)                  -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <div *ngIf="!isLoading && kpis.length > 0"
           class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <a *ngFor="let k of kpis" [routerLink]="k.route"
           class="block focus:outline-none hover:-translate-y-0.5 transition-transform duration-200">
          <app-stat-card [accent]="$any(k.accent)" [iconPath]="k.icon" [label]="k.label"
            [value]="k.value" [sublabel]="k.sublabel"></app-stat-card>
        </a>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- ÉTAT VIDE                                                           -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <div *ngIf="!isLoading && statCards.length === 0 && quickLinks.length === 0"
           class="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
        <div class="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg class="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>
        <p class="text-sm font-bold text-gray-500">Aucun module accessible</p>
        <p class="text-xs text-gray-300 mt-1">
          Contactez l'administrateur pour obtenir des permissions
        </p>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- GRAPHIQUE + À TRAITER                                               -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <div *ngIf="!isLoading && statCards.length > 0"
           class="grid grid-cols-1 lg:grid-cols-5 gap-4">

        <!-- Graphique d'évolution — 3/5 -->
        <div class="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div class="flex items-center justify-between px-5 py-3.5 bg-gray-50/70 border-b border-gray-100">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-slate-700 flex-shrink-0"></span>
              <h2 class="text-sm font-bold text-gray-800">Activité — 7 derniers jours</h2>
            </div>
          </div>
          <div class="p-4 h-52">
            <canvas #evolutionChart></canvas>
          </div>
        </div>

        <!-- À traiter — 2/5 -->
        <div class="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm
                    overflow-hidden flex flex-col">
          <div class="flex items-center justify-between px-5 py-3.5 bg-gray-50/70 border-b border-gray-100">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full flex-shrink-0"
                    [ngClass]="pendingItems.length > 0 ? 'bg-amber-400 animate-pulse' : 'bg-gray-300'"></span>
              <h2 class="text-sm font-bold text-gray-800">À traiter</h2>
            </div>
            <span class="min-w-[28px] h-6 px-2 inline-flex items-center justify-center
                         rounded-full text-xs font-extrabold"
                  [ngClass]="pendingItems.length > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'">
              {{ pendingItems.length }}
            </span>
          </div>

          <div class="flex-1 overflow-y-auto divide-y divide-gray-50/80">
            <a *ngFor="let item of pendingItems"
               [routerLink]="item.route"
               class="flex items-center gap-3 px-5 py-3.5
                      hover:bg-gray-50/70 transition-colors cursor-pointer group">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                   [ngClass]="getModuleBg(item.module)">
                <svg class="w-4 h-4" [ngClass]="getModuleColor(item.module)"
                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75"
                        [attr.d]="getModuleIcon(item.module)"/>
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-800 group-hover:text-gray-900 truncate">
                  {{ item.label }}
                </p>
                <span class="inline-flex items-center mt-0.5 px-1.5 py-0.5
                             text-[11px] font-bold rounded border"
                      [ngClass]="getPriorityClass(item.priority)">
                  {{ getPriorityLabel(item.priority) }}
                </span>
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                <span class="text-xl font-extrabold tabular-nums"
                      [ngClass]="getModuleColor(item.module)">{{ item.count }}</span>
                <svg class="w-3.5 h-3.5 text-gray-200 group-hover:text-gray-500 transition-colors"
                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M9 5l7 7-7 7"/>
                </svg>
              </div>
            </a>

            <!-- Vide -->
            <div *ngIf="pendingItems.length === 0"
                 class="flex flex-col items-center justify-center py-12 px-5 text-center">
              <div class="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-3">
                <svg class="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <p class="text-sm font-bold text-gray-500">Tout est à jour !</p>
              <p class="text-xs text-gray-300 mt-1">Aucun élément en attente</p>
            </div>
          </div>
        </div>

      </div>

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- MODULES DISPONIBLES — tuiles pleine largeur                        -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <div *ngIf="!isLoading && quickLinks.length > 0"
           class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3.5 bg-gray-50/70 border-b border-gray-100">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></span>
            <h2 class="text-sm font-bold text-gray-800">Modules disponibles</h2>
          </div>
          <span class="text-[11px] font-semibold text-gray-400">{{ quickLinks.length }} accès</span>
        </div>

        <div class="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
          <a *ngFor="let link of quickLinks"
             [routerLink]="link.route"
             class="group flex flex-col items-center gap-3 p-4 rounded-xl
                    border border-gray-100 hover:border-gray-200
                    hover:shadow-lg hover:-translate-y-1
                    transition-all duration-200 cursor-pointer text-center">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center
                        shadow-sm group-hover:shadow-md transition-shadow duration-200"
                 [ngClass]="link.bgColor">
              <svg class="w-5 h-5" [ngClass]="link.color"
                   fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75"
                      [attr.d]="link.icon"/>
              </svg>
            </div>
            <div class="w-full">
              <p class="text-xs font-bold text-gray-800 group-hover:text-gray-900 leading-snug">
                {{ link.label }}
              </p>
              <p class="text-[11px] text-gray-400 mt-0.5 leading-snug line-clamp-2">
                {{ link.description }}
              </p>
            </div>
          </a>
        </div>
      </div>

    </div>
  `,
})
export class AgentDashboard implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('evolutionChart') chartCanvas!: ElementRef<HTMLCanvasElement>;

  username        = '';
  initial         = '';
  roleDescription = '';
  todayDate       = '';
  isLoading       = true;

  statCards:    StatCard[]    = []; // série par module (pour le graphique)
  kpis:         KpiCard[]     = []; // cartes affichées (répartition par statut)
  pendingItems: PendingItem[] = [];
  quickLinks:   QuickLink[]   = [];

  private evolutionChart: Chart | null = null;
  private chartReady = false;

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

  ngAfterViewInit(): void {
    this.chartReady = true;
    if (!this.isLoading && this.statCards.length > 0) {
      this.initEvolutionChart();
    }
  }

  ngOnDestroy(): void {
    this.evolutionChart?.destroy();
    this.evolutionChart = null;
  }

  // ── Chargement des données ─────────────────────────────────────────────────

  loadStats(): void {
    this.isLoading = true;
    this.http.get<any>(`${this.apiUrl}/stats`, { withCredentials: true }).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            const { stats, accessibleModules, pendingItems, evolution } = response.data;
            this.buildStatCards(stats, accessibleModules, evolution || {});
            this.buildKpis(stats, accessibleModules);
            this.buildQuickLinks(accessibleModules);
            this.pendingItems = pendingItems || [];
          }
          this.isLoading = false;
          this.cdr.detectChanges();
          // Initialiser le graphique après que le canvas soit rendu
          setTimeout(() => this.initEvolutionChart(), 0);
        });
      },
      error: () => {
        this.ngZone.run(() => {
          const modules = this.authService.getAccessibleModules();
          this.buildQuickLinks(modules);
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  // ── Construction des cartes KPI ───────────────────────────────────────────

  private buildStatCards(stats: any, modules: string[], evolution: Record<string, number[]>): void {
    this.statCards = [];

    const add = (module: string, value: number, subText: string) => {
      const m = MODULE_META[module];
      if (!m) return;
      // Utiliser les données réelles du backend (historique 7 jours)
      // Fallback : tableau de 0 si le backend ne renvoie pas encore l'historique
      const sparklineData = (evolution[module] && evolution[module].length === 7)
        ? evolution[module]
        : Array(7).fill(0);
      const { line, fill } = this.buildSparklinePaths(sparklineData);
      const trend = this.computeTrend(sparklineData);
      this.statCards.push({
        module, label: m.label, value, subText,
        icon: m.icon, color: m.color, bgColor: m.bgColor,
        accentClass: m.accentClass, route: m.route,
        trend, sparklineData, sparklinePath: line, sparklineFill: fill,
      });
    };

    if ((modules.includes('STAGE') || modules.includes('SUIVI_STAGE')) && stats.stages) {
      add('STAGE', stats.stages.total,
        `${stats.stages.enAttente} en attente · ${stats.stages.enCours} en cours`);
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

  /** Construit les cartes KPI affichées (répartition par statut, style unifié). */
  private buildKpis(stats: any, modules: string[]): void {
    this.kpis = [];
    const push = (label: string, value: number, sublabel: string, accent: string, icon: string, route: string) =>
      this.kpis.push({ label, value: value ?? 0, sublabel, accent, icon, route });

    if ((modules.includes('STAGE') || modules.includes('SUIVI_STAGE')) && stats.stages) {
      const r = MODULE_META['STAGE'].route;
      push('Stages', stats.stages.total, 'Total des demandes', MODULE_ACCENT['STAGE'], MODULE_META['STAGE'].icon, r);
      push('En attente', stats.stages.enAttente, 'Stages à traiter', 'amber', ICON_CLOCK, r);
      push('En cours', stats.stages.enCours, 'Stages actifs', 'blue', ICON_PLAY, r);
    }
    if (modules.includes('SUSPENSION_STAGE') && stats.suspensions) {
      const m = MODULE_META['SUSPENSION_STAGE'];
      push('Suspension / Annulation', stats.suspensions.enAttente, 'Demandes à traiter', 'orange', m.icon, m.route);
    }
    if (modules.includes('CANDIDATURES') && stats.candidatures) {
      const r = MODULE_META['CANDIDATURES'].route;
      push('Candidatures', stats.candidatures.total, 'Total reçues', MODULE_ACCENT['CANDIDATURES'], MODULE_META['CANDIDATURES'].icon, r);
      push('En attente', stats.candidatures.enAttente, 'Candidatures à traiter', 'amber', ICON_CLOCK, r);
    }
    if (modules.includes('CANDIDATS') && stats.candidats) {
      const r = MODULE_META['CANDIDATS'].route;
      push('Candidats', stats.candidats.total, 'Inscrits', MODULE_ACCENT['CANDIDATS'], MODULE_META['CANDIDATS'].icon, r);
    }
    if (modules.includes('OFFRE') && stats.offres) {
      const r = MODULE_META['OFFRE'].route;
      push('Offres', stats.offres.total, 'Total', MODULE_ACCENT['OFFRE'], MODULE_META['OFFRE'].icon, r);
      push('En attente', stats.offres.enAttente, 'Offres à traiter', 'amber', ICON_CLOCK, r);
      push('Validées', stats.offres.validees, 'Offres validées', 'emerald', ICON_CHECK, r);
    }
    if (modules.includes('AIDE') && stats.aides) {
      const r = MODULE_META['AIDE'].route;
      push('Aides', stats.aides.total, 'Total', MODULE_ACCENT['AIDE'], MODULE_META['AIDE'].icon, r);
      push('En attente', stats.aides.enAttente, 'Aides à traiter', 'amber', ICON_CLOCK, r);
      push('Validées', stats.aides.validees, 'Aides validées', 'emerald', ICON_CHECK, r);
    }
    if (modules.includes('DEMANDE_AUDIENCE') && stats.audiences) {
      const r = MODULE_META['DEMANDE_AUDIENCE'].route;
      push('Audiences', stats.audiences.total, 'Total', MODULE_ACCENT['DEMANDE_AUDIENCE'], MODULE_META['DEMANDE_AUDIENCE'].icon, r);
      push('En attente', stats.audiences.enAttente, 'Audiences à traiter', 'amber', ICON_CLOCK, r);
    }
  }

  private buildQuickLinks(modules: string[]): void {
    const descriptions: Record<string, string> = {
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

  // ── Sparklines (données réelles issues du backend) ───────────────────────

  /** Calcule les points SVG (viewBox 0 0 80 32) pour la ligne et l'aire. */
  private buildSparklinePaths(data: number[]): { line: string; fill: string } {
    if (!data || data.length < 2) return { line: '', fill: '' };
    const W = 80, H = 28, PAD = 2;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    const pts = data.map((v, i) => ({
      x: +((i / (data.length - 1)) * W).toFixed(1),
      y: +(H - ((v - min) / range) * (H - PAD * 2) - PAD).toFixed(1),
    }));

    const line = pts.map(p => `${p.x},${p.y}`).join(' ');
    const fill = `${line} ${W},${H + PAD} 0,${H + PAD}`;
    return { line, fill };
  }

  /** % d'évolution entre le 1er et le dernier point. Null si tous à 0. */
  private computeTrend(data: number[]): number | null {
    if (data.length < 2) return null;
    const first = data[0];
    const last  = data[data.length - 1];
    if (first === 0 && last === 0) return null; // Pas de données, pas de tendance
    if (first === 0) return null;
    return Math.round(((last - first) / first) * 100);
  }

  // ── Graphique Chart.js (données réelles 7 jours) ─────────────────────────

  private initEvolutionChart(): void {
    if (!this.chartCanvas?.nativeElement || this.evolutionChart || !this.statCards.length) return;

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Labels : 7 derniers jours
    const labels = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
    });

    // Un dataset par module (max 5 pour lisibilité)
    const datasets = this.statCards.slice(0, 5).map(card => ({
      label:                card.label,
      data:                 card.sparklineData,
      borderColor:          this.getModuleHex(card.module),
      backgroundColor:      this.getModuleHex(card.module) + '15',
      borderWidth:          2,
      pointRadius:          3,
      pointHoverRadius:     5,
      pointBackgroundColor: this.getModuleHex(card.module),
      tension:              0.4,
      fill:                 false,
    }));

    this.evolutionChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display:  true,
            position: 'top',
            align:    'start',
            labels: {
              boxWidth:      8,
              boxHeight:     8,
              borderRadius:  4,
              usePointStyle: true,
              pointStyle:    'circle',
              font:          { size: 11, weight: 'bold' },
              color:         '#6b7280',
              padding:       16,
            },
          },
          tooltip: {
            mode:            'index',
            intersect:       false,
            backgroundColor: '#0f172a',
            titleColor:      '#f1f5f9',
            bodyColor:       '#94a3b8',
            borderColor:     '#334155',
            borderWidth:     1,
            padding:         10,
            titleFont:       { size: 12, weight: 'bold' },
            bodyFont:        { size: 11 },
            cornerRadius:    8,
          },
        },
        scales: {
          x: {
            grid:   { display: false },
            ticks:  { font: { size: 11 }, color: '#9ca3af', maxRotation: 0 },
            border: { display: false },
          },
          y: {
            grid:        { color: '#f3f4f6', drawTicks: false },
            ticks:       { font: { size: 11 }, color: '#9ca3af', stepSize: 1 },
            border:      { display: false },
            beginAtZero: true,
          },
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        animation:   { duration: 600, easing: 'easeInOutQuart' },
      },
    });
  }

  // ── Helpers publics (template) ────────────────────────────────────────────

  getModuleHex(module: string): string {
    return MODULE_HEX[module] ?? '#6b7280';
  }

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
      high:   'bg-red-50 text-red-700 border-red-200',
      medium: 'bg-amber-50 text-amber-700 border-amber-200',
      low:    'bg-emerald-50 text-emerald-700 border-emerald-200',
    } as Record<string, string>)[priority] ?? 'bg-gray-100 text-gray-500 border-gray-200';
  }

  getPriorityLabel(priority: string): string {
    return ({
      high: 'Urgent', medium: 'Normal', low: 'Faible',
    } as Record<string, string>)[priority] ?? 'Normal';
  }
}
