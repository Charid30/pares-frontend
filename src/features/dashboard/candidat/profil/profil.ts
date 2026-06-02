import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ChangeDetectorRef } from '@angular/core';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';


@Component({
  selector: 'app-profil',
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
  templateUrl: './profil.html',
  styleUrl: './profil.css',
})
export class Profil {

  profilForm: FormGroup;
  profil: any = null;
  isEditMode = false;
  successMessage = '';
  errorMessage = '';
  
  stats = {
    totalCandidatures: 0,
    validees: 0,
    enAttente: 0
  };

  private apiUrl = environment.apiUrl;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {
    // Formulaire avec seulement les champs de la DB
    this.profilForm = this.fb.group({
      nom: ['', Validators.required],
      prenom: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      telephone: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadProfil();
    this.loadStats();
  }

  loadProfil(): void {
    this.http.get<any>(`${this.apiUrl}/candidat/profil`).subscribe({
      next: (response) => {
        if (response.success) {
          this.profil = response.data;
          this.profilForm.patchValue({
            nom: this.profil.nom,
            prenom: this.profil.prenom,
            email: this.profil.email,
            telephone: this.profil.telephone
          });
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erreur:', error);
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
            validees: response.data.candidaturesValidees,
            enAttente: response.data.candidaturesEnAttente
          };
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erreur stats:', error);
      }
    });
  }

  toggleEditMode(): void {
    if (this.isEditMode) {
      // Annuler : restaurer les valeurs
      this.profilForm.patchValue({
        nom: this.profil.nom,
        prenom: this.profil.prenom,
        email: this.profil.email,
        telephone: this.profil.telephone
      });
      this.errorMessage = '';
      this.successMessage = '';
    }
    this.isEditMode = !this.isEditMode;
    this.cdr.detectChanges();
  }

  sauvegarder(): void {
    if (this.profilForm.valid) {
      this.errorMessage = '';
      this.successMessage = '';

      this.http.put<any>(`${this.apiUrl}/candidat/profil`, this.profilForm.value).subscribe({
        next: (response) => {
          if (response.success) {
            this.successMessage = 'Profil mis à jour avec succès !';
            // Merger au lieu de remplacer pour préserver username, createdDate, ifu, etc.
            this.profil = { ...this.profil, ...response.data };
            this.isEditMode = false;
            this.cdr.detectChanges();
            setTimeout(() => {
              this.successMessage = '';
              this.cdr.detectChanges();
            }, 3000);
          } else {
            this.errorMessage = response.message || 'Erreur lors de la mise à jour';
            this.cdr.detectChanges();
          }
        },
        error: (error) => {
          console.error('Erreur:', error);
          this.errorMessage = 'Erreur lors de la mise à jour du profil';
          this.cdr.detectChanges();
        }
      });
    }
  }

  annuler(): void {
    this.profilForm.patchValue({
      nom: this.profil.nom,
      prenom: this.profil.prenom,
      email: this.profil.email,
      telephone: this.profil.telephone
    });
    this.errorMessage = '';
    this.successMessage = '';
    this.isEditMode = false;
    this.cdr.detectChanges();
  }
}
