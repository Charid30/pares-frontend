// offres-list.ts — Gestion des offres commerciales (côté ADMIN / AGENT_COMMERCIAL)
// Routes backend :
//   GET  /api/offres               → { success, data: OffreCandidat[] }  (pas de pagination)
//   PUT  /api/offres/:id/evaluer   → évaluer (body: { statusOffre, motifRefus })
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ChangeDetectorRef, OnInit, OnDestroy, NgZone } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { Loader } from '../../../../shared/components/loader/loader';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';
import { SearchService } from '../../../../core/services/search.service';

// Offre soumise par un candidat
interface OffreCandidat {
  idoffres: number;
  typeOffre: string;
  titre: string;
  description: string | null;
  cnib_filename: string | null;
  demandeOffre_filename: string | null;
  statusOffre: 'BROUILLON' | 'EN_ATTENTE' | 'EN_TRAITEMENT' | 'VALIDEE' | 'REJETEE' | 'ACTIVE' | 'CLOTUREE';
  motifRefus: string | null;
  createdDate: string;
  lastModifiedDate: string;
  candidatCreateur?: {
    idcandidats: number;
    nom: string;
    prenom: string;
    email: string;
    telephone?: string;
    ifu?: string;
  };
}

@Component({
  selector: 'app-offres-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DatePipe, Loader, StatCard],
  templateUrl: './offres-list.html',
  styleUrl: './offres-list.css',
})
export class OffresList implements OnInit, OnDestroy {

  private searchSub?: Subscription;

  // ── Données ────────────────────────────────────────────────────────────────
  offres: OffreCandidat[] = [];          // toutes les offres chargées
  offresFiltrees: OffreCandidat[] = []; // après filtres locaux
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  // ── Filtres ───────────────────────────────────────────────────────────────
  searchTerm = '';
  filtreStatut = '';
  filtreType = '';

  // ── Compteurs (calculés depuis offres[]) ──────────────────────────────────
  countEnAttente = 0;
  countEnTraitement = 0;
  countValidee = 0;
  countRejetee = 0;

  // ── Modal traitement ──────────────────────────────────────────────────────
  showTraitementModal = false;
  selectedOffre: OffreCandidat | null = null;
  isSubmitting = false;
  errorEval = '';
  evaluation = {
    statusOffre: '' as string,
    motifRefus: '',
  };

