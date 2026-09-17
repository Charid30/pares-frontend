// admin-renouvellements.ts — Liste et traitement des demandes de renouvellement (admin)
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

export interface Renouvellement {
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
  selector: 'app-admin-renouvellements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-renouvellements.html',
})
export class AdminRenouvellements implements OnInit {

  private readonly apiUrl = environment.apiUrl;

  renouvellements: Renouvellement[] = [];
  renouvellementsFiltrés: Renouvellement[] = [];
  isLoading = false;
  filtreStatut = '';
  search = '';
  successMessage = '';
  erreur = '';

  // Modal détail
  showModal = false;
  selected: Renouvellement | null = null;

  // Modal décision
  showDecisionModal = false;
  decisionType: 'ACCEPTE' | 'REJETE' | null = null;
  motifRefus = '';
  soumission = false;

  // Stats
  get total()     { return this.renouvellements.length; }
  get enAttente() { return this.renouvellements.filter(r => r.statusRenouvellement === 'EN_ATTENTE').length; }
  get acceptes()  { return this.renouvellements.filter(r => r.statusRenouvellement === 'ACCEPTE').length; }
  get rejetes()   { return this.renouvellements.filter(r => r.statusRenouvellement === 'REJETE').length; }

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
    this.renouvellementsFiltrés = liste;
  }

  onFiltreChange(): void { this.appliquerFiltres(); }

  effacerFiltres(): void {
    this.filtreStatut = '';
    this.search = '';
    this.appliquerFiltres();
  }

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

  ouvrirDecision(type: 'ACCEPTE' | 'REJETE'): void {
    this.decisionType = type;
    this.motifRefus = '';
    this.showDecisionModal = true;
  }

  fermerDecision(): void {
    this.showDecisionModal = false;
    this.decisionType = null;
    this.motifRefus = '';
  }

  confirmerDecision(): void {
    if (!this.selected || !this.decisionType) return;
    if (this.decisionType === 'REJETE' && !this.motifRefus.trim()) return;
    this.soumission = true;
    const body: Record<string, string> = { statusRenouvellement: this.decisionType };
    if (this.decisionType === 'REJETE') body['motifRefus'] = this.motifRefus.trim();

    this.http.put<{ success: boolean }>(
      `${this.apiUrl}/stages/renouvellements/${this.selected.idrenouvellement}/evaluer`,
      body
    ).subscribe({
      next: () => {
        this.soumission = false;
        this.showDecisionModal = false;
        this.showModal = false;
        this.successMessage = this.decisionType === 'ACCEPTE'
          ? 'Renouvellement accepté avec succès.'
          : 'Renouvellement rejeté.';
        this.charger();
        setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
      },
      error: (err) => {
        this.soumission = false;
        this.erreur = err.error?.message || 'Une erreur est survenue.';
        this.cdr.detectChanges();
      },
    });
  }

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

  formatDate(d?: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR');
  }
}
