// src/features/dashboard/agent/agent-module/agent-module.ts
// Composant générique pour afficher un module selon les permissions
// Chaque route de module (recrutements, stages, offres, aides, rapports) pointe ici
// avec le module DB comme data de route
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

// Mapping action → label lisible
const ACTION_LABELS: Record<string, string> = {
  CONSULTER: 'Consulter',
  CREER:     'Créer',
  MODIFIER:  'Modifier',
  VALIDER:   'Valider',
  REJETER:   'Rejeter',
  SUPPRIMER: 'Supprimer',
};

const MODULE_LABELS: Record<string, string> = {
  RECRUTEMENT:      'Recrutements',
  CANDIDATURES:     'Candidatures Reçues',
  CANDIDATS:        'Candidats',
  STAGE:            'Stages',
  SUIVI_STAGE:      'Suivi des Stages',
  OFFRE:            'Offres Commerciales',
  AIDE:             'Aides Sociales',
  DEMANDE_AUDIENCE: 'Demandes d\'Audience',
  AGENTS:           'Agents',
  SERVICES:         'Services',
};

const MODULE_ICONS: Record<string, string> = {
  RECRUTEMENT: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  STAGE:       'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  OFFRE:       'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  AIDE:        'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
};

@Component({
  selector: 'app-agent-module',
  imports: [CommonModule, RouterModule],
  template: `
    <div class="space-y-6">

      <!-- En-tête module -->
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
          <svg class="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" [attr.d]="moduleIcon" />
          </svg>
        </div>
        <div>
          <h1 class="text-xl font-bold text-gray-900">{{ moduleLabel }}</h1>
          <p class="text-sm text-gray-500">Module agent — Espace de travail</p>
        </div>
      </div>

      <!-- Permissions accordées -->
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Vos permissions sur ce module</h3>
        <div class="flex flex-wrap gap-2" *ngIf="actions.length > 0">
          <span *ngFor="let action of actions"
                class="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 border border-violet-200 text-sm font-medium rounded-xl">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            {{ action }}
          </span>
        </div>
        <p *ngIf="actions.length === 0" class="text-sm text-red-500">
          Aucune permission sur ce module.
        </p>
      </div>

      <!-- Contenu principal — placeholder en attendant les vrais composants -->
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="font-semibold text-gray-900">{{ moduleLabel }}</h3>
          <button *ngIf="canCreate"
                  class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl shadow-sm transition-colors"
                  style="background:#7c3aed">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Nouveau
          </button>
        </div>

        <!-- Zone de contenu -->
        <div class="p-8 text-center text-gray-400">
          <svg class="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" [attr.d]="moduleIcon" />
          </svg>
          <p class="text-sm">Les données de ce module seront affichées ici.</p>
          <p class="text-xs mt-1 text-gray-300">Fonctionnalité en cours de développement pour ce rôle.</p>
        </div>
      </div>

    </div>
  `,
})
export class AgentModule implements OnInit {

  moduleName = '';
  moduleLabel = '';
  moduleIcon = '';
  actions: string[] = [];
  canCreate = false;
  canEdit = false;
  canDelete = false;
  canValidate = false;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.moduleName = this.route.snapshot.data['module'] || '';
    this.moduleLabel = MODULE_LABELS[this.moduleName] || this.moduleName;
    this.moduleIcon = MODULE_ICONS[this.moduleName] || '';

    const user = this.authService.getCurrentUser();
    const permissions = user?.permissions || [];

    this.actions = permissions
      .filter(p => p.module === this.moduleName)
      .map(p => ACTION_LABELS[p.action] || p.action);

    this.canCreate   = this.authService.hasPermission(this.moduleName, 'CREER');
    this.canEdit     = this.authService.hasPermission(this.moduleName, 'MODIFIER');
    this.canDelete   = this.authService.hasPermission(this.moduleName, 'SUPPRIMER');
    this.canValidate = this.authService.hasPermission(this.moduleName, 'VALIDER');
  }
}
