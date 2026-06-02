// dashboard-layout.ts — Layout Agent Commercial / Financier
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { environment } from '../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { Subscription, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
  badgeColor?: string;
  exact?: boolean;
}

@Component({
  selector: 'app-dashboard-layout',
  imports: [RouterOutlet, CommonModule, RouterModule],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.css',
})
export class DashboardLayout implements OnInit, OnDestroy {
  readonly appVersion = environment.appVersion;
  currentUser: any = null;
  sidebarOpen = true;
  sidebarMobileOpen = false;
  userMenuOpen = false;

  menuItems: MenuItem[] = [];
  private refreshSub?: Subscription;

  // Menus par rôle
  private readonly MENUS: Record<string, MenuItem[]> = {
    AGENT_COMMERCIAL: [
      {
        label: 'Tableau de bord',
        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
        route: '/dashboard/commercial',
        exact: true,
      },
      {
        label: 'Offres commerciales',
        icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
        route: '/dashboard/commercial/offres',
        exact: false,
      },
      {
        label: 'Candidatures',
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
        route: '/dashboard/commercial/candidatures',
        exact: false,
        badgeColor: 'bg-orange-500',
      },
      {
        label: 'Activités & Suivi',
        icon: 'M13 10V3L4 14h7v7l9-11h-7z',
        route: '/dashboard/commercial/activites',
        exact: false,
      },
    ],
    AGENT_FINANCIER: [
      {
        label: 'Tableau de bord',
        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
        route: '/dashboard/financier',
        exact: true,
      },
      {
        label: 'Aides sociales',
        icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
        route: '/dashboard/financier/aides-sociales',
        exact: false,
      },
      {
        label: 'Candidatures',
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
        route: '/dashboard/financier/candidatures',
        exact: false,
        badgeColor: 'bg-orange-500',
      },
      {
        label: 'Activités & Suivi',
        icon: 'M13 10V3L4 14h7v7l9-11h-7z',
        route: '/dashboard/financier/activites',
        exact: false,
      },
    ],
  };

  get role(): string {
    return this.currentUser?.role?.accronyme || this.currentUser?.role || '';
  }

  get roleLabel(): string {
    if (this.role === 'AGENT_COMMERCIAL') return 'Agent Commercial';
    if (this.role === 'AGENT_FINANCIER') return 'Agent Financier';
    return 'Agent';
  }

  get roleSubtitle(): string {
    if (this.role === 'AGENT_COMMERCIAL') return 'Offres & Candidatures';
    if (this.role === 'AGENT_FINANCIER') return 'Aides Sociales & Suivi';
    return '';
  }

  get sidebarGradient(): string {
    return this.role === 'AGENT_FINANCIER'
      ? 'from-emerald-900 to-emerald-950'
      : 'from-blue-900 to-blue-950';
  }

  get headerGradient(): string {
    return this.role === 'AGENT_FINANCIER'
      ? 'from-emerald-600 to-emerald-700'
      : 'from-blue-600 to-blue-700';
  }

  get accentColor(): string {
    return this.role === 'AGENT_FINANCIER' ? 'bg-emerald-600' : 'bg-blue-600';
  }

  get textAccent(): string {
    return this.role === 'AGENT_FINANCIER' ? 'text-emerald-200' : 'text-blue-200';
  }

  get avatarGradient(): string {
    return this.role === 'AGENT_FINANCIER'
      ? 'from-emerald-400 to-emerald-600'
      : 'from-blue-400 to-blue-600';
  }

  get dropdownHeaderBg(): string {
    return this.role === 'AGENT_FINANCIER' ? 'from-emerald-50 to-teal-50' : 'from-blue-50 to-sky-50';
  }

  get dropdownRolePill(): string {
    return this.role === 'AGENT_FINANCIER'
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-blue-100 text-blue-700';
  }

  constructor(
    private authService: AuthService,
    private dashboardService: DashboardService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();

    if (!this.currentUser) {
      this.router.navigate(['/auth/login']);
      return;
    }

    // Charger le menu selon le rôle
    this.menuItems = this.MENUS[this.role] || this.MENUS['AGENT_COMMERCIAL'];

    // Fermer la sidebar sur mobile par défaut
    if (window.innerWidth < 1024) {
      this.sidebarOpen = false;
    }

    // Charger le badge des éléments en attente
    this.loadPendingBadge();

    // Refresh badge toutes les 60 secondes
    this.refreshSub = interval(60000).pipe(
      switchMap(() => this.dashboardService.getPendingItems(50))
    ).subscribe({
      next: (res) => { if (res.success) this.updatePendingBadge(res.data.length); },
      error: () => {}
    });
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  private loadPendingBadge(): void {
    this.dashboardService.getPendingItems(50).subscribe({
      next: (res) => { if (res.success) this.updatePendingBadge(res.data.length); },
      error: () => {}
    });
  }

  private updatePendingBadge(count: number): void {
    this.menuItems = this.menuItems.map(item =>
      item.route.endsWith('/activites')
        ? { ...item, badge: count > 0 ? count : undefined }
        : item
    );
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.userMenuOpen && !target.closest('[data-user-menu]')) {
      this.userMenuOpen = false;
    }
  }

  toggleSidebar(): void { this.sidebarOpen = !this.sidebarOpen; }
  toggleSidebarMobile(): void { this.sidebarMobileOpen = !this.sidebarMobileOpen; }
  closeSidebarMobile(): void { this.sidebarMobileOpen = false; }
  toggleUserMenu(): void { this.userMenuOpen = !this.userMenuOpen; }

  logout(): void {
    this.authService.logout();
  }
}
