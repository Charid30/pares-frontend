import { Component, OnInit, NgZone, ChangeDetectorRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { AuthService } from "../../../../core/services/auth.service";
import {
  RhService,
  DashboardMainStats,
  DashboardSecondaryStats,
  DashboardActivity,
  DashboardPendingItem
} from "../../../../core/services/rh.service";

@Component({
  selector: "app-rh-dashboard",
  imports: [CommonModule, RouterModule],
  templateUrl: "./rh-dashboard.html",
  styleUrl: "./rh-dashboard.css",
})
export class RhDashboard implements OnInit {
  currentUser: any = null;
  today = new Date();

  // États de chargement par section
  loadingStats = true;
  loadingSecondary = true;
  loadingActivities = true;
  loadingPending = true;
  error: string | null = null;

  // Données backend
  mainStats: DashboardMainStats | null = null;
  secondaryStats: DashboardSecondaryStats | null = null;
  activities: DashboardActivity[] = [];
  pendingItems: DashboardPendingItem[] = [];

  constructor(
    private authService: AuthService,
    private rhService: RhService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadDashboardData();
  }

  get loading(): boolean {
    return this.loadingStats && this.loadingSecondary && this.loadingActivities && this.loadingPending;
  }

  loadDashboardData(): void {
    this.loadingStats = true;
    this.loadingSecondary = true;
    this.loadingActivities = true;
    this.loadingPending = true;
    this.error = null;

    // Chargement indépendant : chaque section s'affiche dès qu'elle est prête
    this.rhService.getDashboardMainStats().subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) this.mainStats = res.data;
          this.loadingStats = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.loadingStats = false;
          this.error = err.status === 403
            ? 'Accès refusé (403) — Vérifiez les permissions du compte.'
            : 'Impossible de charger les données. Vérifiez votre connexion.';
          this.cdr.detectChanges();
        });
      }
    });

    this.rhService.getDashboardSecondaryStats().subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) this.secondaryStats = res.data;
          this.loadingSecondary = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.loadingSecondary = false;
          this.cdr.detectChanges();
        });
      }
    });

    this.rhService.getDashboardActivities(6).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) this.activities = res.data;
          this.loadingActivities = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.loadingActivities = false;
          this.cdr.detectChanges();
        });
      }
    });

    this.rhService.getDashboardPending(6).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) this.pendingItems = res.data;
          this.loadingPending = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.loadingPending = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  get greeting(): string {
    const h = this.today.getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  }

  getActivityIcon(type: string): string {
    switch (type) {
      case 'candidat':    return 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z';
      case 'stage':       return 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253';
      case 'recrutement': return 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
      default:            return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  }

  getActivityDotColor(type: string): string {
    switch (type) {
      case 'candidat':    return 'bg-secondary-500';
      case 'stage':       return 'bg-blue-500';
      case 'recrutement': return 'bg-primary-500';
      default:            return 'bg-gray-400';
    }
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'high':   return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-amber-100 text-amber-700';
      case 'low':    return 'bg-green-100 text-green-700';
      default:       return 'bg-gray-100 text-gray-600';
    }
  }

  getPriorityLabel(priority: string): string {
    switch (priority) {
      case 'high':   return 'Urgent';
      case 'medium': return 'Moyen';
      case 'low':    return 'Normal';
      default:       return priority;
    }
  }

  getPendingTypeIcon(type: string): string {
    switch (type) {
      case 'stage':       return 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253';
      case 'recrutement': return 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
      case 'aide':        return 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z';
      default:            return 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2';
    }
  }

  formatTimeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }
}
