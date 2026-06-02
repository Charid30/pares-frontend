// src/features/dashboard/admin/stages/stages-suivi.ts
import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminStageService, StageSuivi } from '../../../../core/services/admin-stage.service';

@Component({
  selector: 'app-stages-suivi',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './stages-suivi.html',
  styleUrl: './stages-suivi.css',
})
export class StagesSuivi implements OnInit {
  stages: StageSuivi[] = [];
  filteredStages: StageSuivi[] = [];
  isLoading = false;
  errorMessage = '';
  searchQuery = '';

  readonly DUREE_MAX_MOIS = 6;

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;
  totalPages = 1;

  constructor(
    private adminStageService: AdminStageService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadSuivi();
  }

  loadSuivi(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.adminStageService.getStagesSuivi({
      search: this.searchQuery || undefined,
      page: this.currentPage,
      limit: this.pageSize,
    }).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          this.isLoading = false;
          if (response.success) {
            const data = response.data;
            this.stages = data.items;
            this.filteredStages = data.items;
            this.totalItems = data.total;
            this.totalPages = data.totalPages;
            this.currentPage = data.page;
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.isLoading = false;
          this.errorMessage = err.error?.message || 'Erreur lors du chargement du suivi';
          this.cdr.detectChanges();
        });
      },
    });
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadSuivi();
  }

  onSearchServer(): void {
    this.currentPage = 1;
    this.loadSuivi();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.loadSuivi();
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(this.totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  // Calcul de la largeur de la barre de progression (0-100)
  getProgressPercent(moisConsommes: number): number {
    return Math.min(100, Math.round((moisConsommes / this.DUREE_MAX_MOIS) * 100));
  }

  // Couleur de la barre selon le niveau d'alerte
  getProgressColor(moisConsommes: number): string {
    const pct = this.getProgressPercent(moisConsommes);
    if (pct >= 100) return 'bg-red-600';
    if (pct >= 80) return 'bg-orange-500';
    if (pct >= 60) return 'bg-yellow-500';
    return 'bg-green-500';
  }

  // Badge couleur texte
  getProgressTextColor(moisConsommes: number): string {
    const pct = this.getProgressPercent(moisConsommes);
    if (pct >= 100) return 'text-red-700';
    if (pct >= 80) return 'text-orange-600';
    if (pct >= 60) return 'text-yellow-700';
    return 'text-green-700';
  }

  // Libelle jours restants
  getJoursRestantsLabel(joursRestants: number | null): string {
    if (joursRestants === null) return 'Date non définie';
    if (joursRestants < 0) return 'Terminé';
    if (joursRestants === 0) return 'Dernier jour';
    if (joursRestants === 1) return '1 jour restant';
    return `${joursRestants} jours restants`;
  }

  // Couleur du badge jours restants
  getJoursRestantsBadgeClass(joursRestants: number | null): string {
    if (joursRestants === null || joursRestants < 0) return 'bg-gray-100 text-gray-600';
    if (joursRestants <= 7) return 'bg-red-100 text-red-700';
    if (joursRestants <= 14) return 'bg-orange-100 text-orange-700';
    return 'bg-blue-100 text-blue-700';
  }

  formatDate(date: string | null): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('fr-FR');
  }

  getNomComplet(stage: StageSuivi): string {
    return `${stage.candidat.prenom} ${stage.candidat.nom}`;
  }

  // Tri par mois consommes decroissant (les plus avances en premier)
  get sortedStages(): StageSuivi[] {
    return [...this.filteredStages].sort((a, b) => b.moisConsommes - a.moisConsommes);
  }

  // Stats globales
  get totalEnCours(): number {
    return this.totalItems;
  }

  get totalAtLimite(): number {
    return this.filteredStages.filter(s => s.moisConsommes >= this.DUREE_MAX_MOIS).length;
  }

  get totalEnAlerte(): number {
    return this.filteredStages.filter(
      s => s.moisConsommes >= (this.DUREE_MAX_MOIS * 0.8) && s.moisConsommes < this.DUREE_MAX_MOIS
    ).length;
  }

  get totalRenouvellement(): number {
    return this.filteredStages.filter(s => s.estRenouvellement === 1).length;
  }
}
