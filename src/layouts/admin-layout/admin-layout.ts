import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule, RouterOutlet, NavigationStart } from '@angular/router';
import { environment } from '../../environments/environment';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { AdminDashboardService, MenuBadges } from '../../core/services/admin-dashboard.service';
import { NotificationService } from '../../core/services/notification.service';
import { SearchService } from '../../core/services/search.service';
import { NotificationBellComponent } from '../../shared/components/notification-bell/notification-bell';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';

interface MenuItem {
  label: string;
  icon: string;
  route?: string;
  children?: MenuItem[];
  badge?: number;
  badgeColor?: string;
  badgeKey?: string; // Clé pour le badge dynamique
}

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, CommonModule, RouterModule, FormsModule, NotificationBellComponent],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout implements OnInit, OnDestroy {
  readonly appVersion = environment.appVersion;
  currentUser: any = null;
  sidebarOpen = true;
  sidebarMobileOpen = false;
  userMenuOpen = false;
  expandedMenus: { [key: string]: boolean } = {};
  private badgesSubscription?: Subscription;
  private activitiesSubscription?: Subscription;

  // ── Recherche globale ─────────────────────────────────────
  globalSearchTerm = '';
  showMobileSearch = false;

  // ── Centre de notifications (cloche) ─────────────────────
  notifOpen = false;
  notifLoading = false;
  recentActivities: any[] = [];

  // Badges dynamiques
  menuBadges: MenuBadges = {
    stagesEnAttente: 0,
    rapportsEnAttente: 0,
    candidaturesEnAttente: 0,
    stagesEnCours: 0,
    audiencesEnAttente: 0
  };

  menuItems: MenuItem[] = [
    {
      label: 'Tableau de bord',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      route: '/admin/dashboard'
    },
    {
      label: 'Candidats',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      route: '/admin/candidats'
    },
    {
      label: 'Stages',
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      route: '/admin/stages',
      badgeKey: 'stagesEnAttente',
      badgeColor: 'bg-yellow-500'
    },
    {
      label: 'Suivi des stages',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      route: '/admin/suivi-stages',
      badgeKey: 'stagesEnCours',
      badgeColor: 'bg-indigo-500'
    },
    {
      label: 'Recrutements',
      icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      route: '/admin/recrutements',
      badgeKey: 'candidaturesEnAttente',
      badgeColor: 'bg-red-500'
    },
    {
      label: 'Candidatures reçues',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      route: '/admin/candidatures-recrutement',
      badgeKey: 'candidaturesEnAttente',
      badgeColor: 'bg-red-500'
    },
    {
      label: 'Offres Commerciales',
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      route: '/admin/offres-commerciales'
    },
    {
      label: 'Aides Sociales',
      icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
      route: '/admin/aides-sociales'
    },
    {
      label: 'Audiences',
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      route: '/admin/audiences',
      badgeKey: 'audiencesEnAttente',
      badgeColor: 'bg-blue-500'
    },
    {
      label: 'Agents',
      icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      route: '/admin/utilisateurs'
    },
    {
      label: 'Services',
      icon: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
      route: '/admin/services'
    },
    {
      label: 'Permissions',
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      route: '/admin/permissions'
    },
    {
      label: 'Journal d\'activité',
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      route: '/admin/audit'
    },
    {
      label: 'Sécurité',
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      route: '/admin/securite'
    },
    {
      label: 'Paramètres',
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      route: '/admin/parametres'
    }
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private dashboardService: AdminDashboardService,
    private cdr: ChangeDetectorRef,
    public notificationService: NotificationService,
    public searchService: SearchService,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();

    if (!this.currentUser) {
      this.router.navigate(['/auth/login']);
    }

    // Responsive: fermer la sidebar sur mobile par défaut
    if (window.innerWidth < 1024) {
      this.sidebarOpen = false;
    }

    // Réinitialiser le champ de recherche et fermer les menus à chaque navigation
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.globalSearchTerm = '';
        this.showMobileSearch = false;
        this.userMenuOpen = false;
        this.cdr.detectChanges();
      }
    });

    // Charger les badges et activités récentes au démarrage
    this.loadMenuBadges();
    this.loadRecentActivities();

    // Rafraîchir badges toutes les 30 secondes
    this.badgesSubscription = interval(30000).pipe(
      switchMap(() => this.dashboardService.getMenuBadges())
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.menuBadges = response.data;
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Erreur rafraîchissement badges:', err)
    });

    // Rafraîchir les activités récentes toutes les 30 secondes
    this.activitiesSubscription = interval(30000).pipe(
      switchMap(() => this.dashboardService.getRecentActivities())
    ).subscribe({
      next: (r) => {
        if (r.success) { this.recentActivities = r.data || []; this.cdr.detectChanges(); }
      },
      error: () => {}
    });

    // Démarrer le polling des notifications in-app (partagé avec le composant cloche)
    this.notificationService.startPolling(30000);
  }

  ngOnDestroy(): void {
    this.badgesSubscription?.unsubscribe();
    this.activitiesSubscription?.unsubscribe();
    this.notificationService.stopPolling();
  }

  loadMenuBadges(): void {
    this.dashboardService.getMenuBadges().subscribe({
      next: (response) => {
        if (response.success) {
          this.menuBadges = response.data;
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Erreur chargement badges:', err)
    });
  }

  getBadgeValue(item: MenuItem): number {
    if (!item.badgeKey) return 0;
    return (this.menuBadges as any)[item.badgeKey] || 0;
  }

  onGlobalSearch(): void {
    this.searchService.setTerm(this.globalSearchTerm);
  }

  toggleMobileSearch(): void {
    this.showMobileSearch = !this.showMobileSearch;
    if (!this.showMobileSearch) {
      this.globalSearchTerm = '';
      this.searchService.clear();
    }
    this.cdr.detectChanges();
  }

  clearSearch(): void {
    this.globalSearchTerm = '';
    this.searchService.clear();
    this.showMobileSearch = false;
    this.cdr.detectChanges();
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleSidebarMobile(): void {
    this.sidebarMobileOpen = !this.sidebarMobileOpen;
  }

  toggleUserMenu(): void {
    this.userMenuOpen = !this.userMenuOpen;
    this.cdr.detectChanges();
  }

  toggleSubmenu(label: string): void {
    this.expandedMenus[label] = !this.expandedMenus[label];
    this.cdr.detectChanges();
  }

  isSubmenuExpanded(label: string): boolean {
    return this.expandedMenus[label] || false;
  }

  logout(): void {
    this.authService.logout();
  }

  closeSidebarMobile(): void {
    this.sidebarMobileOpen = false;
    this.cdr.detectChanges();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    let changed = false;
    if (this.userMenuOpen && !target.closest('[data-user-menu]')) {
      this.userMenuOpen = false;
      changed = true;
    }
    if (this.notifOpen && !target.closest('[data-notif-panel]')) {
      this.notifOpen = false;
      changed = true;
    }
    if (changed) this.cdr.detectChanges();
  }

  toggleNotifPanel(): void {
    this.notifOpen = !this.notifOpen;
    this.cdr.detectChanges();
  }

  loadRecentActivities(): void {
    this.notifLoading = true;
    this.cdr.detectChanges();
    this.dashboardService.getRecentActivities().subscribe({
      next: (r) => {
        this.recentActivities = r.success ? (r.data || []) : [];
        this.notifLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.recentActivities = [];
        this.notifLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  getActivityIcon(type: string): string {
    const map: Record<string, string> = {
      candidat:    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      stage:       'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      recrutement: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    };
    return map[type] || 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
  }

  getActivityColor(type: string): string {
    const map: Record<string, string> = {
      candidat:    'bg-violet-100 text-violet-700',
      stage:       'bg-emerald-100 text-emerald-700',
      recrutement: 'bg-blue-100 text-blue-700',
    };
    return map[type] || 'bg-gray-100 text-gray-600';
  }

  getStatusColor(status: string): string {
    const map: Record<string, string> = {
      SOUMISE: 'bg-blue-50 text-blue-600', EN_VERIFICATION: 'bg-yellow-50 text-yellow-600',
      ACCEPTEE: 'bg-green-50 text-green-700', REJETEE: 'bg-red-50 text-red-600',
      EN_ATTENTE: 'bg-yellow-50 text-yellow-600', EN_COURS: 'bg-indigo-50 text-indigo-600',
      TERMINE: 'bg-green-50 text-green-700', ACTIVE: 'bg-green-50 text-green-700',
    };
    return map[status] || 'bg-gray-50 text-gray-500';
  }

  timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return "À l'instant";
    if (m < 60) return `Il y a ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `Il y a ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7)  return `Il y a ${d}j`;
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }
}
