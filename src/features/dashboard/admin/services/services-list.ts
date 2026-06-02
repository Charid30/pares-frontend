// services-list.ts - Composant de gestion des services
import { ChangeDetectorRef, Component, NgZone, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import {
  AdminServiceService,
  ServiceItem,
  ServiceFilters,
} from '../../../../core/services/admin-service.service';
import { SearchService } from '../../../../core/services/search.service';

interface Toast {
  id: number;
  type: 'success' | 'error';
  title: string;
  message: string;
}

@Component({
  selector: 'app-services-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './services-list.html',
  styleUrls: ['./services-list.css'],
})
export class ServicesList implements OnInit, OnDestroy {
  // Données
  services: ServiceItem[] = [];
  totalItems = 0;

  // Filtres
  searchTerm = '';

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  // États
  loading = false;
  submitting = false;

  // Modal
  showModal = false;
  showDeleteModal = false;
  modalMode: 'create' | 'edit' = 'create';
  selectedService: ServiceItem | null = null;

  // Formulaire
  formAccronyme = '';
  formDescription = '';
  formError = '';

  // Toasts
  toasts: Toast[] = [];
  private toastId = 0;

  private searchSub?: Subscription;

  constructor(
    private serviceService: AdminServiceService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private searchService: SearchService,
  ) {}

  ngOnInit(): void {
    this.loadServices();
    this.searchSub = this.searchService.term$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
    ).subscribe(term => {
      this.searchTerm = term;
      this.currentPage = 1;
      this.loadServices();
    });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  // =====================================================
  // CHARGEMENT
  // =====================================================

  loadServices(): void {
    this.loading = true;
    const filters: ServiceFilters = {
      page: this.currentPage,
      limit: this.pageSize,
    };
    if (this.searchTerm.trim()) filters.search = this.searchTerm.trim();

    this.serviceService.getServices(filters).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.services = response.data.items;
            this.totalItems = response.data.total;
            this.totalPages = response.data.totalPages;
            this.currentPage = response.data.page;
          }
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.showToast('Erreur', 'Impossible de charger les services', 'error');
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadServices();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.loadServices();
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(this.totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) { start = Math.max(1, end - maxVisible + 1); }
    for (let i = start; i <= end; i++) { pages.push(i); }
    return pages;
  }

  // =====================================================
  // MODAL CRÉER / ÉDITER
  // =====================================================

  openCreateModal(): void {
    this.modalMode = 'create';
    this.selectedService = null;
    this.formAccronyme = '';
    this.formDescription = '';
    this.formError = '';
    this.showModal = true;
  }

  openEditModal(service: ServiceItem): void {
    this.modalMode = 'edit';
    this.selectedService = service;
    this.formAccronyme = service.accronyme;
    this.formDescription = service.description;
    this.formError = '';
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedService = null;
    this.formError = '';
  }

  submitForm(): void {
    this.formError = '';

    if (!this.formAccronyme.trim()) {
      this.formError = 'L\'acronyme est requis';
      return;
    }
    if (!this.formDescription.trim()) {
      this.formError = 'La description est requise';
      return;
    }
    if (this.formAccronyme.trim().length > 100) {
      this.formError = 'L\'acronyme ne doit pas dépasser 100 caractères';
      return;
    }

    this.submitting = true;
    const data = {
      accronyme: this.formAccronyme.trim().toUpperCase(),
      description: this.formDescription.trim(),
    };

    if (this.modalMode === 'create') {
      this.serviceService.createService(data).subscribe({
        next: (response) => {
          this.ngZone.run(() => {
            if (response.success) {
              this.showToast('Succès', 'Service créé avec succès', 'success');
              this.closeModal();
              this.loadServices();
            }
            this.submitting = false;
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.formError = err.error?.message || 'Erreur lors de la création';
            this.submitting = false;
            this.cdr.detectChanges();
          });
        },
      });
    } else if (this.selectedService) {
      this.serviceService.updateService(this.selectedService.idservice, data).subscribe({
        next: (response) => {
          this.ngZone.run(() => {
            if (response.success) {
              this.showToast('Succès', 'Service mis à jour avec succès', 'success');
              this.closeModal();
              this.loadServices();
            }
            this.submitting = false;
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.formError = err.error?.message || 'Erreur lors de la mise à jour';
            this.submitting = false;
            this.cdr.detectChanges();
          });
        },
      });
    }
  }

  // =====================================================
  // SUPPRESSION
  // =====================================================

  openDeleteModal(service: ServiceItem): void {
    this.selectedService = service;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.selectedService = null;
  }

  confirmDelete(): void {
    if (!this.selectedService) return;
    this.submitting = true;

    this.serviceService.deleteService(this.selectedService.idservice).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.showToast('Succès', 'Service supprimé avec succès', 'success');
            this.closeDeleteModal();
            // Revenir à la page précédente si la page courante est vide
            if (this.services.length === 1 && this.currentPage > 1) {
              this.currentPage--;
            }
            this.loadServices();
          }
          this.submitting = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.showToast('Erreur', err.error?.message || 'Erreur lors de la suppression', 'error');
          this.submitting = false;
          this.closeDeleteModal();
          this.cdr.detectChanges();
        });
      },
    });
  }

  // =====================================================
  // HELPERS
  // =====================================================

  formatDate(date: string): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  getInitials(accronyme: string): string {
    return accronyme?.substring(0, 2).toUpperCase() || '??';
  }

  trackByServiceId(index: number, service: ServiceItem): number {
    return service.idservice;
  }

  // =====================================================
  // TOASTS
  // =====================================================

  showToast(title: string, message: string, type: 'success' | 'error'): void {
    const toast: Toast = { id: ++this.toastId, type, title, message };
    this.toasts.push(toast);
    setTimeout(() => this.removeToast(toast.id), 4000);
  }

  removeToast(id: number): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.cdr.detectChanges();
  }
}
