// src/features/dashboard/financier/activites/activites.ts
import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService, RecentActivity, PendingItem } from '../../../../core/services/dashboard.service';

@Component({
  selector: 'app-financier-activites',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './activites.html',
  styleUrl: './activites.css',
})
export class FinancierActivites implements OnInit {

  activities: RecentActivity[] = [];
  pendingItems: PendingItem[] = [];
  loadingActivities = true;
  loadingPending = true;
  errorActivities = '';
  errorPending = '';

  constructor(
    private dashboardService: DashboardService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadActivities();
    this.loadPending();
  }

  loadActivities(): void {
    this.loadingActivities = true;
    this.dashboardService.getRecentActivities(20).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) this.activities = res.data;
          this.loadingActivities = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.loadingActivities = false;
          this.errorActivities = err.status === 403 ? 'Accès refusé' : 'Erreur de chargement';
          this.cdr.detectChanges();
        });
      }
    });
  }

  loadPending(): void {
    this.loadingPending = true;
    this.dashboardService.getPendingItems(20).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) this.pendingItems = res.data;
          this.loadingPending = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.loadingPending = false;
          this.errorPending = err.status === 403 ? 'Accès refusé' : 'Erreur de chargement';
          this.cdr.detectChanges();
        });
      }
    });
  }

  refreshAll(): void {
    this.errorActivities = '';
    this.errorPending = '';
    this.loadActivities();
    this.loadPending();
  }

  getActivityIcon(type: string): string {
    const icons: Record<string, string> = {
      offre:       'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      candidat:    'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      recrutement: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      stage:       'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      aide:        'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    };
    return icons[type] || 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
  }

  getActivityColor(type: string): string {
    const colors: Record<string, string> = {
      offre:       'bg-blue-100 text-blue-600',
      candidat:    'bg-purple-100 text-purple-600',
      recrutement: 'bg-amber-100 text-amber-600',
      stage:       'bg-green-100 text-green-600',
      aide:        'bg-emerald-100 text-emerald-600',
    };
    return colors[type] || 'bg-gray-100 text-gray-600';
  }

  getPriorityClass(priority: string): string {
    return { high: 'bg-red-100 text-red-700', medium: 'bg-orange-100 text-orange-700', low: 'bg-gray-100 text-gray-600' }[priority] || 'bg-gray-100 text-gray-600';
  }

  getPriorityLabel(priority: string): string {
    return { high: 'Urgent', medium: 'Moyen', low: 'Faible' }[priority] || priority;
  }

  getTypeLabel(type: string): string {
    return { offre: 'Offre', aide: 'Aide', stage: 'Stage', recrutement: 'Recrutement', candidat: 'Candidat' }[type] || type;
  }

  formatDate(date: Date | string): string {
    if (!date) return '—';
    const d = new Date(date);
    const diffMs = new Date().getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }
}
