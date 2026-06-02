// src/features/dashboard/agent/modules/agents/agent-agents.ts
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';

interface Agent {
  idusers: number;   // mappé depuis idagents (pour les appels PUT/DELETE)
  idagents?: number;
  username: string;
  prenom?: string;
  nom?: string;
  matricule?: string;
  email?: string;
  actif: boolean;    // dérivé de del === 0
  createdDate: string;
  role?: { idrole?: number; nomRole: string };
  role_idrole?: number;
  service?: { idservice?: number; nomService: string };
}

interface Role {
  idrole: number;
  nomRole: string;    // mappé depuis description ou accronyme
}

interface Service {
  idservice: number;
  nomService: string; // mappé depuis description ou accronyme
}

@Component({
  selector: 'app-agent-agents',
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
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </div>
              <div>
                <p class="text-primary-400 text-xs font-semibold uppercase tracking-widest mb-1">Agent — Tableau de bord</p>
                <h1 class="text-2xl md:text-3xl font-bold text-white">Agents</h1>
                <p class="text-slate-400 text-sm mt-1 hidden md:block">Gestion des comptes agents et leurs permissions</p>
                <div class="flex items-center gap-3 mt-3">
                  <button (click)="charger()"
                          class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                    Actualiser
                  </button>
                  <button *ngIf="peutCreer" (click)="creerAgent()"
                          class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    Nouvel agent
                  </button>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-3 lg:min-w-[340px]">
              <div class="rounded-xl p-3 text-center bg-white/5 border border-white/10">
                <p class="text-xs text-slate-300 mb-1">Total</p>
                <p class="text-2xl font-bold text-white">{{ agents.length }}</p>
              </div>
              <div class="rounded-xl p-3 text-center bg-green-500/10 border border-green-500/20">
                <p class="text-xs text-green-300 mb-1">Actifs</p>
                <p class="text-2xl font-bold text-white">{{ agentsActifs }}</p>
              </div>
              <div class="rounded-xl p-3 text-center bg-red-500/10 border border-red-500/20">
                <p class="text-xs text-red-300 mb-1">Inactifs</p>
                <p class="text-2xl font-bold text-white">{{ agentsInactifs }}</p>
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
          <p class="text-sm text-gray-500">Vous n'avez pas la permission de consulter les agents.</p>
        </div>

        <div *ngIf="peutConsulter" class="grid grid-cols-1 lg:grid-cols-3 gap-8">

          <!-- Main (2/3) -->
          <div class="lg:col-span-2 space-y-4">

            <!-- Filtres -->
            <div class="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-3">
              <div class="relative flex-1">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
                </svg>
                <input type="text" [(ngModel)]="search" (ngModelChange)="filtrer()"
                       placeholder="Rechercher un agent..."
                       class="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl focus:ring-2 focus:ring-red-400 outline-none"/>
              </div>
              <select [(ngModel)]="filtreActif" (ngModelChange)="filtrer()"
                      class="px-3 py-2 text-sm bg-gray-50 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-red-400 outline-none">
                <option value="">Tous</option>
                <option value="true">Actifs</option>
                <option value="false">Inactifs</option>
              </select>
            </div>

            <div *ngIf="loading" class="flex justify-center py-12">
              <div class="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div *ngIf="erreur && !loading" class="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">{{ erreur }}</div>

            <div *ngIf="!loading && !erreur">
              <div *ngIf="agentsFiltres.length === 0" class="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
                <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                <p class="text-sm text-gray-400">Aucun agent trouvé</p>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div *ngFor="let a of agentsFiltres"
                     class="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
                  <div class="h-1 w-full" [ngClass]="a.actif ? 'bg-green-400' : 'bg-gray-300'"></div>
                  <div class="p-4 flex flex-col gap-3">
                    <!-- Avatar + identité -->
                    <div class="flex items-start gap-3">
                      <div class="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 text-white shadow-sm"
                           style="background:linear-gradient(135deg,#1e293b,#334155)">
                        {{ getInitiales(a) }}
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <p class="font-semibold text-gray-900 truncate text-sm">
                            {{ (a.prenom || a.nom) ? ((a.prenom || '') + ' ' + (a.nom || '')) : a.username }}
                          </p>
                          <span class="inline-block w-2 h-2 rounded-full flex-shrink-0 flex-shrink-0"
                                [ngClass]="a.actif ? 'bg-green-500' : 'bg-red-400'"
                                [title]="a.actif ? 'Actif' : 'Inactif'"></span>
                        </div>
                        <p class="text-xs text-gray-400 truncate">{{ a.username }}</p>
                        <p class="text-xs text-gray-500 truncate" *ngIf="a.email">{{ a.email }}</p>
                      </div>
                    </div>
                    <!-- Badges rôle / service -->
                    <div class="flex flex-wrap gap-1.5">
                      <span *ngIf="a.role"
                            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-100">
                        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                        </svg>
                        {{ a.role.nomRole }}
                      </span>
                      <span *ngIf="a.service"
                            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                        </svg>
                        {{ a.service.nomService }}
                      </span>
                      <span *ngIf="!a.actif"
                            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-100">
                        Inactif
                      </span>
                    </div>
                    <!-- Footer -->
                    <div class="pt-2 border-t border-gray-100 flex items-center justify-between">
                      <span class="text-xs text-gray-400">{{ a.createdDate | date:'dd/MM/yyyy' }}</span>
                      <div class="flex items-center gap-1">
                        <button (click)="voirDetail(a)"
                                class="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Voir le détail">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                          </svg>
                        </button>
                        <button *ngIf="peutModifier" (click)="modifierAgent(a)"
                                class="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Modifier">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                        <button *ngIf="peutSupprimer" (click)="ouvrirDeleteModal(a)"
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
              <div *ngIf="!filtreActif && !search" class="text-xs text-gray-400">Aucun filtre appliqué</div>
              <div class="space-y-2">
                <div *ngIf="filtreActif" class="flex items-center justify-between">
                  <span class="text-xs text-gray-500">Statut</span>
                  <span class="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">{{ filtreActif === 'true' ? 'Actifs' : 'Inactifs' }}</span>
                </div>
                <div *ngIf="search" class="flex items-center justify-between">
                  <span class="text-xs text-gray-500">Recherche</span>
                  <span class="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full truncate max-w-[120px]">{{ search }}</span>
                </div>
              </div>
              <p class="text-xs text-gray-500 mt-3">
                <span class="font-semibold text-gray-700">{{ agentsFiltres.length }}</span> agent(s) affiché(s)
              </p>
            </div>
          </div>

        </div>
      </div>

      <!-- Modal Créer / Modifier Agent -->
      <div *ngIf="showModal"
           class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
          <div class="px-6 py-4 rounded-t-2xl flex items-center justify-between" style="background:linear-gradient(135deg,#c0392b,#96281b)">
            <h3 class="font-bold text-white text-lg">{{ modalMode === 'create' ? 'Nouvel agent' : "Modifier l'agent" }}</h3>
            <button (click)="fermerModal()" [disabled]="soumission" class="text-white/70 hover:text-white disabled:opacity-40">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="p-6 space-y-4 overflow-y-auto flex-1">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Prénom <span class="text-red-500">*</span></label>
                <input type="text" [(ngModel)]="form.prenom" placeholder="Prénom"
                       class="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-400 outline-none"/>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Nom <span class="text-red-500">*</span></label>
                <input type="text" [(ngModel)]="form.nom" placeholder="Nom"
                       class="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-400 outline-none"/>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Matricule</label>
                <input type="text" [(ngModel)]="form.matricule" placeholder="Ex: AG001"
                       class="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-400 outline-none"/>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" [(ngModel)]="form.email" placeholder="email@exemple.com"
                       class="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-400 outline-none"/>
              </div>
            </div>
            <ng-container *ngIf="modalMode === 'create'">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Nom d'utilisateur <span class="text-red-500">*</span></label>
                <input type="text" [(ngModel)]="form.username" placeholder="Nom d'utilisateur unique"
                       class="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-400 outline-none"/>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Mot de passe <span class="text-red-500">*</span></label>
                  <input type="password" [(ngModel)]="form.password" placeholder="••••••••"
                         class="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-400 outline-none"/>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Confirmer <span class="text-red-500">*</span></label>
                  <input type="password" [(ngModel)]="form.confirmPassword" placeholder="••••••••"
                         class="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-400 outline-none"/>
                </div>
              </div>
            </ng-container>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Rôle <span class="text-red-500">*</span></label>
              <select [(ngModel)]="form.role_idrole"
                      class="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-400 outline-none">
                <option [ngValue]="null" disabled>{{ loadingRoles ? 'Chargement...' : '-- Sélectionner un rôle --' }}</option>
                <option *ngFor="let r of roles" [ngValue]="r.idrole">{{ r.nomRole }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Service <span class="text-red-500">*</span></label>
              <select [(ngModel)]="form.service_idservice"
                      class="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-400 outline-none">
                <option [ngValue]="null" disabled>{{ loadingServices ? 'Chargement...' : '-- Sélectionner un service --' }}</option>
                <option *ngFor="let s of servicesListe" [ngValue]="s.idservice">{{ s.nomService }}</option>
              </select>
            </div>
            <div *ngIf="modalMode === 'edit'" class="flex items-center gap-3">
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" [(ngModel)]="form.actif" class="sr-only peer">
                <div class="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-red-400 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
              <span class="text-sm font-medium text-gray-700">Compte actif</span>
            </div>
            <div *ngIf="formErreur" class="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">{{ formErreur }}</div>
          </div>
          <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
            <button (click)="fermerModal()" [disabled]="soumission"
                    class="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50">Annuler</button>
            <button (click)="soumettre()" [disabled]="soumission"
                    class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50">
              <svg *ngIf="soumission" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              {{ modalMode === 'create' ? "Créer l'agent" : 'Enregistrer' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Modal Détail Agent -->
      <div *ngIf="showDetailModal && detailAgent"
           class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
           (click)="fermerDetail()">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
             (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="px-6 py-5 flex items-center gap-4"
               style="background:linear-gradient(135deg,#1e293b,#334155)">
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl text-white flex-shrink-0"
                 style="background:rgba(255,255,255,0.15)">
              {{ getInitiales(detailAgent) }}
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-white text-lg leading-tight">
                {{ (detailAgent.prenom || detailAgent.nom) ? ((detailAgent.prenom || '') + ' ' + (detailAgent.nom || '')) : detailAgent.username }}
              </h3>
              <p class="text-white/60 text-xs mt-0.5">{{ detailAgent.username }}</p>
              <div class="flex items-center gap-2 mt-2">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                      [ngClass]="detailAgent.actif ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'">
                  <span class="w-1.5 h-1.5 rounded-full"
                        [ngClass]="detailAgent.actif ? 'bg-green-400' : 'bg-red-400'"></span>
                  {{ detailAgent.actif ? 'Actif' : 'Inactif' }}
                </span>
              </div>
            </div>
            <button (click)="fermerDetail()" class="text-white/60 hover:text-white p-1 flex-shrink-0">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <!-- Body -->
          <div class="p-6 space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-xs text-gray-400 mb-0.5">Prénom</p>
                <p class="text-sm font-medium text-gray-800">{{ detailAgent.prenom || '—' }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-400 mb-0.5">Nom</p>
                <p class="text-sm font-medium text-gray-800">{{ detailAgent.nom || '—' }}</p>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-xs text-gray-400 mb-0.5">Matricule</p>
                <p class="text-sm font-medium text-gray-800">{{ detailAgent.matricule || '—' }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-400 mb-0.5">Email</p>
                <p class="text-sm font-medium text-gray-800 truncate">{{ detailAgent.email || '—' }}</p>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-xs text-gray-400 mb-1">Rôle</p>
                <span *ngIf="detailAgent.role"
                      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-100">
                  {{ detailAgent.role.nomRole }}
                </span>
                <p *ngIf="!detailAgent.role" class="text-sm text-gray-400">—</p>
              </div>
              <div>
                <p class="text-xs text-gray-400 mb-1">Service</p>
                <span *ngIf="detailAgent.service"
                      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  {{ detailAgent.service.nomService }}
                </span>
                <p *ngIf="!detailAgent.service" class="text-sm text-gray-400">—</p>
              </div>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-0.5">Membre depuis</p>
              <p class="text-sm font-medium text-gray-800">{{ detailAgent.createdDate | date:'dd MMMM yyyy' }}</p>
            </div>
          </div>
          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
            <button *ngIf="peutModifier" (click)="modifierAgent(detailAgent); fermerDetail()"
                    class="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-xl transition-colors">
              Modifier
            </button>
            <button *ngIf="peutSupprimer" (click)="ouvrirDeleteModal(detailAgent); fermerDetail()"
                    class="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-xl transition-colors">
              Supprimer
            </button>
            <button (click)="fermerDetail()"
                    class="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
              Fermer
            </button>
          </div>
        </div>
      </div>

      <!-- Modal Suppression -->
      <div *ngIf="showDeleteModal"
           class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
          <div class="px-6 py-4 flex items-center gap-3 bg-red-600">
            <div class="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </div>
            <div class="flex-1">
              <p class="font-semibold text-white text-sm">Supprimer l'agent</p>
              <p class="text-xs text-white/70 mt-0.5">{{ agentASupprimer?.username }}</p>
            </div>
            <button (click)="fermerDeleteModal()" class="text-white/70 hover:text-white">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="p-6 text-center">
            <p class="text-sm text-gray-600">Supprimer l'agent <strong>{{ agentASupprimer?.username }}</strong> ?</p>
            <p class="text-xs text-red-500 font-medium mt-1">Cette action est irréversible.</p>
          </div>
          <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button (click)="fermerDeleteModal()" [disabled]="soumissionDelete"
                    class="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50">Annuler</button>
            <button (click)="supprimerAgent()" [disabled]="soumissionDelete"
                    class="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50">
              <div *ngIf="soumissionDelete" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              {{ soumissionDelete ? 'Suppression...' : 'Supprimer' }}
            </button>
          </div>
        </div>
      </div>

    </div>
  `,
})
export class AgentAgents implements OnInit {

  agents: Agent[] = [];
  agentsFiltres: Agent[] = [];
  loading = false;
  erreur = '';
  search = '';
  filtreActif = '';

  // ── Permissions (getters réactifs) ───────────────────────
  get peutConsulter(): boolean { return this.authService.hasPermission('AGENTS', 'CONSULTER'); }
  get peutCreer(): boolean     { return this.authService.hasPermission('AGENTS', 'CREER'); }
  get peutModifier(): boolean  { return this.authService.hasPermission('AGENTS', 'MODIFIER'); }
  get peutSupprimer(): boolean { return this.authService.hasPermission('AGENTS', 'SUPPRIMER'); }

  // ── Modal création / édition ───────────────────────────────
  showModal = false;
  modalMode: 'create' | 'edit' = 'create';
  agentEnEdition: Agent | null = null;
  soumission = false;
  formErreur = '';
  form = {
    username: '',
    password: '',
    confirmPassword: '',
    nom: '',
    prenom: '',
    matricule: '',
    email: '',
    role_idrole: null as number | null,
    service_idservice: null as number | null,
    actif: true,
  };

  // Données listes déroulantes
  roles: Role[] = [];
  servicesListe: Service[] = [];
  loadingRoles = false;
  loadingServices = false;

  // ── Modal détail ───────────────────────────────────────────
  showDetailModal = false;
  detailAgent: Agent | null = null;

  // ── Modal suppression ──────────────────────────────────────
  showDeleteModal = false;
  agentASupprimer: Agent | null = null;
  soumissionDelete = false;

  // Toasts
  toasts: { id: number; title: string; message: string; type: 'success' | 'error' | 'warning' }[] = [];
  private toastIdCounter = 0;

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private authService: AuthService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    if (this.peutConsulter) {
      this.charger();
    } else {
      this.cdr.detectChanges();
    }
  }

  charger(): void {
    this.loading = true;
    this.erreur = '';
    this.http.get<any>(`${this.apiUrl}/users/agents?limit=100`).subscribe({
      next: (res) => {
        const raw: any[] = res.data?.items || [];
        this.agents = raw.map(a => ({
          idusers: a.idagents,          // réutilise idusers pour PUT/DELETE
          idagents: a.idagents,
          username: a.users?.[0]?.username || '',
          prenom: a.prenom,
          nom: a.nom,
          matricule: a.matricule,
          email: a.email,
          actif: a.del === 0,           // del=0 → actif, del=1 → supprimé/inactif
          createdDate: a.createdDate,
          role: a.users?.[0]?.role ? {
            idrole: a.users[0].role.idrole,
            nomRole: a.users[0].role.description || a.users[0].role.accronyme,
          } : undefined,
          role_idrole: a.users?.[0]?.role_idrole,
          service: a.service ? {
            idservice: a.service.idservice,
            nomService: a.service.description || a.service.accronyme,
          } : undefined,
        }));
        this.filtrer();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.erreur = err.error?.message || 'Erreur lors du chargement des agents';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private chargerRolesEtServices(): void {
    this.loadingRoles = true;
    this.loadingServices = true;
    this.http.get<any>(`${this.apiUrl}/users/roles`).subscribe({
      next: (res) => {
        const raw: any[] = res.data || [];
        this.roles = raw.map(r => ({ idrole: r.idrole, nomRole: r.description || r.accronyme }));
        this.loadingRoles = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingRoles = false; this.cdr.detectChanges(); },
    });
    this.http.get<any>(`${this.apiUrl}/services?limit=100`).subscribe({
      next: (res) => {
        const raw: any[] = res.data?.items || res.data || [];
        this.servicesListe = raw.map(s => ({ idservice: s.idservice, nomService: s.description || s.accronyme }));
        this.loadingServices = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingServices = false; this.cdr.detectChanges(); },
    });
  }

  filtrer(): void {
    this.agentsFiltres = this.agents.filter(a => {
      const q = this.search.toLowerCase();
      const matchSearch = !this.search ||
        (a.username || '').toLowerCase().includes(q) ||
        (a.nom || '').toLowerCase().includes(q) ||
        (a.prenom || '').toLowerCase().includes(q) ||
        (a.role?.nomRole || '').toLowerCase().includes(q);
      const matchActif = !this.filtreActif || String(a.actif) === this.filtreActif;
      return matchSearch && matchActif;
    });
  }

  get agentsActifs(): number {
    return this.agents.filter(a => a.actif).length;
  }

  get agentsInactifs(): number {
    return this.agents.filter(a => !a.actif).length;
  }

  creerAgent(): void {
    this.form = { username: '', password: '', confirmPassword: '', nom: '', prenom: '', matricule: '', email: '', role_idrole: null, service_idservice: null, actif: true };
    this.formErreur = '';
    this.agentEnEdition = null;
    this.modalMode = 'create';
    this.showModal = true;
    this.chargerRolesEtServices();
  }

  modifierAgent(a: Agent): void {
    this.agentEnEdition = a;
    this.form = {
      username: a.username,
      password: '',
      confirmPassword: '',
      nom: a.nom || '',
      prenom: a.prenom || '',
      matricule: a.matricule || '',
      email: a.email || '',
      role_idrole: a.role?.idrole ?? null,
      service_idservice: a.service?.idservice ?? null,
      actif: a.actif,
    };
    this.formErreur = '';
    this.modalMode = 'edit';
    this.showModal = true;
    this.chargerRolesEtServices();
  }

  fermerModal(): void {
    if (this.soumission) return;
    this.showModal = false;
    this.agentEnEdition = null;
    this.formErreur = '';
  }

  soumettre(): void {
    if (!this.form.prenom.trim()) { this.formErreur = 'Le prénom est requis'; return; }
    if (!this.form.nom.trim()) { this.formErreur = 'Le nom est requis'; return; }
    if (!this.form.role_idrole) { this.formErreur = 'Le rôle est requis'; return; }
    if (!this.form.service_idservice) { this.formErreur = 'Le service est requis'; return; }

    if (this.modalMode === 'create') {
      if (!this.form.username.trim()) { this.formErreur = "Le nom d'utilisateur est requis"; return; }
      if (!this.form.password) { this.formErreur = 'Le mot de passe est requis'; return; }
      if (this.form.password.length < 6) { this.formErreur = 'Le mot de passe doit contenir au moins 6 caractères'; return; }
      if (this.form.password !== this.form.confirmPassword) { this.formErreur = 'Les mots de passe ne correspondent pas'; return; }
    }

    this.formErreur = '';
    this.soumission = true;

    if (this.modalMode === 'create') {
      const body = {
        username: this.form.username,
        password: this.form.password,
        nom: this.form.nom,
        prenom: this.form.prenom,
        matricule: this.form.matricule || undefined,
        email: this.form.email || undefined,
        role_idrole: this.form.role_idrole,
        service_idservice: this.form.service_idservice,
      };
      this.http.post<any>(`${this.apiUrl}/users/agents`, body).subscribe({
        next: () => {
          this.soumission = false;
          this.fermerModal();
          this.showToast('Succès', 'Agent créé avec succès');
          this.cdr.detectChanges();
          this.charger();
        },
        error: (err) => {
          this.formErreur = err.error?.message || 'Erreur lors de la création';
          this.soumission = false;
          this.cdr.detectChanges();
        },
      });
    } else {
      const body = {
        nom: this.form.nom,
        prenom: this.form.prenom,
        matricule: this.form.matricule || undefined,
        email: this.form.email || undefined,
        role_idrole: this.form.role_idrole,
        service_idservice: this.form.service_idservice,
        actif: this.form.actif,
      };
      this.http.put<any>(`${this.apiUrl}/users/agents/${this.agentEnEdition!.idusers}`, body).subscribe({
        next: () => {
          this.soumission = false;
          this.fermerModal();
          this.showToast('Succès', 'Agent modifié avec succès');
          this.cdr.detectChanges();
          this.charger();
        },
        error: (err) => {
          this.formErreur = err.error?.message || 'Erreur lors de la modification';
          this.soumission = false;
          this.cdr.detectChanges();
        },
      });
    }
  }

  getInitiales(a: Agent): string {
    const n = (a.nom?.[0] || '').toUpperCase();
    const p = (a.prenom?.[0] || '').toUpperCase();
    return (p + n) || (a.username?.[0] || '?').toUpperCase();
  }

  voirDetail(a: Agent): void {
    this.detailAgent = a;
    this.showDetailModal = true;
    this.cdr.detectChanges();
  }

  fermerDetail(): void {
    this.showDetailModal = false;
    this.detailAgent = null;
  }

  ouvrirDeleteModal(a: Agent): void {
    this.agentASupprimer = a;
    this.showDeleteModal = true;
    this.cdr.detectChanges();
  }

  fermerDeleteModal(): void {
    this.showDeleteModal = false;
    this.agentASupprimer = null;
    this.soumissionDelete = false;
    this.cdr.detectChanges();
  }

  supprimerAgent(): void {
    if (!this.agentASupprimer || this.soumissionDelete) return;
    this.soumissionDelete = true;
    this.http.delete(`${this.apiUrl}/users/agents/${this.agentASupprimer.idusers}`).subscribe({
      next: () => {
        this.agents = this.agents.filter(x => x.idusers !== this.agentASupprimer!.idusers);
        this.filtrer();
        this.showToast('Supprimé', 'Agent supprimé avec succès', 'warning');
        this.fermerDeleteModal();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.showToast('Erreur', err.error?.message || 'Erreur lors de la suppression', 'error');
        this.soumissionDelete = false;
        this.fermerDeleteModal();
        this.cdr.detectChanges();
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
