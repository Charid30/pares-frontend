// src/features/dashboard/agent/agent-dashboard/agent-dashboard.ts
// Tableau de bord « poste de travail » de l'agent : la file de travail d'abord
// (tâches calculées par le backend selon ses permissions et ses directions),
// puis quelques chiffres clés et les raccourcis vers ses modules.
import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';
import { StatCard as StatCardComponent } from '../../../../shared/components/stat-card/stat-card';

// ── Icônes ────────────────────────────────────────────────────────────────────
const ICONS: Record<string, string> = {
  STAGE:            'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  RENOUVELLEMENT:   'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  RAPPORT:          'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  ARCHIVES:         'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  SUIVI_STAGE:      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  SUSPENSION_STAGE: 'M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z',
  OFFRE:            'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  AIDE:             'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  DEMANDE_AUDIENCE: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  CANDIDATURES:     'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  CANDIDATS:        'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  AGENTS:           'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  SERVICES:         'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  CLOCK:            'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  INBOX:            'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
  USERS:            'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  CALENDAR:         'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
};

// Raccourcis : un ou plusieurs écrans par module accessible
const RACCOURCIS: Record<string, { label: string; route: string; icon: string }[]> = {
  STAGE: [
    { label: 'Stages',           route: '/dashboard/agent/stages',          icon: ICONS['STAGE'] },
    { label: 'Rapports',         route: '/dashboard/agent/rapports',        icon: ICONS['RAPPORT'] },
    { label: 'Archives',         route: '/dashboard/agent/archives',        icon: ICONS['ARCHIVES'] },
  ],
  RENOUVELLEMENT:   [{ label: 'Renouvellements',      route: '/dashboard/agent/renouvellements', icon: ICONS['RENOUVELLEMENT'] }],
  SUIVI_STAGE:      [{ label: 'Suivi des stages',     route: '/dashboard/agent/suivi-stages', icon: ICONS['SUIVI_STAGE'] }],
  SUSPENSION_STAGE: [{ label: 'Suspensions',          route: '/dashboard/agent/suspensions',  icon: ICONS['SUSPENSION_STAGE'] }],
  OFFRE:            [{ label: 'Offres commerciales',  route: '/dashboard/agent/offres',       icon: ICONS['OFFRE'] }],
  AIDE:             [{ label: 'Aides sociales',       route: '/dashboard/agent/aides',        icon: ICONS['AIDE'] }],
  DEMANDE_AUDIENCE: [{ label: 'Audiences',            route: '/dashboard/agent/audiences',    icon: ICONS['DEMANDE_AUDIENCE'] }],
  CANDIDATURES:     [{ label: 'Candidatures',         route: '/dashboard/agent/candidatures', icon: ICONS['CANDIDATURES'] }],
  CANDIDATS:        [{ label: 'Candidats',            route: '/dashboard/agent/candidats',    icon: ICONS['CANDIDATS'] }],
  AGENTS:           [{ label: 'Agents',               route: '/dashboard/agent/agents',       icon: ICONS['AGENTS'] }],
  SERVICES:         [{ label: 'Services',             route: '/dashboard/agent/services',     icon: ICONS['SERVICES'] }],
};

const ACTION_LABELS: Record<string, string> = {
  APPROUVER: 'Approuver', VALIDER: 'Valider', REJETER: 'Rejeter',
};

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Tache {
  cle:        string;
  module:     string;
  action:     string | null;
  label:      string;
  route:      string;
  count:      number;
  plusAncien: string | null;
  priority:   'high' | 'medium' | 'low';
}

interface Echeance {
  cle:    string;
  module: string;
  label:  string;
  route:  string;
  count:  number;
}

interface Kpis {
  aTraiter:       number;
  enStage?:       number;
  demandesTotal?: number;
  demandesMois?:  number;
}

