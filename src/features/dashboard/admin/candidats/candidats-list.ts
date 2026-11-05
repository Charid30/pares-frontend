// src/features/dashboard/admin/candidats/candidats-list.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AdminCandidatService, Candidat, CandidatDetails, CandidatStats, CandidatFilters } from '../../../../core/services/admin-candidat.service';
import { SearchService } from '../../../../core/services/search.service';
import { environment } from '../../../../environments/environment';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmService } from '../../../../core/services/confirm.service';

@Component({
  selector: 'app-candidats-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, StatCard],
  templateUrl: './candidats-list.html'
})
export class CandidatsList implements OnInit, OnDestroy {
  private readonly confirmService = inject(ConfirmService);
  private readonly toastService = inject(ToastService);
  // Données
  candidats: Candidat[] = [];
  stats: CandidatStats | null = null;
  selectedCandidat: CandidatDetails | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;
  totalPages = 0;

  // Filtres et recherche
  searchTerm = '';
  sortBy = 'createdDate';
  sortOrder: 'ASC' | 'DESC' = 'DESC';

  // État
  loading = false;
  submitting = false;
  error = '';

  // Modal
  showModal = false;
  modalMode: 'view' | 'edit' = 'view';

  // Modal suppression
  candidatToDelete: Candidat | null = null;

  // Modal reset mot de passe
  showResetPasswordModal = false;
  candidatToReset: Candidat | null = null;
  resetPasswordForm = { newPassword: '', confirmPassword: '', showPassword: false };

  // Formulaire d'édition
  editForm = {
    nom: '',
    prenom: '',
    email: '',
    telephone: ''
  };

  private searchSub?: Subscription;

