// src/features/dashboard/agent/modules/suivi-stage/agent-suivi-stage.ts
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';
import { StatCard } from '../../../../../shared/components/stat-card/stat-card';

interface SuiviStage {
  idstage: number;
  typeStage: string;
  domaineStage?: string;
  dureeStage?: number;           // en mois
  dateDebutEffective?: string;
  dateFinEffective?: string;
  estRenouvellement?: boolean;
  stage_parent_idstage?: number;
  dateDebutChaine?: string;
  moisConsommes?: number;
  moisRestantsAvantLimit?: number;
  renouvellementPossible?: boolean;
  joursRestants?: number | null;
  candidat?: { idcandidats: number; nom: string; prenom: string; email: string; telephone?: string };
}

@Component({
  selector: 'app-agent-suivi-stage',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, StatCard],
  templateUrl: './agent-suivi-stage.html',
})
export class AgentSuiviStage implements OnInit {

  stages: SuiviStage[] = [];
  stagesFiltres: SuiviStage[] = [];
  loading = false;
  erreur = '';
  search = '';
  filtreType = '';
  showDetailModal = false;
  detailItem: SuiviStage | null = null;

  get peutConsulter(): boolean { return this.authService.hasPermission('SUIVI_STAGE', 'CONSULTER'); }

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    if (!this.peutConsulter) return;
    this.charger();
  }

  charger(): void {
    this.loading = true;
    this.erreur = '';
    this.http.get<any>(`${this.apiUrl}/stages/suivi`).subscribe({
      next: (res) => {
        this.stages = res.data?.items || [];
        this.filtrer();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.erreur = err.error?.message || 'Erreur lors du chargement';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  filtrer(): void {
    this.stagesFiltres = this.stages.filter(s => {
      const nom = `${s.candidat?.nom || ''} ${s.candidat?.prenom || ''} ${s.candidat?.email || ''}`.toLowerCase();
      const matchSearch = !this.search || nom.includes(this.search.toLowerCase());
      const matchType = !this.filtreType || s.typeStage === this.filtreType;
      return matchSearch && matchType;
    });
  }

  effacerFiltres(): void {
    this.search = '';
    this.filtreType = '';
    this.filtrer();
  }

  getInitiales(s: SuiviStage): string {
    if (!s.candidat) return '?';
    return ((s.candidat.nom?.[0] || '') + (s.candidat.prenom?.[0] || '')).toUpperCase() || '?';
  }

  /** Moyenne des durées en mois, affichée en jours (×30) */
  get moyenneDuree(): string {
    if (!this.stages.length) return '—';
    const valides = this.stages.filter(s => s.dureeStage);
    if (!valides.length) return '—';
    const somme = valides.reduce((acc, s) => acc + (s.dureeStage || 0), 0);
    const moyMois = somme / valides.length;
    return Math.round(moyMois * 30).toString();
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      ACADEMIQUE: 'Académique',
      PROFESSIONNEL: 'Professionnel',
      PRE_EMPLOI: 'Pré-emploi',
      PERFECTIONNEMENT: 'Perfectionnement',
    };
    return labels[type] || type;
  }

  voirDetail(s: SuiviStage): void {
    this.detailItem = s;
    this.showDetailModal = true;
    this.cdr.detectChanges();
  }

  fermerDetail(): void {
    this.showDetailModal = false;
    this.detailItem = null;
  }

  getAvancement(s: SuiviStage): number {
    if (!s.dateDebutEffective || !s.dateFinEffective) return 0;
    const debut = new Date(s.dateDebutEffective).getTime();
    const fin = new Date(s.dateFinEffective).getTime();
    const now = Date.now();
    if (now <= debut) return 0;
    if (now >= fin) return 100;
    return Math.round(((now - debut) / (fin - debut)) * 100);
  }
}
