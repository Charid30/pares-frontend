// aides-list.ts — Gestion des aides sociales (côté ADMIN / AGENT_FINANCIER)
// Routes backend :
//   GET  /api/aides               → { success, data: AideCandidat[] }  (pas de pagination)
//   PUT  /api/aides/:id/evaluer   → évaluer (body: { statusAide, motifRefus })
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ChangeDetectorRef, OnInit, NgZone } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { Loader } from '../../../../shared/components/loader/loader';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';

// Aide soumise par un candidat
interface AideCandidat {
  idaide: number;
  typeAide: string;
  titre: string;
  description: string | null;
  cnib_filename: string | null;
  demandeAide_filename: string | null;
  statusAide: 'BROUILLON' | 'EN_ATTENTE' | 'EN_TRAITEMENT' | 'VALIDEE' | 'REJETEE' | 'ACTIVE' | 'CLOTUREE';
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
  selector: 'app-aides-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DatePipe, Loader, StatCard],
  templateUrl: './aides-list.html',
  styleUrl: './aides-list.css',
})
export class AidesList implements OnInit {

  // ── Données ────────────────────────────────────────────────────────────────
  aides: AideCandidat[] = [];          // toutes les aides chargées
  aidesFiltrees: AideCandidat[] = []; // après filtres locaux
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  // ── Filtres ───────────────────────────────────────────────────────────────
  searchTerm = '';
  filtreStatut = '';
  filtreType = '';

  // ── Compteurs (calculés depuis aides[]) ───────────────────────────────────
  countEnAttente = 0;
  countEnTraitement = 0;
  countValidee = 0;
  countRejetee = 0;

  // ── Modal traitement ──────────────────────────────────────────────────────
  showTraitementModal = false;
  selectedAide: AideCandidat | null = null;
  isSubmitting = false;
  errorEval = '';
  evaluation = {
    statusAide: '' as string,
    motifRefus: '',
  };

