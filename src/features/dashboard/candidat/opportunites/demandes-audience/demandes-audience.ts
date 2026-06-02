import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { environment } from '../../../../../environments/environment';

interface DemandeAudience {
  iddemande: number;
  modeSoumission: 'FICHIER' | 'FORMULAIRE';
  // Mode FICHIER
  fichier_filename: string | null;
  fichier_size: number | null;
  // Mode FORMULAIRE
  pourM: string | null;
  pendant: 'ABSENCE' | 'PRESENCE' | null;
  contact: string | null;
  actionCochee: string | null;
  motif: string | null;
  // Commun
  dateAudience: string;
  heureAudience: string;
  status: 'EN_ATTENTE' | 'ACCEPTE' | 'REJETE' | 'ANNULE';
  commentaireAdmin: string | null;
  createdDate: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Labels des actions cochées
const ACTION_LABELS: Record<string, string> = {
  A_TELEPHONER: 'À téléphoner',
  EST_PASSE: 'Est passé(e)',
  RAPPELLERA: 'Rappellera',
  DEMANDE_RAPPEL: 'Demande de le rappeler',
  VEUT_VOIR: 'Veut vous voir',
  URGENT: 'URGENT',
};

@Component({
  selector: 'app-demandes-audience',
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  templateUrl: './demandes-audience.html',
  styleUrl: './demandes-audience.css',
})
export class DemandesAudience implements OnInit {

  // ── État ──────────────────────────────────────────────────
  isLoading = false;
  isSubmitting = false;
  showModal = false;

  // ── Données ───────────────────────────────────────────────
  mesDemandes: DemandeAudience[] = [];
  pagination: Pagination = { total: 0, page: 1, limit: 10, totalPages: 0, hasNext: false, hasPrev: false };
  pageSize = 10;

  // ── Modal — étapes ────────────────────────────────────────
  etape: 1 | 2 = 1;  // Étape 1 : choix du mode | Étape 2 : formulaire
  modeSoumission: 'FICHIER' | 'FORMULAIRE' | null = null;

  // ── Formulaires ───────────────────────────────────────────
  fichierForm: FormGroup;
  ficheForm: FormGroup;

  // ── Fichier joint ─────────────────────────────────────────
  fichierJoint: File | null = null;
  fichierJointName = '';
  fichierJointError = '';

  // ── Actions cochées (fiche message) ──────────────────────
  readonly ACTIONS = [
    { value: 'A_TELEPHONER',  label: 'À téléphoner' },
    { value: 'EST_PASSE',     label: 'Est passé(e)' },
    { value: 'RAPPELLERA',    label: 'Rappellera' },
    { value: 'DEMANDE_RAPPEL',label: 'Demande de le rappeler' },
    { value: 'VEUT_VOIR',     label: 'Veut vous voir' },
    { value: 'URGENT',        label: '🔴 URGENT' },
  ];

  // ── Détail ────────────────────────────────────────────────
  showDetail = false;
  demandeDetail: DemandeAudience | null = null;

  // ── Toast ─────────────────────────────────────────────────
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  private toastTimeout: any;

  private apiUrl = environment.apiUrl;

  readonly ACTION_LABELS = ACTION_LABELS;

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
  ) {
    // Formulaire mode FICHIER
    this.fichierForm = this.fb.group({
      dateAudience: ['', Validators.required],
      heureAudience: ['', Validators.required],
    });

    // Formulaire mode FORMULAIRE (fiche message)
    this.ficheForm = this.fb.group({
      pourM:        ['', [Validators.required, Validators.minLength(2)]],
      dateAudience: ['', Validators.required],
      heureAudience:['', Validators.required],
      pendant:      ['', Validators.required],
      contact:      [''],
      actionCochee: ['', Validators.required],
      motif:        ['', [Validators.required, Validators.minLength(5)]],
    });
  }

  ngOnInit(): void {
    this.loadMesDemandes();
  }

