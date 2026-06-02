import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';

interface FileInfo {
  file: File | null;
  name: string;
  size: number;
  error: string;
}

interface DemandeStage {
  idstage: number;
  typeStage: string;
  niveau: string | null;
  dernierDiplome_filename: string | null;
  domaineStage: string;
  dureeStage: number;
  dateDebutSouhaitee: string;
  dateDebutEffective: string | null;
  dateFinEffective: string | null;
  statusStage: string;
  createdDate: string;
  hasConvention: boolean;
  conventionFilename: string | null;
}

interface ConventionRenouvellement {
  stage: {
    idstage: number;
    typeStage: string;
    domaineStage: string;
    dureeStage: number;
    dateDebutEffective: string | null;
    dateFinEffective: string | null;
  };
  convention: {
    iddocument: number;
    filename: string;
    size: number;
    dateEmission: string | null;
    emetteurNom: string | null;
  } | null;
  conventionDisponible: boolean;
}

// Statuts qui bloquent une nouvelle demande de stage
const STATUTS_BLOQUANTS = ['EN_ATTENTE', 'EN_COURS_DE_TRAITEMENT', 'ACCEPTE', 'EN_COURS', 'RAPPORT_SOUMIS'];

@Component({
  selector: 'app-stages',
  imports: [CommonModule, ReactiveFormsModule, DatePipe, RouterModule],
  templateUrl: './stages.html',
  styleUrl: './stages.css',
})
export class Stages implements OnInit {

  // Modal demande de stage
  showModal = false;
  etapeCreate: 1 | 2 = 1;

  // Modal détails d'une demande
  showDetailModal = false;
  selectedDemandeDetail: DemandeStage | null = null;

  // Modal rapport de stage
  showRapportModal = false;
  selectedStageId: number | null = null;
  selectedStageDomaine = '';

  // Modal renouvellement
  showRenouvellementModal = false;
  renouvellementStageId: number | null = null;
  conventionInfo: ConventionRenouvellement | null = null;
  isLoadingConvention = false;

  // Loading state
  isLoading = false;
  isSubmitting = false;
  isSubmittingRapport = false;
  isSubmittingRenouvellement = false;

  // Liste des demandes de stage
  mesDemandesStage: DemandeStage[] = [];

  // Toast notifications
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  private toastTimeout: any;

  // Formulaire de demande de stage
  demandeForm: FormGroup;

  // Formulaire de rapport
  rapportForm: FormGroup;

  // Formulaire de renouvellement
  renouvellementForm: FormGroup;

  // Fichier lettre de renouvellement
  lettreRenouvellementFile: FileInfo = { file: null, name: '', size: 0, error: '' };

  // Options pour le niveau
  niveauxSoutenance = ['LICENCE', 'MASTER', 'DOCTORAT'];
  niveauxPerfectionnement = [
    { value: 'BAC', label: 'BAC' },
    { value: 'LICENCE', label: 'Licence' },
    { value: 'MASTER', label: 'Master' },
    { value: 'DOCTORAT', label: 'Doctorat' },
  ];

  /** Getter pratiques pour les valeurs du formulaire */
  get typeStageVal(): string { return this.demandeForm.get('typeStage')?.value ?? ''; }
  get typeEtablissementVal(): string { return this.demandeForm.get('typeEtablissement')?.value ?? ''; }
  get isPublic(): boolean { return this.typeEtablissementVal === 'PUBLIC'; }
  get isPerfectionnement(): boolean { return this.typeStageVal === 'PERFECTIONNEMENT'; }

  // Fichiers pour demande de stage
  files: { [key: string]: FileInfo } = {
    cv: { file: null, name: '', size: 0, error: '' },
    cnib: { file: null, name: '', size: 0, error: '' },
    casierJudiciaire: { file: null, name: '', size: 0, error: '' },
    lettreMotivation: { file: null, name: '', size: 0, error: '' },
    lettreRecommandation: { file: null, name: '', size: 0, error: '' },
    dernierDiplome: { file: null, name: '', size: 0, error: '' },
  };

  // Fichier rapport
  rapportFile: FileInfo = { file: null, name: '', size: 0, error: '' };

