// src/features/dashboard/financier/aides-sociales/aides-sociales.ts
// v2 : traitement des demandes d'aides (évaluation candidat + gestion programmes admin)
import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FinancierService, Aide } from '../../../../core/services/financier.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-financier-aides-sociales',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './aides-sociales.html',
  styleUrl: './aides-sociales.css',
})
export class FinancierAidesSociales implements OnInit {
  aides: Aide[] = [];
  filteredAides: Aide[] = [];
  isLoading = false;
  errorMessage = '';
  searchQuery = '';

  // Filtres
  filterStatus = '';
  filterCreePar = '';

  // Pagination
  currentPage = 1;
  pageSize = 10;

  // ── Modal détail / évaluation ────────────────────────────────────────────
  showDetailModal = false;
  selectedAide: Aide | null = null;

  // ── Modal évaluation rapide (inline) ────────────────────────────────────
  showEvalModal = false;
  evalAide: Aide | null = null;
  evalStatut: 'EN_TRAITEMENT' | 'VALIDEE' | 'REJETEE' | '' = '';
  evalMotif = '';
  evalError = '';
  isEvaluating = false;
  evalSuccessMessage = '';

  // Permissions module AIDE
  canCreate   = false;
  canEdit     = false;
  canValidate = false;
  canReject   = false;
  canDelete   = false;

  constructor(
    private financierService: FinancierService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.canCreate   = this.authService.hasPermission('AIDE', 'CREER');
    this.canEdit     = this.authService.hasPermission('AIDE', 'MODIFIER');
    this.canValidate = this.authService.hasPermission('AIDE', 'VALIDER');
    this.canReject   = this.authService.hasPermission('AIDE', 'REJETER');
    this.canDelete   = this.authService.hasPermission('AIDE', 'SUPPRIMER');
    this.loadAides();
  }

  loadAides(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.financierService.getAllAides({}).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.isLoading = false;
          if (res.success) {
            this.aides = res.data;
            this.applyFilters();
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.isLoading = false;
          this.errorMessage = err.error?.message || 'Erreur lors du chargement des aides';
          this.cdr.detectChanges();
        });
      },
    });
  }

  applyFilters(): void {
    let result = [...this.aides];
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(a =>
        a.titre.toLowerCase().includes(q) ||
        a.typeAide.toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q) ||
        (a.candidatCreateur?.nom || '').toLowerCase().includes(q) ||
        (a.candidatCreateur?.prenom || '').toLowerCase().includes(q)
      );
    }
    if (this.filterStatus) result = result.filter(a => a.statusAide === this.filterStatus);
    if (this.filterCreePar) result = result.filter(a => a.creePar === this.filterCreePar);
    this.filteredAides = result;
    this.currentPage = 1;
  }

  onSearch(): void { this.applyFilters(); }

  resetFilters(): void {
    this.searchQuery = '';
    this.filterStatus = '';
    this.filterCreePar = '';
    this.applyFilters();
  }

  // ── Pagination ────────────────────────────────────────────────────────────
  get totalPages(): number { return Math.ceil(this.filteredAides.length / this.pageSize); }
  get pagedAides(): Aide[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredAides.slice(start, start + this.pageSize);
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

  // ── Stats rapides ─────────────────────────────────────────────────────────
  get totalAides(): number { return this.aides.length; }
  get aidesActives(): number { return this.aides.filter(a => a.statusAide === 'ACTIVE').length; }
  get aidesEnAttente(): number {
    return this.aides.filter(a => a.statusAide === 'EN_ATTENTE' || a.statusAide === 'EN_TRAITEMENT').length;
  }
  // Demandes candidats à traiter (uniquement celles EN_ATTENTE créées par candidat)
  get demandesCandidatsEnAttente(): number {
    return this.aides.filter(a => a.creePar === 'CANDIDAT' && a.statusAide === 'EN_ATTENTE').length;
  }

  // ── Modal détail ──────────────────────────────────────────────────────────
  ouvrirDetail(aide: Aide): void {
    this.selectedAide = aide;
    this.showDetailModal = true;
  }

  fermerDetail(): void {
    this.showDetailModal = false;
    this.selectedAide = null;
  }

  // ── Modal évaluation (demandes candidats : evaluateAide) ──────────────────
  ouvrirEvaluation(aide: Aide, statut: 'EN_TRAITEMENT' | 'VALIDEE' | 'REJETEE'): void {
    this.evalAide = aide;
    this.evalStatut = statut;
    this.evalMotif = '';
    this.evalError = '';
    this.showEvalModal = true;
    // Fermer le modal détail si ouvert
    this.showDetailModal = false;
  }

  fermerEvaluation(): void {
    this.showEvalModal = false;
    this.evalAide = null;
    this.evalStatut = '';
    this.evalMotif = '';
    this.evalError = '';
  }

  confirmerEvaluation(): void {
    if (!this.evalAide || !this.evalStatut) return;
    if (this.evalStatut === 'REJETEE' && !this.evalMotif.trim()) {
      this.evalError = 'Le motif de refus est obligatoire.';
      return;
    }
    this.isEvaluating = true;
    this.evalError = '';

    const payload: { statusAide: string; motifRefus?: string } = { statusAide: this.evalStatut };
    if (this.evalStatut === 'REJETEE') payload.motifRefus = this.evalMotif.trim();

    this.financierService.evaluateAide(this.evalAide.idaide, payload).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.isEvaluating = false;
          if (res.success) {
            this.fermerEvaluation();
            this.evalSuccessMessage = `Demande "${res.data.titre}" mise à jour : ${this.getStatusLabel(res.data.statusAide)}`;
            setTimeout(() => { this.evalSuccessMessage = ''; this.cdr.detectChanges(); }, 5000);
            this.loadAides();
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.isEvaluating = false;
          this.evalError = err.error?.message || 'Erreur lors de l\'évaluation.';
          this.cdr.detectChanges();
        });
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
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

  getStatusBarClass(status: string): string {
    const map: Record<string, string> = {
      ACTIVE:        'bg-green-500',
      EN_ATTENTE:    'bg-orange-400',
      EN_TRAITEMENT: 'bg-blue-500',
      VALIDEE:       'bg-teal-500',
      REJETEE:       'bg-red-500',
      CLOTUREE:      'bg-gray-400',
      BROUILLON:     'bg-gray-300',
    };
    return map[status] || 'bg-gray-300';
  }

  getCreePar(creePar: string): string {
    return creePar === 'ADMIN' ? 'Agent' : 'Candidat';
  }

  getCreeParClass(creePar: string): string {
    return creePar === 'ADMIN' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700';
  }

  // Indique si une aide peut être évaluée (seulement les demandes candidats non finalisées)
  peutEvaluer(aide: Aide): boolean {
    return aide.creePar === 'CANDIDAT' &&
      (aide.statusAide === 'EN_ATTENTE' || aide.statusAide === 'EN_TRAITEMENT');
  }

  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'SCOLAIRE':    'M12 14l9-5-9-5-9 5 9 5z',
      'MEDICAL':     'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
      'FUNERAILLES': 'M19 14l-7 7m0 0l-7-7m7 7V3',
      'MARIAGE':     'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
      'NAISSANCE':   'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      'LOGEMENT':    'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    };
    return icons[type] || 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  getInitials(nom?: string, prenom?: string): string {
    return ((prenom?.[0] || '') + (nom?.[0] || '')).toUpperCase() || '?';
  }
}
