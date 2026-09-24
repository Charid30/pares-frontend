// agent-rapports.ts — Liste et traitement des rapports de stage
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
  telephone?: string;
}

interface StageInfo {
  idstage: number;
  domaineStage?: string;
  typeStage?: string;
  dureeStage?: number;
  dateDebutEffective?: string;
  dateFinEffective?: string;
  candidat?: Candidat;
}

interface Rapport {
  idrapport: number;
  stage_idstage: number;
  titreRapport?: string;
  natureRapport?: string;
  rapportPdf_filename?: string;
  statusRapport: 'SOUMIS' | 'EN_EVALUATION' | 'VALIDE' | 'REFUSE';
  noteRapport?: number;
  commentaireEvaluateur?: string;
  motifRefus?: string;
  evaluePar?: string;
  dateEvaluation?: string;
  createdDate?: string;
  stage?: StageInfo;
}

@Component({
  selector: 'app-agent-rapports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agent-rapports.html',
})
export class AgentRapports implements OnInit {

  private readonly apiUrl = environment.apiUrl;

  rapports: Rapport[] = [];
  rapportsFiltres: Rapport[] = [];
  isLoading = false;
  filtreStatut = '';
  search = '';
  successMessage = '';
  erreur = '';

  // Modal détail
  showModal = false;
  selected: Rapport | null = null;

  // Modal décision
  showDecisionModal = false;
  decisionType: 'VALIDE' | 'REFUSE' | null = null;
  motifRefus = '';
  commentaire = '';
  attestationFile: File | null = null;
  soumission = false;

  // Modal attestation (remplacer)
  showAttestationModal = false;
  attestationRemplacement: File | null = null;
  soumissionAttestation = false;

  // Permissions
  peutValider = false;
  peutRejeter = false;
  peutCreerAttestation = false;

  // Cumul mois par candidat (calculé à partir des rapports chargés)
  cumulMoisParCandidat: Map<number, number> = new Map();

