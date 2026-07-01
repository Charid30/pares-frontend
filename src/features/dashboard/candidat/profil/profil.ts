import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-profil',
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
  templateUrl: './profil.html',
  styleUrl: './profil.css',
})
export class Profil implements OnInit {

  profilForm: FormGroup;
  profil: any = null;
  isEditMode = false;
  successMessage = '';
  errorMessage = '';

  // ── Type de document fiscal sélectionné en mode édition ────────────────
  documentFiscalType: 'ifu' | 'recipisse' = 'ifu';

  stats = { totalCandidatures: 0, validees: 0, enAttente: 0 };

  private apiUrl = environment.apiUrl;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {
    this.profilForm = this.fb.group({
      nom:       ['', Validators.required],
      prenom:    ['', Validators.required],
      email:     ['', [Validators.required, Validators.email]],
      telephone: ['', Validators.required],
      username:  ['', [Validators.required, Validators.minLength(3)]],
      ifu:       ['', [Validators.pattern(/^\d{8}[A-Za-z]$/)]],
      recipisse: ['', [Validators.minLength(3), Validators.maxLength(50)]],
    });
  }

  ngOnInit(): void {
    this.loadProfil();
    this.loadStats();
  }

  // ── Getters cooldown username ─────────────────────────────────────────

  get canChangeUsername(): boolean {
    if (!this.profil?.lastUsernameChange) return true;
    const nextAllowed = new Date(this.profil.lastUsernameChange);
    nextAllowed.setDate(nextAllowed.getDate() + 25);
    return new Date() >= nextAllowed;
  }

  get daysUntilUsernameChange(): number {
    if (!this.profil?.lastUsernameChange) return 0;
    const nextAllowed = new Date(this.profil.lastUsernameChange);
    nextAllowed.setDate(nextAllowed.getDate() + 25);
    const diff = nextAllowed.getTime() - Date.now();
    return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
  }

  get nextUsernameChangeDate(): Date | null {
    if (!this.profil?.lastUsernameChange) return null;
    const d = new Date(this.profil.lastUsernameChange);
    d.setDate(d.getDate() + 25);
    return d;
  }

  // ── Chargement ────────────────────────────────────────────────────────

  loadProfil(): void {
    this.http.get<any>(`${this.apiUrl}/candidat/profil`).subscribe({
      next: (response) => {
        if (response.success) {
          this.profil = response.data;
          this.documentFiscalType = this.profil.recipisse ? 'recipisse' : 'ifu';
          this.patchForm();
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Erreur lors du chargement du profil';
        this.cdr.detectChanges();
      }
    });
  }

  loadStats(): void {
    this.http.get<any>(`${this.apiUrl}/candidat/stats`).subscribe({
      next: (response) => {
        if (response.success) {
          this.stats = {
            totalCandidatures: response.data.totalCandidatures,
            validees:          response.data.candidaturesValidees,
            enAttente:         response.data.candidaturesEnAttente,
          };
        }
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  private patchForm(): void {
    this.profilForm.patchValue({
      nom:       this.profil.nom,
      prenom:    this.profil.prenom,
      email:     this.profil.email,
      telephone: this.profil.telephone,
      username:  this.profil.username,
      ifu:       this.profil.ifu       || '',
      recipisse: this.profil.recipisse || '',
    });
    if (!this.canChangeUsername) {
      this.profilForm.get('username')?.disable();
    } else {
      this.profilForm.get('username')?.enable();
    }
  }

  // ── Sélecteur IFU / Récépissé ─────────────────────────────────────────

  setDocumentFiscalType(type: 'ifu' | 'recipisse'): void {
    this.documentFiscalType = type;
    if (type === 'ifu') {
      this.profilForm.get('recipisse')?.setValue('');
    } else {
      this.profilForm.get('ifu')?.setValue('');
    }
  }

  // ── Mode édition ──────────────────────────────────────────────────────

  toggleEditMode(): void {
    if (this.isEditMode) {
      this.patchForm();
      this.errorMessage = '';
      this.successMessage = '';
    }
    this.isEditMode = !this.isEditMode;
    this.cdr.detectChanges();
  }

  annuler(): void {
    this.patchForm();
    this.errorMessage = '';
    this.successMessage = '';
    this.isEditMode = false;
    this.cdr.detectChanges();
  }

  sauvegarder(): void {
    if (this.profilForm.invalid) return;

    this.errorMessage = '';
    this.successMessage = '';

    const raw = this.profilForm.getRawValue();
    const payload: any = {
      nom:       raw.nom,
      prenom:    raw.prenom,
      email:     raw.email,
      telephone: raw.telephone,
      username:  raw.username,
      ifu:       this.documentFiscalType === 'ifu'       ? (raw.ifu       || null) : null,
      recipisse: this.documentFiscalType === 'recipisse' ? (raw.recipisse || null) : null,
    };

    this.http.put<any>(`${this.apiUrl}/candidat/profil`, payload).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = 'Profil mis à jour avec succès !';
          this.profil = { ...this.profil, ...response.data };
          this.documentFiscalType = this.profil.recipisse ? 'recipisse' : 'ifu';
          this.patchForm();
          this.isEditMode = false;
          this.cdr.detectChanges();
          setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 3000);
        } else {
          this.errorMessage = response.message || 'Erreur lors de la mise à jour';
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Erreur lors de la mise à jour du profil';
        this.cdr.detectChanges();
      }
    });
  }
}
