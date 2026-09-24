// admin-archives.ts — Stages archivés (EXPIRE + sans parent)
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface Candidat {
  idcandidats: number;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
}

interface Direction {
  iddirection: number;
  nom: string;
  accronyme: string;
}

interface StageArchive {
  idstage: number;
  statusStage: string;
  typeStage?: string;
  domaineStage?: string;
  dateDebutEffective?: string;
  dateFinEffective?: string;
  dureeStage?: number;
  candidat?: Candidat;
  direction?: Direction;
}

@Component({
  selector: 'app-admin-archives',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-archives.html',
})
export class AdminArchives implements OnInit {

  private readonly apiUrl = environment.apiUrl;

  stages: StageArchive[] = [];
  stagesFiltres: StageArchive[] = [];
  isLoading = false;
  erreur = '';
  successMessage = '';
  search = '';
  filtreType = '';
  filtreDomaine = '';

  total = 0;
  page = 1;
  totalPages = 1;
  readonly limit = 20;

  // Modal détail
  showModal = false;
  selected: StageArchive | null = null;

  // Modal confirmation suppression définitive
  showConfirmSuppression = false;
  suppressionEnCours = false;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.isLoading = true;
    this.erreur = '';
    const params: Record<string, string> = {
      page: String(this.page),
      limit: String(this.limit),
    };
    if (this.search.trim())   params['search']       = this.search.trim();
    if (this.filtreType)      params['typeStage']    = this.filtreType;
    if (this.filtreDomaine)   params['domaineStage'] = this.filtreDomaine;

    this.http.get<{ success: boolean; data: { items: StageArchive[]; total: number; totalPages: number } }>(
      `${this.apiUrl}/stages/archives`, { params }
    ).subscribe({
      next: (res) => {
        this.stages        = res.data?.items ?? [];
        this.total         = res.data?.total ?? 0;
        this.totalPages    = res.data?.totalPages ?? 1;
        this.stagesFiltres = this.stages;
        this.isLoading     = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.erreur    = 'Impossible de charger les archives.';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  onFiltreChange(): void {
    this.page = 1;
    this.charger();
  }

  effacerFiltres(): void {
    this.search = '';
    this.filtreType = '';
    this.filtreDomaine = '';
    this.page = 1;
    this.charger();
  }

  changerPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.page = p;
    this.charger();
  }

  voirDetail(s: StageArchive): void {
    this.selected = s;
    this.showModal = true;
    this.erreur = '';
    this.successMessage = '';
  }

  fermerModal(): void {
    this.showModal = false;
    this.selected = null;
    this.showConfirmSuppression = false;
  }

  // ── Suppression définitive ──────────────────────────────────────────────────

  ouvrirConfirmSuppression(): void {
    this.showConfirmSuppression = true;
  }

  annulerSuppression(): void {
    this.showConfirmSuppression = false;
  }

  confirmerSuppression(): void {
    if (!this.selected) return;
    this.suppressionEnCours = true;
    this.http.delete<{ success: boolean }>(
      `${this.apiUrl}/stages/${this.selected.idstage}/permanent`
    ).subscribe({
      next: () => {
        this.suppressionEnCours   = false;
        this.showConfirmSuppression = false;
        this.showModal            = false;
        this.successMessage       = 'Stage supprimé définitivement.';
        this.selected             = null;
        this.charger();
        setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
      },
      error: (err) => {
        this.suppressionEnCours = false;
        this.erreur = err.error?.message || 'Une erreur est survenue lors de la suppression.';
        this.cdr.detectChanges();
      },
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  getInitiales(s: StageArchive): string {
    const c = s.candidat;
    if (!c) return '?';
    return ((c.prenom?.[0] || '') + (c.nom?.[0] || '')).toUpperCase();
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR');
  }
}
