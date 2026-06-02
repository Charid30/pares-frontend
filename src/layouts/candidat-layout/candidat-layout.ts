import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { NotificationBellComponent } from '../../shared/components/notification-bell/notification-bell';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-candidat-layout',
  imports: [RouterOutlet, CommonModule, RouterModule, NotificationBellComponent],
  templateUrl: './candidat-layout.html',
  styleUrl: './candidat-layout.css',
})
export class CandidatLayout implements OnInit, OnDestroy {

  currentUser: any = null;
  mobileMenuOpen = false;
  userMenuOpen = false;
  showOpportunitesMenu = false;  // Pour desktop hover
  opportunitesMenuMobileOpen = false;  // Pour mobile click

  constructor(
    private authService: AuthService,
    private router: Router,
    public notificationService: NotificationService,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();

    if (!this.currentUser) {
      this.router.navigate(['/auth/login']);
    }

    // Démarrer le polling des notifications in-app
    this.notificationService.startPolling(30000);
  }

  ngOnDestroy(): void {
    this.notificationService.stopPolling();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    if (this.mobileMenuOpen) {
      this.userMenuOpen = false;
    }
  }

  toggleUserMenu(): void {
    this.userMenuOpen = !this.userMenuOpen;
  }

  toggleOpportunitesMenuMobile(): void {
    this.opportunitesMenuMobileOpen = !this.opportunitesMenuMobileOpen;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  get userInitials(): string {
    const user = this.currentUser;
    if (!user) return '?';
    const p = user.prenom?.charAt(0) || '';
    const n = user.nom?.charAt(0) || '';
    return (p + n).toUpperCase() || user.username?.charAt(0).toUpperCase() || '?';
  }

  get fullName(): string {
    const user = this.currentUser;
    if (!user) return '';
    return `${user.prenom || ''} ${user.nom || ''}`.trim() || user.username || '';
  }
}