  constructor(
    private adminCandidatService: AdminCandidatService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private searchService: SearchService,
  ) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadCandidats();
    this.searchSub = this.searchService.term$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
    ).subscribe(term => {
      this.searchTerm = term;
      this.currentPage = 1;
      this.loadCandidats();
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
  loadStats(): void {
    this.adminCandidatService.getStats().subscribe({
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

  loadCandidats(): void {
    this.loading = true;
    this.error = '';

    const filters: CandidatFilters = {
      page: this.currentPage,
      limit: this.pageSize,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder
    };

    if (this.searchTerm) {
      filters.search = this.searchTerm;
    }

    this.adminCandidatService.getCandidats(filters).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.candidats = response.data.items;
            this.totalItems = response.data.total;
            this.totalPages = response.data.totalPages;
          }
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.error = 'Erreur lors du chargement des candidats';
          this.loading = false;
          console.error('Erreur:', err);
          this.cdr.detectChanges();
        });
      }
    });
  }

  // ==================== SEARCH & FILTER ====================
  onSearch(): void {
    this.currentPage = 1;
    this.loadCandidats();
  }

  onSortChange(field: string): void {
    if (this.sortBy === field) {
      this.sortOrder = this.sortOrder === 'ASC' ? 'DESC' : 'ASC';
    } else {
      this.sortBy = field;
      this.sortOrder = 'DESC';
    }
    this.loadCandidats();
  }

  // ==================== PAGINATION ====================
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadCandidats();
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
  openViewModal(candidat: Candidat): void {
    this.modalMode = 'view';
    this.selectedCandidat = null;
    this.loading = true;
    this.showModal = true;
    this.cdr.detectChanges();

    console.log('=== openViewModal ===');
    console.log('Candidat ID:', candidat.idcandidats);
    console.log('showModal:', this.showModal);

    this.adminCandidatService.getCandidatById(candidat.idcandidats).subscribe({
      next: (response) => {
        console.log('=== Réponse API reçue ===');
        console.log('Success:', response.success);
        console.log('Data:', response.data);
        this.ngZone.run(() => {
          if (response.success) {
            this.selectedCandidat = response.data;
          } else {
            console.error('Réponse non réussie:', response);
            this.showToast('error', 'Erreur', 'Erreur lors du chargement des détails');
          }
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error('=== Erreur API ===');
        console.error('Status:', err.status);
        console.error('Message:', err.message);
        console.error('Error Object:', err);
        this.ngZone.run(() => {
          const errorMsg = err.error?.message || err.message || 'Impossible de charger les détails du candidat';
          this.showToast('error', 'Erreur', errorMsg);
          this.loading = false;
          // Ne pas fermer le modal - afficher l'erreur à l'intérieur
          this.cdr.detectChanges();
        });
      }
    });
  }

  openEditModal(candidat: Candidat): void {
    this.modalMode = 'edit';
    this.selectedCandidat = candidat as CandidatDetails;
    this.editForm = {
      nom: candidat.nom,
      prenom: candidat.prenom,
      email: candidat.email,
      telephone: candidat.telephone
    };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedCandidat = null;
    this.editForm = { nom: '', prenom: '', email: '', telephone: '' };
  }

  // ==================== CRUD OPERATIONS ====================
  async saveCandidat(): Promise<void> {
    if (!this.selectedCandidat) return;

    // Validation simple
    if (!this.editForm.nom.trim() || !this.editForm.prenom.trim() || !this.editForm.email.trim() || !this.editForm.telephone.trim()) {
      this.showToast('error', 'Erreur', 'Tous les champs sont obligatoires');
      return;
    }

    if (!(await this.confirmService.demander({ titre: 'Enregistrer les modifications', message: 'Les informations du candidat seront mises à jour.', confirmer: 'Enregistrer' }))) return;
    this.submitting = true;
    this.adminCandidatService.updateCandidat(this.selectedCandidat.idcandidats, this.editForm).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.closeModal();
            this.loadCandidats();
            this.showToast('success', 'Succès !', `Le candidat ${this.editForm.prenom} ${this.editForm.nom} a été mis à jour`);
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

  async openDeleteModal(candidat: Candidat): Promise<void> {
    this.candidatToDelete = candidat;
    if (!(await this.confirmService.demander({ titre: 'Supprimer le candidat', message: 'Cette action est irréversible.', detail: `${candidat.prenom} ${candidat.nom}`, confirmer: 'Supprimer', danger: true }))) { this.closeDeleteModal(); return; }
    this.confirmDelete();
  }

  closeDeleteModal(): void {
    this.candidatToDelete = null;
  }

  confirmDelete(): void {
    if (!this.candidatToDelete) return;

    this.submitting = true;
    const candidatName = `${this.candidatToDelete.prenom} ${this.candidatToDelete.nom}`;
    const id = this.candidatToDelete.idcandidats;

    this.adminCandidatService.deleteCandidat(id).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.closeDeleteModal();
            this.loadCandidats();
            this.loadStats();
            this.showToast('success', 'Supprimé !', `Le candidat ${candidatName} a été supprimé`);
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

  // ==================== RESET PASSWORD ====================
  openResetPasswordModal(candidat: Candidat): void {
    this.candidatToReset = candidat;
    this.resetPasswordForm = { newPassword: '', confirmPassword: '', showPassword: false };
    this.showResetPasswordModal = true;
  }

  closeResetPasswordModal(): void {
    this.candidatToReset = null;
    this.resetPasswordForm = { newPassword: '', confirmPassword: '', showPassword: false };
    this.showResetPasswordModal = false;
  }

  async confirmResetPassword(): Promise<void> {
    if (!this.candidatToReset) return;

    if (!(await this.confirmService.demander({ titre: 'Réinitialiser le mot de passe', message: 'Le candidat devra utiliser ce nouveau mot de passe pour se connecter.', confirmer: 'Réinitialiser', danger: true }))) return;
    const { newPassword, confirmPassword } = this.resetPasswordForm;
    if (!newPassword || newPassword.length < 8) {
      this.showToast('error', 'Erreur', 'Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (newPassword !== confirmPassword) {
      this.showToast('error', 'Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    this.submitting = true;
    const candidatName = `${this.candidatToReset.prenom} ${this.candidatToReset.nom}`;

    this.adminCandidatService.resetPassword(this.candidatToReset.idcandidats, newPassword).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.closeResetPasswordModal();
            this.showToast('success', 'Mot de passe réinitialisé', `Le mot de passe de ${candidatName} a été modifié avec succès`);
          }
          this.submitting = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.showToast('error', 'Erreur', err.error?.message || 'Erreur lors de la réinitialisation');
          this.submitting = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  // ==================== HELPERS ====================
  getInitials(candidat: Candidat): string {
    return `${candidat.prenom.charAt(0)}${candidat.nom.charAt(0)}`.toUpperCase();
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatDateTime(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStageStatusClass(status: string): string {
    const classes: { [key: string]: string } = {
      'EN_ATTENTE': 'bg-yellow-100 text-yellow-700',
      'VALIDE': 'bg-green-100 text-green-700',
      'EN_COURS': 'bg-blue-100 text-blue-700',
      'TERMINE': 'bg-gray-100 text-gray-700',
      'REJETE': 'bg-red-100 text-red-700'
    };
    return classes[status] || 'bg-gray-100 text-gray-700';
  }

  getStageStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'EN_ATTENTE': 'En attente',
      'VALIDE': 'Validé',
      'EN_COURS': 'En cours',
      'TERMINE': 'Terminé',
      'REJETE': 'Rejeté'
    };
    return labels[status] || status;
  }

  // ==================== EXPORT CSV ====================
  exporterCSV(): void {
    const url = `${environment.apiUrl}/admin/candidats/export`;
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const today = new Date().toISOString().slice(0, 10);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `candidats_${today}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        this.showToast('success', 'Export', 'Fichier CSV téléchargé avec succès');
        this.cdr.detectChanges();
      },
      error: () => {
        this.showToast('error', 'Export', 'Impossible de générer le fichier CSV');
        this.cdr.detectChanges();
      },
    });
  }
}
