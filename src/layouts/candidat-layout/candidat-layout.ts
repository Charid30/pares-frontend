import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { NotificationBellComponent } from '../../shared/components/notification-bell/notification-bell';
import { CommonModule } from '@angular/common';
import { environment } from '../../environments/environment';

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

  // ── Popup genre (anciens comptes sans genre) ──────────────────────────
  showGenrePopup = false;
  genreSelection = '';
  savingGenre = false;
  genreSuccess = false;  // état succès avant fermeture

  private apiUrl = environment.apiUrl;

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    public notificationService: NotificationService,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();

    if (!this.currentUser) {
      this.router.navigate(['/auth/login']);
      return;
    }

    // Vérifier si le genre est renseigné — sinon afficher le popup (anciens comptes)
    this.checkGenre();

    // Démarrer le polling des notifications in-app
    this.notificationService.startPolling(30000);
  }

  checkGenre(): void {
    // Vérifier via l'API profil si genre est null
    this.http.get<any>(`${this.apiUrl}/candidat/profil`).subscribe({
      next: (res) => {
        if (res.success && !res.data?.genre) {
          this.showGenrePopup = true;
        }
      },
      error: () => {} // Silencieux
    });
  }

  sauvegarderGenre(): void {
    if (!this.genreSelection) return;
    this.savingGenre = true;
    this.genreSuccess = false;
    this.http.put<any>(`${this.apiUrl}/candidat/profil`, { genre: this.genreSelection }).subscribe({
      next: (res) => {
        this.savingGenre = false;
        if (res.success) {
          // 1. Afficher le message de succès dans le popup
          this.genreSuccess = true;
          this.cdr.detectChanges();

          // 2. Mettre à jour le user en session
          const user = this.authService.getCurrentUser();
          if (user) {
            (user as any).genre = this.genreSelection;
            this.authService.updateCurrentUser(user);
          }

          // 3. Fermer le popup après 1.5s
          setTimeout(() => {
            this.showGenrePopup = false;
            this.genreSuccess = false;
            this.cdr.detectChanges();
          }, 1500);
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.savingGenre = false;
        this.cdr.detectChanges();
      }
    });
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