interface Raccourci { label: string; route: string; icon: string; }

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
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-12 h-12 rounded-2xl flex-shrink-0 shadow-sm flex items-center justify-center
                      text-white font-extrabold text-lg select-none"
               style="background: linear-gradient(135deg, #c0392b, #96281b)">
            {{ initial }}
          </div>
          <div class="min-w-0">
            <h1 class="text-xl font-bold text-gray-900 leading-tight">Bonjour, {{ username }}</h1>
            <div class="flex items-center gap-1.5 mt-1 flex-wrap">
              <span class="inline-flex items-center px-2 py-0.5 bg-red-50 border border-red-100 rounded-full
                           text-[11px] font-semibold text-red-700">
                {{ roleDescription }}
              </span>
              <span *ngIf="porteeGlobale"
                    class="inline-flex items-center px-2 py-0.5 bg-gray-100 rounded-full text-[11px] font-medium text-gray-600">
                Toutes les directions
              </span>
              <ng-container *ngIf="!porteeGlobale">
                <span *ngFor="let d of directions"
                      class="inline-flex items-center px-2 py-0.5 bg-gray-100 rounded-full text-[11px] font-medium text-gray-600"
                      [title]="d.nom">
                  {{ d.accronyme || d.nom }}
                </span>
              </ng-container>
              <span class="text-[11px] text-gray-400 capitalize ml-1">{{ todayDate }}</span>
            </div>
          </div>
        </div>
        <span *ngIf="!isLoading && !loadError"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
              [ngClass]="kpis.aTraiter > 0 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'">
          <span class="w-1.5 h-1.5 rounded-full" [ngClass]="kpis.aTraiter > 0 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'"></span>
          {{ kpis.aTraiter > 0 ? kpis.aTraiter + ' dossier(s) en attente de votre action' : 'Rien en attente' }}
        </span>
      </div>

      <!-- Erreur de chargement -->
      <div *ngIf="loadError"
           class="flex items-center justify-between gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
        <p class="text-xs text-red-700">Impossible de charger votre file de travail.</p>
        <button (click)="loadStats()"
                class="text-xs font-semibold py-2 px-3 rounded-lg bg-white border border-red-200 text-red-700 hover:bg-red-100 transition-colors">
          Réessayer
        </button>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- SKELETON                                                            -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <div *ngIf="isLoading" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 space-y-3 animate-pulse">
          <div class="w-40 h-4 bg-gray-100 rounded"></div>
          <div *ngFor="let i of [1,2,3,4]" class="h-12 bg-gray-50 rounded-xl"></div>
        </div>
        <div class="grid grid-cols-2 gap-3 content-start animate-pulse">
          <div *ngFor="let i of [1,2,3,4]" class="h-24 bg-white border border-gray-100 rounded-xl"></div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- FILE DE TRAVAIL + COLONNE DROITE                                    -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <div *ngIf="!isLoading" class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        <!-- Ma file de travail — 2/3 -->
        <div *ngIf="!loadError" class="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div class="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="icons['INBOX']"/>
              </svg>
              <h2 class="text-sm font-bold text-gray-800">Ma file de travail</h2>
            </div>
            <span class="text-[11px] text-gray-400">Selon vos permissions et vos directions</span>
          </div>

          <div class="divide-y divide-gray-50">
            <!-- Tâches -->
            <div *ngFor="let t of taches"
                 class="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/70 transition-colors">
              <div class="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" [attr.d]="getIcon(t.module)"/>
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-800 truncate">{{ t.label }}</p>
                <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span class="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded border"
                        [ngClass]="getPriorityClass(t.priority)">
                    {{ getPriorityLabel(t.priority) }}
                  </span>
                  <span *ngIf="t.plusAncien" class="text-[11px] text-gray-400">
                    plus ancien {{ formatAnciennete(t.plusAncien) }}
                  </span>
                  <span *ngIf="t.action" class="text-[11px] text-gray-400">· {{ getActionLabel(t.action) }}</span>
                </div>
              </div>
              <span class="text-xl font-extrabold tabular-nums text-gray-900 flex-shrink-0">{{ t.count }}</span>
              <a [routerLink]="t.route"
                 class="flex-shrink-0 text-xs font-semibold py-2 px-3 rounded-lg text-white bg-[#c0392b] hover:bg-[#96281b] transition-colors">
                Ouvrir
              </a>
            </div>

            <!-- Échéances (information, pas d'action requise) -->
            <a *ngFor="let e of echeances" [routerLink]="e.route"
               class="flex items-center gap-3 px-5 py-3 bg-amber-50/40 hover:bg-amber-50 transition-colors group">
              <div class="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" [attr.d]="icons['CLOCK']"/>
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-700 truncate">{{ e.label }}</p>
                <p class="text-[11px] text-gray-400 mt-0.5">À surveiller (renouvellement, rapport)</p>
              </div>
              <span class="text-xl font-extrabold tabular-nums text-amber-700 flex-shrink-0">{{ e.count }}</span>
              <svg class="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
            </a>

            <!-- Vide -->
            <div *ngIf="taches.length === 0 && echeances.length === 0"
                 class="flex flex-col items-center justify-center py-12 px-5 text-center">
              <div class="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-3">
                <svg class="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <p class="text-sm font-bold text-gray-600">Tout est à jour</p>
              <p class="text-xs text-gray-400 mt-1">Aucun dossier n'attend votre action dans vos directions.</p>
            </div>
          </div>
        </div>

        <!-- Colonne droite — 1/3 -->
        <div class="space-y-4" [ngClass]="loadError ? 'lg:col-span-3' : ''">

          <!-- Chiffres clés -->
          <div *ngIf="!loadError" class="grid grid-cols-2 gap-3">
            <app-stat-card accent="red" [iconPath]="icons['INBOX']" label="À traiter"
              [value]="kpis.aTraiter" sublabel="Dossiers en attente"></app-stat-card>
            <ng-container *ngIf="kpis.enStage !== undefined">
              <app-stat-card accent="emerald" [iconPath]="icons['USERS']" label="En stage"
                [value]="kpis.enStage" sublabel="Stagiaires actuellement"></app-stat-card>
              <app-stat-card accent="blue" [iconPath]="icons['CALENDAR']" label="Ce mois"
                [value]="kpis.demandesMois ?? 0" sublabel="Demandes reçues"></app-stat-card>
              <app-stat-card accent="slate" [iconPath]="icons['STAGE']" label="Demandes"
                [value]="kpis.demandesTotal ?? 0" sublabel="Total de vos directions"></app-stat-card>
            </ng-container>
          </div>

          <!-- Raccourcis -->
          <div *ngIf="raccourcis.length > 0" class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div class="px-5 py-3.5 border-b border-gray-100">
              <h2 class="text-sm font-bold text-gray-800">Raccourcis</h2>
            </div>
            <div class="p-2 grid grid-cols-2 gap-1">
              <a *ngFor="let r of raccourcis" [routerLink]="r.route"
                 class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-600
                        hover:bg-red-50 hover:text-[#c0392b] transition-colors group">
                <svg class="w-4 h-4 text-gray-400 group-hover:text-[#c0392b] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" [attr.d]="r.icon"/>
                </svg>
                <span class="truncate">{{ r.label }}</span>
              </a>
            </div>
          </div>

          <!-- Aucun module -->
          <div *ngIf="raccourcis.length === 0"
               class="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <p class="text-sm font-bold text-gray-500">Aucun module accessible</p>
            <p class="text-xs text-gray-400 mt-1">Contactez l'administrateur pour obtenir des permissions.</p>
          </div>
        </div>

      </div>
    </div>
  `,
})
export class AgentDashboard implements OnInit {

  readonly icons = ICONS;

  username        = '';
  initial         = '';
  roleDescription = '';
  todayDate       = '';
  isLoading       = true;
  loadError       = false;

  porteeGlobale = false;
  directions: { iddirection: number; nom: string; accronyme?: string }[] = [];
  taches:     Tache[]     = [];
  echeances:  Echeance[]  = [];
  kpis:       Kpis        = { aTraiter: 0 };
  raccourcis: Raccourci[] = [];

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
      weekday: 'long', day: 'numeric', month: 'long',
    });

    this.loadStats();
  }

  // ── Chargement des données ─────────────────────────────────────────────────

  loadStats(): void {
    this.isLoading = true;
    this.loadError = false;
    this.http.get<any>(`${this.apiUrl}/stats`, { withCredentials: true }).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            const d = response.data;
            this.porteeGlobale = !!d.porteeGlobale;
            this.directions    = d.directions || [];
            this.taches        = d.taches || [];
            this.echeances     = d.echeances || [];
            this.kpis          = { aTraiter: 0, ...(d.kpis || {}) };
            this.buildRaccourcis(d.accessibleModules || []);
          }
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.buildRaccourcis(this.authService.getAccessibleModules());
          this.loadError = true;
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  private buildRaccourcis(modules: string[]): void {
    this.raccourcis = modules.flatMap(m => RACCOURCIS[m] ?? []);
  }

  // ── Helpers (template) ────────────────────────────────────────────────────

  getIcon(module: string): string {
    return ICONS[module] ?? ICONS['INBOX'];
  }

  getActionLabel(action: string): string {
    return ACTION_LABELS[action] ?? action;
  }

  /** « aujourd'hui », « hier », « il y a 9 j » */
  formatAnciennete(date: string): string {
    const jours = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
    if (jours <= 0) return "aujourd'hui";
    if (jours === 1) return 'hier';
    return `il y a ${jours} j`;
  }

  getPriorityClass(priority: string): string {
    return ({
      high:   'bg-red-50 text-red-700 border-red-200',
      medium: 'bg-amber-50 text-amber-700 border-amber-200',
      low:    'bg-gray-50 text-gray-500 border-gray-200',
    } as Record<string, string>)[priority] ?? 'bg-gray-50 text-gray-500 border-gray-200';
  }

  getPriorityLabel(priority: string): string {
    return ({
      high: 'Urgent', medium: 'À faire', low: 'Récent',
    } as Record<string, string>)[priority] ?? 'À faire';
  }
}
