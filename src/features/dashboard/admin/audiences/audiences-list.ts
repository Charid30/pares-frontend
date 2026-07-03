// audiences-list.ts — Admin : Gestion des demandes d'audience
// Routes backend :
//   GET  /api/demandes-audience               → { success, data, pagination }
//   PUT  /api/demandes-audience/:id/statut    → { status, commentaireAdmin }
//   GET  /api/demandes-audience/:id/fichier   → Blob PDF (mode FICHIER)
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ChangeDetectorRef, OnInit, OnDestroy, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { SearchService } from '../../../../core/services/search.service';
import { Loader } from '../../../../shared/components/loader/loader';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';

interface CandidatInfo {
  idcandidats: number;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
}

interface DirectionInfo {
  iddirection: number;
  nom: string;
  accronyme: string;
}

interface DemandeAudience {
  iddemande: number;
  candidats_idcandidats: number;
  modeSoumission: 'FICHIER' | 'FORMULAIRE';
  // Mode FICHIER
  fichier_filename?: string;
  fichier_size?: number;
  // Mode FORMULAIRE
  pourM?: string;
  pendant?: 'ABSENCE' | 'PRESENCE';
  contact?: string;
  actionCochee?: 'A_TELEPHONER' | 'EST_PASSE' | 'RAPPELLERA' | 'DEMANDE_RAPPEL' | 'VEUT_VOIR' | 'URGENT';
  motif?: string;
  // Commun
  dateAudience: string;
  heureAudience: string;
  status: 'EN_ATTENTE' | 'ACCEPTE' | 'REJETE' | 'ANNULE';
  commentaireAdmin?: string;
  createdDate: string;
  lastModifiedDate: string;
  candidat?: CandidatInfo;
  // Affectation administrative
  direction_iddirection?: number | null;
  direction?: DirectionInfo;
}

@Component({
  selector: 'app-audiences-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, Loader, StatCard],
  templateUrl: './audiences-list.html',
})
export class AudiencesList implements OnInit, OnDestroy {

  // ── Données ────────────────────────────────────────────────────────────────
  demandes: DemandeAudience[] = [];
  demandesFiltrees: DemandeAudience[] = [];
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  // ── Filtres ───────────────────────────────────────────────────────────────
  searchTerm = '';
  filtreStatut = '';
  filtreMode = '';
  filtreDateDebut = '';
  filtreDateFin = '';

  // ── Compteurs ─────────────────────────────────────────────────────────────
  countEnAttente = 0;
  countAccepte = 0;
  countRejete = 0;
  countAnnule = 0;

  // ── Pagination ────────────────────────────────────────────────────────────
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;
  totalPages = 1;

  // ── Modal traitement ──────────────────────────────────────────────────────
  showTraitementModal = false;
  selectedDemande: DemandeAudience | null = null;
  isSubmitting = false;
  errorEval = '';
  traitement = {
    status: '' as string,
    commentaireAdmin: '',
  };

  // ── Modal détail ──────────────────────────────────────────────────────────
  showDetailModal = false;
  detailDemande: DemandeAudience | null = null;

  // ── Affectation direction (admin) ─────────────────────────────────────────
  directions: DirectionInfo[] = [];
  affectationForm = { direction_iddirection: null as number | null };
  savingAffectation = false;

  private apiUrl = environment.apiUrl;

