import { ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
})
export class ForgotPassword implements OnInit, OnDestroy {
  // step 1 = saisie email, step 2 = email envoyé OU formulaire nouveau mot de passe (via lien), step 3 = succès
  step: 1 | 2 | 3 = 1;
  isTokenMode = false;   // true quand l'utilisateur arrive via le lien email (?token=...)
  resetToken = '';

  emailForm!: FormGroup;
  passwordForm!: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;
  showPassword = false;
  showConfirmPassword = false;

  // Cooldown entre deux demandes de reset
  cooldownSeconds = 0;
  private _cooldownTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.passwordForm = this.fb.group({
      newPassword: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
      ]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    // Si un token est présent dans l'URL (?token=...), aller directement au formulaire de réinitialisation
    const token = this.route.snapshot.queryParams['token'];
    if (token) {
      this.isTokenMode = true;
      this.resetToken = token;
      this.step = 2;
    }
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const newPassword = control.get('newPassword')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }

  onCheckEmail(): void {
    if (this.emailForm.valid) {
      this.isLoading = true;
      this.errorMessage = null;
      const email = this.emailForm.get('email')?.value;

      this.authService.checkEmailForReset(email).subscribe({
        next: (response: any) => {
          this.isLoading = false;

          // Email introuvable → afficher l'erreur sur le formulaire, ne pas changer d'étape
          if (response?.data?.notFound) {
            this.errorMessage = 'Aucun compte n\'est associé à cette adresse email.';
            this.cdr.detectChanges();
            return;
          }

          // Email trouvé → passer à l'étape 2 avec countdown
          this.step = 2;
          const wait = response?.data?.waitSeconds ?? 240;
          this._startCooldown(wait);
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.isLoading = false;
          if (error.status === 0) {
            this.errorMessage = 'Impossible de contacter le serveur. Vérifiez votre connexion.';
          } else {
            this.errorMessage = error.error?.message || 'Une erreur est survenue. Veuillez réessayer.';
          }
          this.cdr.detectChanges();
        }
      });
    }
  }

  private _startCooldown(seconds: number): void {
    this._clearCooldown();
    this.cooldownSeconds = seconds;
    this._cooldownTimer = setInterval(() => {
      this.cooldownSeconds--;
      this.cdr.detectChanges();
      if (this.cooldownSeconds <= 0) this._clearCooldown();
    }, 1000);
  }

  private _clearCooldown(): void {
    if (this._cooldownTimer) {
      clearInterval(this._cooldownTimer);
      this._cooldownTimer = null;
    }
    this.cooldownSeconds = 0;
  }

  ngOnDestroy(): void {
    this._clearCooldown();
  }

  onResetPassword(): void {
    if (this.passwordForm.valid) {
      this.isLoading = true;
      this.errorMessage = null;
      const newPassword = this.passwordForm.get('newPassword')?.value;

      this.authService.resetPassword(this.resetToken, newPassword).subscribe({
        next: (response) => {
          this.isLoading = false;
          if (response.success) {
            this.step = 3;
          } else {
            this.errorMessage = response.message || 'Erreur lors de la réinitialisation.';
          }
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'Une erreur est survenue. Veuillez réessayer.';
          this.cdr.detectChanges();
        }
      });
    }
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }
}
