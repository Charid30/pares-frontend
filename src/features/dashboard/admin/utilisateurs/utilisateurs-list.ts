// src/features/dashboard/admin/utilisateurs/utilisateurs-list.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { UserService, AgentFilters } from '../../../../core/services/user.service';
import { Agent, Role, Service, Direction, UserStats } from '../../../../core/models/user.model';
import { SearchService } from '../../../../core/services/search.service';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmService } from '../../../../core/services/confirm.service';

@Component({
  selector: 'app-utilisateurs-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, StatCard],
  templateUrl: './utilisateurs-list.html',
  styles: [`
    .step-active {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    }
    .step-completed {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    }
    .step-pending {
      background: #e5e7eb;
    }
  `]
})
export class UtilisateursList implements OnInit, OnDestroy {
  private readonly confirmService = inject(ConfirmService);
  private readonly toastService = inject(ToastService);
  // Données
  agents: Agent[] = [];
  roles: Role[] = [];
  services: Service[] = [];
  directions: Direction[] = [];
  stats: UserStats | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;
  totalPages = 0;

  // Filtres
  searchQuery = '';
  selectedRole: number | null = null;
  selectedService: number | null = null;

  // État
  submitting = false;
  error = '';

  // Modal
  showModal = false;
  modalMode: 'create' | 'edit' | 'view' | 'password' = 'create';
  selectedAgent: Agent | null = null;

  // Multi-step form
  currentStep = 1;
  totalSteps = 3;

  // Formulaire - Step 1: Informations Agent
  // rattachementType : un agent est lié SOIT à un service, SOIT directement à une direction
  // (certains agents n'appartiennent à aucun service).
  agentInfo = {
    nom: '',
    prenom: '',
    matricule: '',
    email: '',
    rattachementType: 'service' as 'service' | 'direction',
    service_idservice: 0,
    direction_ids: [] as number[],
  };

  // Formulaire - Step 2: Compte Utilisateur
  userInfo = {
    username: '',
    password: '',
    confirmPassword: ''
  };

  // Formulaire - Step 3: Rôles (multi-sélection — 1er = principal)
  selectedRoleIds: number[] = [];

  // Validation des étapes
  stepErrors: { [key: number]: string[] } = {
    1: [],
    2: [],
    3: []
  };

  // Changement de mot de passe
  newPassword = '';
  confirmNewPassword = '';

  private searchSub?: Subscription;

  constructor(
    private userService: UserService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private searchService: SearchService,
  ) { }

  ngOnInit(): void {
    this.loadRoles();
    this.loadServices();
    this.loadDirections();
    this.loadStats();
    this.loadAgents();
    this.searchSub = this.searchService.term$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
    ).subscribe(term => {
      this.searchQuery = term;
      this.currentPage = 1;
      this.loadAgents();
    });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  // ==================== TOAST NOTIFICATIONS ====================
  showToast(type: 'success' | 'error' | 'warning' | 'info', title: string, message: string): void {
    this.toastService.afficher(type, title, message);
  }