  // ── Chargement ────────────────────────────────────────────
  loadMesDemandes(): void {
    this.isLoading = true;
    const params = { page: String(this.pagination.page), limit: String(this.pageSize) };
    this.http.get<any>(`${this.apiUrl}/demandes-audience/mes-demandes`, { params }).subscribe({
      next: (res) => {
        if (res.success) {
          this.mesDemandes = res.data;
          this.pagination = res.pagination;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[DemandesAudience] loadMesDemandes:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ── Pagination ────────────────────────────────────────────
  changerPage(page: number): void {
    if (page < 1 || page > this.pagination.totalPages) return;
    this.pagination.page = page;
    this.loadMesDemandes();
  }

  // ── Modal ─────────────────────────────────────────────────
  ouvrirModal(): void {
    this.etape = 1;
    this.modeSoumission = null;
    this.fichierForm.reset();
    this.ficheForm.reset();
    this.fichierJoint = null;
    this.fichierJointName = '';
    this.fichierJointError = '';
    this.showModal = true;
    this.cdr.detectChanges();
  }

  fermerModal(): void {
    this.showModal = false;
  }

  choisirMode(mode: 'FICHIER' | 'FORMULAIRE'): void {
    this.modeSoumission = mode;
    this.etape = 2;
    this.cdr.detectChanges();
  }

  retourEtape1(): void {
    this.etape = 1;
    this.modeSoumission = null;
    this.cdr.detectChanges();
  }

  // ── Fichier ───────────────────────────────────────────────
  onFichierSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      this.fichierJointError = 'Seuls les fichiers PDF sont acceptés';
      this.fichierJoint = null;
      this.fichierJointName = '';
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.fichierJointError = 'Le fichier dépasse la taille maximale de 5 Mo';
      this.fichierJoint = null;
      this.fichierJointName = '';
      input.value = '';
      return;
    }

    this.fichierJoint = file;
    this.fichierJointName = file.name;
    this.fichierJointError = '';
    this.cdr.detectChanges();
  }

  removeFichier(): void {
    this.fichierJoint = null;
    this.fichierJointName = '';
    this.fichierJointError = '';
  }

  // ── Validation ────────────────────────────────────────────
  isFormValid(): boolean {
    if (this.modeSoumission === 'FICHIER') {
      return this.fichierForm.valid && !!this.fichierJoint;
    }
    if (this.modeSoumission === 'FORMULAIRE') {
      return this.ficheForm.valid;
    }
    return false;
  }

  // ── Soumission ────────────────────────────────────────────
  soumettreDemande(): void {
    if (!this.isFormValid()) {
      this.showToast('Veuillez remplir tous les champs obligatoires', 'error');
      return;
    }

    this.isSubmitting = true;
    const formData = new FormData();
    formData.append('modeSoumission', this.modeSoumission!);

    if (this.modeSoumission === 'FICHIER') {
      const vals = this.fichierForm.value;
      formData.append('dateAudience', vals.dateAudience);
      formData.append('heureAudience', vals.heureAudience);
      formData.append('fichier', this.fichierJoint!);
    } else {
      const vals = this.ficheForm.value;
      formData.append('dateAudience', vals.dateAudience);
      formData.append('heureAudience', vals.heureAudience);
      formData.append('pourM', vals.pourM);
      formData.append('pendant', vals.pendant);
      if (vals.contact) formData.append('contact', vals.contact);
      formData.append('actionCochee', vals.actionCochee);
      formData.append('motif', vals.motif);
    }

    this.http.post<any>(`${this.apiUrl}/demandes-audience/candidat`, formData).subscribe({
      next: (res) => {
        if (res.success) {
          this.showToast('Votre demande d\'audience a été soumise avec succès !', 'success');
          this.fermerModal();
          this.pagination.page = 1;
          this.loadMesDemandes();
        }
        this.isSubmitting = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.showToast(err.error?.message || 'Erreur lors de la soumission', 'error');
        this.isSubmitting = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ── Détail ────────────────────────────────────────────────
  voirDetail(demande: DemandeAudience): void {
    this.demandeDetail = demande;
    this.showDetail = true;
    this.cdr.detectChanges();
  }

  fermerDetail(): void {
    this.showDetail = false;
    this.demandeDetail = null;
  }

  // ── Annulation ────────────────────────────────────────────
  annulerDemande(demande: DemandeAudience): void {
    if (demande.status !== 'EN_ATTENTE') return;

    this.http.put<any>(`${this.apiUrl}/demandes-audience/${demande.iddemande}/annuler`, {}).subscribe({
      next: (res) => {
        if (res.success) {
          demande.status = 'ANNULE';
          this.showToast('Demande annulée', 'success');
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        this.showToast(err.error?.message || 'Erreur lors de l\'annulation', 'error');
        this.cdr.detectChanges();
      },
    });
  }

  // ── Helpers UI ────────────────────────────────────────────
  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      EN_ATTENTE: 'bg-amber-100 text-amber-700 border border-amber-200',
      ACCEPTE:    'bg-green-100 text-green-700 border border-green-200',
      REJETE:     'bg-red-100 text-red-700 border border-red-200',
      ANNULE:     'bg-gray-100 text-gray-500 border border-gray-200',
    };
    return classes[status] ?? 'bg-gray-100 text-gray-500';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      EN_ATTENTE: 'En attente',
      ACCEPTE:    'Acceptée',
      REJETE:     'Rejetée',
      ANNULE:     'Annulée',
    };
    return labels[status] ?? status;
  }

  getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      EN_ATTENTE: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      ACCEPTE:    'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      REJETE:     'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
      ANNULE:     'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
    };
    return icons[status] ?? '';
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  }

  getActionLabel(action: string): string {
    return ACTION_LABELS[action] ?? action;
  }

  // ── Toast ─────────────────────────────────────────────────
  showToast(message: string, type: 'success' | 'error'): void {
    this.toastMessage = message;
    this.toastType = type;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => this.fermerToast(), 5000);
    this.cdr.detectChanges();
  }

  fermerToast(): void {
    this.toastMessage = '';
    this.cdr.detectChanges();
  }

  minVal(a: number, b: number): number { return Math.min(a, b); }

  // Comptes par statut (pour les badges en-tête)
  get countEnAttente(): number { return this.mesDemandes.filter(d => d.status === 'EN_ATTENTE').length; }
  get countAccepte(): number   { return this.mesDemandes.filter(d => d.status === 'ACCEPTE').length; }
}
