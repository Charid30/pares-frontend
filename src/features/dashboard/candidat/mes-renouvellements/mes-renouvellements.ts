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
  stageActuel: StageInfo | null;
  stageNouveau: StageInfo | null;
}

type StatusRenouv = 'EN_ATTENTE' | 'PROGRAMMATION_EN_COURS' | 'ACCEPTE' | 'REJETE' | 'EN_COURS' | 'EXPIRE' | 'TERMINE' | 'RAPPORT_SOUMIS';

@Component({
  selector: 'app-mes-renouvellements',
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './mes-renouvellements.html',
})
export class MesRenouvellements implements OnInit {
  renouvellements: MesRenouvellement[] = [];
  loading = true;
  error: string | null = null;
  expanded: Set<number> = new Set();

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

  toggleExpand(id: number): void {
    if (this.expanded.has(id)) {
      this.expanded.delete(id);
    } else {
      this.expanded.add(id);
    }
  }

  isExpanded(id: number): boolean {
    return this.expanded.has(id);
  }

  getStatutBadge(status: string): string {
    const map: Record<string, string> = {
      EN_ATTENTE:           'bg-amber-100 text-amber-700 border-amber-200',
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
      ['EN_ATTENTE', 'PROGRAMMATION_EN_COURS', 'ACCEPTE', 'EN_COURS'].includes(r.statusRenouvellement)
    ).length;
  }

  private readonly STEP_ORDER = ['EN_ATTENTE', 'PROGRAMMATION_EN_COURS', 'ACCEPTE', 'EN_COURS', 'TERMINE', 'RAPPORT_SOUMIS'];

  isStepReached(current: string, step: string): boolean {
    if (current === 'REJETE') return false;
    const ci = this.STEP_ORDER.indexOf(current === 'RAPPORT_SOUMIS' ? 'TERMINE' : current);
    const si = this.STEP_ORDER.indexOf(step);
    return si !== -1 && ci !== -1 && si <= ci;
  }

  get totalTermines(): number {
    return this.renouvellements.filter(r =>
      ['TERMINE', 'RAPPORT_SOUMIS'].includes(r.statusRenouvellement)
    ).length;
  }
}
