import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';

interface StageInfo {
  idstage: number;
  domaine: string;
  type: string;
  dateDebut: string | null;
  dateFin: string | null;
  status?: string;
}

interface MesRenouvellement {
  idrenouvellement: number;
  statusRenouvellement: string;
  motifRefus: string | null;
  dureeDemandee: number | null;
  dateRenouvellement: string;
  createdBy: string | null;
  lastModifiedBy: string | null;
  lastModifiedDate: string | null;
  lettreNonConforme: boolean | null;
  lettreMotivationFilename: string | null;
  /** Convention du renouvellement, jointe par l'agent/admin sur le nouveau stage */
  conventionFilename: string | null;
  stageActuel: StageInfo | null;
  stageNouveau: StageInfo | null;
}

type StatusRenouv = 'EN_ATTENTE' | 'EN_COURS_DE_TRAITEMENT' | 'PROGRAMMATION_EN_COURS' | 'ACCEPTE' | 'REJETE' | 'EN_COURS' | 'EXPIRE' | 'TERMINE' | 'RAPPORT_SOUMIS';

@Component({
  selector: 'app-mes-renouvellements',
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './mes-renouvellements.html',
})
export class MesRenouvellements implements OnInit {
  renouvellements: MesRenouvellement[] = [];
  loading = true;
  error: string | null = null;

  // Onglets de filtre (même principe que « Mes stages »)
  activeFilter: 'tous' | 'en_cours' | 'rejetes' = 'tous';

  // Modal détail
  selectedDetail: MesRenouvellement | null = null;

  // Re-soumission modal
  showResoumissionModal = false;
  resoumissionTarget: MesRenouvellement | null = null;
  resoumissionLettreFile: File | null = null;
  resoumissionSubmitting = false;
  resoumissionError: string | null = null;
  resoumissionSuccess = false;

