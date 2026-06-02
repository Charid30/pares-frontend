// src/features/dashboard/agent/modules/services/agent-services.ts
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';

interface Service {
  idservice: number;
  nomService: string;      // mappé depuis accronyme
  descriptionService?: string; // mappé depuis description
  actif: boolean;          // dérivé de del === 0
  createdDate: string;
}

@Component({
  selector: 'app-agent-services',
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
      <div class="bg-slate-900 relative overflow-hidden">
        <div class="absolute inset-0 opacity-20"
             style="background-image:radial-gradient(circle,#94a3b8 1px,transparent 1px);background-size:24px 24px"></div>
        <div class="absolute top-0 right-0 w-96 h-64 rounded-full opacity-10"
             style="background:#ef4444;filter:blur(80px)"></div>
        <div class="container-custom py-10 md:py-14 relative z-10">
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div class="flex items-center gap-5">
              <div class="w-14 h-14 bg-primary-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                </svg>
              </div>
              <div>
                <p class="text-primary-400 text-xs font-semibold uppercase tracking-widest mb-1">Agent — Tableau de bord</p>
                <h1 class="text-2xl md:text-3xl font-bold text-white">Services</h1>
                <p class="text-slate-400 text-sm mt-1 hidden md:block">Gestion des services de l'organisation</p>
                <div class="flex items-center gap-3 mt-3">
                  <button (click)="charger()"
                          class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                    Actualiser
                  </button>
                  <button *ngIf="peutCreer" (click)="ouvrirFormulaire(null)"
                          class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    Nouveau service
                  </button>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-3 lg:min-w-[340px]">
              <div class="rounded-xl p-3 text-center bg-white/5 border border-white/10">
                <p class="text-xs text-slate-300 mb-1">Total</p>
                <p class="text-2xl font-bold text-white">{{ services.length }}</p>
              </div>
              <div class="rounded-xl p-3 text-center bg-green-500/10 border border-green-500/20">
                <p class="text-xs text-green-300 mb-1">Actifs</p>
                <p class="text-2xl font-bold text-white">{{ servicesActifs }}</p>
              </div>
              <div class="rounded-xl p-3 text-center bg-slate-700/50 border border-white/10">
                <p class="text-xs text-slate-300 mb-1">Inactifs</p>
                <p class="text-2xl font-bold text-white">{{ servicesInactifs }}</p>
              </div>
            </div>
          </div>
        </div>
        <div class="h-px w-full" style="background:linear-gradient(to right,transparent,rgba(239,68,68,0.4),transparent)"></div>
      </div>

      <!-- Content -->
      <div class="container-custom py-8 md:py-12">

        <!-- Accès refusé -->
        <div *ngIf="!peutConsulter" class="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
          <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900 mb-1">Accès non autorisé</h3>
          <p class="text-sm text-gray-500">Vous n'avez pas la permission de consulter les services.</p>
        </div>

        <div *ngIf="peutConsulter" class="grid grid-cols-1 lg:grid-cols-3 gap-8">

          <!-- Main (2/3) -->
          <div class="lg:col-span-2 space-y-4">

            <!-- Filtre -->
            <div class="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex gap-2">
              <div class="relative flex-1">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
                </svg>
                <input type="text" [(ngModel)]="search" (ngModelChange)="filtrer()"
                       placeholder="Rechercher un service..."
                       class="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl focus:ring-2 focus:ring-red-400 outline-none"/>
              </div>
              <button (click)="search = ''; filtrer()"
                      class="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
                <span class="hidden sm:inline">Effacer</span>
              </button>
            </div>

            <div *ngIf="loading" class="flex justify-center py-12">
              <div class="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div *ngIf="erreur && !loading" class="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">{{ erreur }}</div>

            <div *ngIf="!loading && !erreur">
              <div *ngIf="servicesFiltres.length === 0" class="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
                <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                </svg>
                <p class="text-sm text-gray-400">Aucun service trouvé</p>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div *ngFor="let s of servicesFiltres"
                     class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                  <div class="h-1 w-full" [ngClass]="s.actif ? 'bg-primary-500' : 'bg-gray-200'"></div>
                  <div class="p-4 flex-1 flex flex-col gap-3">
                    <div class="flex items-start gap-3">
                      <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                           [ngClass]="s.actif ? 'bg-red-50' : 'bg-gray-100'">
                        <svg class="w-5 h-5" [ngClass]="s.actif ? 'text-red-600' : 'text-gray-400'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                        </svg>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="font-semibold text-gray-900 text-sm leading-tight truncate">{{ s.nomService }}</p>
                        <p *ngIf="s.descriptionService" class="text-xs text-gray-500 truncate">{{ s.descriptionService }}</p>
                      </div>
                      <span class="px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0"
                            [ngClass]="s.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
                        {{ s.actif ? 'Actif' : 'Inactif' }}
                      </span>
                    </div>
                    <p *ngIf="s.descriptionService" class="text-xs text-gray-500 line-clamp-2">{{ s.descriptionService }}</p>
                  </div>
                  <div class="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                    <span class="text-xs text-gray-400">{{ s.createdDate | date:'dd/MM/yyyy' }}</span>
                    <div class="flex items-center gap-1">
                      <button (click)="voirDetail(s)"
                              class="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Voir le détail">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                      </button>
                      <button *ngIf="peutModifier" (click)="ouvrirFormulaire(s)"
                              class="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Modifier">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                      </button>
                      <button *ngIf="peutSupprimer" (click)="supprimer(s)"
                              class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
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
              <div *ngIf="!search" class="text-xs text-gray-400">Aucun filtre appliqué</div>
              <div *ngIf="search" class="flex items-center justify-between">
                <span class="text-xs text-gray-500">Recherche</span>
                <span class="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full truncate max-w-[120px]">{{ search }}</span>
              </div>
              <p class="text-xs text-gray-500 mt-3">
                <span class="font-semibold text-gray-700">{{ servicesFiltres.length }}</span> service(s) affiché(s)
              </p>
            </div>
          </div>

        </div>
      </div>

      <!-- Modal Détail -->
      <div *ngIf="showDetailModal && detailService"
           class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
           (click)="fermerDetail()">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg" (click)="$event.stopPropagation()">
          <div class="px-6 py-4 rounded-t-2xl flex items-center gap-4" style="background:linear-gradient(135deg,#c0392b,#96281b)">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style="background:rgba(255,255,255,0.2)">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-white text-lg leading-tight truncate">{{ detailService.nomService }}</h3>
              <p *ngIf="detailService.descriptionService" class="text-white/70 text-xs mt-0.5 truncate">{{ detailService.descriptionService }}</p>
            </div>
            <button (click)="fermerDetail()" class="text-white/70 hover:text-white p-1">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="p-6 space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-xs text-gray-500 mb-1">Statut</p>
                <span class="px-2 py-0.5 text-xs font-semibold rounded-full"
                      [ngClass]="detailService.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
                  {{ detailService.actif ? 'Actif' : 'Inactif' }}
                </span>
              </div>
              <div>
                <p class="text-xs text-gray-500 mb-1">Date création</p>
                <p class="text-sm font-medium text-gray-800">{{ detailService.createdDate | date:'dd/MM/yyyy' }}</p>
              </div>
            </div>
            <div *ngIf="detailService.descriptionService">
              <p class="text-xs text-gray-500 mb-1">Description</p>
              <p class="text-sm text-gray-700 bg-gray-50 rounded-lg p-2">{{ detailService.descriptionService }}</p>
            </div>
          </div>
          <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button *ngIf="peutModifier" (click)="ouvrirFormulaire(detailService); fermerDetail()"
                    class="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors">Modifier</button>
            <button (click)="fermerDetail()"
                    class="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Fermer</button>
          </div>
        </div>
      </div>

      <!-- Modal formulaire -->
      <div *ngIf="showFormulaire"
           class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
           (click)="fermerFormulaire()">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-md" (click)="$event.stopPropagation()">
          <div class="px-6 py-4 rounded-t-2xl" style="background:linear-gradient(135deg,#c0392b,#96281b)">
            <h3 class="font-bold text-white text-lg">{{ serviceEnEdition ? 'Modifier le service' : 'Nouveau service' }}</h3>
            <p class="text-white/70 text-xs mt-0.5">{{ serviceEnEdition ? 'Mettre à jour les informations' : "Ajouter un service à l'organisation" }}</p>
          </div>
          <div class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Acronyme <span class="text-red-500">*</span></label>
              <input type="text" [(ngModel)]="form.accronyme"
                     class="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-red-400"
                     placeholder="Ex: DRH, FIN, COM..."/>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Description <span class="text-red-500">*</span></label>
              <textarea [(ngModel)]="form.description" rows="3"
                        class="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-red-400 resize-none"
                        placeholder="Description du service..."></textarea>
            </div>
          </div>
          <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button (click)="fermerFormulaire()"
                    class="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Annuler</button>
            <button (click)="enregistrer()" [disabled]="!form.accronyme.trim() || soumission"
                    class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl transition-colors">
              {{ soumission ? 'En cours...' : 'Enregistrer' }}
            </button>
          </div>
        </div>
      </div>

    </div>
  `,
})
export class AgentServices implements OnInit {

  services: Service[] = [];
  servicesFiltres: Service[] = [];
  loading = false;
  erreur = '';
  search = '';
  showFormulaire = false;
  serviceEnEdition: Service | null = null;
  soumission = false;
  form = { accronyme: '', description: '' };
  showDetailModal = false;
  detailService: Service | null = null;

  // Toasts
  toasts: { id: number; title: string; message: string; type: 'success' | 'error' | 'warning' }[] = [];
  private toastIdCounter = 0;

  // Permissions (réactives)
  get peutConsulter(): boolean { return this.authService.hasPermission('SERVICES', 'CONSULTER'); }
  get peutCreer():     boolean { return this.authService.hasPermission('SERVICES', 'CREER'); }
  get peutModifier():  boolean { return this.authService.hasPermission('SERVICES', 'MODIFIER'); }
  get peutSupprimer(): boolean { return this.authService.hasPermission('SERVICES', 'SUPPRIMER'); }

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private authService: AuthService, private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnInit(): void {
    if (!this.peutConsulter) return;
    this.charger();
  }

  charger(): void {
    this.loading = true;
    this.erreur = '';
    this.http.get<any>(`${this.apiUrl}/admin/services?limit=100`).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          const raw: any[] = res.data?.items || res.data || [];
          this.services = raw.map(s => ({
            idservice: s.idservice,
            nomService: s.accronyme || s.nomService || '',
            descriptionService: s.description || s.descriptionService || '',
            actif: s.del === 0,
            createdDate: s.createdDate,
          }));
          this.filtrer();
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.erreur = err.error?.message || 'Erreur lors du chargement des services';
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  filtrer(): void {
    const q = this.search.toLowerCase();
    this.servicesFiltres = this.services.filter(s =>
      !this.search || s.nomService.toLowerCase().includes(q) || (s.descriptionService || '').toLowerCase().includes(q)
    );
  }

  get servicesActifs(): number {
    return this.services.filter(s => s.actif).length;
  }

  get servicesInactifs(): number {
    return this.services.filter(s => !s.actif).length;
  }

  voirDetail(s: Service): void {
    this.detailService = s;
    this.showDetailModal = true;
    this.cdr.detectChanges();
  }

  fermerDetail(): void {
    this.showDetailModal = false;
    this.detailService = null;
  }

  ouvrirFormulaire(s: Service | null): void {
    this.serviceEnEdition = s;
    this.form = {
      accronyme: s?.nomService || '',
      description: s?.descriptionService || '',
    };
    this.showFormulaire = true;
  }

  fermerFormulaire(): void {
    this.showFormulaire = false;
    this.serviceEnEdition = null;
    this.form = { accronyme: '', description: '' };
  }

  enregistrer(): void {
    if (!this.form.accronyme.trim()) return;
    this.soumission = true;
    const payload = {
      accronyme: this.form.accronyme.trim(),
      description: this.form.description.trim() || null,
    };
    const req = this.serviceEnEdition
      ? this.http.put(`${this.apiUrl}/admin/services/${this.serviceEnEdition.idservice}`, payload)
      : this.http.post(`${this.apiUrl}/admin/services`, payload);

    req.subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.charger();
          this.fermerFormulaire();
          this.soumission = false;
          this.showToast('Succès', this.serviceEnEdition ? 'Service modifié' : 'Service créé');
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.showToast('Erreur', err.error?.message || "Erreur lors de l'enregistrement", 'error');
          this.soumission = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  supprimer(s: Service): void {
    if (!confirm(`Supprimer le service "${s.nomService}" ?`)) return;
    this.http.delete(`${this.apiUrl}/admin/services/${s.idservice}`).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.services = this.services.filter(x => x.idservice !== s.idservice);
          this.filtrer();
          this.showToast('Supprimé', 'Service supprimé avec succès', 'warning');
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
}
