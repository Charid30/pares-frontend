import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
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
  domaineStage: string;
  dureeStage: number;
  dateDebutSouhaitee: string;
  dateDebutEffective: string | null;
  dateFinEffective: string | null;
  statusStage: string;
  motifRefus: string | null;
  documentsRejetes: string | null;
  createdDate: string;
  hasConvention: boolean;
  conventionFilename: string | null;
  cv_filename: string | null;
  cnib_filename: string | null;
  casierJudiciaire_filename: string | null;
  lettreMotivation_filename: string | null;
  lettreRecommandation_filename: string | null;
  dernierDiplome_filename: string | null;
  demandeModifEnCours: { id: number; type: 'SUSPENSION' | 'ANNULATION'; dateDebut: string | null; createdDate: string } | null;
  autorisationRenouvellement: { id: number; expiresAt: string } | null;
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
const STATUTS_BLOQUANTS = ['EN_ATTENTE', 'EN_COURS_DE_TRAITEMENT', 'ACCEPTE', 'PROGRAMMATION_EN_COURS', 'EN_COURS', 'RAPPORT_SOUMIS'];

@Component({
  selector: 'app-stages',
  imports: [CommonModule, ReactiveFormsModule, FormsModule, DatePipe, RouterModule],
  templateUrl: './stages.html',
  styleUrl: './stages.css',
})
export class Stages implements OnInit {

  readonly stepsCreate = [1, 2, 3, 4, 5];

  // Modal demande de stage
  showModal = false;
  etapeCreate: 1 | 2 | 3 | 4 | 5 = 1;
  showConfirmSubmitPopup = false;

  // Popup d'avertissement sur les documents à légaliser, avant ouverture du formulaire
  showLegalisationPopup = false;

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

  // Filtre d'affichage de la liste
  activeFilter: 'tous' | 'en_cours' | 'rejetees' = 'tous';

  setFilter(filter: 'tous' | 'en_cours' | 'rejetees'): void {
    this.activeFilter = filter;
  }

  get demandesFiltrees(): DemandeStage[] {
    if (this.activeFilter === 'en_cours') {
      return this.mesDemandesStage.filter(s => s.statusStage === 'EN_COURS' || s.statusStage === 'ACCEPTE');
    }
    if (this.activeFilter === 'rejetees') {
      return this.mesDemandesStage.filter(s => s.statusStage === 'REJETE' || s.statusStage === 'ANNULE');
    }
    return this.mesDemandesStage;
  }

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

  // Directions avec leurs services
  directions: {
    iddirection: number;
    nom: string;
    accronyme: string;
    services?: { idservice: number; accronyme: string; description: string }[];
  }[] = [];

  /** Services de la direction actuellement sélectionnée */
  get servicesForSelectedDirection(): { idservice: number; accronyme: string; description: string }[] {
    const dirId = this.demandeForm.get('direction_iddirection')?.value;
    if (!dirId) return [];
    const dir = this.directions.find(d => String(d.iddirection) === String(dirId));
    return dir?.services ?? [];
  }

  // Demande de modification
  showDemandeModifModal = false;
  demandeModifType: 'SUSPENSION' | 'ANNULATION' = 'SUSPENSION';
  demandeModifForm = { motif: '', dateDebut: '' };
  lettreManuscriteFile: File | null = null;
  submittingDemandeModif = false;
  stageForDemandeModif: any = null;

  // Options pour le niveau
  niveauxSoutenance = ['LICENCE', 'MASTER', 'DOCTORAT'];
  niveauxPerfectionnement = [
    { value: 'BAC', label: 'BAC' },
    { value: 'LICENCE', label: 'Licence' },
    { value: 'MASTER', label: 'Master' },
    { value: 'DOCTORAT', label: 'Doctorat' },
  ];

  /** Getters pratiques pour les valeurs du formulaire */
  get typeStageVal(): string { return this.demandeForm.get('typeStage')?.value ?? ''; }
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