  private api = environment.apiUrl;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading = true;
    this.error = null;
    this.http.get<{ success: boolean; data: MesRenouvellement[] }>(`${this.api}/candidat/renouvellements`, { withCredentials: true })
      .subscribe({
        next: (res) => {
          this.renouvellements = res.data || [];
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.error = 'Impossible de charger vos renouvellements.';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  setFilter(f: 'tous' | 'en_cours' | 'rejetes'): void {
    this.activeFilter = f;
  }

  get renouvellementsFiltres(): MesRenouvellement[] {
    if (this.activeFilter === 'en_cours') {
      return this.renouvellements.filter(r =>
        ['EN_ATTENTE', 'EN_COURS_DE_TRAITEMENT', 'PROGRAMMATION_EN_COURS', 'ACCEPTE', 'EN_COURS'].includes(r.statusRenouvellement));
    }
    if (this.activeFilter === 'rejetes') {
      return this.renouvellements.filter(r => r.statusRenouvellement === 'REJETE');
    }
    return this.renouvellements;
  }

  ouvrirDetail(r: MesRenouvellement): void {
    this.selectedDetail = r;
  }

  fermerDetail(): void {
    this.selectedDetail = null;
  }

  // ─── Re-soumission ───────────────────────────────────────

  ouvrirResoumission(r: MesRenouvellement): void {
    this.resoumissionTarget = r;
    this.resoumissionLettreFile = null;
    this.resoumissionError = null;
    this.resoumissionSuccess = false;
    this.showResoumissionModal = true;
  }

  fermerResoumission(): void {
    if (this.resoumissionSubmitting) return;
    this.showResoumissionModal = false;
    this.resoumissionTarget = null;
  }

  onLettreChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.resoumissionLettreFile = input.files?.[0] ?? null;
  }

  soumettreDossier(): void {
    if (!this.resoumissionTarget) return;
    const r = this.resoumissionTarget;

    // La lettre est le seul document fourni par le candidat (la convention est jointe par l'agent/admin)
    if (r.lettreNonConforme && !this.resoumissionLettreFile) {
      this.resoumissionError = 'Vous devez fournir une nouvelle lettre de motivation (signalée non conforme).';
      return;
    }

    const fd = new FormData();
    if (this.resoumissionLettreFile) fd.append('lettreRenouvellement', this.resoumissionLettreFile);

    this.resoumissionSubmitting = true;
    this.resoumissionError = null;

    this.http.put<{ success: boolean }>(
      `${this.api}/candidat/renouvellements/${r.idrenouvellement}/ressoumettre`,
      fd,
      { withCredentials: true }
    ).subscribe({
      next: () => {
        this.resoumissionSubmitting = false;
        this.resoumissionSuccess = true;
        setTimeout(() => {
          this.fermerResoumission();
          this.charger();
        }, 1500);
      },
      error: (err) => {
        this.resoumissionSubmitting = false;
        this.resoumissionError = err.error?.message || 'Erreur lors de la re-soumission.';
        this.cdr.detectChanges();
      }
    });
  }

  // ─── Téléchargements ─────────────────────────────────────

  // Via HttpClient (et non window.open) pour que l'intercepteur ajoute le jeton JWT
  telechargerLettre(id: number): void {
    this.ouvrirPdf(`${this.api}/candidat/renouvellements/${id}/lettre`, 'Impossible de charger la lettre.');
  }

  telechargerConvention(id: number): void {
    this.ouvrirPdf(`${this.api}/candidat/renouvellements/${id}/convention`, 'Impossible de charger la convention.');
  }

  private ouvrirPdf(url: string, messageErreur: string): void {
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const objectUrl = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        window.open(objectUrl, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60000);
      },
      error: () => {
        this.error = messageErreur;
        this.cdr.detectChanges();
      },
    });
  }

  // ─── Statuts ─────────────────────────────────────────────

  getStatutBadge(status: string): string {
    const map: Record<string, string> = {
      EN_ATTENTE:           'bg-amber-100 text-amber-700 border-amber-200',
      EN_COURS_DE_TRAITEMENT: 'bg-orange-100 text-orange-700 border-orange-200',
      PROGRAMMATION_EN_COURS: 'bg-blue-100 text-blue-700 border-blue-200',
      ACCEPTE:              'bg-green-100 text-green-700 border-green-200',
      EN_COURS:             'bg-indigo-100 text-indigo-700 border-indigo-200',
      EXPIRE:               'bg-orange-100 text-orange-600 border-orange-200',
      TERMINE:              'bg-gray-100 text-gray-500 border-gray-200',
      RAPPORT_SOUMIS:       'bg-purple-100 text-purple-700 border-purple-200',
      REJETE:               'bg-red-100 text-red-700 border-red-200',
    };
    return map[status] ?? 'bg-gray-100 text-gray-500 border-gray-200';
  }

  getStatutLabel(status: string): string {
    const map: Record<string, string> = {
      EN_ATTENTE:             'En attente',
      EN_COURS_DE_TRAITEMENT: 'En traitement',
      PROGRAMMATION_EN_COURS: 'Approuvé',
      ACCEPTE:                'Accepté',
      EN_COURS:               'En cours',
      EXPIRE:                 'Expiré',
      TERMINE:                'Terminé',
      RAPPORT_SOUMIS:         'Rapport soumis',
      REJETE:                 'Rejeté',
    };
    return map[status] ?? status;
  }

  getTimelineColor(status: string): string {
    const map: Record<string, string> = {
      EN_ATTENTE:             'bg-amber-400',
      EN_COURS_DE_TRAITEMENT: 'bg-orange-500',
      PROGRAMMATION_EN_COURS: 'bg-blue-500',
      ACCEPTE:                'bg-green-500',
      EN_COURS:               'bg-indigo-500',
      EXPIRE:                 'bg-orange-400',
      TERMINE:                'bg-gray-400',
      RAPPORT_SOUMIS:         'bg-purple-500',
      REJETE:                 'bg-red-500',
    };
    return map[status] ?? 'bg-gray-300';
  }

  get totalActifs(): number {
    return this.renouvellements.filter(r =>
      ['EN_ATTENTE', 'EN_COURS_DE_TRAITEMENT', 'PROGRAMMATION_EN_COURS', 'ACCEPTE', 'EN_COURS'].includes(r.statusRenouvellement)
    ).length;
  }

  private readonly STEP_ORDER = ['EN_ATTENTE', 'PROGRAMMATION_EN_COURS', 'ACCEPTE', 'EN_COURS', 'TERMINE', 'RAPPORT_SOUMIS'];

  isStepReached(current: string, step: string): boolean {
    if (current === 'REJETE') return false;
    // « En traitement » est une sous-étape de « Soumis » (avant approbation)
    const normalise = current === 'RAPPORT_SOUMIS' ? 'TERMINE' : current === 'EN_COURS_DE_TRAITEMENT' ? 'EN_ATTENTE' : current;
    const ci = this.STEP_ORDER.indexOf(normalise);
    const si = this.STEP_ORDER.indexOf(step);
    return si !== -1 && ci !== -1 && si <= ci;
  }

  get totalTermines(): number {
    return this.renouvellements.filter(r =>
      ['TERMINE', 'RAPPORT_SOUMIS'].includes(r.statusRenouvellement)
    ).length;
  }
}
