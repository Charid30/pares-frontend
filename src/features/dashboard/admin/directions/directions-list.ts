// directions-list.ts
import { ChangeDetectorRef, Component, NgZone, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import {
  AdminDirectionService,
  DirectionItem,
  DirectionFilters,
} from '../../../../core/services/admin-direction.service';
import { ServiceItem } from '../../../../core/services/admin-service.service';
import { SearchService } from '../../../../core/services/search.service';

interface Toast {
  id: number;
  type: 'success' | 'error';
  title: string;
  message: string;
}

@Component({
  selector: 'app-directions-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './directions-list.html',
  styleUrls: ['./directions-list.css'],
})
export class DirectionsList implements OnInit, OnDestroy {
  // ── Données ───────────────────────────────────────────
  directions: DirectionItem[] = [];
  allServices: ServiceItem[]  = [];   // Pour le multi-sélect dans la modal
  totalItems = 0;

  // ── Filtres & Pagination ──────────────────────────────
  searchTerm  = '';
  currentPage = 1;
  pageSize    = 10;
  totalPages  = 1;

  // ── États ─────────────────────────────────────────────
  loading    = false;
  submitting = false;

  // ── Modal créer / éditer ──────────────────────────────
  showModal  = false;
  showDeleteModal = false;
  modalMode: 'create' | 'edit' = 'create';
  selectedDirection: DirectionItem | null = null;

  // ── Formulaire ────────────────────────────────────────
  formNom        = '';
  formAccronyme  = '';
  formServiceIds = new Set<number>();   // Services cochés dans la modal
  formError      = '';

  // ── Toasts ────────────────────────────────────────────
  toasts: Toast[] = [];
  private toastId = 0;

  private searchSub?: Subscription;

  constructor(
    private directionService: AdminDirectionService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private searchService: SearchService,
  ) {}

  ngOnInit(): void {
    this.loadAll();
    this.searchSub = this.searchService.term$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
    ).subscribe(term => {
      this.searchTerm = term;
      this.currentPage = 1;
      this.loadDirections();
    });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  // ═══════════════════════════════════════════════════
  // CHARGEMENT
  // ═══════════════════════════════════════════════════

  private loadAll(): void {
    // Charger directions + liste complète des services en parallèle
    this.loading = true;
    this.directionService.getAllServices().subscribe({
      next: (res) => {
        if (res.success) this.allServices = res.data.items;
        this.loadDirections();
      },
      error: () => this.loadDirections(),
    });
  }

  loadDirections(): void {
    this.loading = true;
    const filters: DirectionFilters = { page: this.currentPage, limit: this.pageSize };
    if (this.searchTerm.trim()) filters.search = this.searchTerm.trim();

    this.directionService.getDirections(filters).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.directions = res.data.items;
            this.totalItems = res.data.total;
            this.totalPages = res.data.totalPages;
            this.currentPage = res.data.page;
          }
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.showToast('Erreur', 'Impossible de charger les directions', 'error');
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  onSearch(): void { this.currentPage = 1; this.loadDirections(); }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.loadDirections();
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    const max = 5;
    let start = Math.max(1, this.currentPage - Math.floor(max / 2));
    const end  = Math.min(this.totalPages, start + max - 1);
    if (end - start < max - 1) start = Math.max(1, end - max + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  // ═══════════════════════════════════════════════════
  // MODAL CRÉER / ÉDITER
  // ═══════════════════════════════════════════════════

  openCreateModal(): void {
    this.modalMode = 'create';
    this.selectedDirection = null;
    this.formNom       = '';
    this.formAccronyme = '';
    this.formServiceIds = new Set();
    this.formError = '';
    this.showModal = true;
  }

  openEditModal(dir: DirectionItem): void {
    this.modalMode = 'edit';
    this.selectedDirection = dir;
    this.formNom       = dir.nom;
    this.formAccronyme = dir.accronyme;
    this.formServiceIds = new Set((dir.services ?? []).map(s => s.idservice));
    this.formError = '';
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedDirection = null;
    this.formError = '';
  }

  toggleService(id: number): void {
    if (this.formServiceIds.has(id)) {
      this.formServiceIds.delete(id);
    } else {
      this.formServiceIds.add(id);
    }
  }

  isServiceSelected(id: number): boolean {
    return this.formServiceIds.has(id);
  }

  submitForm(): void {
    this.formError = '';
    if (!this.formNom.trim())       { this.formError = 'Le nom est requis';       return; }
    if (!this.formAccronyme.trim()) { this.formError = 'L\'acronyme est requis';  return; }

    this.submitting = true;
    const data = {
      nom:        this.formNom.trim(),
      accronyme:  this.formAccronyme.trim().toUpperCase(),
      serviceIds: Array.from(this.formServiceIds),
    };

    if (this.modalMode === 'create') {
      this.directionService.createDirection(data).subscribe({
        next: (res) => {
          this.ngZone.run(() => {
            if (res.success) {
              this.showToast('Succès', 'Direction créée avec succès', 'success');
              this.closeModal();
              this.loadDirections();
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
    } else if (this.selectedDirection) {
      this.directionService.updateDirection(this.selectedDirection.iddirection, data).subscribe({
        next: (res) => {
          this.ngZone.run(() => {
            if (res.success) {
              this.showToast('Succès', 'Direction mise à jour avec succès', 'success');
              this.closeModal();
              this.loadDirections();
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

  // ═══════════════════════════════════════════════════
  // SUPPRESSION
  // ═══════════════════════════════════════════════════

  openDeleteModal(dir: DirectionItem): void {
    this.selectedDirection = dir;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.selectedDirection = null;
  }

  confirmDelete(): void {
    if (!this.selectedDirection) return;
    this.submitting = true;

    this.directionService.deleteDirection(this.selectedDirection.iddirection).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.showToast('Succès', 'Direction supprimée avec succès', 'success');
            this.closeDeleteModal();
            if (this.directions.length === 1 && this.currentPage > 1) this.currentPage--;
            this.loadDirections();
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

  // ═══════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════

  formatDate(date: string): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  getInitials(accronyme: string): string {
    return accronyme?.substring(0, 3).toUpperCase() || '???';
  }

  trackByDirectionId(_: number, dir: DirectionItem): number {
    return dir.iddirection;
  }

  // ═══════════════════════════════════════════════════
  // TOASTS
  // ═══════════════════════════════════════════════════

  showToast(title: string, message: string, type: 'success' | 'error'): void {
    const toast: Toast = { id: ++this.toastId, type, title, message };
    this.toasts.push(toast);
    setTimeout(() => this.removeToast(toast.id), 4000);
  }

  removeToast(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.cdr.detectChanges();
  }
}
