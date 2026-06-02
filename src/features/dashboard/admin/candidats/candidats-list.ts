// src/features/dashboard/admin/candidats/candidats-list.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AdminCandidatService, Candidat, CandidatDetails, CandidatStats, CandidatFilters } from '../../../../core/services/admin-candidat.service';
import { SearchService } from '../../../../core/services/search.service';
import { environment } from '../../../../environments/environment';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

@Component({
  selector: 'app-candidats-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './candidats-list.html',
  styles: [`
    .toast-enter {
      animation: slideInRight 0.3s ease-out;
    }
    .toast-leave {
      animation: slideOutRight 0.3s ease-in;
    }
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `]
})
export class CandidatsList implements OnInit, OnDestroy {
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
  showDeleteModal = false;
  candidatToDelete: Candidat | null = null;

  // Formulaire d'édition
  editForm = {
    nom: '',
    prenom: '',
    email: '',
    telephone: ''
  };

  // Toast notifications
  toasts: Toast[] = [];
  private toastId = 0;
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
    const toast: Toast = {
      id: ++this.toastId,
      type,
      title,
      message
    };
    this.toasts.push(toast);
    this.cdr.detectChanges();

    setTimeout(() => {
      this.ngZone.run(() => {
        this.removeToast(toast.id);
      });
    }, 5000);
  }

  removeToast(id: number): void {
    const index = this.toasts.findIndex(t => t.id === id);
    if (index > -1) {
      this.toasts.splice(index, 1);
      this.cdr.detectChanges();
    }
  }

  getToastIcon(type: string): string {
    switch (type) {
      case 'success': return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'error': return 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'warning': return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
      case 'info': return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
      default: return '';
    }
  }

  getToastBgClass(type: string): string {
    switch (type) {
      case 'success': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'info': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
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
  saveCandidat(): void {
    if (!this.selectedCandidat) return;

    // Validation simple
    if (!this.editForm.nom.trim() || !this.editForm.prenom.trim() || !this.editForm.email.trim() || !this.editForm.telephone.trim()) {
      this.showToast('error', 'Erreur', 'Tous les champs sont obligatoires');
      return;
    }

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

  openDeleteModal(candidat: Candidat): void {
    this.candidatToDelete = candidat;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.candidatToDelete = null;
    this.showDeleteModal = false;
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
