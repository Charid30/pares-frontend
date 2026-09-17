// agent-renouvellement.ts — Liste et traitement des demandes de renouvellement
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../../core/services/auth.service';

interface Candidat {
  idcandidats: number;
  nom: string;
  prenom: string;
  email: string;
}

interface StageActuel {
  idstage: number;
  domaineStage?: string;
  typeStage?: string;
  dateFinEffective?: string;
  candidat?: Candidat;
}

interface StageNouveau {
  idstage: number;
  statusStage: string;
  dateDebutEffective?: string;
  dateFinEffective?: string;
}

interface Renouvellement {
  idrenouvellement: number;
  statusRenouvellement: 'EN_ATTENTE' | 'ACCEPTE' | 'REJETE';
  dureeDemandee: number;
  dateRenouvellement: string;
  lettreMotivationRenouvellement_filename?: string;
  conventionStageEnCours_filename?: string;
  stageActuel?: StageActuel;
  stageNouveau?: StageNouveau;
}

@Component({
  selector: 'app-agent-renouvellement',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agent-renouvellement.html',
})
export class AgentRenouvellement implements OnInit {

  private readonly apiUrl = environment.apiUrl;

  renouvellements: Renouvellement[] = [];
  renouvellementsFiltres: Renouvellement[] = [];
  isLoading = false;
  filtreStatut = '';
  search = '';
  successMessage = '';
  erreur = '';

  // Modal détail
  showModal = false;
  selected: Renouvellement | null = null;

  // Modal décision (accepter/refuser)
  showDecisionModal = false;
  decisionType: 'ACCEPTE' | 'REJETE' | null = null;
  motifRefus = '';
  conventionFile: File | null = null;
  soumission = false;

  // Modal convention (remplacer/joindre après acceptation)
  showConventionModal = false;
  conventionRemplacement: File | null = null;
  soumissionConvention = false;

  // Permissions
  peutValider = false;
  peutRejeter = false;
  peutCreerConvention = false;

