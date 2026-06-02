import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RhService, Candidat } from '../../../../core/services/rh.service';

@Component({
  selector: 'app-rh-candidats',
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './rh-candidats.html',
  styleUrl: './rh-candidats.css',
})
export class RhCandidats implements OnInit {
  candidats: Candidat[] = [];
  selectedCandidat: Candidat | null = null;
  candidatDetails: any = null;

  loading = true;
  loadingDetails = false;
  error: string | null = null;

  // Filtres
  searchTerm = '';
  sortBy = 'createdDate';
  sortOrder: 'ASC' | 'DESC' = 'DESC';

  // Pagination
  page = 1;
  limit = 15;
  total = 0;
  totalPages = 0;

  // Stats
  stats: any = null;

  readonly Math = Math;

  constructor(
    private rhService: RhService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadCandidats();
    this.loadStats();
  }

  loadCandidats(): void {
    this.loading = true;
    this.error = null;

    this.rhService.getCandidats({
      page: this.page,
      limit: this.limit,
      search: this.searchTerm.trim() || undefined,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder,
    }).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.candidats = res.data.items;
            this.total = res.data.total;
            this.totalPages = res.data.totalPages;
          }
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          console.error('Erreur chargement candidats:', err);
          this.error = 'Impossible de charger la liste des candidats.';
          this.loading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  loadStats(): void {
    this.rhService.getCandidatStats().subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) this.stats = res.data;
          this.cdr.detectChanges();
        });
      },
      error: () => {}
    });
  }

  viewCandidat(candidat: Candidat): void {
    this.selectedCandidat = candidat;
    this.loadingDetails = true;
    this.candidatDetails = null;

    this.rhService.getCandidatById(candidat.idcandidats).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) this.candidatDetails = res.data;
          this.loadingDetails = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.loadingDetails = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  closeDetails(): void {
    this.selectedCandidat = null;
    this.candidatDetails = null;
  }

  onSearch(): void { this.page = 1; this.loadCandidats(); }
  clearFilters(): void { this.searchTerm = ''; this.page = 1; this.loadCandidats(); }

  toggleSort(field: string): void {
    if (this.sortBy === field) {
      this.sortOrder = this.sortOrder === 'ASC' ? 'DESC' : 'ASC';
    } else {
      this.sortBy = field;
      this.sortOrder = 'ASC';
    }
    this.page = 1;
    this.loadCandidats();
  }

  getInitiales(c: Candidat): string {
    return `${c.nom.charAt(0)}${c.prenom.charAt(0)}`.toUpperCase();
  }

  getNomComplet(c: Candidat): string {
    return `${c.prenom} ${c.nom}`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  get pages(): number[] {
    return Array.from({ length: Math.min(this.totalPages, 7) }, (_, i) => {
      if (this.totalPages <= 7) return i + 1;
      if (this.page <= 4) return i + 1;
      if (this.page >= this.totalPages - 3) return this.totalPages - 6 + i;
      return this.page - 3 + i;
    });
  }
}
