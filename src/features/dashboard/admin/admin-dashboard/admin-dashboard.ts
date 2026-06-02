import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DashboardService, RecentActivity, PendingItem } from '../../../../core/services/dashboard.service';
import { Chart, registerables } from 'chart.js';

// Enregistrer tous les composants Chart.js
Chart.register(...registerables);

interface StatCard {
  label: string;
  value: number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  icon: string;
  color: string;
  bgColor: string;
  accentClass: string;
  route: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.css'],
})
export class AdminDashboard implements OnInit, AfterViewInit {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  // isLoading = true;

  currentDate = new Date();
  chart: Chart | null = null;

  // Statistiques principales - initialisées avec des valeurs par défaut
  stats: StatCard[] = [
    {
      label: 'Candidats inscrits',
      value: 0,
      change: 0,
      changeType: 'neutral',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      accentClass: 'bg-blue-500',
      route: '/admin/candidats'
    },
    {
      label: 'Demandes de stage',
      value: 0,
      change: 0,
      changeType: 'neutral',
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      accentClass: 'bg-amber-400',
      route: '/admin/stages'
    },
    {
      label: 'Campagnes actives',
      value: 0,
      change: 0,
      changeType: 'neutral',
      icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      color: 'text-primary-600',
      bgColor: 'bg-primary-50',
      accentClass: 'bg-primary-500',
      route: '/admin/recrutements'
    },
    {
      label: 'Offres commerciales',
      value: 0,
      change: 0,
      changeType: 'neutral',
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      color: 'text-secondary-600',
      bgColor: 'bg-secondary-50',
      accentClass: 'bg-secondary-500',
      route: '/admin/offres-commerciales'
    }
  ];

  // Statistiques secondaires
  secondaryStats = {
    aidesSociales: { active: 0, demandes: 0 },
    utilisateurs: { total: 0, admins: 0 },
    candidaturesEnAttente: 0,
    tauxValidation: 0
  };

  // Activités récentes
  recentActivities: RecentActivity[] = [];

  // Éléments en attente
  pendingItems: PendingItem[] = [];

  // Données pour le graphique
  chartData = {
    labels: [] as string[],
    candidats: [] as number[],
    stagesValides: [] as number[]
  };

  constructor(
    private dashboardService: DashboardService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    // Initialiser le graphique après le chargement de la vue
    setTimeout(() => this.initChart(), 100);
  }