  // ── Modal détail (lecture seule) ──────────────────────────────────────────
  showDetailModal = false;
  detailAide: AideCandidat | null = null;

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.loadAides();
  }

  private openFromQueryParam(): void {
    const openId = this.route.snapshot.queryParamMap.get('open');
    if (!openId) return;
    const aide = this.aides.find(a => a.idaide === +openId);
    if (aide) {
      this.selectedAide = aide;
      this.showDetailModal = true;
      this.cdr.detectChanges();
    }
  }

  // ─── Chargement ───────────────────────────────────────────────────────────
  // GET /api/aides → { success: true, data: [...] }  (sans pagination)
  loadAides(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.http.get<any>(`${this.apiUrl}/aides`).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success && Array.isArray(res.data)) {
            this.aides = res.data;
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

  // ─── Compteurs (calculés localement depuis aides[]) ───────────────────────
  calculerCompteurs(): void {
    this.countEnAttente    = this.aides.filter(a => a.statusAide === 'EN_ATTENTE').length;
    this.countEnTraitement = this.aides.filter(a => a.statusAide === 'EN_TRAITEMENT').length;
    this.countValidee      = this.aides.filter(a => a.statusAide === 'VALIDEE').length;
    this.countRejetee      = this.aides.filter(a => a.statusAide === 'REJETEE').length;
  }

  // ─── Filtres locaux ───────────────────────────────────────────────────────
  appliquerFiltres(): void {
    this.aidesFiltrees = this.aides.filter(a => {
      const nom = this.getNomCandidat(a).toLowerCase();
      const matchSearch = !this.searchTerm ||
        a.titre.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        a.typeAide.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        nom.includes(this.searchTerm.toLowerCase());
      const matchStatut = !this.filtreStatut || a.statusAide === this.filtreStatut;
      const matchType   = !this.filtreType   || a.typeAide === this.filtreType;
      return matchSearch && matchStatut && matchType;
    });
  }

  effacerFiltres(): void {
    this.searchTerm   = '';
    this.filtreStatut = '';
    this.filtreType   = '';
    this.aidesFiltrees = [...this.aides];
  }

  // ─── Modal traitement ─────────────────────────────────────────────────────
  ouvrirTraitement(aide: AideCandidat, event?: Event): void {
    event?.stopPropagation();
    this.selectedAide = aide;
    this.evaluation = { statusAide: '', motifRefus: '' };
    this.errorEval = '';
    this.showTraitementModal = true;
  }

  fermerTraitement(): void {
    this.showTraitementModal = false;
    this.selectedAide = null;
    this.errorEval = '';
  }

  enregistrerDecision(): void {
    if (!this.evaluation.statusAide) {
      this.errorEval = 'Veuillez choisir une décision.';
      return;
    }
    if (this.evaluation.statusAide === 'REJETEE' && !this.evaluation.motifRefus.trim()) {
      this.errorEval = 'Le motif de refus est obligatoire en cas de rejet.';
      return;
    }
    if (!this.selectedAide) return;

    this.isSubmitting = true;
    this.errorEval = '';

    const body: any = { statusAide: this.evaluation.statusAide };
    if (this.evaluation.motifRefus.trim()) {
      body.motifRefus = this.evaluation.motifRefus.trim();
    }

    this.http.put<any>(
      `${this.apiUrl}/aides/${this.selectedAide.idaide}/evaluer`, body
    ).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.fermerTraitement();
            this.loadAides();
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
  validerRapide(aide: AideCandidat, event: Event): void {
    event.stopPropagation();
    if (!this.peutEvaluer(aide)) return;
    this.selectedAide = aide;
    this.evaluation = { statusAide: 'VALIDEE', motifRefus: '' };
    this.showTraitementModal = true;
    this.errorEval = '';
  }

  rejeterRapide(aide: AideCandidat, event: Event): void {
    event.stopPropagation();
    if (!this.peutEvaluer(aide)) return;
    this.selectedAide = aide;
    this.evaluation = { statusAide: 'REJETEE', motifRefus: '' };
    this.showTraitementModal = true;
    this.errorEval = '';
  }

  // ─── Modal détail (lecture seule) ─────────────────────────────────────────
  voirDetail(aide: AideCandidat, event?: Event): void {
    event?.stopPropagation();
    this.detailAide = aide;
    this.showDetailModal = true;
  }

  fermerDetail(): void {
    this.showDetailModal = false;
    this.detailAide = null;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  peutEvaluer(aide: AideCandidat): boolean {
    return aide.statusAide === 'EN_ATTENTE' || aide.statusAide === 'EN_TRAITEMENT';
  }

  getNomCandidat(aide: AideCandidat): string {
    if (aide.candidatCreateur) {
      return `${aide.candidatCreateur.prenom} ${aide.candidatCreateur.nom}`.trim();
    }
    return 'Candidat inconnu';
  }

  getInitiales(aide: AideCandidat): string {
    if (aide.candidatCreateur) {
      return `${aide.candidatCreateur.prenom?.[0] || ''}${aide.candidatCreateur.nom?.[0] || ''}`.toUpperCase();
    }
    return '?';
  }

  // ─── Visualisation / téléchargement de fichiers ───────────────────────────
  // HttpClient est utilisé afin que l'intercepteur ajoute automatiquement le token JWT.
  // On crée une URL Blob temporaire côté client pour ouvrir ou télécharger le PDF.

  ouvrirFichier(
    id: number,
    type: 'cnib' | 'demandeAide',
    filename: string,
    mode: 'view' | 'download'
  ): void {
    this.http.get(`${this.apiUrl}/aides/${id}/fichier/${type}`, {
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
      'VALIDEE':       'bg-emerald-100 text-emerald-700',
      'REJETEE':       'bg-red-100 text-red-700',
      'CLOTUREE':      'bg-gray-100 text-gray-600',
      'BROUILLON':     'bg-gray-100 text-gray-500',
      'ACTIVE':        'bg-teal-100 text-teal-700',
    };
    return classes[statut] || 'bg-gray-100 text-gray-600';
  }

  getStatutBarClass(statut: string): string {
    const classes: Record<string, string> = {
      'EN_ATTENTE':    'bg-blue-500',
      'EN_TRAITEMENT': 'bg-amber-400',
      'VALIDEE':       'bg-emerald-500',
      'REJETEE':       'bg-red-500',
      'CLOTUREE':      'bg-gray-400',
      'BROUILLON':     'bg-gray-300',
      'ACTIVE':        'bg-teal-500',
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

  getTypeClass(type: string): string {
    const classes: Record<string, string> = {
      'ALIMENTAIRE':   'bg-orange-100 text-orange-700',
      'SANTE':         'bg-red-100 text-red-700',
      'EDUCATION':     'bg-blue-100 text-blue-700',
      'LOGEMENT':      'bg-purple-100 text-purple-700',
      'EMPLOI':        'bg-emerald-100 text-emerald-700',
      'AUTRE':         'bg-gray-100 text-gray-700',
    };
    return classes[type] || 'bg-gray-100 text-gray-700';
  }

  // ─── Export CSV ───────────────────────────────────────────────────────────
  exporterCSV(): void {
    this.http.get(`${this.apiUrl}/aides/export`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aides_${new Date().toISOString().slice(0, 10)}.csv`;
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
}