  get total()     { return this.rapports.length; }
  get soumis()    { return this.rapports.filter(r => r.statusRapport === 'SOUMIS').length; }
  get valides()   { return this.rapports.filter(r => r.statusRapport === 'VALIDE').length; }
  get refuses()   { return this.rapports.filter(r => r.statusRapport === 'REFUSE').length; }

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.peutValider         = this.authService.hasPermission('STAGE', 'VALIDER');
    this.peutRejeter         = this.authService.hasPermission('STAGE', 'REJETER');
    this.peutCreerAttestation = this.authService.hasPermission('STAGE', 'CREER');
    this.charger();
  }

  charger(): void {
    this.isLoading = true;
    this.erreur = '';
    this.http.get<{ success: boolean; data: Rapport[] }>(`${this.apiUrl}/stages/rapports`).subscribe({
      next: (res) => {
        this.rapports = res.data ?? [];
        this.calculerCumulMois();
        this.appliquerFiltres();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.erreur = 'Impossible de charger les rapports de stage.';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private calculerCumulMois(): void {
    this.cumulMoisParCandidat.clear();
    for (const r of this.rapports) {
      const id = r.stage?.candidat?.idcandidats;
      if (id === undefined) continue;
      const mois = r.stage?.dureeStage ?? 0;
      this.cumulMoisParCandidat.set(id, (this.cumulMoisParCandidat.get(id) ?? 0) + mois);
    }
  }

  getCumulMois(r: Rapport): number {
    const id = r.stage?.candidat?.idcandidats;
    return id !== undefined ? (this.cumulMoisParCandidat.get(id) ?? 0) : 0;
  }

  appliquerFiltres(): void {
    let liste = [...this.rapports];
    if (this.filtreStatut) {
      liste = liste.filter(r => r.statusRapport === this.filtreStatut);
    }
    if (this.search.trim()) {
      const q = this.search.toLowerCase();
      liste = liste.filter(r => {
        const c = r.stage?.candidat;
        return (c?.nom?.toLowerCase().includes(q) ||
                c?.prenom?.toLowerCase().includes(q) ||
                c?.email?.toLowerCase().includes(q) ||
                r.stage?.domaineStage?.toLowerCase().includes(q) ||
                r.titreRapport?.toLowerCase().includes(q));
      });
    }
    this.rapportsFiltres = liste;
  }

  onFiltreChange(): void { this.appliquerFiltres(); }
  effacerFiltres(): void { this.filtreStatut = ''; this.search = ''; this.appliquerFiltres(); }

  voirDetail(r: Rapport): void {
    this.selected = r;
    this.showModal = true;
    this.erreur = '';
    this.successMessage = '';
  }

  fermerModal(): void { this.showModal = false; this.selected = null; }

  ouvrirDecision(type: 'VALIDE' | 'REFUSE'): void {
    this.decisionType = type;
    this.motifRefus = '';
    this.commentaire = '';
    this.attestationFile = null;
    this.showDecisionModal = true;
  }

  fermerDecision(): void { this.showDecisionModal = false; this.decisionType = null; }

  onAttestationChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.attestationFile = input.files?.[0] ?? null;
  }

  confirmerDecision(): void {
    if (!this.selected || !this.decisionType) return;
    if (!this.commentaire.trim()) return;
    if (this.decisionType === 'REFUSE' && !this.motifRefus.trim()) return;
    if (this.decisionType === 'VALIDE' && this.peutCreerAttestation && !this.attestationFile) return;
    this.soumission = true;

    const body: Record<string, unknown> = {
      statusRapport: this.decisionType,
      commentaireEvaluateur: this.commentaire.trim(),
    };
    if (this.decisionType === 'REFUSE') body['motifRefus'] = this.motifRefus.trim();

    this.http.put<{ success: boolean }>(
      `${this.apiUrl}/stages/rapports/${this.selected.idrapport}/evaluer`, body
    ).subscribe({
      next: () => {
        if (this.decisionType === 'VALIDE' && this.attestationFile && this.selected) {
          this.uploadAttestation(this.selected, this.attestationFile, () => {
            this.soumission = false;
            this.showDecisionModal = false;
            this.showModal = false;
            this.successMessage = 'Rapport validé et attestation uploadée avec succès.';
            this.charger();
            setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
          });
        } else {
          this.soumission = false;
          this.showDecisionModal = false;
          this.showModal = false;
          this.successMessage = this.decisionType === 'VALIDE'
            ? 'Rapport validé avec succès.'
            : 'Rapport rejeté.';
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

  private uploadAttestation(rapport: Rapport, file: File, onDone: () => void): void {
    const fd = new FormData();
    fd.append('stage_idstage', String(rapport.stage_idstage));
    fd.append('typeDocument', 'ATTESTATION');
    fd.append('rapport_idrapport', String(rapport.idrapport));
    fd.append('document', file, file.name);

    this.http.post(`${this.apiUrl}/stages/documents`, fd).subscribe({
      next: onDone,
      error: () => {
        // rapport validé mais attestation échouée — on affiche un avertissement
        this.successMessage = 'Rapport validé. L\'upload de l\'attestation a échoué — réessayez via le bouton "Remplacer l\'attestation".';
        this.charger();
        setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 6000);
        onDone();
      },
    });
  }

  // ── Remplacer l'attestation ──────────────────────────────────────────────────

  ouvrirRemplacement(): void {
    this.attestationRemplacement = null;
    this.showAttestationModal = true;
  }

  fermerRemplacement(): void { this.showAttestationModal = false; }

  onRemplacementChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.attestationRemplacement = input.files?.[0] ?? null;
  }

  confirmerRemplacement(): void {
    if (!this.selected || !this.attestationRemplacement) return;
    this.soumissionAttestation = true;
    this.uploadAttestation(this.selected, this.attestationRemplacement, () => {
      this.soumissionAttestation = false;
      this.showAttestationModal = false;
      this.successMessage = 'Attestation uploadée avec succès.';
      this.charger();
      setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
    });
  }

  // ── Documents ────────────────────────────────────────────────────────────────

  telechargerRapport(mode: 'voir' | 'telecharger'): void {
    if (!this.selected) return;
    const filename = this.selected.rapportPdf_filename || `rapport_${this.selected.idrapport}.pdf`;
    this.http.get(`${this.apiUrl}/stages/rapports/${this.selected.idrapport}/download`, { responseType: 'blob' }).subscribe({
      next: (blob) => this.ouvrirBlob(blob, filename, mode),
      error: () => { this.erreur = 'Impossible de charger le rapport.'; this.cdr.detectChanges(); },
    });
  }

  private ouvrirBlob(blob: Blob, filename: string, mode: 'voir' | 'telecharger'): void {
    const url = URL.createObjectURL(blob);
    if (mode === 'voir') { window.open(url, '_blank'); }
    else {
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  getInitiales(r: Rapport): string {
    const c = r.stage?.candidat;
    if (!c) return '?';
    return ((c.prenom?.[0] || '') + (c.nom?.[0] || '')).toUpperCase();
  }

  getStatutBadge(statut: string): string {
    switch (statut) {
      case 'SOUMIS':        return 'bg-blue-100 text-blue-700';
      case 'EN_EVALUATION': return 'bg-amber-100 text-amber-700';
      case 'VALIDE':        return 'bg-green-100 text-green-700';
      case 'REFUSE':        return 'bg-red-100 text-red-700';
      default:              return 'bg-gray-100 text-gray-600';
    }
  }

  getStatutLabel(statut: string): string {
    switch (statut) {
      case 'SOUMIS':        return 'Soumis';
      case 'EN_EVALUATION': return 'En évaluation';
      case 'VALIDE':        return 'Validé';
      case 'REFUSE':        return 'Refusé';
      default:              return statut;
    }
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR');
  }
}
