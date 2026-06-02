// src/features/dashboard/commercial/offres-commerciales/offres-commerciales.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CommercialService, Offre } from '../../../../core/services/commercial.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-commercial-offres-commerciales',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './offres-commerciales.html',
  styleUrl: './offres-commerciales.css',
})
export class CommercialOffresCommerciales implements OnInit {
  offres: Offre[] = [];
  filteredOffres: Offre[] = [];
  isLoading = false;
  errorMessage = '';
  searchQuery = '';

  // Filtres
  filterStatus = '';
  filterCreePar = '';

  // Pagination
  currentPage = 1;
  pageSize = 10;

  get peutConsulter(): boolean { return this.authService.hasPermission('OFFRE', 'CONSULTER'); }
  get peutGerer(): boolean { return this.authService.hasPermission('OFFRE', 'GERER'); }

  constructor(
    private commercialService: CommercialService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadOffres();
  }

  loadOffres(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.commercialService.getAllOffres({}).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.offres = res.data;
          this.applyFilters();
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Erreur lors du chargement des offres';
        this.cdr.detectChanges();
      },
    });
  }

  applyFilters(): void {
    let result = [...this.offres];
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(o =>
        o.titre.toLowerCase().includes(q) ||
        o.typeOffre.toLowerCase().includes(q) ||
        (o.description || '').toLowerCase().includes(q)
      );
    }
    if (this.filterStatus) {
      result = result.filter(o => o.statusOffre === this.filterStatus);
    }
    if (this.filterCreePar) {
      result = result.filter(o => o.creePar === this.filterCreePar);
    }
    this.filteredOffres = result;
    this.currentPage = 1;
  }

  onSearch(): void {
    this.applyFilters();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.filterStatus = '';
    this.filterCreePar = '';
    this.applyFilters();
  }

  // Pagination
  get totalPages(): number {
    return Math.ceil(this.filteredOffres.length / this.pageSize);
  }

  get pagedOffres(): Offre[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredOffres.slice(start, start + this.pageSize);
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(this.totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
  }

  // Stats rapides
  get totalOffres(): number { return this.offres.length; }
  get offresActives(): number { return this.offres.filter(o => o.statusOffre === 'ACTIVE').length; }
  get offresEnAttente(): number { return this.offres.filter(o => o.statusOffre === 'EN_ATTENTE' || o.statusOffre === 'EN_TRAITEMENT').length; }

  // Helpers
  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      BROUILLON: 'Brouillon', EN_ATTENTE: 'En attente', EN_TRAITEMENT: 'En traitement',
      VALIDEE: 'Validée', REJETEE: 'Rejetée', ACTIVE: 'Active', CLOTUREE: 'Clôturée'
    };
    return map[status] || status;
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      ACTIVE:        'bg-green-100 text-green-700',
      EN_ATTENTE:    'bg-orange-100 text-orange-700',
      EN_TRAITEMENT: 'bg-blue-100 text-blue-700',
      VALIDEE:       'bg-teal-100 text-teal-700',
      REJETEE:       'bg-red-100 text-red-700',
      CLOTUREE:      'bg-gray-100 text-gray-600',
      BROUILLON:     'bg-gray-100 text-gray-500',
    };
    return map[status] || 'bg-gray-100 text-gray-600';
  }

  getCreePar(creePar: string): string {
    return creePar === 'ADMIN' ? 'Agent' : 'Candidat';
  }

  getCreeParClass(creePar: string): string {
    return creePar === 'ADMIN' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