  // Taille max des fichiers (1 MB pour documents, 5 MB pour rapport/lettre)
  readonly MAX_FILE_SIZE = 1 * 1024 * 1024;
  readonly MAX_RAPPORT_SIZE = 5 * 1024 * 1024;

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.demandeForm = this.fb.group({
      typeStage: ['', Validators.required],
      typeEtablissement: ['PRIVE'],
      niveau: [''],
      domaineStage: ['', [Validators.required, Validators.minLength(3)]],
      dureeStage: ['', [Validators.required, Validators.min(1), Validators.max(12)]],
      dateDebutSouhaitee: ['', Validators.required],
    });

    this.rapportForm = this.fb.group({
      titreRapport: ['', [Validators.required, Validators.minLength(5)]],
      natureRapport: ['RAPPORT_STAGE'],
    });

    this.renouvellementForm = this.fb.group({
      dureeDemandee: ['', [Validators.required, Validators.min(1), Validators.max(12)]],
    });

    // Observer les changements de typeStage pour valider niveau
    this.demandeForm.get('typeStage')?.valueChanges.subscribe(value => {
      const niveauControl = this.demandeForm.get('niveau');

      // Niveau requis pour tous les types de stage
      if (value === 'SOUTENANCE' || value === 'PERFECTIONNEMENT') {
        niveauControl?.setValidators(Validators.required);
      } else {
        niveauControl?.clearValidators();
        niveauControl?.setValue('');
      }

      // Réinitialiser le dernier diplôme si on quitte PERFECTIONNEMENT
      if (value !== 'PERFECTIONNEMENT') {
        this.files['dernierDiplome'] = { file: null, name: '', size: 0, error: '' };
      }

      niveauControl?.updateValueAndValidity();
      this.cdr.detectChanges();
    });

  }

  ngOnInit(): void {
    this.loadMesDemandesStage();
  }

  /**
   * Vérifie si le candidat a un stage actif qui bloque une nouvelle demande
   */
  get stageActifExistant(): DemandeStage | undefined {
    return this.mesDemandesStage.find(s => STATUTS_BLOQUANTS.includes(s.statusStage));
  }

  get countEnAttente(): number {
    return this.mesDemandesStage.filter(s =>
      s.statusStage === 'EN_ATTENTE' || s.statusStage === 'EN_COURS_DE_TRAITEMENT'
    ).length;
  }

  get countEnCours(): number {
    return this.mesDemandesStage.filter(s =>
      s.statusStage === 'EN_COURS' || s.statusStage === 'ACCEPTE'
    ).length;
  }

  /**
   * Charger les demandes de stage du candidat
   */
  loadMesDemandesStage(): void {
    this.isLoading = true;

    this.http.get<any>(`${this.apiUrl}/candidat/mes-demandes-stage`).subscribe({
      next: (response) => {
        if (response.success) {
          this.mesDemandesStage = response.data;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erreur:', error);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Ouvrir le modal de demande de stage
   */
  ouvrirModal(): void {
    if (this.stageActifExistant) {
      const messages: { [key: string]: string } = {
        EN_ATTENTE: 'Vous avez déjà une demande en attente.',
        EN_COURS_DE_TRAITEMENT: 'Vous avez déjà une demande en cours de traitement.',
        ACCEPTE: 'Vous avez déjà un stage accepté.',
        EN_COURS: 'Vous avez déjà un stage en cours.',
        RAPPORT_SOUMIS: 'Votre rapport de stage est en cours d\'évaluation.',
      };
      const msg = messages[this.stageActifExistant.statusStage] || 'Vous avez déjà un stage actif.';
      this.showToast(msg + ' Vous ne pouvez pas soumettre une nouvelle demande.', 'error');
      return;
    }
    this.etapeCreate = 1;
    this.showModal = true;
    this.resetForm();
  }

  /**
   * Fermer le modal
   */
  fermerModal(): void {
    this.showModal = false;
    this.etapeCreate = 1;
  }

  /**
   * Ouvrir le modal de rapport
   */
  ouvrirRapportModal(stageId: number, domaine: string): void {
    this.selectedStageId = stageId;
    this.selectedStageDomaine = domaine;
    this.rapportForm.reset();
    this.rapportForm.patchValue({ natureRapport: 'RAPPORT_STAGE' });
    this.rapportFile = { file: null, name: '', size: 0, error: '' };
    this.showRapportModal = true;
  }

  /**
   * Fermer le modal de rapport
   */
  fermerRapportModal(): void {
    this.showRapportModal = false;
    this.selectedStageId = null;
    this.selectedStageDomaine = '';
  }

  /**
   * Ouvrir le modal de renouvellement et charger les infos de convention
   */
  ouvrirRenouvellementModal(stageId: number): void {
    this.renouvellementStageId = stageId;
    this.conventionInfo = null;
    this.isLoadingConvention = true;
    this.lettreRenouvellementFile = { file: null, name: '', size: 0, error: '' };
    this.renouvellementForm.reset();
    this.showRenouvellementModal = true;
    this.cdr.detectChanges();

    // Charger les infos depuis le backend
    this.http.get<any>(`${this.apiUrl}/candidat/stages/${stageId}/convention-renouvellement`).subscribe({
      next: (response) => {
        if (response.success) {
          this.conventionInfo = response.data;
          // Pré-remplir la durée avec la durée initiale du stage
          if (response.data.stage?.dureeStage) {
            this.renouvellementForm.patchValue({ dureeDemandee: response.data.stage.dureeStage });
          }
        }
        this.isLoadingConvention = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        const msg = err.error?.message || 'Erreur lors du chargement des informations';
        this.showToast(msg, 'error');
        this.isLoadingConvention = false;
        this.showRenouvellementModal = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Fermer le modal de renouvellement
   */
  fermerRenouvellementModal(): void {
    this.showRenouvellementModal = false;
    this.renouvellementStageId = null;
    this.conventionInfo = null;
    this.lettreRenouvellementFile = { file: null, name: '', size: 0, error: '' };
    this.renouvellementForm.reset();
  }

  /**
   * Afficher un toast
   */
  showToast(message: string, type: 'success' | 'error'): void {
    this.toastMessage = message;
    this.toastType = type;

    // Auto-fermer le toast après 5 secondes
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.toastTimeout = setTimeout(() => {
      this.fermerToast();
    }, 5000);

    this.cdr.detectChanges();
  }

  /**
   * Fermer le toast
   */
  fermerToast(): void {
    this.toastMessage = '';
    this.cdr.detectChanges();
  }

  /**
   * Gérer la sélection d'un fichier (PDF uniquement)
   */
  onFileSelect(event: Event, fieldName: string): void {
    event.stopPropagation();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.files[fieldName] = { file: null, name: '', size: 0, error: '' };
      return;
    }

    // Vérifier la taille
    if (file.size > this.MAX_FILE_SIZE) {
      this.files[fieldName] = {
        file: null,
        name: file.name,
        size: file.size,
        error: 'Le fichier dépasse la taille maximale de 1 Mo'
      };
      input.value = '';
      return;
    }

    // Vérifier le type (PDF uniquement)
    if (file.type !== 'application/pdf') {
      this.files[fieldName] = {
        file: null,
        name: file.name,
        size: file.size,
        error: 'Seuls les fichiers PDF sont autorisés'
      };
      input.value = '';
      return;
    }

    this.files[fieldName] = {
      file: file,
      name: file.name,
      size: file.size,
      error: ''
    };
    this.cdr.detectChanges();
  }

  /**
   * Gérer la sélection du fichier rapport
   */
  onRapportFileSelect(event: Event): void {
    event.stopPropagation();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.rapportFile = { file: null, name: '', size: 0, error: '' };
      return;
    }

    // Vérifier la taille (5 MB max pour rapport)
    if (file.size > this.MAX_RAPPORT_SIZE) {
      this.rapportFile = {
        file: null,
        name: file.name,
        size: file.size,
        error: 'Le fichier dépasse la taille maximale de 5 Mo'
      };
      input.value = '';
      return;
    }

    // Vérifier le type (PDF uniquement)
    if (file.type !== 'application/pdf') {
      this.rapportFile = {
        file: null,
        name: file.name,
        size: file.size,
        error: 'Seuls les fichiers PDF sont autorisés'
      };
      input.value = '';
      return;
    }

    this.rapportFile = {
      file: file,
      name: file.name,
      size: file.size,
      error: ''
    };
    this.cdr.detectChanges();
  }

  /**
   * Gérer la sélection de la lettre de renouvellement
   */
  onLettreRenouvellementSelect(event: Event): void {
    event.stopPropagation();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.lettreRenouvellementFile = { file: null, name: '', size: 0, error: '' };
      return;
    }

    if (file.size > this.MAX_RAPPORT_SIZE) {
      this.lettreRenouvellementFile = {
        file: null, name: file.name, size: file.size,
        error: 'Le fichier dépasse la taille maximale de 5 Mo'
      };
      input.value = '';
      return;
    }

    if (file.type !== 'application/pdf') {
      this.lettreRenouvellementFile = {
        file: null, name: file.name, size: file.size,
        error: 'Seuls les fichiers PDF sont autorisés'
      };
      input.value = '';
      return;
    }

    this.lettreRenouvellementFile = { file, name: file.name, size: file.size, error: '' };
    this.cdr.detectChanges();
  }

  /**
   * Supprimer un fichier
   */
  removeFile(fieldName: string): void {
    this.files[fieldName] = { file: null, name: '', size: 0, error: '' };
    this.cdr.detectChanges();
  }

  /**
   * Supprimer le fichier rapport
   */
  removeRapportFile(): void {
    this.rapportFile = { file: null, name: '', size: 0, error: '' };
    this.cdr.detectChanges();
  }

  /**
   * Supprimer la lettre de renouvellement
   */
  removeLettreRenouvellement(): void {
    this.lettreRenouvellementFile = { file: null, name: '', size: 0, error: '' };
    this.cdr.detectChanges();
  }

  /**
   * Formater la taille du fichier
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Vérifier si le formulaire est valide selon les règles métier :
   * - Université PUBLIC → seulement lettre de recommandation requise
   * - Université PRIVE  → tous les documents selon le type de stage
   */
  isFormValid(): boolean {
    if (!this.demandeForm.valid) return false;

    // Aucune erreur sur les fichiers
    for (const key of Object.keys(this.files)) {
      if (this.files[key].error) return false;
    }

    if (this.isPublic) {
      // Université publique : seule la lettre de recommandation est requise
      if (!this.files['lettreRecommandation'].file) return false;
    } else {
      // Université privée : documents communs obligatoires
      if (!this.files['cv'].file) return false;
      if (!this.files['cnib'].file) return false;
      if (!this.files['casierJudiciaire'].file) return false;
      if (!this.files['lettreMotivation'].file) return false;

      // Lettre de recommandation obligatoire pour SOUTENANCE (privé)
      if (this.typeStageVal === 'SOUTENANCE') {
        if (!this.files['lettreRecommandation'].file) return false;
      }

      // Dernier diplôme obligatoire pour PERFECTIONNEMENT (privé)
      if (this.typeStageVal === 'PERFECTIONNEMENT') {
        if (!this.files['dernierDiplome'].file) return false;
      }
    }

    return true;
  }

  /**
   * Vérifier si le formulaire rapport est valide
   */
  isRapportFormValid(): boolean {
    if (!this.rapportForm.valid) return false;
    if (!this.rapportFile.file) return false;
    if (this.rapportFile.error) return false;
    return true;
  }

  /**
   * Vérifier si le formulaire de renouvellement est valide
   */
  isRenouvellementFormValid(): boolean {
    if (!this.renouvellementForm.valid) return false;
    if (!this.lettreRenouvellementFile.file) return false;
    if (this.lettreRenouvellementFile.error) return false;
    return true;
  }

  /**
   * Réinitialiser le formulaire
   */
  resetForm(): void {
    this.demandeForm.reset();
    Object.keys(this.files).forEach(key => {
      this.files[key] = { file: null, name: '', size: 0, error: '' };
    });
  }

  /**
   * Soumettre la demande de stage
   */
  soumettreDemandeStage(): void {
    if (!this.isFormValid()) {
      this.showToast('Veuillez remplir tous les champs obligatoires et joindre tous les documents requis', 'error');
      return;
    }

    this.isSubmitting = true;

    // Créer le FormData
    const formData = new FormData();
    formData.append('typeStage', this.typeStageVal);
    formData.append('typeEtablissement', this.typeEtablissementVal);
    formData.append('domaineStage', this.demandeForm.get('domaineStage')?.value);
    formData.append('dureeStage', this.demandeForm.get('dureeStage')?.value);
    formData.append('dateDebutSouhaitee', this.demandeForm.get('dateDebutSouhaitee')?.value);

    // Niveau requis pour SOUTENANCE et PERFECTIONNEMENT
    if (this.typeStageVal === 'SOUTENANCE' || this.typeStageVal === 'PERFECTIONNEMENT') {
      formData.append('niveau', this.demandeForm.get('niveau')?.value);
    }

    // Ajouter les fichiers selon les règles métier
    if (this.isPublic) {
      // Université publique : seulement la lettre de recommandation
      if (this.files['lettreRecommandation'].file) {
        formData.append('lettreRecommandation', this.files['lettreRecommandation'].file as File);
      }
    } else {
      // Université privée : tous les fichiers disponibles
      Object.keys(this.files).forEach(key => {
        if (this.files[key].file) {
          formData.append(key, this.files[key].file as File);
        }
      });
    }

    this.http.post<any>(`${this.apiUrl}/candidat/demande-stage`, formData).subscribe({
      next: (response) => {
        if (response.success) {
          this.showToast('Votre demande de stage a été soumise avec succès !', 'success');
          this.fermerModal();
          this.loadMesDemandesStage();
        }
        this.isSubmitting = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erreur:', error);
        this.showToast(error.error?.message || 'Erreur lors de la soumission de la demande', 'error');
        this.isSubmitting = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Soumettre le rapport de stage
   */
  soumettreRapportStage(): void {
    if (!this.isRapportFormValid() || !this.selectedStageId) {
      this.showToast('Veuillez remplir tous les champs obligatoires et joindre le rapport', 'error');
      return;
    }

    this.isSubmittingRapport = true;

    const formData = new FormData();
    formData.append('titreRapport', this.rapportForm.get('titreRapport')?.value);
    formData.append('natureRapport', this.rapportForm.get('natureRapport')?.value);
    formData.append('rapportPdf', this.rapportFile.file as File);

    this.http.post<any>(`${this.apiUrl}/candidat/stages/${this.selectedStageId}/rapport`, formData).subscribe({
      next: (response) => {
        if (response.success) {
          this.showToast('Votre rapport de stage a été soumis avec succès !', 'success');
          this.fermerRapportModal();
          this.loadMesDemandesStage();
        }
        this.isSubmittingRapport = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erreur:', error);
        this.showToast(error.error?.message || 'Erreur lors de la soumission du rapport', 'error');
        this.isSubmittingRapport = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Soumettre la demande de renouvellement
   */
  soumettreRenouvellement(): void {
    if (!this.isRenouvellementFormValid() || !this.renouvellementStageId) {
      this.showToast('Veuillez renseigner la durée et joindre la lettre de demande (PDF)', 'error');
      return;
    }

    this.isSubmittingRenouvellement = true;

    const formData = new FormData();
    formData.append('dureeDemandee', this.renouvellementForm.get('dureeDemandee')?.value);
    formData.append('lettreRenouvellement', this.lettreRenouvellementFile.file as File);

    this.http.post<any>(
      `${this.apiUrl}/candidat/stages/${this.renouvellementStageId}/renouvellement`,
      formData
    ).subscribe({
      next: (response) => {
        if (response.success) {
          const msg = response.data.conventionJointe
            ? 'Demande de renouvellement soumise avec succès ! La convention a été jointe automatiquement.'
            : 'Demande de renouvellement soumise avec succès ! (Aucune convention trouvée dans le système)';
          this.showToast(msg, 'success');
          this.fermerRenouvellementModal();
          this.loadMesDemandesStage();
        }
        this.isSubmittingRenouvellement = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erreur:', error);
        this.showToast(error.error?.message || 'Erreur lors de la demande de renouvellement', 'error');
        this.isSubmittingRenouvellement = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Retourne la classe CSS pour le badge de statut
   */
  getStatusClass(status: string): string {
    const classes: { [key: string]: string } = {
      'EN_ATTENTE':           'bg-amber-100 text-amber-700 border-amber-200',
      'EN_COURS_DE_TRAITEMENT': 'bg-blue-100 text-blue-700 border-blue-200',
      'ACCEPTE':              'bg-emerald-100 text-emerald-700 border-emerald-200',
      'REJETE':               'bg-red-100 text-red-700 border-red-200',
      'EN_COURS':             'bg-teal-100 text-teal-700 border-teal-200',
      'TERMINE':              'bg-gray-100 text-gray-600 border-gray-200',
      'RAPPORT_SOUMIS':       'bg-indigo-100 text-indigo-700 border-indigo-200',
      'EXPIRE':               'bg-orange-100 text-orange-700 border-orange-200',
    };
    return classes[status] || 'bg-gray-100 text-gray-600 border-gray-200';
  }

  /**
   * Retourne le libellé du statut
   */
  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'EN_ATTENTE': 'En attente',
      'EN_COURS_DE_TRAITEMENT': 'En traitement',
      'ACCEPTE': 'Accepté',
      'REJETE': 'Rejeté',
      'EN_COURS': 'En cours',
      'TERMINE': 'Terminé',
      'RAPPORT_SOUMIS': 'Rapport soumis',
      'EXPIRE': 'Expiré',
    };
    return labels[status] || status;
  }

  /**
   * Ouvrir le modal de soumission de rapport
   */
  soumettreRapport(stageId: number): void {
    const stage = this.mesDemandesStage.find(s => s.idstage === stageId);
    if (stage) {
      this.ouvrirRapportModal(stageId, stage.domaineStage);
    }
  }

  /**
   * Voir ou télécharger la convention de stage
   * @param stageId  identifiant du stage
   * @param mode     'voir' → ouvre dans un nouvel onglet | 'telecharger' → force le téléchargement
   */
  accederConvention(stageId: number, mode: 'voir' | 'telecharger'): void {
    this.http.get(`${this.apiUrl}/stages/${stageId}/convention`, {
      responseType: 'blob'
    }).subscribe({
      next: (blob) => {
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(pdfBlob);

        if (mode === 'voir') {
          // Ouvrir dans un nouvel onglet
          const nouvelOnglet = window.open(url, '_blank');
          if (nouvelOnglet) {
            setTimeout(() => window.URL.revokeObjectURL(url), 10000);
            this.showToast('Convention ouverte dans un nouvel onglet', 'success');
          } else {
            this.showToast('Impossible d\'ouvrir un nouvel onglet. Vérifiez vos paramètres de popup.', 'error');
            window.URL.revokeObjectURL(url);
          }
        } else {
          // Forcer le téléchargement
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `convention_stage_${stageId}.pdf`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          }, 500);
          this.showToast('Téléchargement de la convention lancé', 'success');
        }
      },
      error: (error) => {
        console.error('Erreur:', error);
        this.showToast('Erreur lors du chargement de la convention', 'error');
      }
    });
  }

  /**
   * Alias conservé pour compatibilité avec les appels existants
   */
  telechargerConvention(stageId: number): void {
    this.accederConvention(stageId, 'telecharger');
  }

  /**
   * Vérifier si le renouvellement est possible (2 semaines avant la fin)
   */
  peutRenouveler(stage: DemandeStage): boolean {
    if (stage.statusStage !== 'EN_COURS' || !stage.dateFinEffective) {
      return false;
    }
    const dateFin = new Date(stage.dateFinEffective);
    const aujourdhui = new Date();
    const deuxSemainesAvant = new Date(dateFin);
    deuxSemainesAvant.setDate(deuxSemainesAvant.getDate() - 14);

    return aujourdhui >= deuxSemainesAvant && aujourdhui < dateFin;
  }

  /**
   * Calculer les jours restants avant la fin du stage
   */
  getJoursRestants(dateFinEffective: string): number {
    const dateFin = new Date(dateFinEffective);
    const aujourdhui = new Date();
    const diff = dateFin.getTime() - aujourdhui.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Ouvrir le modal de renouvellement
   */
  demanderRenouvellement(stageId: number): void {
    this.ouvrirRenouvellementModal(stageId);
  }

  /**
   * Ouvrir le modal de détails d'une demande
   */
  ouvrirDetail(demande: DemandeStage): void {
    this.selectedDemandeDetail = demande;
    this.showDetailModal = true;
  }

  /**
   * Fermer le modal de détails
   */
  fermerDetail(): void {
    this.showDetailModal = false;
    this.selectedDemandeDetail = null;
  }
}
