import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DashboardService, RecentActivity, RepartitionStages, AudiencesStats, ATraiter, StagesDirection } from '../../../../core/services/dashboard.service';
import { classesStatut } from '../../../../core/constants/statuts';
import { Chart, registerables } from 'chart.js';

// Enregistrer tous les composants Chart.js
Chart.register(...registerables);

interface Priorite {
  libelle: string;
  detail: string;
  nombre: number;
  statut: string;
  route: string;
  queryParams?: { statut: string };
}

const ROUGE = '#c0392b';
const GRIS = '#94a3b8';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.css'],
})
export class AdminDashboard implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  currentDate = new Date();
  chart: Chart | null = null;
  charge = false;
  classesStatut = classesStatut;

  aTraiter: ATraiter = {
    total: 0, stages: 0, conventions: 0, stagesEnRetard: 0,
    renouvellements: 0, offres: 0, audiences: 0, aides: 0, rapports: 0,
  };
  priorites: Priorite[] = [];
  chiffres = { candidats: 0, enStage: 0, tauxValidation: 0 };
  directions: StagesDirection[] = [];
  stagesBientotTermines = 0;
  recentActivities: RecentActivity[] = [];

  // Pour l'export CSV
  repartitionStages: RepartitionStages = { labels: [], values: [] };
  audiencesStats: AudiencesStats = { total: 0, enAttente: 0, acceptees: 0, rejetees: 0 };

  chartData = {
    labels: [] as string[],
    candidats: [] as number[],
    stagesSoumis: [] as number[]
  };

  constructor(
    private dashboardService: DashboardService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    this.initChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  loadDashboardData(): void {
    this.dashboardService.getDashboardData().subscribe({
      next: (response) => {
        if (response.success) {
          const data = response.data;

          this.chiffres = {
            candidats: data.mainStats.candidats.total,
            enStage: data.mainStats.stages.enCours,
            tauxValidation: data.secondaryStats.tauxValidation,
          };
          this.recentActivities = data.recentActivities.map(a => ({ ...a, date: new Date(a.date) }));
          this.directions = data.stagesParDirection ?? [];
          this.stagesBientotTermines = data.stagesBientotTermines ?? 0;
          if (data.aTraiter) {
            this.aTraiter = data.aTraiter;
            this.priorites = this.construirePriorites(data.aTraiter);
          }
          if (data.repartitionStages) this.repartitionStages = data.repartitionStages;
          if (data.audiencesStats) this.audiencesStats = data.audiencesStats;
          if (data.chartData) {
            this.chartData = data.chartData;
            this.updateChart();
          }
          this.charge = true;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur chargement dashboard:', err);
        this.cdr.detectChanges();
      }
    });
  }

  private construirePriorites(t: ATraiter): Priorite[] {
    return [
      { libelle: 'Demandes de stage', detail: 'À examiner', nombre: t.stages, statut: 'EN_COURS_DE_TRAITEMENT', route: '/admin/stages', queryParams: { statut: 'EN_COURS_DE_TRAITEMENT' } },
      { libelle: 'Conventions', detail: 'À joindre', nombre: t.conventions, statut: 'PROGRAMMATION_EN_COURS', route: '/admin/stages', queryParams: { statut: 'PROGRAMMATION_EN_COURS' } },
      { libelle: 'Renouvellements', detail: 'À traiter', nombre: t.renouvellements, statut: 'PROGRAMMATION_EN_COURS', route: '/admin/renouvellements' },
      { libelle: 'Offres commerciales', detail: 'En attente', nombre: t.offres, statut: 'EN_ATTENTE', route: '/admin/offres-commerciales' },
      { libelle: "Demandes d'audience", detail: 'En attente', nombre: t.audiences, statut: 'EN_ATTENTE', route: '/admin/audiences' },
      { libelle: 'Aides sociales', detail: 'En attente', nombre: t.aides, statut: 'EN_ATTENTE', route: '/admin/aides-sociales' },
      { libelle: 'Rapports de stage', detail: 'À évaluer', nombre: t.rapports, statut: 'EN_ATTENTE', route: '/admin/rapports' },
    ];
  }

  /** Part des dossiers de stage, puis des renouvellements, dans la barre du bandeau rouge */
  get partStages(): number {
    return this.aTraiter.stages + this.aTraiter.conventions;
  }

  get autresDemandes(): number {
    return this.aTraiter.total - this.partStages - this.aTraiter.renouvellements;
  }

  get maxDirection(): number {
    return this.directions[0]?.nombre || 1;
  }

  initChart(): void {
    const ctx = this.chartCanvas?.nativeElement.getContext('2d');
    if (!ctx) return;

    const degrade = ctx.createLinearGradient(0, 0, 0, 220);
    degrade.addColorStop(0, 'rgba(192, 57, 43, 0.25)');
    degrade.addColorStop(1, 'rgba(192, 57, 43, 0)');

    const serie = { tension: 0.4, pointRadius: 3, pointHoverRadius: 5, pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5 };

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.chartData.labels,
        datasets: [
          {
            ...serie,
            label: 'Inscriptions',
            data: this.chartData.candidats,
            borderColor: ROUGE,
            backgroundColor: degrade,
            pointBackgroundColor: ROUGE,
            fill: true,
          },
          {
            ...serie,
            label: 'Demandes de stage',
            data: this.chartData.stagesSoumis,
            borderColor: GRIS,
            pointBackgroundColor: GRIS,
            fill: false,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            padding: 12,
            cornerRadius: 10,
            boxWidth: 8,
            boxHeight: 8,
            usePointStyle: true,
          }
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } },
          y: { display: false, beginAtZero: true }
        }
      }
    });
  }

  updateChart(): void {
    if (!this.chart) return;
    this.chart.data.labels = this.chartData.labels;
    this.chart.data.datasets[0].data = this.chartData.candidats;
    this.chart.data.datasets[1].data = this.chartData.stagesSoumis;
    this.chart.update();
  }

  exporterCSV(): void {
    // Export récapitulatif du tableau de bord en CSV
    const BOM = '﻿';
    const today = new Date().toLocaleDateString('fr-FR');
    const rows: string[][] = [
      ['Tableau de bord PARES — Export du ' + today],
      [],
      ['=== CANDIDATS ==='],
      ['Total', String(this.chiffres.candidats)],
      [],
      ['=== DOSSIERS À TRAITER ==='],
      ...this.priorites.map(p => [`${p.libelle} (${p.detail})`, String(p.nombre)]),
      ['Total', String(this.aTraiter.total)],
      [],
      ['=== STAGES PAR STATUT ==='],
      ...this.repartitionStages.labels.map((label, i) => [label, String(this.repartitionStages.values[i])]),
      [],
      ['=== AUDIENCES ==='],
      ['Total',       String(this.audiencesStats.total)],
      ['En attente',  String(this.audiencesStats.enAttente)],
      ['Acceptées',   String(this.audiencesStats.acceptees)],
      ['Rejetées',    String(this.audiencesStats.rejetees)],
    ];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = BOM + rows.map(r => r.map(esc).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  refreshData(): void {
    this.loadDashboardData();
  }

  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);

    if (diffMins < 1) {
      return 'À l\'instant';
    } else if (diffMins < 60) {
      return `Il y a ${diffMins} min`;
    } else if (diffHours < 24) {
      return `Il y a ${diffHours}h`;
    } else {
      return `Il y a ${diffDays}j`;
    }
  }

  getActivityRoute(type: string): string {
    return type === 'stage' ? '/admin/stages' : '/admin/candidats';
  }

  getActivityIcon(type: string): string {
    const icons: { [key: string]: string } = {
      candidat: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      stage: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
    };
    return icons[type] || icons['candidat'];
  }

  getStatusLabel(status: string | null): string {
    if (!status) return '';
    const labels: { [key: string]: string } = {
      'EN_ATTENTE': 'En attente',
      'EN_COURS_DE_TRAITEMENT': 'En traitement',
      'PROGRAMMATION_EN_COURS': 'En cours de programmation',
      'ACCEPTE': 'Accepté',
      'REJETE': 'Rejeté',
      'EN_COURS': 'En cours',
      'EXPIRE': 'Expiré',
      'TERMINE': 'Terminé'
    };
    return labels[status] || status;
  }
}