  // Stats
  get total()     { return this.renouvellements.length; }
  get enAttente() { return this.renouvellements.filter(r => r.statusRenouvellement === 'EN_ATTENTE').length; }
  get acceptes()  { return this.renouvellements.filter(r => r.statusRenouvellement === 'ACCEPTE').length; }
  get rejetes()   { return this.renouvellements.filter(r => r.statusRenouvellement === 'REJETE').length; }

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.peutValider          = this.authService.hasPermission('STAGE', 'VALIDER');
    this.peutRejeter          = this.authService.hasPermission('STAGE', 'REJETER');
    this.peutCreerConvention  = this.authService.hasPermission('STAGE', 'CREER');
    this.charger();
  }

  charger(): void {
    this.isLoading = true;
    this.erreur = '';
    this.http.get<{ success: boolean; data: Renouvellement[] }>(`${this.apiUrl}/stages/renouvellements`).subscribe({
      next: (res) => {
        this.renouvellements = res.data ?? [];
        this.appliquerFiltres();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.erreur = 'Impossible de charger les demandes de renouvellement.';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  appliquerFiltres(): void {
    let liste = [...this.renouvellements];
    if (this.filtreStatut) {
      liste = liste.filter(r => r.statusRenouvellement === this.filtreStatut);
    }
    if (this.search.trim()) {
      const q = this.search.toLowerCase();
      liste = liste.filter(r => {
        const c = r.stageActuel?.candidat;
        return (c?.nom?.toLowerCase().includes(q) ||
                c?.prenom?.toLowerCase().includes(q) ||
                c?.email?.toLowerCase().includes(q) ||
                r.stageActuel?.domaineStage?.toLowerCase().includes(q));
      });
    }
    this.renouvellementsFiltres = liste;
  }

  onFiltreChange(): void { this.appliquerFiltres(); }

  effacerFiltres(): void {
    this.filtreStatut = '';
    this.search = '';
    this.appliquerFiltres();
  }

  // ── Modal détail ─────────────────────────────────────────────────────────────

  voirDetail(r: Renouvellement): void {
    this.selected = r;
    this.showModal = true;
    this.erreur = '';
    this.successMessage = '';
  }

  fermerModal(): void {
    this.showModal = false;
    this.selected = null;
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  ouvrirDecision(type: 'ACCEPTE' | 'REJETE'): void {
    this.decisionType = type;
    this.motifRefus = '';
    this.conventionFile = null;
    this.showDecisionModal = true;
  }

  fermerDecision(): void {
    this.showDecisionModal = false;
    this.decisionType = null;
    this.motifRefus = '';
    this.conventionFile = null;
  }

  onConventionChange(event: Event): void {
    this.conventionFile = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  confirmerDecision(): void {
    if (!this.selected || !this.decisionType) return;
    if (this.decisionType === 'REJETE' && !this.motifRefus.trim()) return;
    if (this.decisionType === 'ACCEPTE' && this.peutCreerConvention && !this.conventionFile) return;
    this.soumission = true;
    const body: Record<string, string> = { statusRenouvellement: this.decisionType };
    if (this.decisionType === 'REJETE') body['motifRefus'] = this.motifRefus.trim();

    this.http.put<{ success: boolean; data: any }>(
      `${this.apiUrl}/stages/renouvellements/${this.selected.idrenouvellement}/evaluer`,
      body
    ).subscribe({
      next: (res) => {
        if (this.decisionType === 'ACCEPTE' && this.conventionFile && this.peutCreerConvention) {
          const nouveauStageId = res.data?.stageNouveau?.idstage ?? res.data?.stage_nouveau_idstage;
          if (nouveauStageId) {
            const fd = new FormData();
            fd.append('stage_idstage', String(nouveauStageId));
            fd.append('typeDocument', 'CONVENTION');
            fd.append('document', this.conventionFile, this.conventionFile.name);
            this.http.post(`${this.apiUrl}/stages/documents`, fd).subscribe({
              next: () => {
                this.soumission = false;
                this.showDecisionModal = false;
                this.showModal = false;
                this.successMessage = 'Renouvellement accepté et convention uploadée avec succès.';
                this.charger();
                setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
              },
              error: () => {
                this.soumission = false;
                this.showDecisionModal = false;
                this.showModal = false;
                this.successMessage = 'Renouvellement accepté. L\'upload de la convention a échoué — réessayez ultérieurement.';
                this.charger();
                setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 6000);
              },
            });
          } else {
            this.soumission = false;
            this.showDecisionModal = false;
            this.showModal = false;
            this.successMessage = 'Renouvellement accepté avec succès.';
            this.charger();
            setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
          }
        } else {
          this.soumission = false;
          this.showDecisionModal = false;
          this.showModal = false;
          this.successMessage = this.decisionType === 'ACCEPTE'
            ? 'Renouvellement accepté avec succès.'
            : 'Renouvellement rejeté.';
          this.charger();
          setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
        }
      },
      error: (err) => {
        this.soumission = false;
        this.erreur = err.error?.message || 'Une erreur est survenue.';
        this.cdr.detectChanges();
      },
    });
  }

  // ── Convention (post-acceptation) ────────────────────────────────────────────

  ouvrirConventionModal(): void {
    this.conventionRemplacement = null;
    this.showConventionModal = true;
  }

  fermerConventionModal(): void {
    this.showConventionModal = false;
    this.conventionRemplacement = null;
  }

  onConventionRemplacementChange(event: Event): void {
    this.conventionRemplacement = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  confirmerConvention(): void {
    if (!this.selected || !this.conventionRemplacement) return;
    const stageId = this.selected.stageNouveau?.idstage;
    if (!stageId) {
      this.erreur = 'Impossible de trouver le nouveau stage associé.';
      this.cdr.detectChanges();
      return;
    }
    this.soumissionConvention = true;
    const fd = new FormData();
    fd.append('stage_idstage', String(stageId));
    fd.append('typeDocument', 'CONVENTION');
    fd.append('document', this.conventionRemplacement, this.conventionRemplacement.name);
    this.http.post(`${this.apiUrl}/stages/documents`, fd).subscribe({
      next: () => {
        this.soumissionConvention = false;
        this.showConventionModal = false;
        this.successMessage = 'Convention uploadée avec succès.';
        this.charger();
        setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
      },
      error: (err) => {
        this.soumissionConvention = false;
        this.erreur = err.error?.message || 'Erreur lors de l\'upload de la convention.';
        this.cdr.detectChanges();
      },
    });
  }

  // ── Documents ────────────────────────────────────────────────────────────────

  accederLettre(mode: 'voir' | 'telecharger'): void {
    if (!this.selected) return;
    const filename = this.selected.lettreMotivationRenouvellement_filename || `lettre_${this.selected.idrenouvellement}.pdf`;
    this.http.get(`${this.apiUrl}/stages/renouvellements/${this.selected.idrenouvellement}/lettre`, { responseType: 'blob' }).subscribe({
      next: (blob) => this.ouvrirOuTelechargerBlob(blob, filename, mode),
      error: () => { this.erreur = 'Impossible de charger la lettre.'; this.cdr.detectChanges(); },
    });
  }

  accederConvention(mode: 'voir' | 'telecharger'): void {
    if (!this.selected) return;
    const filename = this.selected.conventionStageEnCours_filename || `convention_${this.selected.idrenouvellement}.pdf`;
    this.http.get(`${this.apiUrl}/stages/renouvellements/${this.selected.idrenouvellement}/convention`, { responseType: 'blob' }).subscribe({
      next: (blob) => this.ouvrirOuTelechargerBlob(blob, filename, mode),
      error: () => { this.erreur = 'Impossible de charger la convention.'; this.cdr.detectChanges(); },
    });
  }

  private ouvrirOuTelechargerBlob(blob: Blob, filename: string, mode: 'voir' | 'telecharger'): void {
    const url = URL.createObjectURL(blob);
    if (mode === 'voir') {
      window.open(url, '_blank');
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  getInitiales(r: Renouvellement): string {
    const c = r.stageActuel?.candidat;
    if (!c) return '?';
    return ((c.prenom?.[0] || '') + (c.nom?.[0] || '')).toUpperCase();
  }

  getStatutBadge(statut: string): string {
    switch (statut) {
      case 'EN_ATTENTE': return 'bg-amber-100 text-amber-700';
      case 'ACCEPTE':    return 'bg-green-100 text-green-700';
      case 'REJETE':     return 'bg-red-100 text-red-700';
      default:           return 'bg-gray-100 text-gray-600';
    }
  }

  getStatutLabel(statut: string): string {
    switch (statut) {
      case 'EN_ATTENTE': return 'En attente';
      case 'ACCEPTE':    return 'Accepté';
      case 'REJETE':     return 'Rejeté';
      default:           return statut;
    }
  }
}
