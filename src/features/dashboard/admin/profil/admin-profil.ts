// admin-profil.ts — Page profil de l'administrateur
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-profil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-profil.html',
})
export class AdminProfil implements OnInit {

  currentUser: any = null;

  // Formulaire modification mot de passe
  ancienMotDePasse  = '';
  nouveauMotDePasse = '';
  confirmerMotDePasse = '';

  isLoadingPwd  = false;
  pwdSuccess    = '';
  pwdError      = '';

  showAncien    = false;
  showNouveau   = false;
  showConfirmer = false;

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.cdr.detectChanges();
    });
  }

  get initiale(): string {
    return this.currentUser?.username?.charAt(0).toUpperCase() || 'A';
  }

  get roleLabel(): string {
    const role = this.currentUser?.role;
    if (role === 'ADMIN') return 'Super Administrateur';
    return role ?? '—';
  }

  // ── Changement de mot de passe ────────────────────────────────────────────
  changerMotDePasse(): void {
    this.pwdSuccess = '';
    this.pwdError   = '';

    if (!this.ancienMotDePasse || !this.nouveauMotDePasse || !this.confirmerMotDePasse) {
      this.pwdError = 'Tous les champs sont requis.';
      this.cdr.detectChanges();
      return;
    }
    if (this.nouveauMotDePasse !== this.confirmerMotDePasse) {
      this.pwdError = 'Le nouveau mot de passe et la confirmation ne correspondent pas.';
      this.cdr.detectChanges();
      return;
    }
    if (this.nouveauMotDePasse.length < 8) {
      this.pwdError = 'Le nouveau mot de passe doit contenir au moins 8 caractères.';
      this.cdr.detectChanges();
      return;
    }

    this.isLoadingPwd = true;
    this.cdr.detectChanges();

    this.http.put<any>(`${environment.apiUrl}/settings/change-password`, {
      currentPassword: this.ancienMotDePasse,
      newPassword:     this.nouveauMotDePasse,
      confirmPassword: this.confirmerMotDePasse,
    }).subscribe({
      next: (res) => {
        this.isLoadingPwd = false;
        if (res.success) {
          this.pwdSuccess = 'Mot de passe modifié avec succès.';
          this.ancienMotDePasse   = '';
          this.nouveauMotDePasse  = '';
          this.confirmerMotDePasse = '';
        } else {
          this.pwdError = res.message || 'Erreur lors du changement.';
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoadingPwd = false;
        this.pwdError = err?.error?.message || 'Erreur lors du changement de mot de passe.';
        this.cdr.detectChanges();
      },
    });
  }

  get pwdForce(): { label: string; color: string; pct: number } {
    const pwd = this.nouveauMotDePasse;
    if (!pwd) return { label: '', color: 'bg-gray-200', pct: 0 };
    let score = 0;
    if (pwd.length >= 8)  score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { label: 'Faible',  color: 'bg-red-500',    pct: 25 };
    if (score <= 2) return { label: 'Moyen',   color: 'bg-orange-400', pct: 50 };
    if (score <= 3) return { label: 'Bon',     color: 'bg-yellow-400', pct: 75 };
    return              { label: 'Fort',    color: 'bg-green-500',  pct: 100 };
  }
}