  readonly MAX_FILE_SIZE = 1 * 1024 * 1024;
  readonly MAX_RAPPORT_SIZE = 5 * 1024 * 1024;

  private apiUrl = environment.apiUrl;

  // ── Calendrier date de début (uniquement 1er ou 15 du mois) ─────────────
  readonly moisLabels = [
    'Janvier','Février','Mars','Avril','Mai','Juin',
    'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
  ];
  readonly JOURS_SEMAINE = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

  showCalendar = false;
  calendarYear  = new Date().getFullYear();
  calendarMonth = new Date().getMonth(); // 0-based
  /** Position fixe du panneau calendrier (calculée depuis le bouton déclencheur) */
  calendarPos = { top: 0, left: 0, width: 280 };

  /** Titre affiché dans l'en-tête du calendrier */
  get calendarTitle(): string {
    return `${this.moisLabels[this.calendarMonth]} ${this.calendarYear}`;
  }

  /** Cellules du calendrier pour le mois en cours */
  get calendarDays(): Array<{ day: number | null; dateStr: string | null; isValid: boolean }> {
    const firstDayRaw = new Date(this.calendarYear, this.calendarMonth, 1).getDay(); // 0=dim
    const daysInMonth = new Date(this.calendarYear, this.calendarMonth + 1, 0).getDate();
    const today       = new Date();
    today.setHours(0, 0, 0, 0);

    const cells: Array<{ day: number | null; dateStr: string | null; isValid: boolean }> = [];

    // Décalage lundi-based (lundi = 0)
    const startOffset = (firstDayRaw === 0 ? 7 : firstDayRaw) - 1;
    for (let i = 0; i < startOffset; i++) {
      cells.push({ day: null, dateStr: null, isValid: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date    = new Date(this.calendarYear, this.calendarMonth, d);
      const mm      = String(this.calendarMonth + 1).padStart(2, '0');
      const dd      = String(d).padStart(2, '0');
      const dateStr = `${this.calendarYear}-${mm}-${dd}`;
      // Valide = 1er ou 15, ET strictement futur
      const isValid = (d === 1 || d === 15) && date > today;
      cells.push({ day: d, dateStr, isValid });
    }
    return cells;
  }

  /** Libellé de la date sélectionnée */
  get selectedDateDisplay(): string {
    const val = this.demandeForm.get('dateDebutSouhaitee')?.value;
    if (!val) return '';
    const [y, m, d] = val.split('-');
    const jour = parseInt(d, 10);
    return `${jour === 1 ? '1er' : jour} ${this.moisLabels[parseInt(m, 10) - 1]} ${y}`;
  }

  /** Peut-on reculer d'un mois ? (pas avant le mois courant) */
  get canGoPrev(): boolean {
    const now = new Date();
    return !(this.calendarYear === now.getFullYear() && this.calendarMonth === now.getMonth());
  }

  // ─── Validation par étape ───────────────────────────────────────
  /** Étape 1 valide : type de stage + niveau renseignés */
  get etape1Valide(): boolean {
    return (
      this.demandeForm.get('typeStage')?.valid === true &&
      this.demandeForm.get('niveau')?.valid === true
    );
  }

  /** Étape 2 valide : direction + service + domaine */
  get etape2Valide(): boolean {
    return (
      this.demandeForm.get('direction_iddirection')?.valid === true &&
      this.demandeForm.get('service_idservice')?.valid === true &&
      this.demandeForm.get('domaineStage')?.valid === true
    );
  }

  /** Étape 3 valide : durée + date */
  get etape3Valide(): boolean {
    return (
      this.demandeForm.get('dureeStage')?.valid === true &&
      this.demandeForm.get('dateDebutSouhaitee')?.valid === true
    );
  }

  /**
   * Naviguer vers une étape : marque les champs de l'étape courante
   * comme touchés pour afficher les erreurs, et n'avance que si valide.
   */
  allerEtape(n: 1 | 2 | 3 | 4 | 5): void {
    // Validation à la montée uniquement
    if (n > this.etapeCreate) {
      if (this.etapeCreate === 1) {
        ['typeStage', 'niveau'].forEach(f =>
          this.demandeForm.get(f)?.markAsTouched()
        );
        if (!this.etape1Valide) { this.cdr.detectChanges(); return; }
      } else if (this.etapeCreate === 2) {
        ['direction_iddirection', 'service_idservice', 'domaineStage'].forEach(f =>
          this.demandeForm.get(f)?.markAsTouched()
        );
        if (!this.etape2Valide) { this.cdr.detectChanges(); return; }
      } else if (this.etapeCreate === 3) {
        ['dureeStage', 'dateDebutSouhaitee'].forEach(f =>
          this.demandeForm.get(f)?.markAsTouched()
        );
        if (!this.etape3Valide) { this.cdr.detectChanges(); return; }
      } else if (this.etapeCreate === 4) {
        if (!this.isFormValid()) {
          this.showToast('Veuillez remplir tous les champs obligatoires et joindre tous les documents requis', 'error');
          this.cdr.detectChanges();
          return;
        }
      }
    }
    this.etapeCreate = n;
    this.cdr.detectChanges();
  }

  allerEtapePrecedente(): void {
    if (this.etapeCreate > 1) this.allerEtape((this.etapeCreate - 1) as 1 | 2 | 3 | 4 | 5);
  }

  allerEtapeSuivante(): void {
    if (this.etapeCreate < 5) this.allerEtape((this.etapeCreate + 1) as 1 | 2 | 3 | 4 | 5);
  }

  /** Libellé du type de stage pour le récapitulatif */
  getTypeStageLabel(): string {
    return this.typeStageVal === 'SOUTENANCE' ? 'Soutenance (fin d\'études)' : 'Perfectionnement';
  }

  /** Libellé de la direction sélectionnée pour le récapitulatif */
  getDirectionLabel(): string {
    const dirId = this.demandeForm.get('direction_iddirection')?.value;
    const dir = this.directions.find(d => String(d.iddirection) === String(dirId));
    return dir ? `${dir.accronyme} — ${dir.nom}` : '—';
  }

  /** Libellé du service sélectionné pour le récapitulatif */
  getServiceLabel(): string {
    const svcId = this.demandeForm.get('service_idservice')?.value;
    const svc = this.servicesForSelectedDirection.find(s => String(s.idservice) === String(svcId));
    return svc ? `${svc.accronyme} — ${svc.description}` : '—';
  }

  /** Liste des documents joints pour le récapitulatif */
  get fichiersRecap(): { label: string; name: string }[] {
    return Object.keys(this.files)
      .filter(key => this.files[key].file)
      .map(key => ({ label: this.documentLabels[key] || key, name: this.files[key].name }));
  }

  /** Ouvre la popup de confirmation avant l'envoi définitif */
  ouvrirConfirmationSoumission(): void {
    this.showConfirmSubmitPopup = true;
  }

  fermerConfirmationSoumission(): void {
    this.showConfirmSubmitPopup = false;
  }

  confirmerEtSoumettre(): void {
    this.showConfirmSubmitPopup = false;
    this.soumettreDemandeStage();
  }

  toggleCalendar(event: Event): void {
    event.stopPropagation();
    this.showCalendar = !this.showCalendar;
    if (this.showCalendar) {
      // Calculer la position du bouton dans le viewport pour positionner le calendrier en fixed
      const btn  = event.currentTarget as HTMLElement;
      const rect = btn.getBoundingClientRect();
      const calH = 320; // hauteur estimée du calendrier
      // Afficher au-dessus si pas assez de place en-dessous
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < calH) {
        this.calendarPos = { top: rect.top - calH - 6, left: rect.left, width: rect.width };
      } else {
        this.calendarPos = { top: rect.bottom + 4, left: rect.left, width: rect.width };
      }
    }
    this.cdr.detectChanges();
  }

  closeCalendar(): void {
    this.showCalendar = false;
    this.cdr.detectChanges();
  }

  prevCalendarMonth(): void {
    if (!this.canGoPrev) return;
    if (this.calendarMonth === 0) { this.calendarMonth = 11; this.calendarYear--; }
    else { this.calendarMonth--; }
    this.cdr.detectChanges();
  }

  nextCalendarMonth(): void {
    if (this.calendarMonth === 11) { this.calendarMonth = 0; this.calendarYear++; }
    else { this.calendarMonth++; }
    this.cdr.detectChanges();
  }

  selectCalendarDate(dateStr: string): void {
    this.demandeForm.get('dateDebutSouhaitee')?.setValue(dateStr);
    this.showCalendar = false;
    this.cdr.detectChanges();
  }

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.demandeForm = this.fb.group({
      typeStage: ['', Validators.required],
      niveau: [''],
      direction_iddirection: ['', Validators.required],
      service_idservice: ['', Validators.required],
      domaineStage: ['', [Validators.required, Validators.minLength(3)]],
      dureeStage: ['', [Validators.required, Validators.min(1), Validators.max(6)]],
      dateDebutSouhaitee: ['', [Validators.required, this.dateDebutValidator]],
    });

    // Initialiser le calendrier sur le mois prochain par défaut
    const now = new Date();
    if (now.getMonth() === 11) {
      this.calendarMonth = 0;
      this.calendarYear  = now.getFullYear() + 1;
    } else {
      this.calendarMonth = now.getMonth() + 1;
      this.calendarYear  = now.getFullYear();
    }
    // Pré-sélectionner le 1er du mois prochain
    const mm = String(this.calendarMonth + 1).padStart(2, '0');
    this.demandeForm.get('dateDebutSouhaitee')
      ?.setValue(`${this.calendarYear}-${mm}-01`, { emitEvent: false });

    this.rapportForm = this.fb.group({
      titreRapport: ['', [Validators.required, Validators.minLength(5)]],
      natureRapport: ['RAPPORT_STAGE'],
    });

    this.renouvellementForm = this.fb.group({
      dureeDemandee: ['', [Validators.required, Validators.min(1), Validators.max(12)]],
    });

    // Réinitialiser service ET domaine quand la direction change
    this.demandeForm.get('direction_iddirection')?.valueChanges.subscribe(() => {
      this.demandeForm.get('service_idservice')?.setValue('');
      this.demandeForm.get('domaineStage')?.setValue('');
      this.cdr.detectChanges();
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
    this.loadDirections();
  }

  private loadDirections(): void {
    this.http.get<any>(`${this.apiUrl}/stages/directions`).subscribe({
      next: (res) => {
        if (res.success) {
          this.directions = res.data;
        }
        this.cdr.detectChanges(); // indispensable en mode zoneless
      },
      error: (err) => {
        console.error('Erreur chargement directions:', err);
        this.cdr.detectChanges();
      },
    });
  }

  /**
   * Vérifie si le candidat a un stage actif qui bloque une nouvelle demande
   */
  get stageActifExistant(): DemandeStage | undefined {
    return this.mesDemandesStage.find(s => STATUTS_BLOQUANTS.includes(s.statusStage));
  }

  /**
   * Vérifie si le candidat a une demande rejetée non encore corrigée.
   * Tant qu'elle existe, il doit remplacer les documents non conformes et
   * resoumettre cette demande plutôt que d'en créer une nouvelle.
   */
  get stageRejeteExistant(): DemandeStage | undefined {
    return this.mesDemandesStage.find(s => s.statusStage === 'REJETE');
  }

  get countEnAttente(): number {
    return this.mesDemandesStage.filter(s =>
      s.statusStage === 'EN_ATTENTE' || s.statusStage === 'PROGRAMMATION_EN_COURS'
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
    // Une demande rejetée doit d'abord être corrigée (remplacer les documents non
    // conformes puis resoumettre) — on ne permet pas de créer une demande vierge en parallèle.
    if (this.stageRejeteExistant) {
      this.showToast('Votre demande a été rejetée. Remplacez les documents non conformes puis resoumettez-la.', 'error');
      this.ouvrirDetail(this.stageRejeteExistant);
      return;
    }
    this.showLegalisationPopup = true;
  }

  /**
   * Fermer l'avertissement de légalisation sans ouvrir le formulaire
   */
  fermerLegalisationPopup(): void {
    this.showLegalisationPopup = false;
  }

  /**
   * Le candidat confirme avoir légalisé ses documents : ouvrir le formulaire
   */
  confirmerLegalisationEtOuvrirFormulaire(): void {
    this.showLegalisationPopup = false;
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
    this.showConfirmSubmitPopup = false;
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

    // Documents communs toujours obligatoires
    if (!this.files['cv'].file) return false;
    if (!this.files['cnib'].file) return false;
    if (!this.files['casierJudiciaire'].file) return false;
    if (!this.files['lettreMotivation'].file) return false;

    // Lettre de recommandation : SOUTENANCE uniquement (pas pour le perfectionnement)
    if (!this.isPerfectionnement && !this.files['lettreRecommandation'].file) return false;

    // Dernier diplôme : toujours obligatoire (soutenance et perfectionnement)
    if (!this.files['dernierDiplome'].file) return false;

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
    this.demandeForm.reset({
      direction_iddirection: '',
      service_idservice: '',
      domaineStage: '',
    });
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
    formData.append('direction_iddirection', this.demandeForm.get('direction_iddirection')?.value);
    formData.append('service_idservice', this.demandeForm.get('service_idservice')?.value);
    formData.append('domaineStage', this.demandeForm.get('domaineStage')?.value);
    formData.append('dureeStage', this.demandeForm.get('dureeStage')?.value);
    formData.append('dateDebutSouhaitee', this.demandeForm.get('dateDebutSouhaitee')?.value);

    // Niveau requis pour SOUTENANCE et PERFECTIONNEMENT
    if (this.typeStageVal === 'SOUTENANCE' || this.typeStageVal === 'PERFECTIONNEMENT') {
      formData.append('niveau', this.demandeForm.get('niveau')?.value);
    }

    // Ajouter tous les fichiers disponibles
    Object.keys(this.files).forEach(key => {
      if (this.files[key].file) {
        formData.append(key, this.files[key].file as File);
      }
    });

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
      'PROGRAMMATION_EN_COURS': 'bg-blue-100 text-blue-700 border-blue-200',
      'SUSPENDU':             'bg-orange-100 text-orange-700 border-orange-200',
      'ANNULE':               'bg-gray-100 text-gray-500 border-gray-200',
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
      'PROGRAMMATION_EN_COURS': 'Programmation en cours',
      'SUSPENDU': 'Suspendu',
      'ANNULE': 'Annulé',
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

  /** Stage actuellement sélectionné pour le modal de renouvellement */
  get stageRenouvellementEnCours(): DemandeStage | null {
    if (!this.renouvellementStageId) return null;
    return this.mesDemandesStage.find(s => s.idstage === this.renouvellementStageId) || null;
  }

  /**
   * Vérifier si le renouvellement est possible :
   * - EN_COURS : dans la fenêtre des 2 semaines avant la fin
   * - TERMINE / EXPIRE : si une autorisation admin active existe
   */
  peutRenouveler(stage: DemandeStage): boolean {
    // Cas TERMINE / EXPIRE : autorisation admin requise
    if (stage.statusStage === 'TERMINE' || stage.statusStage === 'EXPIRE') {
      if (!stage.autorisationRenouvellement) return false;
      return new Date(stage.autorisationRenouvellement.expiresAt) > new Date();
    }

    // Cas EN_COURS : fenêtre des 2 semaines
    if (stage.statusStage !== 'EN_COURS' || !stage.dateFinEffective) {
      return false;
    }
    const dateFin = new Date(stage.dateFinEffective);
    dateFin.setHours(0, 0, 0, 0);
    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);
    const deuxSemainesAvant = new Date(dateFin);
    deuxSemainesAvant.setDate(deuxSemainesAvant.getDate() - 14);

    return aujourdhui >= deuxSemainesAvant && aujourdhui <= dateFin;
  }

  /**
   * Calculer les jours restants avant la fin du stage
   */
  /**
   * Validator : la date de début doit être le 1er ou le 15 du mois
   */
  dateDebutValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    const jour = new Date(control.value).getUTCDate();
    return (jour === 1 || jour === 15) ? null : { jourInvalide: true };
  }

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

  // ── Remplacement des documents non conformes (après rejet) ──────────────
  documentLabels: Record<string, string> = {
    cv: 'CV daté et signé',
    cnib: 'CNIB',
    casierJudiciaire: 'Casier judiciaire',
    lettreMotivation: 'Lettre de motivation signée',
    lettreRecommandation: 'Lettre de recommandation',
    dernierDiplome: 'Dernier diplôme légalisé',
  };
  remplacementEnCours: Record<string, boolean> = {};

  /** Liste des documents que le candidat a joints à sa demande (non-vides) */
  getCandidatDocsDetail(demande: DemandeStage): { type: string; label: string; filename: string }[] {
    const map: { type: string; filenameKey: keyof DemandeStage }[] = [
      { type: 'cv', filenameKey: 'cv_filename' },
      { type: 'cnib', filenameKey: 'cnib_filename' },
      { type: 'casierJudiciaire', filenameKey: 'casierJudiciaire_filename' },
      { type: 'lettreMotivation', filenameKey: 'lettreMotivation_filename' },
      { type: 'lettreRecommandation', filenameKey: 'lettreRecommandation_filename' },
      { type: 'dernierDiplome', filenameKey: 'dernierDiplome_filename' },
    ];
    const docs: { type: string; label: string; filename: string }[] = [];
    for (const m of map) {
      const filename = demande[m.filenameKey] as string | null;
      if (filename) docs.push({ type: m.type, label: this.documentLabels[m.type] || m.type, filename });
    }
    return docs;
  }

  /** Voir ou télécharger un document joint à la demande de stage */
  accederDocumentCandidat(stageId: number, type: string, filename: string, mode: 'voir' | 'telecharger'): void {
    this.http.get(`${this.apiUrl}/stages/${stageId}/documents/${type}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(pdfBlob);
        if (mode === 'voir') {
          const nouvelOnglet = window.open(url, '_blank');
          if (nouvelOnglet) {
            setTimeout(() => window.URL.revokeObjectURL(url), 10000);
          } else {
            this.showToast('Impossible d\'ouvrir un nouvel onglet. Vérifiez vos paramètres de popup.', 'error');
            window.URL.revokeObjectURL(url);
          }
        } else {
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 500);
        }
      },
      error: () => this.showToast('Impossible de charger ce document', 'error'),
    });
  }

  /** Convertit le JSON brut `documentsRejetes` en tableau de clés */
  parseDocumentsRejetes(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /** Remplacer un document signalé comme non conforme */
  remplacerDocument(demande: DemandeStage, type: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    if (!file) return;
    if (file.type !== 'application/pdf') {
      this.showToast('Seuls les fichiers PDF sont acceptés.', 'error');
      input.value = '';
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      this.showToast('Le fichier ne doit pas dépasser 1 Mo.', 'error');
      input.value = '';
      return;
    }

    const key = `${demande.idstage}_${type}`;
    this.remplacementEnCours[key] = true;

    const formData = new FormData();
    formData.append('document', file, file.name);

    this.http.put<any>(`${this.apiUrl}/stages/${demande.idstage}/documents/${type}`, formData).subscribe({
      next: (res) => {
        if (res.success) {
          demande.documentsRejetes = res.data.documentsRejetes;
          this.showToast('Document remplacé avec succès.', 'success');
        }
        this.remplacementEnCours[key] = false;
        input.value = '';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.showToast(err.error?.message || 'Erreur lors du remplacement du document', 'error');
        this.remplacementEnCours[key] = false;
        input.value = '';
        this.cdr.detectChanges();
      }
    });
  }

  /** Resoumettre la demande après remplacement de tous les documents non conformes */
  resoumettreDemande(demande: DemandeStage): void {
    if (this.parseDocumentsRejetes(demande.documentsRejetes).length > 0) return;

    this.http.put<any>(`${this.apiUrl}/stages/${demande.idstage}/resoumettre`, {}).subscribe({
      next: (res) => {
        if (res.success) {
          this.showToast('Votre demande a été resoumise avec succès.', 'success');
          this.fermerDetail();
          this.loadMesDemandesStage();
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.showToast(err.error?.message || 'Erreur lors de la resoumission', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Ouvrir le modal de demande de modification (suspension/annulation)
   */
  ouvrirDemandeModif(stage: any, type: 'SUSPENSION' | 'ANNULATION'): void {
    this.stageForDemandeModif = stage;
    this.demandeModifType = type;
    this.demandeModifForm = { motif: '', dateDebut: '' };
    this.lettreManuscriteFile = null;
    this.showDemandeModifModal = true;
  }

  /** Sélection de la demande manuscrite (PDF uniquement) */
  onDemandeModifFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    if (file && file.type !== 'application/pdf') {
      this.showToast('Seuls les fichiers PDF sont acceptés.', 'error');
      input.value = '';
      return;
    }
    if (file && file.size > 1 * 1024 * 1024) {
      this.showToast('Le fichier ne doit pas dépasser 1 Mo.', 'error');
      input.value = '';
      return;
    }
    this.lettreManuscriteFile = file;
  }

  /** Le formulaire de demande de modification est-il valide ? */
  get demandeModifValide(): boolean {
    return this.demandeModifForm.motif.trim().length >= 10
      && !!this.demandeModifForm.dateDebut
      && !!this.lettreManuscriteFile;
  }

  /**
   * Soumettre la demande de modification (multipart : date + 2 fichiers)
   */
  soumettreDemandeModif(): void {
    if (!this.stageForDemandeModif || !this.demandeModifValide) return;
    this.submittingDemandeModif = true;

    const formData = new FormData();
    formData.append('type', this.demandeModifType);
    formData.append('motif', this.demandeModifForm.motif);
    formData.append('dateDebut', this.demandeModifForm.dateDebut);
    formData.append('lettreManuscrite', this.lettreManuscriteFile!, this.lettreManuscriteFile!.name);

    this.http.post<any>(`${this.apiUrl}/stages/${this.stageForDemandeModif.idstage}/demandes-modification`, formData).subscribe({
      next: (res) => {
        if (res.success) {
          this.showDemandeModifModal = false;
          const libelle = this.demandeModifType === 'SUSPENSION'
            ? 'Votre demande de suspension est en cours de traitement.'
            : 'Votre demande d\'annulation est en cours de traitement.';
          this.showToast(libelle, 'success');
          this.loadMesDemandesStage();
        }
        this.submittingDemandeModif = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.showToast(err.error?.message || 'Erreur lors de la soumission', 'error');
        this.submittingDemandeModif = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Annulation d'une demande de modification (suspension/annulation) en attente ──
  annulingDemandeModif: Record<number, boolean> = {};

  annulerDemandeModif(demande: DemandeStage): void {
    if (!demande.demandeModifEnCours) return;
    const demandeId = demande.demandeModifEnCours.id;
    this.annulingDemandeModif[demandeId] = true;
    this.cdr.detectChanges();

    this.http.put<any>(`${this.apiUrl}/stages/demandes-modification/${demandeId}/annuler`, {}).subscribe({
      next: (res) => {
        if (res.success) {
          this.showToast('Demande retirée avec succès.', 'success');
          this.loadMesDemandesStage();
        }
        delete this.annulingDemandeModif[demandeId];
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.showToast(err.error?.message || 'Erreur lors du retrait de la demande', 'error');
        delete this.annulingDemandeModif[demandeId];
        this.cdr.detectChanges();
      }
    });
  }
}
