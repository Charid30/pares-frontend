import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Location } from '@angular/common';
import { AuthService, User } from '../../../core/services/auth.service';

@Component({
  selector: 'app-access-denied',
  imports: [CommonModule, RouterModule],
  templateUrl: './access-denied.html',
  styleUrl: './access-denied.css',
})
export class AccessDenied implements OnInit {

  currentUser: User | null = null;
  currentUrl: string = '';

  private roleLabels: Record<string, string> = {
    ADMIN:    'Administrateur',
    CANDIDAT: 'Candidat',
  };

  private roleDashboards: Record<string, string> = {
    ADMIN:    '/admin/dashboard',
    CANDIDAT: '/dashboard/candidat',
  };

  constructor(
    private router: Router,
    private location: Location,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.currentUrl = this.router.url;
    this.currentUser = this.authService.getCurrentUser();
  }

  /** Libellé du rôle actuel */
  get roleLabel(): string {
    if (!this.currentUser?.role) return 'Inconnu';
    return this.roleLabels[this.currentUser.role] ?? this.currentUser.role;
  }

  /** Retourner au dashboard selon le rôle */
  goToDashboard(): void {
    if (!this.currentUser?.role) {
      this.router.navigate(['/auth/login']);
      return;
    }
    const path = this.roleDashboards[this.currentUser.role] ?? '/dashboard/agent';
    this.router.navigate([path]);
  }

  /** Retourner à la page précédente */
  goBack(): void {
    this.location.back();
  }

  /** Se déconnecter */
  logout(): void {
    this.authService.logout();
  }

  /** Aller à la page d'accueil publique */
  goHome(): void {
    this.router.navigate(['/accueil']);
  }
}
