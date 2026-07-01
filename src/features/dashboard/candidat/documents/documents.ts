import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';

interface StageRapport {
  idstage: number;
  intitule: string;
  typeStage: string;
  dateDebutEffective: string | null;
  dateFinEffective: string | null;
  statusStage: string;
  // Infos rapport
  rapportSoumis: boolean;
  idrapport: number | null;
  titreRapport: string | null;
  dateSoumissionRapport: string | null;
  statusRapport: string | null;
  noteRapport: number | null;
  // Infos attestation
  attestationDisponible: boolean;
  idattestation: number | null;
  numeroAttestation: string | null;
}

@Component({
  selector: 'app-documents',
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './documents.html',
  styleUrl: './documents.css',
})
export class Documents {

  stagesRapports: StageRapport[] = [];
  isLoading = false;
  errorMessage = '';

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadStagesRapports();
  }

  // ── Computed getters pour le hero ──────────────────────────────
  /** Stages affichés : on masque les stages rejetés/annulés */
  get stagesAffiches(): StageRapport[] {
    return this.stagesRapports.filter(s => s.statusStage !== 'REJETE' && s.statusStage !== 'ANNULE');
  }

  get countRapportsSoumis(): number {
    return this.stagesAffiches.filter(s => s.rapportSoumis).length;
  }

  get countAttestations(): number {
    return this.stagesAffiches.filter(s => s.attestationDisponible).length;
  }

  // ── Chargement ─────────────────────────────────────────────────
  loadStagesRapports(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.http.get<any>(`${this.apiUrl}/candidat/stages-rapports`).subscribe({
      next: (response) => {
        if (response.success) {
          this.stagesRapports = response.data;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erreur:', error);
        this.errorMessage = 'Erreur lors du chargement des stages et rapports';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Télécharger l'attestation de stage
   */
  telechargerAttestation(idattestation: number): void {
    this.http.get(`${this.apiUrl}/candidat/attestations/${idattestation}/download`, {
      responseType: 'blob'
    }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attestation_${idattestation}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Erreur téléchargement attestation:', err);
        this.errorMessage = 'Erreur lors du téléchargement de l\'attestation';
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Classes Tailwind pour le badge statut rapport
   */
  getStatusRapportClass(status: string | null): string {
    if (!status) return 'bg-gray-100 text-gray-500 border border-gray-200';

    const classes: { [key: string]: string } = {
      'SOUMIS':        'bg-blue-50 text-blue-700 border border-blue-200',
      'EN_EVALUATION': 'bg-amber-50 text-amber-700 border border-amber-200',
      'VALIDE':        'bg-green-50 text-green-700 border border-green-200',
      'REFUSE':        'bg-red-50 text-red-700 border border-red-200',
    };
    return classes[status] || 'bg-gray-100 text-gray-500 border border-gray-200';
  }

  /**
   * Libellé du statut rapport
   */
  getStatusRapportLabel(status: string | null): string {
    if (!status) return 'Non soumis';

    const labels: { [key: string]: string } = {
      'SOUMIS':        'Soumis',
      'EN_EVALUATION': 'En évaluation',
      'VALIDE':        'Validé',
      'REFUSE':        'Refusé',
    };
    return labels[status] || status;
  }
}
