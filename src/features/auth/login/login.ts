import { Component, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
 
    loginForm!: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    // Rediriger si déjà connecté
    if (this.authService.isLoggedIn()) {
      this.redirectToDashboard();
      return;
    }

    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]],
      rememberMe: [false]
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = null;

      const { username, password, rememberMe } = this.loginForm.value;

      this.authService.login(username, password, !!rememberMe).subscribe({
        next: (response) => {
          this.ngZone.run(() => {
            this.isLoading = false;
            if (response.success) {
              this.redirectToDashboard();
            }
            this.cdr.detectChanges();
          });
        },
        error: (error) => {
          this.ngZone.run(() => {
            this.isLoading = false;
            if (error.status === 401) {
              this.errorMessage = 'Nom d\'utilisateur ou mot de passe incorrect';
            } else if (error.status === 400 && error.error?.message?.includes('suspect')) {
              this.errorMessage = '⚠️ Contenu suspect détecté. Vos actions ont été enregistrées et votre IP surveillée.';
            } else if (error.status === 403 && error.error?.message?.includes('banni')) {
              this.errorMessage = error.error.message;
            } else if (error.status === 0) {
              this.errorMessage = 'Impossible de contacter le serveur. Vérifiez votre connexion.';
            } else {
              this.errorMessage = error.error?.message || 'Une erreur est survenue lors de la connexion';
            }
            this.cdr.detectChanges();
          });
        }
      });
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  private redirectToDashboard(): void {
    const user = this.authService.getCurrentUser();
    
    if (!user) {
      this.router.navigate(['/accueil']);
      return;
    }

    switch (this.authService.getEffectiveDashboardRole(user)) {
      case 'CANDIDAT': this.router.navigate(['/dashboard/candidat']); break;
      case 'ADMIN':    this.router.navigate(['/admin/dashboard']);     break;
      default:         this.router.navigate(['/dashboard/agent']);
    }
  }


}