  loadDashboardData(): void {
    this.dashboardService.getDashboardData().subscribe({
      next: (response) => {
        // Exécuter dans la zone Angular pour garantir la détection de changement
        this.ngZone.run(() => {
          if (response.success) {
            const data = response.data;

            // Mapper les statistiques principales
            this.stats = [
              {
                label: 'Candidats inscrits',
                value: data.mainStats.candidats.total,
                change: Math.abs(data.mainStats.candidats.change),
                changeType: data.mainStats.candidats.changeType,
                icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
                color: 'text-blue-600',
                bgColor: 'bg-blue-50',
                accentClass: 'bg-blue-500',
                route: '/admin/candidats'
              },
              {
                label: 'Demandes de stage',
                value: data.mainStats.stages.total,
                change: Math.abs(data.mainStats.stages.change),
                changeType: data.mainStats.stages.changeType,
                icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
                color: 'text-amber-600',
                bgColor: 'bg-amber-50',
                accentClass: 'bg-amber-400',
                route: '/admin/stages'
              },
              {
                label: 'Campagnes actives',
                value: data.mainStats.recrutements.campagnesActives,
                change: 0,
                changeType: 'neutral',
                icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
                color: 'text-primary-600',
                bgColor: 'bg-primary-50',
                accentClass: 'bg-primary-500',
                route: '/admin/recrutements'
              },
              {
                label: 'Offres commerciales',
                value: data.mainStats.offres.total,
                change: 0,
                changeType: 'neutral',
                icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
                color: 'text-secondary-600',
                bgColor: 'bg-secondary-50',
                accentClass: 'bg-secondary-500',
                route: '/admin/offres-commerciales'
              }
            ];

            // Mapper les statistiques secondaires
            this.secondaryStats = data.secondaryStats;

            // Activités récentes
            this.recentActivities = data.recentActivities.map(a => ({
              ...a,
              date: new Date(a.date)
            }));

            // Éléments en attente
            this.pendingItems = data.pendingItems.map(p => ({
              ...p,
              date: new Date(p.date)
            }));

            // Mettre à jour le graphique avec les vraies données
            if (data.chartData) {
              this.chartData = data.chartData;
              this.updateChart();
            }
          }

          // Forcer la détection de changement
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error('Erreur chargement dashboard:', err);
        // Les données par défaut sont déjà initialisées
        this.cdr.detectChanges();
      }
    });
  }

  initChart(): void {
    if (!this.chartCanvas) return;

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Données par défaut pour le graphique (6 derniers mois)
    const months = this.getLastMonths(6);

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Candidats inscrits',
            data: this.chartData.candidats.length > 0 ? this.chartData.candidats : [0, 0, 0, 0, 0, 0],
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#3B82F6',
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          },
          {
            label: 'Stages validés',
            data: this.chartData.stagesValides.length > 0 ? this.chartData.stagesValides : [0, 0, 0, 0, 0, 0],
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#10B981',
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 20,
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 12,
            cornerRadius: 8,
            displayColors: true,
            boxWidth: 8,
            boxHeight: 8,
            usePointStyle: true,
            callbacks: {
              title: (context) => `${context[0].label}`,
              label: (context) => ` ${context.dataset.label}: ${context.parsed.y}`
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#9CA3AF',
              font: {
                size: 11
              }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(156, 163, 175, 0.1)'
            },
            ticks: {
              color: '#9CA3AF',
              font: {
                size: 11
              },
              stepSize: 5
            }
          }
        }
      }
    });
  }

  updateChart(): void {
    if (!this.chart) return;

    // Mettre à jour avec les vraies données si disponibles
    if (this.chartData.labels.length > 0) {
      this.chart.data.labels = this.chartData.labels;
      this.chart.data.datasets[0].data = this.chartData.candidats;
      this.chart.data.datasets[1].data = this.chartData.stagesValides;
      this.chart.update();
    }
  }

  getLastMonths(count: number): string[] {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const result: string[] = [];
    const now = new Date();

    for (let i = count - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      result.push(months[date.getMonth()]);
    }

    return result;
  }

  generateSampleData(length: number, min: number, max: number): number[] {
    const data: number[] = [];
    let previousValue = Math.floor(Math.random() * (max - min) + min);

    for (let i = 0; i < length; i++) {
      // Générer une variation réaliste par rapport à la valeur précédente
      const variation = Math.floor(Math.random() * 10) - 5;
      let newValue = previousValue + variation;
      newValue = Math.max(min, Math.min(max, newValue));
      data.push(newValue);
      previousValue = newValue;
    }

    return data;
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

  getActivityIcon(type: string): string {
    const icons: { [key: string]: string } = {
      candidat: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      stage: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      recrutement: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      offre: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      aide: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z'
    };
    return icons[type] || icons['candidat'];
  }

  getActivityColor(type: string): string {
    const colors: { [key: string]: string } = {
      candidat: 'bg-blue-100 text-blue-600',
      stage: 'bg-yellow-100 text-yellow-600',
      recrutement: 'bg-primary-100 text-primary-600',
      offre: 'bg-secondary-100 text-secondary-600',
      aide: 'bg-purple-100 text-purple-600'
    };
    return colors[type] || colors['candidat'];
  }

  getPriorityClass(priority: string): string {
    const classes: { [key: string]: string } = {
      high: 'bg-red-100 text-red-700 border-red-200',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      low: 'bg-green-100 text-green-700 border-green-200'
    };
    return classes[priority] || classes['low'];
  }

  getPriorityLabel(priority: string): string {
    const labels: { [key: string]: string } = {
      high: 'Urgent',
      medium: 'Normal',
      low: 'Faible'
    };
    return labels[priority] || 'Normal';
  }

  getTypeIcon(type: string): string {
    return this.getActivityIcon(type);
  }

  getTypeColor(type: string): string {
    return this.getActivityColor(type);
  }

  getStatusLabel(status: string | null): string {
    if (!status) return '';
    const labels: { [key: string]: string } = {
      'EN_ATTENTE': 'En attente',
      'EN_COURS_DE_TRAITEMENT': 'En traitement',
      'ACCEPTE': 'Accepté',
      'REJETE': 'Rejeté',
      'EN_COURS': 'En cours',
      'SOUMISE': 'Soumise',
      'EN_EXAMEN': 'En examen',
      'RETENUE': 'Retenue',
      'REJETEE': 'Rejetée'
    };
    return labels[status] || status;
  }
}