  // ── Modal détail (lecture seule) ──────────────────────────────────────────
  showDetailModal = false;
  detailOffre: OffreCandidat | null = null;

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private route: ActivatedRoute,
    private searchService: SearchService,
  ) {}

  ngOnInit(): void {
    this.loadOffres();
    // Recherche globale (barre du haut)
    this.searchSub = this.searchService.term$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
    ).subscribe(term => {
      this.searchTerm = term;
      this.appliquerFiltres();
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  private openFromQueryParam(): void {
    const openId = this.route.snapshot.queryParamMap.get('open');
    if (!openId) return;
    const offre = this.offres.find(o => o.idoffres === +openId);
    if (offre) {
      this.selectedOffre = offre;
      this.showDetailModal = true;
      this.cdr.detectChanges();
    }
  }

  // ─── Chargement ───────────────────────────────────────────────────────────
  // GET /api/offres → { success: true, data: [...] }  (sans pagination)
  loadOffres(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.http.get<any>(`${this.apiUrl}/offres`).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success && Array.isArray(res.data)) {
            this.offres = res.data;
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
          this.errorMessage = err.error?.message || 'Erreur lors du chargement';
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  // ─── Compteurs (calculés localement depuis offres[]) ──────────────────────
  calculerCompteurs(): void {
    this.countEnAttente    = this.offres.filter(o => o.statusOffre === 'EN_ATTENTE').length;
    this.countEnTraitement = this.offres.filter(o => o.statusOffre === 'EN_TRAITEMENT').length;
    this.countValidee      = this.offres.filter(o => o.statusOffre === 'VALIDEE').length;
    this.countRejetee      = this.offres.filter(o => o.statusOffre === 'REJETEE').length;
  }

  // ─── Filtres locaux ───────────────────────────────────────────────────────
  appliquerFiltres(): void {
    this.offresFiltrees = this.offres.filter(o => {
      const nom = this.getNomCandidat(o).toLowerCase();
      const matchSearch = !this.searchTerm ||
        o.titre.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        o.typeOffre.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        nom.includes(this.searchTerm.toLowerCase());
      const matchStatut = !this.filtreStatut || o.statusOffre === this.filtreStatut;
      const matchType   = !this.filtreType   || o.typeOffre === this.filtreType;
      return matchSearch && matchStatut && matchType;
    });
  }

  effacerFiltres(): void {
    this.searchTerm   = '';
    this.filtreStatut = '';
    this.filtreType   = '';
    this.offresFiltrees = [...this.offres];
  }

  // ─── Modal traitement ─────────────────────────────────────────────────────
  ouvrirTraitement(offre: OffreCandidat, event?: Event): void {
    event?.stopPropagation();
    this.selectedOffre = offre;
    this.evaluation = { statusOffre: '', motifRefus: '' };
    this.errorEval = '';
    this.showTraitementModal = true;
  }

  fermerTraitement(): void {
    this.showTraitementModal = false;
    this.selectedOffre = null;
    this.errorEval = '';
  }

  enregistrerDecision(): void {
    if (!this.evaluation.statusOffre) {
      this.errorEval = 'Veuillez choisir une décision.';
      return;
    }
    if (this.evaluation.statusOffre === 'REJETEE' && !this.evaluation.motifRefus.trim()) {
      this.errorEval = 'Le motif de refus est obligatoire en cas de rejet.';
      return;
    }
    if (!this.selectedOffre) return;

    this.isSubmitting = true;
    this.errorEval = '';

    const body: any = { statusOffre: this.evaluation.statusOffre };
    if (this.evaluation.motifRefus.trim()) {
      body.motifRefus = this.evaluation.motifRefus.trim();
    }

    this.http.put<any>(
      `${this.apiUrl}/offres/${this.selectedOffre.idoffres}/evaluer`, body
    ).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.fermerTraitement();
            this.loadOffres();
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
      }
    });
  }

  // ─── Actions rapides ──────────────────────────────────────────────────────
  validerRapide(offre: OffreCandidat, event: Event): void {
    event.stopPropagation();
    if (!this.peutEvaluer(offre)) return;
    this.selectedOffre = offre;
    this.evaluation = { statusOffre: 'VALIDEE', motifRefus: '' };
    this.showTraitementModal = true;
    this.errorEval = '';
  }

  rejeterRapide(offre: OffreCandidat, event: Event): void {
    event.stopPropagation();
    if (!this.peutEvaluer(offre)) return;
    this.selectedOffre = offre;
    this.evaluation = { statusOffre: 'REJETEE', motifRefus: '' };
    this.showTraitementModal = true;
    this.errorEval = '';
  }

  // ─── Modal détail (lecture seule) ─────────────────────────────────────────
  voirDetail(offre: OffreCandidat, event?: Event): void {
    event?.stopPropagation();
    this.detailOffre = offre;
    this.showDetailModal = true;
  }

  fermerDetail(): void {
    this.showDetailModal = false;
    this.detailOffre = null;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  peutEvaluer(offre: OffreCandidat): boolean {
    return offre.statusOffre === 'EN_ATTENTE' || offre.statusOffre === 'EN_TRAITEMENT';
  }

  getNomCandidat(offre: OffreCandidat): string {
    if (offre.candidatCreateur) {
      return `${offre.candidatCreateur.prenom} ${offre.candidatCreateur.nom}`.trim();
    }
    return 'Candidat inconnu';
  }

  getInitiales(offre: OffreCandidat): string {
    if (offre.candidatCreateur) {
      return `${offre.candidatCreateur.prenom?.[0] || ''}${offre.candidatCreateur.nom?.[0] || ''}`.toUpperCase();
    }
    return '?';
  }

  // ─── Visualisation / téléchargement de fichiers ───────────────────────────
  // HttpClient est utilisé pour que l'intercepteur ajoute le token JWT automatiquement.
  // On crée une Blob URL temporaire côté client pour ouvrir ou télécharger le PDF.
  ouvrirFichier(
    id: number,
    type: 'cnib' | 'demandeOffre',
    filename: string,
    mode: 'view' | 'download'
  ): void {
    this.http.get(`${this.apiUrl}/offres/${id}/fichier/${type}`, {
      responseType: 'blob',
    }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        if (mode === 'view') {
          window.open(url, '_blank');
          // Libérer l'URL après ouverture
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

  getCountByStatut(statut: string): number {
    switch (statut) {
      case 'EN_ATTENTE':    return this.countEnAttente;
      case 'EN_TRAITEMENT': return this.countEnTraitement;
      case 'VALIDEE':       return this.countValidee;
      case 'REJETEE':       return this.countRejetee;
      default: return 0;
    }
  }

  // ─── Helpers statut ───────────────────────────────────────────────────────
  getStatutClass(statut: string): string {
    const classes: Record<string, string> = {
      'EN_ATTENTE':    'bg-blue-100 text-blue-700',
      'EN_TRAITEMENT': 'bg-amber-100 text-amber-700',
      'VALIDEE':       'bg-green-100 text-green-700',
      'REJETEE':       'bg-red-100 text-red-700',
      'CLOTUREE':      'bg-gray-100 text-gray-600',
      'BROUILLON':     'bg-gray-100 text-gray-500',
      'ACTIVE':        'bg-emerald-100 text-emerald-700',
    };
    return classes[statut] || 'bg-gray-100 text-gray-600';
  }

  getStatutBarClass(statut: string): string {
    const classes: Record<string, string> = {
      'EN_ATTENTE':    'bg-blue-500',
      'EN_TRAITEMENT': 'bg-amber-400',
      'VALIDEE':       'bg-green-500',
      'REJETEE':       'bg-red-500',
      'CLOTUREE':      'bg-gray-400',
      'BROUILLON':     'bg-gray-300',
      'ACTIVE':        'bg-emerald-500',
    };
    return classes[statut] || 'bg-gray-400';
  }

  getStatutLabel(statut: string): string {
    const labels: Record<string, string> = {
      'EN_ATTENTE':    'En attente',
      'EN_TRAITEMENT': 'En traitement',
      'VALIDEE':       'Validée',
      'REJETEE':       'Rejetée',
      'CLOTUREE':      'Clôturée',
      'BROUILLON':     'Brouillon',
      'ACTIVE':        'Active',
    };
    return labels[statut] || statut;
  }

  getStatutBarClassModal(statut: string): string {
    return this.getStatutBarClass(statut);
  }

  getTypeClass(type: string): string {
    const classes: Record<string, string> = {
      'VENTE':        'bg-blue-100 text-blue-700',
      'PARTENARIAT':  'bg-purple-100 text-purple-700',
      'DISTRIBUTION': 'bg-green-100 text-green-700',
      'SERVICE':      'bg-orange-100 text-orange-700',
      'AUTRE':        'bg-gray-100 text-gray-700',
    };
    return classes[type] || 'bg-gray-100 text-gray-700';
  }

  // ─── Exports ──────────────────────────────────────────────────────────────
  exporterCSV(): void {
    this.http.get(`${this.apiUrl}/offres/export`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `offres_${new Date().toISOString().slice(0, 10)}.csv`;
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
    this.http.get(`${this.apiUrl}/offres/export/pdf`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapport_offres_${new Date().toISOString().slice(0, 10)}.pdf`;
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
