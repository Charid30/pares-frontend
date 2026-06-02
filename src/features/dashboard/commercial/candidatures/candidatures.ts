// src/features/dashboard/commercial/candidatures/candidatures.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CommercialService, Offre, CandidatureOffre } from '../../../../core/services/commercial.service';
import { AuthService } from '../../../../core/services/auth.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-commercial-candidatures',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './candidatures.html',
  styleUrl: './candidatures.css',
})
export class CommercialCandidatures implements OnInit {

  candidatures: CandidatureOffre[] = [];
  filteredCandidatures: CandidatureOffre[] = [];
  isLoading = false;
  errorMessage = '';
  searchQuery = '';
  filterStatus = '';

  currentPage = 1;
  pageSize = 12;

  get peutConsulter(): boolean { return this.authService.hasPermission('CANDIDATURES', 'CONSULTER'); }

  constructor(
    private commercialService: CommercialService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCandidatures();
  }

  loadCandidatures(): void {
    this.isLoading = true;
    this.errorMessage = '';

    // 1) charger toutes les offres, puis 2) charger les candidatures de chacune
    this.commercialService.getAllOffres({}).subscribe({
      next: (res) => {
        if (!res.success || res.data.length === 0) {
          this.isLoading = false;
          this.cdr.detectChanges();
          return;
        }
        const offres = res.data;
        const calls = offres.map(o => this.commercialService.getCandidaturesByOffre(o.idoffres));
        forkJoin(calls).subscribe({
          next: (results) => {
            this.candidatures = results
              .filter(r => r.success)
              .flatMap(r => r.data)
              .sort((a, b) => new Date(b.dateCandidature).getTime() - new Date(a.dateCandidature).getTime());
            this.applyFilters();
            this.isLoading = false;
            this.cdr.detectChanges();
          },
          error: () => {
            this.isLoading = false;
            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Erreur lors du chargement des candidatures';
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters(): void {
    let result = [...this.candidatures];
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(c =>
        (c.candidat?.nom || '').toLowerCase().includes(q) ||
        (c.candidat?.prenom || '').toLowerCase().includes(q) ||
        (c.candidat?.email || '').toLowerCase().includes(q) ||
        (c.offre?.titre || '').toLowerCase().includes(q)
      );
    }
    if (this.filterStatus) {
      result = result.filter(c => c.statusCandidature === this.filterStatus);
    }
    this.filteredCandidatures = result;
    this.currentPage = 1;
  }

  onSearch(): void { this.applyFilters(); }

  resetFilters(): void {
    this.searchQuery = '';
    this.filterStatus = '';
    this.applyFilters();
  }

  get totalPages(): number { return Math.ceil(this.filteredCandidatures.length / this.pageSize); }
  get pagedCandidatures(): CandidatureOffre[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredCandidatures.slice(start, start + this.pageSize);
  }
  get visiblePages(): number[] {
    const pages: number[] = [], max = 5;
    let start = Math.max(1, this.currentPage - Math.floor(max / 2));
    const end = Math.min(this.totalPages, start + max - 1);
    if (end - start < max - 1) start = Math.max(1, end - max + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
  }

  get totalCandidatures(): number { return this.candidatures.length; }
  get enAttente(): number { return this.candidatures.filter(c => c.statusCandidature === 'SOUMISE' || c.statusCandidature === 'EN_EXAMEN').length; }
  get validees(): number { return this.candidatures.filter(c => c.statusCandidature === 'VALIDEE').length; }

  getStatusLabel(s: string): string {
    return { SOUMISE: 'Soumise', EN_EXAMEN: 'En examen', VALIDEE: 'Validée', REJETEE: 'Rejetée' }[s] || s;
  }
  getStatusClass(s: string): string {
    return { SOUMISE: 'bg-orange-100 text-orange-700', EN_EXAMEN: 'bg-blue-100 text-blue-700', VALIDEE: 'bg-green-100 text-green-700', REJETEE: 'bg-red-100 text-red-700' }[s] || 'bg-gray-100 text-gray-600';
  }
  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  getInitials(nom?: string, prenom?: string): string {
    return ((prenom?.[0] || '') + (nom?.[0] || '')).toUpperCase() || '?';
  }
}