  private searchSub?: Subscription;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private searchService: SearchService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.loadDemandes();
    this.loadDirections();
    this.searchSub = this.searchService.term$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
    ).subscribe(term => {
      this.searchTerm = term;
      this.appliquerFiltres();
    });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  private openFromQueryParam(): void {
    const openId = this.route.snapshot.queryParamMap.get('open');
    if (!openId) return;
    const demande = this.demandes.find(d => d.iddemande === +openId);
    if (demande) {
      this.selectedDemande = demande;
      this.showDetailModal = true;
      this.cdr.detectChanges();
    }
  }

  // ─── Chargement ───────────────────────────────────────────────────────────
  loadDemandes(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.http.get<any>(`${this.apiUrl}/demandes-audience`).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success && Array.isArray(res.data)) {
            this.demandes = res.data;
            this.calculerCompteurs();
            this.appliquerFiltres();
            this.openFromQueryParam();
          }
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.errorMessage = err.error?.message || 'Erreur lors du chargement des demandes.';
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  // ─── Compteurs ────────────────────────────────────────────────────────────
  calculerCompteurs(): void {
    this.countEnAttente = this.demandes.filter(d => d.status === 'EN_ATTENTE').length;
    this.countAccepte   = this.demandes.filter(d => d.status === 'ACCEPTE').length;
    this.countRejete    = this.demandes.filter(d => d.status === 'REJETE').length;
    this.countAnnule    = this.demandes.filter(d => d.status === 'ANNULE').length;
  }

  // ─── Filtres locaux ───────────────────────────────────────────────────────
  appliquerFiltres(): void {
    const debut = this.filtreDateDebut ? new Date(this.filtreDateDebut) : null;
    const fin   = this.filtreDateFin   ? new Date(this.filtreDateFin + 'T23:59:59') : null;

    this.demandesFiltrees = this.demandes.filter(d => {
      const nom = this.getNomCandidat(d).toLowerCase();
      const matchSearch = !this.searchTerm ||
        nom.includes(this.searchTerm.toLowerCase()) ||
        (d.pourM && d.pourM.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        (d.motif && d.motif.toLowerCase().includes(this.searchTerm.toLowerCase()));
      const matchStatut = !this.filtreStatut || d.status === this.filtreStatut;
      const matchMode   = !this.filtreMode   || d.modeSoumission === this.filtreMode;

      let matchDate = true;
      if (debut || fin) {
        const dateAudience = d.dateAudience ? new Date(d.dateAudience) : null;
        if (dateAudience) {
          if (debut && dateAudience < debut) matchDate = false;
          if (fin   && dateAudience > fin)   matchDate = false;
        } else {
          matchDate = false;
        }
      }

      return matchSearch && matchStatut && matchMode && matchDate;
    });
  }

  effacerFiltres(): void {
    this.searchTerm      = '';
    this.filtreStatut    = '';
    this.filtreMode      = '';
    this.filtreDateDebut = '';
    this.filtreDateFin   = '';
    this.demandesFiltrees = [...this.demandes];
  }

  // ─── Modal traitement ─────────────────────────────────────────────────────
  ouvrirTraitement(demande: DemandeAudience, event?: Event): void {
    event?.stopPropagation();
    this.selectedDemande = demande;
    this.traitement = { status: '', commentaireAdmin: '' };
    this.errorEval = '';
    this.showTraitementModal = true;
  }

  fermerTraitement(): void {
    this.showTraitementModal = false;
    this.selectedDemande = null;
    this.errorEval = '';
  }

  enregistrerDecision(): void {
    if (!this.traitement.status) {
      this.errorEval = 'Veuillez choisir une décision.';
      return;
    }
    if (this.traitement.status === 'REJETE' && !this.traitement.commentaireAdmin.trim()) {
      this.errorEval = 'Un commentaire est obligatoire en cas de rejet.';
      return;
    }
    if (!this.selectedDemande) return;

    this.isSubmitting = true;
    this.errorEval = '';

    const body: any = { status: this.traitement.status };
    if (this.traitement.commentaireAdmin.trim()) {
      body.commentaireAdmin = this.traitement.commentaireAdmin.trim();
    }

    this.http.put<any>(
      `${this.apiUrl}/demandes-audience/${this.selectedDemande.iddemande}/statut`, body
    ).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.fermerTraitement();
            this.loadDemandes();
            this.successMessage = 'Décision enregistrée avec succès !';
            setTimeout(() => this.successMessage = '', 4000);
          }
          this.isSubmitting = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.errorEval = err.error?.message || 'Erreur lors de l\'enregistrement.';
          this.isSubmitting = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  // ─── Actions rapides ──────────────────────────────────────────────────────
  accepterRapide(demande: DemandeAudience, event: Event): void {
    event.stopPropagation();
    if (!this.peutTraiter(demande)) return;
    this.selectedDemande = demande;
    this.traitement = { status: 'ACCEPTE', commentaireAdmin: '' };
    this.errorEval = '';
    this.showTraitementModal = true;
  }

  rejeterRapide(demande: DemandeAudience, event: Event): void {
    event.stopPropagation();
    if (!this.peutTraiter(demande)) return;
    this.selectedDemande = demande;
    this.traitement = { status: 'REJETE', commentaireAdmin: '' };
    this.errorEval = '';
    this.showTraitementModal = true;
  }

  // ─── Modal détail ─────────────────────────────────────────────────────────
  voirDetail(demande: DemandeAudience, event?: Event): void {
    event?.stopPropagation();
    this.detailDemande = demande;
    this.initAffectationForm();
    this.showDetailModal = true;
  }

  fermerDetail(): void {
    this.showDetailModal = false;
    this.detailDemande = null;
  }

  // ─── Affectation direction ────────────────────────────────────────────────
  loadDirections(): void {
    this.http.get<any>(`${this.apiUrl}/stages/directions`).subscribe({
      next: (res) => {
        if (res.success) {
          this.directions = res.data;
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Erreur chargement directions:', err),
    });
  }

  initAffectationForm(): void {
    const dirId = this.detailDemande?.direction_iddirection ?? null;
    this.affectationForm = { direction_iddirection: dirId ? +dirId : null };
  }

  getDirectionLabel(dirId: any): string {
    const dir = this.directions.find(d => d.iddirection === +dirId);
    return dir ? `${dir.accronyme} — ${dir.nom}` : '—';
  }

  sauvegarderAffectation(): void {
    if (!this.detailDemande) return;
    this.savingAffectation = true;
    this.http.put<any>(
      `${this.apiUrl}/demandes-audience/${this.detailDemande.iddemande}`,
      { direction_iddirection: this.affectationForm.direction_iddirection }
    ).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.detailDemande!.direction_iddirection = this.affectationForm.direction_iddirection;
            const dir = this.directions.find(d => d.iddirection === this.affectationForm.direction_iddirection);
            if (dir) this.detailDemande!.direction = dir;
            this.successMessage = 'Direction affectée avec succès !';
            setTimeout(() => this.successMessage = '', 4000);
            this.loadDemandes();
          }
          this.savingAffectation = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.errorMessage = err.error?.message || 'Impossible de mettre à jour l\'affectation.';
          setTimeout(() => this.errorMessage = '', 4000);
          this.savingAffectation = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  // ─── Téléchargement fichier (mode FICHIER) ────────────────────────────────
  ouvrirFichier(id: number, filename: string, mode: 'view' | 'download'): void {
    this.http.get(`${this.apiUrl}/demandes-audience/${id}/fichier`, {
      responseType: 'blob',
    }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        if (mode === 'view') {
          window.open(url, '_blank');
          setTimeout(() => URL.revokeObjectURL(url), 10000);
        } else {
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        }
      },
      error: () => {
        this.ngZone.run(() => {
          this.errorMessage = 'Impossible de récupérer le fichier.';
          setTimeout(() => this.errorMessage = '', 4000);
          this.cdr.detectChanges();
        });
      },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  peutTraiter(demande: DemandeAudience): boolean {
    return demande.status === 'EN_ATTENTE';
  }

  getNomCandidat(demande: DemandeAudience): string {
    if (demande.candidat) {
      return `${demande.candidat.prenom} ${demande.candidat.nom}`.trim();
    }
    return 'Candidat inconnu';
  }

  getInitiales(demande: DemandeAudience): string {
    if (demande.candidat) {
      return `${demande.candidat.prenom?.[0] || ''}${demande.candidat.nom?.[0] || ''}`.toUpperCase();
    }
    return '?';
  }

  getActionLabel(action?: string): string {
    const labels: Record<string, string> = {
      A_TELEPHONER:   'À téléphoner',
      EST_PASSE:      'Est passé(e)',
      RAPPELLERA:     'Rappellera',
      DEMANDE_RAPPEL: 'Demande un rappel',
      VEUT_VOIR:      'Veut vous voir',
      URGENT:         'Urgent',
    };
    return action ? (labels[action] || action) : '—';
  }

  getCountByStatut(statut: string): number {
    switch (statut) {
      case 'EN_ATTENTE': return this.countEnAttente;
      case 'ACCEPTE':    return this.countAccepte;
      case 'REJETE':     return this.countRejete;
      case 'ANNULE':     return this.countAnnule;
      default: return 0;
    }
  }

  getStatutClass(status: string): string {
    const classes: Record<string, string> = {
      EN_ATTENTE: 'bg-blue-100 text-blue-700',
      ACCEPTE:    'bg-emerald-100 text-emerald-700',
      REJETE:     'bg-red-100 text-red-700',
      ANNULE:     'bg-gray-100 text-gray-600',
    };
    return classes[status] || 'bg-gray-100 text-gray-600';
  }

  getStatutBarClass(status: string): string {
    const classes: Record<string, string> = {
      EN_ATTENTE: 'bg-blue-500',
      ACCEPTE:    'bg-emerald-500',
      REJETE:     'bg-red-500',
      ANNULE:     'bg-gray-400',
    };
    return classes[status] || 'bg-gray-400';
  }

  getStatutLabel(status: string): string {
    const labels: Record<string, string> = {
      EN_ATTENTE: 'En attente',
      ACCEPTE:    'Acceptée',
      REJETE:     'Rejetée',
      ANNULE:     'Annulée',
    };
    return labels[status] || status;
  }

  // ─── Exports ──────────────────────────────────────────────────────────────
  exporterCSV(): void {
    this.http.get(`${this.apiUrl}/demandes-audience/export`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audiences_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.ngZone.run(() => {
          this.errorMessage = 'Erreur lors de l\'export CSV.';
          setTimeout(() => this.errorMessage = '', 4000);
          this.cdr.detectChanges();
        });
      },
    });
  }

  exporterPDF(): void {
    this.http.get(`${this.apiUrl}/demandes-audience/export/pdf`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapport_audiences_${new Date().toISOString().slice(0, 10)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.ngZone.run(() => {
          this.errorMessage = 'Erreur lors de la génération du rapport PDF.';
          setTimeout(() => this.errorMessage = '', 4000);
          this.cdr.detectChanges();
        });
      },
    });
  }
}
