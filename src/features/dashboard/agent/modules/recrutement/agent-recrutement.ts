// src/features/dashboard/agent/modules/recrutement/agent-recrutement.ts
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';

interface Campagne {
  idcampagne: number;
  titreCampagne: string;
  description?: string;
  dateDebut: string;
  dateFin: string;
  statusCampagne: string;
  createdDate: string;
}

@Component({
  selector: 'app-agent-recrutement',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>

      <!-- Toasts -->
      <div class="fixed top-4 right-4 z-[9999] flex flex-col gap-2" style="pointer-events:none">
        <div *ngFor="let t of toasts"
             class="flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm w-80"
             [ngClass]="{'bg-green-600': t.type==='success','bg-red-600': t.type==='error','bg-amber-500': t.type==='warning'}"
             style="pointer-events:auto">
          <div class="flex-1">
            <p class="font-semibold">{{ t.title }}</p>
            <p class="opacity-90">{{ t.message }}</p>
          </div>
          <button (click)="dismissToast(t.id)" class="text-white/70 hover:text-white mt-0.5 flex-shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Hero -->
      <div class="bg-slate-900 relative overflow-hidden mb-8">
        <!-- Dot pattern -->
        <div class="absolute inset-0 opacity-[0.15]"
             style="background-image:radial-gradient(circle,#94a3b8 1px,transparent 1px);background-size:24px 24px"></div>
        <!-- Red glow -->
        <div class="absolute top-0 right-0 w-[500px] h-[220px] rounded-full opacity-20 pointer-events-none"
             style="background:#c0392b;filter:blur(90px)"></div>

        <div class="container-custom relative z-10 py-10 md:py-14">
          <div class="flex flex-col md:flex-row md:items-center gap-6">

            <!-- Left: icon + text + buttons -->
            <div class="flex items-start gap-5 flex-1 min-w-0">
              <div class="w-14 h-14 bg-primary-500 rounded-2xl flex items-center justify-center shadow-2xl ring-4 ring-white/10 flex-shrink-0">
                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-primary-400 text-xs font-semibold uppercase tracking-widest mb-0.5">Agent — Tableau de bord</p>
                <h1 class="text-2xl md:text-3xl font-bold text-white tracking-tight">Recrutements</h1>
                <p class="text-sm text-slate-400 mt-1">Gestion des campagnes de recrutement</p>
                <div class="flex flex-wrap gap-3 mt-4">
                  <button (click)="chargerCampagnes()"
                          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl transition-all">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                    Actualiser
                  </button>
                  <button *ngIf="peutCreer" (click)="ouvrirFormulaire()"
                          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-all shadow-lg">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    Nouvelle campagne
                  </button>
                </div>
              </div>
            </div>

            <!-- Right: stats -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:min-w-[380px]">
              <button *ngFor="let s of statsStatuts"
                      (click)="filtreStatut = (filtreStatut === s.value ? '' : s.value); filtrer()"
                      class="rounded-xl p-3 text-center transition-all border focus:outline-none"
                      [ngClass]="filtreStatut === s.value ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10 hover:bg-white/8'">
                <div class="flex items-center justify-center gap-1.5 mb-1">
                  <span class="inline-block w-2 h-2 rounded-full flex-shrink-0" [ngClass]="s.dot"></span>
                  <p class="text-xs text-slate-300 truncate">{{ s.label }}</p>
                </div>
                <p class="text-2xl font-bold text-white">{{ s.count }}</p>
              </button>
            </div>

          </div>
        </div>
        <div class="h-px w-full" style="background:linear-gradient(to right,transparent,rgba(239,68,68,0.4),transparent)"></div>
      </div>

      <!-- Accès refusé -->
      <div *ngIf="!peutConsulter" class="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
        <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-1">Accès non autorisé</h3>
        <p class="text-sm text-gray-500">Vous n'avez pas la permission de consulter les campagnes de recrutement.</p>
      </div>

      <div *ngIf="peutConsulter" class="grid grid-cols-1 lg:grid-cols-3 gap-8">

        <!-- Main (2/3) -->
        <div class="lg:col-span-2 space-y-4">

          <!-- Filtres -->
          <div class="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
            <div class="flex gap-2">
              <div class="relative flex-1">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
                </svg>
                <input type="text" [(ngModel)]="search" (ngModelChange)="filtrer()"
                       placeholder="Rechercher une campagne..."
                       class="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl focus:ring-2 focus:ring-red-400 outline-none"/>
              </div>
              <button (click)="effacerFiltres()"
                      class="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
                <span class="hidden sm:inline">Effacer</span>
              </button>
            </div>
            <select [(ngModel)]="filtreStatut" (ngModelChange)="filtrer()"
                    class="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-red-400 outline-none">
              <option value="">Tous les statuts</option>
              <option value="BROUILLON">Brouillon</option>
              <option value="ACTIVE">Active</option>
              <option value="CLOTUREE">Clôturée</option>
              <option value="ANNULEE">Annulée</option>
            </select>
          </div>

          <div *ngIf="loading" class="flex justify-center py-12">
            <div class="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div *ngIf="erreur && !loading" class="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">{{ erreur }}</div>

          <div *ngIf="!loading && !erreur">
            <div *ngIf="campagnesFiltrees.length === 0" class="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
              <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              <p class="text-sm text-gray-400">Aucune campagne trouvée</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div *ngFor="let c of campagnesFiltrees"
                   class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                <div class="h-1 w-full" [ngClass]="getStatutBarClass(c.statusCampagne)"></div>
                <div class="p-4 flex-1 flex flex-col gap-3">
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold text-white bg-slate-900">
                      {{ c.titreCampagne.charAt(0).toUpperCase() }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{{ c.titreCampagne }}</p>
                    </div>
                    <span class="px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0" [ngClass]="getStatutClass(c.statusCampagne)">
                      {{ getStatutLabel(c.statusCampagne) }}
                    </span>
                  </div>
                  <p *ngIf="c.description" class="text-xs text-gray-500 line-clamp-2">{{ c.description }}</p>
                  <div class="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                    <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <span>{{ c.dateDebut | date:'dd/MM/yyyy' }}</span>
                    <span class="text-gray-300">→</span>
                    <span>{{ c.dateFin | date:'dd/MM/yyyy' }}</span>
                  </div>
                </div>
                <div class="px-4 py-3 border-t border-gray-100 flex gap-2">
                  <button (click)="voirDetail(c)"
                          class="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                    Voir
                  </button>
                  <button *ngIf="peutModifier" (click)="modifier(c)"
                          class="flex-1 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg transition-colors">Modifier</button>
                  <button *ngIf="peutSupprimer" (click)="supprimer(c)"
                          class="flex-1 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg transition-colors">Supprimer</button>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Sidebar (1/3) -->
        <div class="space-y-4">
          <div class="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <h3 class="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
              Mes permissions
            </h3>
            <div class="space-y-2">
              <div *ngFor="let perm of [
                {label:'Consulter', ok: peutConsulter},
                {label:'Créer', ok: peutCreer},
                {label:'Modifier', ok: peutModifier},
                {label:'Supprimer', ok: peutSupprimer}
              ]" class="flex items-center justify-between px-3 py-2 rounded-xl"
                 [ngClass]="perm.ok ? 'bg-green-50' : 'bg-gray-50'">
                <span class="text-sm font-medium" [ngClass]="perm.ok ? 'text-green-700' : 'text-gray-400'">{{ perm.label }}</span>
                <div class="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                     [ngClass]="perm.ok ? 'bg-green-100' : 'bg-gray-200'">
                  <svg *ngIf="perm.ok" class="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                  </svg>
                  <svg *ngIf="!perm.ok" class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <h3 class="text-sm font-semibold text-gray-900 mb-3">Filtres actifs</h3>
            <div *ngIf="!filtreStatut && !search" class="text-xs text-gray-400">Aucun filtre appliqué</div>
            <div class="space-y-2">
              <div *ngIf="filtreStatut" class="flex items-center justify-between">
                <span class="text-xs text-gray-500">Statut</span>
                <span class="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">{{ getStatutLabel(filtreStatut) }}</span>
              </div>
              <div *ngIf="search" class="flex items-center justify-between">
                <span class="text-xs text-gray-500">Recherche</span>
                <span class="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full truncate max-w-[120px]">{{ search }}</span>
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-3">
              <span class="font-semibold text-gray-700">{{ campagnesFiltrees.length }}</span> campagne(s) affichée(s)
            </p>
          </div>
          <div class="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <h3 class="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Information
            </h3>
            <p class="text-xs text-gray-500 leading-relaxed">Les campagnes de recrutement permettent de gérer les offres d'emploi et les candidatures associées.</p>
          </div>
        </div>

      </div>

      <!-- Modal Détail -->
      <div *ngIf="campagneSelectionnee"
           class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
           (click)="campagneSelectionnee = null">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg"
             (click)="$event.stopPropagation()">
          <!-- Header gradient -->
          <div class="px-6 py-4 rounded-t-2xl flex items-center gap-4"
               style="background:linear-gradient(135deg,#c0392b,#96281b)">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg text-white flex-shrink-0"
                 style="background:rgba(255,255,255,0.2)">
              {{ campagneSelectionnee.titreCampagne.charAt(0).toUpperCase() }}
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-white text-lg leading-tight line-clamp-1">{{ campagneSelectionnee.titreCampagne }}</h3>
            </div>
            <button (click)="campagneSelectionnee = null" class="text-white/70 hover:text-white p-1">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <!-- Corps -->
          <div class="p-6 space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-xs text-gray-500 mb-1">Statut</p>
                <span class="px-2 py-0.5 text-xs font-semibold rounded-full"
                      [ngClass]="getStatutClass(campagneSelectionnee.statusCampagne)">
                  {{ getStatutLabel(campagneSelectionnee.statusCampagne) }}
                </span>
              </div>
              <div>
                <p class="text-xs text-gray-500 mb-1">Date création</p>
                <p class="text-sm font-medium text-gray-800">{{ campagneSelectionnee.createdDate | date:'dd/MM/yyyy' }}</p>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-xs text-gray-500 mb-1">Date de début</p>
                <p class="text-sm font-medium text-gray-800">{{ campagneSelectionnee.dateDebut | date:'dd/MM/yyyy' }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 mb-1">Date de fin</p>
                <p class="text-sm font-medium text-gray-800">{{ campagneSelectionnee.dateFin | date:'dd/MM/yyyy' }}</p>
              </div>
            </div>
            <div *ngIf="campagneSelectionnee.description">
              <p class="text-xs text-gray-500 mb-1">Description</p>
              <p class="text-sm text-gray-700 bg-gray-50 rounded-lg p-2">{{ campagneSelectionnee.description }}</p>
            </div>
          </div>
          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button *ngIf="peutModifier"
                    (click)="modifier(campagneSelectionnee); campagneSelectionnee = null"
                    class="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors">
              Modifier
            </button>
            <button (click)="campagneSelectionnee = null"
                    class="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
              Fermer
            </button>
          </div>
        </div>
      </div>

      <!-- Modal Créer / Modifier Campagne -->
      <div *ngIf="showModal"
           class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
           (click)="fermerModal()">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col"
             (click)="$event.stopPropagation()">
          <!-- Header gradient -->
          <div class="px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-t-2xl"
               style="background:linear-gradient(135deg,#c0392b,#96281b)">
            <div>
              <h3 class="font-bold text-white text-lg">
                {{ modalMode === 'create' ? 'Nouvelle campagne' : 'Modifier la campagne' }}
              </h3>
              <p class="text-white/70 text-xs mt-0.5">
                {{ modalMode === 'create' ? 'Créer une campagne de recrutement' : 'Mettre à jour les informations' }}
              </p>
            </div>
            <button (click)="fermerModal()" [disabled]="soumission" class="text-white/70 hover:text-white disabled:opacity-40 p-1">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Corps modal -->
          <div class="p-6 space-y-4 overflow-y-auto flex-1">
            <!-- Titre campagne -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Titre de la campagne <span class="text-red-500">*</span>
              </label>
              <input type="text" [(ngModel)]="form.titreCampagne"
                     placeholder="Ex: Recrutement techniciens 2025"
                     class="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-400 outline-none"/>
            </div>

            <!-- Description -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea [(ngModel)]="form.description" rows="3"
                        placeholder="Description de la campagne..."
                        class="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-400 outline-none resize-none"></textarea>
            </div>

            <!-- Dates -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Date de début <span class="text-red-500">*</span>
                </label>
                <input type="date" [(ngModel)]="form.dateDebut"
                       class="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-400 outline-none"/>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Date de fin <span class="text-red-500">*</span>
                </label>
                <input type="date" [(ngModel)]="form.dateFin"
                       class="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-400 outline-none"/>
              </div>
            </div>

            <!-- Statut -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <select [(ngModel)]="form.statusCampagne"
                      class="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-400 outline-none">
                <option value="BROUILLON">Brouillon</option>
                <option value="ACTIVE">Active</option>
                <option value="CLOTUREE">Clôturée</option>
                <option value="ANNULEE">Annulée</option>
              </select>
            </div>

            <!-- Erreur formulaire -->
            <div *ngIf="formErreur" class="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex items-start gap-2">
              <svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {{ formErreur }}
            </div>
          </div>

          <!-- Footer modal -->
          <div class="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0">
            <button (click)="fermerModal()" [disabled]="soumission"
                    class="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50">
              Annuler
            </button>
            <button (click)="soumettre()" [disabled]="soumission"
                    class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-50"
                    style="background:#c0392b">
              <svg *ngIf="soumission" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              {{ modalMode === 'create' ? 'Créer la campagne' : 'Enregistrer' }}
            </button>
          </div>
        </div>
      </div>

    </div>
  `,
})
export class AgentRecrutement implements OnInit {

  campagnes: Campagne[] = [];
  campagnesFiltrees: Campagne[] = [];
  loading = false;
  erreur = '';
  search = '';
  filtreStatut = '';
  campagneSelectionnee: Campagne | null = null;

  statsStatuts = [
    { value: 'BROUILLON', label: 'Brouillons', dot: 'bg-blue-400',  ringClass: 'ring-blue-400',   count: 0 },
    { value: 'ACTIVE',    label: 'Actives',    dot: 'bg-green-500', ringClass: 'ring-green-400',  count: 0 },
    { value: 'CLOTUREE',  label: 'Clôturées',  dot: 'bg-gray-400',  ringClass: 'ring-gray-400',   count: 0 },
    { value: 'ANNULEE',   label: 'Annulées',   dot: 'bg-red-500',   ringClass: 'ring-red-400',    count: 0 },
  ];

  // Modal
  showModal = false;
  modalMode: 'create' | 'edit' = 'create';
  campagneEnEdition: Campagne | null = null;
  soumission = false;
  formErreur = '';
  form = {
    titreCampagne: '',
    description: '',
    dateDebut: '',
    dateFin: '',
    statusCampagne: 'BROUILLON',
  };

  // Toasts
  toasts: { id: number; title: string; message: string; type: 'success' | 'error' | 'warning' }[] = [];
  private toastIdCounter = 0;

  // Permissions (réactives)
  get peutConsulter(): boolean { return this.authService.hasPermission('RECRUTEMENT', 'CONSULTER'); }
  get peutCreer():     boolean { return this.authService.hasPermission('RECRUTEMENT', 'CREER'); }
  get peutModifier():  boolean { return this.authService.hasPermission('RECRUTEMENT', 'MODIFIER'); }
  get peutSupprimer(): boolean { return this.authService.hasPermission('RECRUTEMENT', 'SUPPRIMER'); }

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private authService: AuthService, private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnInit(): void {
    if (!this.peutConsulter) return;
    this.chargerCampagnes();
  }

  chargerCampagnes(): void {
    this.loading = true;
    this.erreur = '';
    this.http.get<any>(`${this.apiUrl}/recrutement/campagnes?limit=50`).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.campagnes = res.data?.items || [];
          this.calculerStats();
          this.filtrer();
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.erreur = err.error?.message || 'Erreur lors du chargement des campagnes';
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  calculerStats(): void {
    this.statsStatuts.forEach(s => {
      s.count = this.campagnes.filter(c => c.statusCampagne === s.value).length;
    });
  }

  filtrer(): void {
    this.campagnesFiltrees = this.campagnes.filter(c => {
      const matchSearch = !this.search || c.titreCampagne.toLowerCase().includes(this.search.toLowerCase());
      const matchStatut = !this.filtreStatut || c.statusCampagne === this.filtreStatut;
      return matchSearch && matchStatut;
    });
  }

  effacerFiltres(): void {
    this.search = '';
    this.filtreStatut = '';
    this.filtrer();
  }

  voirDetail(c: Campagne): void {
    this.campagneSelectionnee = c;
    this.cdr.detectChanges();
  }

  ouvrirFormulaire(): void {
    this.form = { titreCampagne: '', description: '', dateDebut: '', dateFin: '', statusCampagne: 'BROUILLON' };
    this.formErreur = '';
    this.campagneEnEdition = null;
    this.modalMode = 'create';
    this.showModal = true;
  }

  modifier(c: Campagne): void {
    this.campagneEnEdition = c;
    this.form = {
      titreCampagne: c.titreCampagne,
      description: c.description || '',
      dateDebut: c.dateDebut ? c.dateDebut.split('T')[0] : '',
      dateFin: c.dateFin ? c.dateFin.split('T')[0] : '',
      statusCampagne: c.statusCampagne,
    };
    this.formErreur = '';
    this.modalMode = 'edit';
    this.showModal = true;
  }

  fermerModal(): void {
    if (this.soumission) return;
    this.showModal = false;
    this.campagneEnEdition = null;
    this.formErreur = '';
  }

  soumettre(): void {
    if (!this.form.titreCampagne.trim()) { this.formErreur = 'Le titre de la campagne est requis'; return; }
    if (!this.form.dateDebut) { this.formErreur = 'La date de début est requise'; return; }
    if (!this.form.dateFin) { this.formErreur = 'La date de fin est requise'; return; }
    if (this.form.dateFin < this.form.dateDebut) { this.formErreur = 'La date de fin doit être après la date de début'; return; }

    this.formErreur = '';
    this.soumission = true;

    if (this.modalMode === 'create') {
      this.http.post<any>(`${this.apiUrl}/recrutement/campagnes`, this.form).subscribe({
        next: (res) => {
          this.ngZone.run(() => {
            const newC = res.data;
            if (newC) { this.campagnes.unshift(newC); }
            this.calculerStats();
            this.filtrer();
            this.soumission = false;
            this.fermerModal();
            this.showToast('Succès', 'Campagne créée avec succès');
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.formErreur = err.error?.message || 'Erreur lors de la création';
            this.soumission = false;
            this.cdr.detectChanges();
          });
        },
      });
    } else {
      this.http.put<any>(`${this.apiUrl}/recrutement/campagnes/${this.campagneEnEdition!.idcampagne}`, this.form).subscribe({
        next: (res) => {
          this.ngZone.run(() => {
            const updated = res.data;
            if (updated) {
              const idx = this.campagnes.findIndex(x => x.idcampagne === this.campagneEnEdition!.idcampagne);
              if (idx !== -1) this.campagnes[idx] = { ...this.campagnes[idx], ...updated };
            }
            this.calculerStats();
            this.filtrer();
            this.soumission = false;
            this.fermerModal();
            this.showToast('Succès', 'Campagne modifiée avec succès');
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.formErreur = err.error?.message || 'Erreur lors de la modification';
            this.soumission = false;
            this.cdr.detectChanges();
          });
        },
      });
    }
  }

  supprimer(c: Campagne): void {
    if (!confirm(`Supprimer la campagne "${c.titreCampagne}" ?`)) return;
    this.http.delete(`${this.apiUrl}/recrutement/campagnes/${c.idcampagne}`).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.campagnes = this.campagnes.filter(x => x.idcampagne !== c.idcampagne);
          this.calculerStats();
          this.filtrer();
          this.showToast('Supprimé', 'Campagne supprimée avec succès', 'warning');
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.showToast('Erreur', err.error?.message || 'Erreur lors de la suppression', 'error');
          this.cdr.detectChanges();
        });
      },
    });
  }

  showToast(title: string, message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    const id = ++this.toastIdCounter;
    this.toasts.push({ id, title, message, type });
    setTimeout(() => this.dismissToast(id), 4000);
  }

  dismissToast(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  getStatutBarClass(s: string): string {
    const c: Record<string, string> = {
      ACTIVE: 'bg-green-500', OUVERTE: 'bg-green-500',
      BROUILLON: 'bg-blue-400', CLOTUREE: 'bg-gray-400', FERMEE: 'bg-gray-400', ANNULEE: 'bg-red-500',
    };
    return c[s] || 'bg-gray-300';
  }

  getStatutLabel(s: string): string {
    const l: Record<string, string> = {
      BROUILLON: 'Brouillon', ACTIVE: 'Active', OUVERTE: 'Ouverte',
      CLOTUREE: 'Clôturée', FERMEE: 'Fermée', ANNULEE: 'Annulée',
    };
    return l[s] || s;
  }

  getStatutClass(s: string): string {
    const c: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-700',
      OUVERTE: 'bg-green-100 text-green-700',
      CLOTUREE: 'bg-gray-100 text-gray-600',
      FERMEE: 'bg-gray-100 text-gray-600',
      BROUILLON: 'bg-blue-100 text-blue-700',
      ANNULEE: 'bg-red-100 text-red-700',
    };
    return c[s] || 'bg-gray-100 text-gray-600';
  }
}
