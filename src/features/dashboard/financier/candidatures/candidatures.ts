// src/features/dashboard/financier/candidatures/candidatures.ts
// v2 : traitement des candidatures aux aides sociales (évaluation par le financier)
import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinancierService, Aide, CandidatureAide } from '../../../../core/services/financier.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-financier-candidatures',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './candidatures.html',
  styleUrl: './candidatures.css',
})
export class FinancierCandidatures implements OnInit {

  candidatures: CandidatureAide[] = [];
  filteredCandidatures: CandidatureAide[] = [];
  isLoading = false;
  errorMessage = '';
  searchQuery = '';
  filterStatus = '';

  currentPage = 1;
  pageSize = 12;

  // ── Modal détail ──────────────────────────────────────────────────────────
  showDetailModal = false;
  selectedCandidature: CandidatureAide | null = null;

  // ── Modal évaluation ──────────────────────────────────────────────────────
  showEvalModal = false;
  evalCandidature: CandidatureAide | null = null;
  evalStatut: 'EN_EXAMEN' | 'VALIDEE' | 'REJETEE' | '' = '';
  evalMotif = '';
  evalCommentaire = '';
  evalError = '';
  isEvaluating = false;
  evalSuccessMessage = '';

  constructor(
    private financierService: FinancierService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCandidatures();
  }

  loadCandidatures(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.financierService.getAllAides({}).subscribe({
      next: (res) => {
        if (!res.success || res.data.length === 0) {
          this.ngZone.run(() => { this.isLoading = false; this.cdr.detectChanges(); });
          return;
        }
        const aides = res.data;
        const calls = aides.map((a: Aide) => this.financierService.getCandidaturesByAide(a.idaide));
        forkJoin(calls).subscribe({
          next: (results: any[]) => {
            this.ngZone.run(() => {
              this.candidatures = results
                .filter((r: any) => r.success)
                .flatMap((r: any) => r.data)
                .sort((a: CandidatureAide, b: CandidatureAide) =>
                  new Date(b.dateCandidature).getTime() - new Date(a.dateCandidature).getTime()
                );
              this.applyFilters();
              this.isLoading = false;
              this.cdr.detectChanges();
            });
          },
          error: () => {
            this.ngZone.run(() => { this.isLoading = false; this.cdr.detectChanges(); });
          }
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.isLoading = false;
          this.errorMessage = err.error?.message || 'Erreur lors du chargement des candidatures';
          this.cdr.detectChanges();
        });
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
        (c.aide?.titre || '').toLowerCase().includes(q)
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

  // ── Pagination ─────────────────────────────────────────────────────────────
  get totalPages(): number { return Math.ceil(this.filteredCandidatures.length / this.pageSize); }
  get pagedCandidatures(): CandidatureAide[] {
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

  // ── Stats ─────────────────────────────────────────────────────────────────
  get totalCandidatures(): number { return this.candidatures.length; }
  get soumisesUrgent(): number { return this.candidatures.filter(c => c.statusCandidature === 'SOUMISE').length; }
  get enExamen(): number { return this.candidatures.filter(c => c.statusCandidature === 'EN_EXAMEN').length; }
  get validees(): number { return this.candidatures.filter(c => c.statusCandidature === 'VALIDEE').length; }
  get rejetees(): number { return this.candidatures.filter(c => c.statusCandidature === 'REJETEE').length; }

  // ── Modal détail ──────────────────────────────────────────────────────────
  ouvrirDetail(candidature: CandidatureAide): void {
    this.selectedCandidature = candidature;
    this.showDetailModal = true;
  }

  fermerDetail(): void {
    this.showDetailModal = false;
    this.selectedCandidature = null;
  }

  // ── Modal évaluation ──────────────────────────────────────────────────────
  ouvrirEvaluation(candidature: CandidatureAide, statut: 'EN_EXAMEN' | 'VALIDEE' | 'REJETEE'): void {
    this.evalCandidature = candidature;
    this.evalStatut = statut;
    this.evalMotif = '';
    this.evalCommentaire = '';
    this.evalError = '';
    this.showEvalModal = true;
    this.showDetailModal = false;
  }

  fermerEvaluation(): void {
    this.showEvalModal = false;
    this.evalCandidature = null;
    this.evalStatut = '';
    this.evalMotif = '';
    this.evalCommentaire = '';
    this.evalError = '';
  }

  confirmerEvaluation(): void {
    if (!this.evalCandidature || !this.evalStatut) return;
    if (this.evalStatut === 'REJETEE' && !this.evalMotif.trim()) {
      this.evalError = 'Le motif de refus est obligatoire.';
      return;
    }
    this.isEvaluating = true;
    this.evalError = '';

    const payload: { statusCandidature: string; motifRefus?: string; commentaireAgent?: string } = {
      statusCandidature: this.evalStatut
    };
    if (this.evalStatut === 'REJETEE') payload.motifRefus = this.evalMotif.trim();
    if (this.evalCommentaire.trim()) payload.commentaireAgent = this.evalCommentaire.trim();

    this.financierService.evaluateCandidature(this.evalCandidature.idcandidature, payload).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.isEvaluating = false;
          if (res.success) {
            const nom = this.evalCandidature?.candidat?.nom || '';
            const prenom = this.evalCandidature?.candidat?.prenom || '';
            this.fermerEvaluation();
            this.evalSuccessMessage = `Candidature de ${prenom} ${nom} mise à jour : ${this.getStatusLabel(res.data.statusCandidature)}`;
            setTimeout(() => { this.evalSuccessMessage = ''; this.cdr.detectChanges(); }, 5000);
            this.loadCandidatures();
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.isEvaluating = false;
          this.evalError = err.error?.message || "Erreur lors de l'évaluation.";
          this.cdr.detectChanges();
        });
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  peutEvaluer(c: CandidatureAide): boolean {
    return c.statusCandidature === 'SOUMISE' || c.statusCandidature === 'EN_EXAMEN';
  }

  getStatusLabel(s: string): string {
    const map: Record<string, string> = {
      SOUMISE: 'Soumise', EN_EXAMEN: 'En examen', VALIDEE: 'Validée', REJETEE: 'Rejetée'
    };
    return map[s] || s;
  }

  getStatusClass(s: string): string {
    const map: Record<string, string> = {
      SOUMISE:    'bg-orange-100 text-orange-700',
      EN_EXAMEN:  'bg-blue-100 text-blue-700',
      VALIDEE:    'bg-green-100 text-green-700',
      REJETEE:    'bg-red-100 text-red-700',
    };
    return map[s] || 'bg-gray-100 text-gray-600';
  }

  getStatusBarClass(s: string): string {
    const map: Record<string, string> = {
      SOUMISE:   'bg-orange-400',
      EN_EXAMEN: 'bg-blue-500',
      VALIDEE:   'bg-green-500',
      REJETEE:   'bg-red-500',
    };
    return map[s] || 'bg-gray-300';
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  getInitials(nom?: string, prenom?: string): string {
    return ((prenom?.[0] || '') + (nom?.[0] || '')).toUpperCase() || '?';
  }
}
