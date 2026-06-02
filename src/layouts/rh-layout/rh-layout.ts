import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { environment } from '../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { NotificationBellComponent } from '../../shared/components/notification-bell/notification-bell';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
  badgeColor?: string;
}

@Component({
  selector: 'app-rh-layout',
  imports: [RouterOutlet, CommonModule, RouterModule, NotificationBellComponent],
  templateUrl: './rh-layout.html',
  styleUrl: './rh-layout.css',
})
export class RhLayout implements OnInit, OnDestroy {
  readonly appVersion = environment.appVersion;
  currentUser: any = null;
  sidebarOpen = true;
  sidebarMobileOpen = false;
  userMenuOpen = false;

  menuItems: MenuItem[] = [
    {
      label: 'Tableau de bord',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      route: '/dashboard/rh'
    },
    {
      label: 'Recrutements',
      icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      route: '/dashboard/rh/recrutements',
      badgeColor: 'bg-rose-500'
    },
    {
      label: 'Candidats',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      route: '/dashboard/rh/candidats'
    },
    {
      label: 'Offres d\'emploi',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      route: '/dashboard/rh/offres'
    },
    {
      label: 'Aides Sociales',
      icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
      route: '/dashboard/rh/aides-sociales'
    },
    {
      label: 'Rapports',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      route: '/dashboard/rh/rapports'
    },
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    public notificationService: NotificationService,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.router.navigate(['/auth/login']);
      return;
    }
    if (window.innerWidth < 1024) {
      this.sidebarOpen = false;
    }
    this.notificationService.startPolling(30000);
  }

  ngOnDestroy(): void {
    this.notificationService.stopPolling();
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
  toggleUserMenu(): void { this.userMenuOpen = !this.userMenuOpen; this.cdr.detectChanges(); }

  logout(): void {
    this.authService.logout();
  }
}