  // ==================== DATA LOADING ====================
  loadRoles(): void {
    this.userService.getRoles().subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.roles = response.data.filter((r: Role) => r.accronyme !== 'CANDIDAT');
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error('Erreur chargement rôles:', err);
        this.cdr.detectChanges();
      }
    });
  }

  loadServices(): void {
    this.userService.getServices().subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.services = response.data;
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error('Erreur chargement services:', err);
        this.cdr.detectChanges();
      }
    });
  }

  loadDirections(): void {
    this.userService.getDirections().subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.directions = response.data;
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error('Erreur chargement directions:', err);
        this.cdr.detectChanges();
      }
    });
  }

  loadStats(): void {
    this.userService.getStats().subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.stats = response.data;
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error('Erreur chargement stats:', err);
        this.cdr.detectChanges();
      }
    });
  }

  loadAgents(): void {
    this.error = '';

    const filters: AgentFilters = {
      page: this.currentPage,
      limit: this.pageSize
    };

    if (this.searchQuery) filters.search = this.searchQuery;
    if (this.selectedRole) filters.role = this.selectedRole;
    if (this.selectedService) filters.service = this.selectedService;

    this.userService.getAgents(filters).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.agents = response.data.items;
            this.totalItems = response.data.total;
            this.totalPages = response.data.totalPages;
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.error = 'Erreur lors du chargement des agents';
          console.error('Erreur:', err);
          this.cdr.detectChanges();
        });
      }
    });
  }

  // ==================== SEARCH & FILTER ====================
  onSearch(): void {
    this.currentPage = 1;
    this.loadAgents();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadAgents();
  }

  // ==================== PAGINATION ====================
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadAgents();
    }
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  // ==================== MODAL MANAGEMENT ====================
  openCreateModal(): void {
    this.modalMode = 'create';
    this.selectedAgent = null;
    this.currentStep = 1;
    this.resetForm();
    this.stepErrors = {};
    this.showModal = true;
  }

  openEditModal(agent: Agent): void {
    this.modalMode = 'edit';
    this.selectedAgent = agent;
    this.currentStep = 1;
    this.stepErrors = {};

    // Pré-remplir les données
    const hasDirs = (agent.directions?.length ?? 0) > 0;
    this.agentInfo = {
      nom: agent.nom,
      prenom: agent.prenom,
      matricule: agent.matricule,
      email: agent.email,
      rattachementType: (hasDirs || agent.direction_iddirection) ? 'direction' : 'service',
      service_idservice: agent.service_idservice || 0,
      direction_ids: hasDirs
        ? agent.directions!.map(d => d.iddirection)
        : (agent.direction_iddirection ? [agent.direction_iddirection] : []),
    };

    this.userInfo = {
      username: agent.users?.[0]?.username || '',
      password: '',
      confirmPassword: ''
    };

    // Rôles : principal d'abord, puis les additionnels (dédupliqués)
    const principal = agent.users?.[0]?.role_idrole;
    const additional = (agent.users?.[0]?.additionalRoles || []).map(r => r.idrole);
    const ids: number[] = [];
    for (const id of [principal, ...additional]) {
      if (id && !ids.includes(id)) ids.push(id);
    }
    this.selectedRoleIds = ids;

    this.showModal = true;
  }

  openViewModal(agent: Agent): void {
    this.modalMode = 'view';
    this.selectedAgent = agent;
    this.showModal = true;
  }

  openPasswordModal(agent: Agent): void {
    this.modalMode = 'password';
    this.selectedAgent = agent;
    this.newPassword = '';
    this.confirmNewPassword = '';
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedAgent = null;
    this.currentStep = 1;
    this.showDirectionDropdown = false;
    this.resetForm();
    this.stepErrors = {};
  }

  resetForm(): void {
    this.agentInfo = {
      nom: '',
      prenom: '',
      matricule: '',
      email: '',
      rattachementType: 'service',
      service_idservice: 0,
      direction_ids: [],
    };

    this.userInfo = {
      username: '',
      password: '',
      confirmPassword: ''
    };

    this.selectedRoleIds = [];
  }

  /** Bascule la sélection d'un rôle (multi-sélection). Le 1er coché = principal. */
  toggleRole(roleId: number): void {
    const idx = this.selectedRoleIds.indexOf(roleId);
    if (idx > -1) {
      this.selectedRoleIds.splice(idx, 1);
    } else {
      this.selectedRoleIds.push(roleId);
    }
  }

  isRoleSelected(roleId: number): boolean {
    return this.selectedRoleIds.includes(roleId);
  }

  /** Le rôle principal est le premier sélectionné. */
  isPrincipalRole(roleId: number): boolean {
    return this.selectedRoleIds[0] === roleId;
  }

  // ==================== MULTI-STEP NAVIGATION ====================
  validateStep(step: number): boolean {
    this.stepErrors[step] = [];

    switch (step) {
      case 1:
        if (!this.agentInfo.nom.trim()) {
          this.stepErrors[step].push('Le nom est requis');
        }
        if (!this.agentInfo.prenom.trim()) {
          this.stepErrors[step].push('Le prénom est requis');
        }
        if (!this.agentInfo.matricule.trim()) {
          this.stepErrors[step].push('Le matricule est requis');
        }
        if (!this.agentInfo.email.trim()) {
          this.stepErrors[step].push("L'adresse email est requise");
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.agentInfo.email.trim())) {
          this.stepErrors[step].push("L'adresse email n'est pas valide");
        }
        if (this.agentInfo.rattachementType === 'service') {
          if (!this.agentInfo.service_idservice) {
            this.stepErrors[step].push('Le service est requis');
          }
        } else if (this.agentInfo.direction_ids.length === 0) {
          this.stepErrors[step].push('Veuillez sélectionner au moins une direction');
        }
        break;

      case 2:
        if (!this.userInfo.username.trim()) {
          this.stepErrors[step].push('Le nom d\'utilisateur est requis');
        }
        if (this.modalMode === 'create') {
          if (!this.userInfo.password) {
            this.stepErrors[step].push('Le mot de passe est requis');
          } else if (this.userInfo.password.length < 6) {
            this.stepErrors[step].push('Le mot de passe doit contenir au moins 6 caractères');
          }
          if (this.userInfo.password !== this.userInfo.confirmPassword) {
            this.stepErrors[step].push('Les mots de passe ne correspondent pas');
          }
        }
        break;

      case 3:
        if (this.selectedRoleIds.length === 0) {
          this.stepErrors[step].push('Au moins un rôle est requis');
        }
        break;
    }

    return this.stepErrors[step].length === 0;
  }

  nextStep(): void {
    if (this.validateStep(this.currentStep)) {
      if (this.currentStep < this.totalSteps) {
        this.currentStep++;
      }
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  goToStep(step: number): void {
    // On peut seulement aller aux étapes précédentes ou l'étape actuelle
    if (step <= this.currentStep) {
      this.currentStep = step;
    }
  }

  getStepStatus(step: number): 'completed' | 'active' | 'pending' {
    if (step < this.currentStep) return 'completed';
    if (step === this.currentStep) return 'active';
    return 'pending';
  }

  getStepTitle(step: number): string {
    switch (step) {
      case 1: return 'Informations Agent';
      case 2: return 'Compte Utilisateur';
      case 3: return 'Rôle & Permissions';
      default: return '';
    }
  }

  // ==================== FORM SUBMISSION ====================
  submitForm(): void {
    // Pour le mode password, pas besoin de valider les étapes agent/user/role
    if (this.modalMode === 'password') {
      this.changePassword();
      return;
    }

    // Valider toutes les étapes
    let allValid = true;
    for (let i = 1; i <= this.totalSteps; i++) {
      if (!this.validateStep(i)) {
        allValid = false;
        this.currentStep = i;
        break;
      }
    }

    if (!allValid) {
      this.showToast('error', 'Erreur de validation', 'Veuillez corriger les erreurs avant de continuer');
      return;
    }

    if (this.modalMode === 'create') {
      this.createAgent();
    } else if (this.modalMode === 'edit') {
      this.updateAgent();
    }
  }

  showDirectionDropdown = false;

  toggleDirection(id: number): void {
    const idx = this.agentInfo.direction_ids.indexOf(id);
    if (idx === -1) {
      this.agentInfo.direction_ids = [...this.agentInfo.direction_ids, id];
    } else {
      this.agentInfo.direction_ids = this.agentInfo.direction_ids.filter(d => d !== id);
    }
  }

  addDirection(id: number): void {
    if (!this.agentInfo.direction_ids.includes(id)) {
      this.agentInfo.direction_ids = [...this.agentInfo.direction_ids, id];
    }
    this.showDirectionDropdown = false;
  }

  removeDirection(id: number): void {
    this.agentInfo.direction_ids = this.agentInfo.direction_ids.filter(d => d !== id);
  }

  isDirectionSelected(id: number): boolean {
    return this.agentInfo.direction_ids.includes(id);
  }

  getAvailableDirections(): Direction[] {
    return this.directions.filter(d => !this.agentInfo.direction_ids.includes(d.iddirection));
  }

  getDirectionById(id: number): Direction | undefined {
    return this.directions.find(d => d.iddirection === id);
  }

  async createAgent(): Promise<void> {
    if (!(await this.confirmService.demander({ titre: 'Créer l\'agent', message: 'Le compte de l\'agent sera créé.', confirmer: 'Créer' }))) return;
    this.submitting = true;
    const agentName = `${this.agentInfo.prenom} ${this.agentInfo.nom}`;

    this.userService.createAgent({
      nom: this.agentInfo.nom,
      prenom: this.agentInfo.prenom,
      matricule: this.agentInfo.matricule,
      email: this.agentInfo.email,
      ...(this.agentInfo.rattachementType === 'service'
        ? { service_idservice: this.agentInfo.service_idservice }
        : { direction_ids: this.agentInfo.direction_ids }),
      roleIds: this.selectedRoleIds,
      username: this.userInfo.username,
      password: this.userInfo.password,
      confirmPassword: this.userInfo.confirmPassword
    }).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.closeModal();
            this.loadAgents();
            this.loadStats();
            this.showToast('success', 'Succès !', `L'agent ${agentName} a été créé avec succès`);
          }
          this.submitting = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.showToast('error', 'Erreur', err.error?.message || 'Erreur lors de la création de l\'agent');
          this.submitting = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  async updateAgent(): Promise<void> {
    if (!this.selectedAgent) return;

    if (!(await this.confirmService.demander({ titre: 'Enregistrer les modifications', message: 'Les informations de l\'agent seront mises à jour.', confirmer: 'Enregistrer' }))) return;
    this.submitting = true;
    const agentName = `${this.agentInfo.prenom} ${this.agentInfo.nom}`;

    this.userService.updateAgent(this.selectedAgent.idagents, {
      nom: this.agentInfo.nom,
      prenom: this.agentInfo.prenom,
      matricule: this.agentInfo.matricule,
      email: this.agentInfo.email,
      ...(this.agentInfo.rattachementType === 'service'
        ? { service_idservice: this.agentInfo.service_idservice }
        : { direction_ids: this.agentInfo.direction_ids }),
      roleIds: this.selectedRoleIds
    }).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.closeModal();
            this.loadAgents();
            this.showToast('success', 'Succès !', `L'agent ${agentName} a été mis à jour`);
          }
          this.submitting = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.showToast('error', 'Erreur', err.error?.message || 'Erreur lors de la mise à jour');
          this.submitting = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  async changePassword(): Promise<void> {
    if (!this.selectedAgent) return;

    if (this.newPassword !== this.confirmNewPassword) {
      this.showToast('error', 'Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    if (this.newPassword.length < 6) {
      this.showToast('error', 'Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (!(await this.confirmService.demander({ titre: 'Changer le mot de passe', message: 'L\'agent devra utiliser ce nouveau mot de passe pour se connecter.', confirmer: 'Changer', danger: true }))) return;
    this.submitting = true;
    this.userService.changePassword(this.selectedAgent.idagents, this.newPassword, this.confirmNewPassword).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.closeModal();
            this.showToast('success', 'Succès !', 'Le mot de passe a été modifié avec succès');
          }
          this.submitting = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.showToast('error', 'Erreur', err.error?.message || 'Erreur lors du changement de mot de passe');
          this.submitting = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  // ─── Modale de confirmation personnalisée (suppression / activation) ──────
  confirmAction: 'delete' | 'toggle' | null = null;
  confirmTarget: Agent | null = null;

  async demanderSuppression(agent: Agent): Promise<void> {
    const ok = await this.confirmService.demander({
      titre: 'Supprimer cet agent ?', message: 'Son compte ne pourra plus se connecter. Cette action est irréversible.',
      detail: `${agent.prenom} ${agent.nom}`, confirmer: 'Supprimer', danger: true,
    });
    if (!ok) return;
    this.confirmAction = 'delete';
    this.confirmTarget = agent;
    this.executerConfirmation();
  }

  async demanderToggleActif(agent: Agent): Promise<void> {
    const actif = agent.actif ?? true;
    const ok = await this.confirmService.demander({
      titre: actif ? 'Désactiver ce compte ?' : 'Réactiver ce compte ?',
      message: actif ? "L'agent ne pourra plus se connecter tant que son compte est désactivé." : "L'agent pourra de nouveau se connecter.",
      detail: `${agent.prenom} ${agent.nom}`, confirmer: actif ? 'Désactiver' : 'Réactiver', danger: actif,
    });
    if (!ok) return;
    this.confirmAction = 'toggle';
    this.confirmTarget = agent;
    this.executerConfirmation();
  }

  annulerConfirmation(): void {
    this.confirmAction = null;
    this.confirmTarget = null;
  }

  executerConfirmation(): void {
    if (!this.confirmAction || !this.confirmTarget) return;
    const agent = this.confirmTarget;
    const action = this.confirmAction;
    this.annulerConfirmation();

    if (action === 'delete') {
      this.deleteAgent(agent);
    } else {
      this.toggleAgentActif(agent);
    }
  }


  private deleteAgent(agent: Agent): void {
    this.submitting = true;
    const agentName = `${agent.prenom} ${agent.nom}`;

    this.userService.deleteAgent(agent.idagents).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.loadAgents();
            this.loadStats();
            this.showToast('success', 'Supprimé !', `L'agent ${agentName} a été supprimé`);
          }
          this.submitting = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.showToast('error', 'Erreur', err.error?.message || 'Erreur lors de la suppression');
          this.submitting = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  private toggleAgentActif(agent: Agent): void {
    const nouvelEtat = !(agent.actif ?? true);
    const agentName = `${agent.prenom} ${agent.nom}`;

    this.submitting = true;
    this.userService.toggleAgentActif(agent.idagents, nouvelEtat).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            agent.actif = nouvelEtat;
            this.showToast('success', nouvelEtat ? 'Réactivé !' : 'Désactivé !',
              `Le compte de ${agentName} a été ${nouvelEtat ? 'réactivé' : 'désactivé'}`);
          }
          this.submitting = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.showToast('error', 'Erreur', err.error?.message || 'Erreur lors de la mise à jour');
          this.submitting = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  // ==================== HELPERS ====================
  getRoleBadgeClass(accronyme: string): string {
    switch (accronyme) {
      case 'ADMIN':           return 'bg-red-100 text-red-700';
      case 'AGENT_RH':        return 'bg-blue-100 text-blue-700';
      case 'AGENT_FINANCIER': return 'bg-green-100 text-green-700';
      case 'AGENT_COMMERCIAL':return 'bg-yellow-100 text-yellow-700';
      default:                return 'bg-purple-100 text-purple-700';
    }
  }

  getRoleLabel(accronyme: string): string {
    // Utiliser la description du rôle si disponible, sinon formater l'acronyme
    const role = this.roles.find(r => r.accronyme === accronyme);
    if (role) return role.description;
    return accronyme.replace(/_/g, ' ');
  }

  getRoleIcon(accronyme: string): string {
    switch (accronyme) {
      case 'ADMIN':
        return 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z';
      case 'AGENT_RH':
        return 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z';
      case 'AGENT_FINANCIER':
        return 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'AGENT_COMMERCIAL':
        return 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
      default:
        return 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z';
    }
  }

  getAgentRole(agent: Agent): string {
    return agent.users?.[0]?.role?.accronyme || 'N/A';
  }

  /** Tous les rôles d'un agent : principal d'abord, puis additionnels (dédupliqués). */
  getAgentRoles(agent: Agent): Role[] {
    const user = agent.users?.[0];
    if (!user) return [];
    const list: Role[] = [];
    const seen = new Set<number>();
    if (user.role) { list.push(user.role); seen.add(user.role.idrole); }
    for (const r of user.additionalRoles || []) {
      if (!seen.has(r.idrole)) { list.push(r); seen.add(r.idrole); }
    }
    return list;
  }

  getServiceName(serviceId: number): string {
    const service = this.services.find(s => s.idservice === serviceId);
    return service?.description || service?.accronyme || 'N/A';
  }

  /** Libellé du rattachement d'un agent : son service, ou ses directions. */
  getRattachementLabel(agent: Agent): string {
    if (agent.directions && agent.directions.length > 0) {
      return agent.directions.map(d => d.accronyme || d.nom).join(', ');
    }
    if (agent.directionDirecte) {
      return `${agent.directionDirecte.nom} (${agent.directionDirecte.accronyme})`;
    }
    if (agent.service_idservice) {
      return this.getServiceName(agent.service_idservice);
    }
    return 'N/A';
  }
}
