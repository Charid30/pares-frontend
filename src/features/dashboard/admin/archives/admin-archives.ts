// admin-archives.ts — Stages archivés (EXPIRE + sans parent)
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { SearchService } from '../../../../core/services/search.service';

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
  /** Chaîne stage + renouvellements (durée totale, fin du dernier renouvellement) */
  chaine?: { dureeTotaleMois: number; nbRenouvellements: number; finProlongation: string | null; prolonge: boolean };
  candidat?: Candidat;
  direction?: Direction;
}

@Component({
  selector: 'app-admin-archives',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-archives.html',
})
export class AdminArchives implements OnInit, OnDestroy {

  private readonly apiUrl = environment.apiUrl;

  stages: StageArchive[] = [];
  stagesFiltres: StageArchive[] = [];
  isLoading = false;
  erreur = '';
  successMessage = '';
  search = '';
  filtreType = '';
  filtreDomaine = '';
  filtreDirection: number | null = null;
  directions: Direction[] = [];

  // Panneau de filtres (icône entonnoir)
  showFiltres = false;
  private searchSub?: Subscription;

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
    private searchService: SearchService,
  ) {}

  ngOnInit(): void {
    this.charger();
    this.http.get<{ success: boolean; data: Direction[] }>(`${this.apiUrl}/stages/directions`).subscribe({
      next: (res) => { this.directions = res.data ?? []; this.cdr.detectChanges(); },
      error: () => { this.directions = []; },
    });
    // La recherche se fait via la barre globale du haut (comme la page Stages)
    this.searchSub = this.searchService.term$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
    ).subscribe(term => {
      if (term === this.search) return;
      this.search = term;
      this.onFiltreChange();
    });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  /** Nombre de filtres actifs (badge sur l'icône entonnoir) */
  get nbFiltresActifs(): number {
    return [this.filtreType, this.filtreDirection, this.filtreDomaine.trim()].filter(Boolean).length;
  }

  /** Durée totale = stage initial + renouvellements effectués (le renouvellement prolonge le stage) */
  dureeTotale(s: StageArchive): string {
    const total = s.chaine?.dureeTotaleMois ?? s.dureeStage;
    if (!total) return '—';
    const nb = s.chaine?.nbRenouvellements ?? 0;
    return nb > 0
      ? `${total} mois au total (dont ${nb} renouvellement${nb > 1 ? 's' : ''})`
      : `${total} mois`;
  }

  getTypeLabel(type?: string): string {
    if (type === 'SOUTENANCE') return 'Soutenance';
    if (type === 'PERFECTIONNEMENT') return 'Perfectionnement';
    return type || '—';
  }

  getDirectionNom(id: number | null): string {
    return this.directions.find(d => d.iddirection === id)?.nom || '';
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
    if (this.filtreDomaine.trim()) params['domaineStage'] = this.filtreDomaine.trim();
    if (this.filtreDirection) params['directionId']  = String(this.filtreDirection);

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

  /** Réinitialise les filtres du panneau (la recherche reste pilotée par la barre du haut) */
  effacerFiltres(): void {
    this.filtreType = '';
    this.filtreDomaine = '';
    this.filtreDirection = null;
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
