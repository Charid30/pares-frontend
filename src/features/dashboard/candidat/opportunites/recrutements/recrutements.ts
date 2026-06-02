import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ChangeDetectorRef, OnInit, ViewChild, ElementRef } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../../environments/environment';
import { Loader } from "../../../../../shared/components/loader/loader";

interface DocumentRequis {
  code: string;
  label: string;
  required: boolean;
}

interface ProfilRecrutement {
  idprofil: number;
  titreProfil: string;
  description: string;
  competencesRequises: string;
  conditionsRequises: string;
  nombrePostes: number;
  nombreCandidaturesActuelles: number;
  nombreCandidaturesMax: number;
  statusProfil: string;
  documentsRequis?: string[] | null;
}

interface CampagneRecrutement {
  idcampagne: number;
  titreCampagne: string;
  description: string;
  dateDebut: string;
  dateFin: string;
  statusCampagne: string;
  profils?: ProfilRecrutement[];
}

interface MaCandidatureRecrutement {
  idcandidature: number;
  dateCandidature: string;
  statusCandidature: string;
  dateModification?: string;
  profil: {
    idprofil: number;
    titreProfil: string;
    description: string;
    nombrePostes: number;
  };
  campagne: {
    titreCampagne: string;
    dateDebut: string;
    dateFin: string;
  };
}

@Component({
  selector: 'app-recrutements',
  imports: [CommonModule, RouterModule, FormsModule, DatePipe],
  templateUrl: './recrutements.html',
  styleUrl: './recrutements.css',
})
export class Recrutements implements OnInit {

  // Onglet actif
  activeTab: 'campagnes' | 'historique' = 'campagnes';

  // Campagnes
  campagnes: CampagneRecrutement[] = [];
  campagnesFiltrees: CampagneRecrutement[] = [];
  isLoading = false;
  errorMessage = '';

  // Historique candidatures
  mesCandidatures: MaCandidatureRecrutement[] = [];
  mesCandidaturesFiltrees: MaCandidatureRecrutement[] = [];
  isLoadingHistorique = false;
  errorHistorique = '';
  filtreStatutHistorique = '';

  // Filtres
  searchTerm = '';

  // Modal détails campagne
  showDetailModal = false;
  selectedCampagne: CampagneRecrutement | null = null;
  selectedProfil: ProfilRecrutement | null = null;
  loadingProfils = false;

  // Modal postuler
  showPostulerModal = false;
  isPostulating = false;

  // Documents pour candidature
  documentsUploades: { [key: string]: File } = {};
  errorDocuments = '';

  // Modal détails candidature
  showCandidatureDetailModal = false;
  selectedCandidature: MaCandidatureRecrutement | null = null;

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCampagnesActives();
    this.loadMesCandidatures();
  }

  /**
   * Changer d'onglet
   */
  setActiveTab(tab: 'campagnes' | 'historique'): void {
    this.activeTab = tab;
    this.searchTerm = '';
    if (tab === 'campagnes') {
      this.campagnesFiltrees = [...this.campagnes];
    } else {
      this.mesCandidaturesFiltrees = [...this.mesCandidatures];
    }
  }

  /**
   * Charger les campagnes actives
   */
  loadCampagnesActives(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.http.get<any>(`${this.apiUrl}/recrutement/campagnes/actives`).subscribe({
      next: (response) => {
        if (response.success) {
          this.campagnes = response.data;
          this.campagnesFiltrees = [...this.campagnes];
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erreur:', error);
        this.errorMessage = error.error?.message || 'Erreur lors du chargement des campagnes';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Charger mes candidatures de recrutement
   */
  loadMesCandidatures(): void {
    this.isLoadingHistorique = true;
    this.errorHistorique = '';

    this.http.get<any>(`${this.apiUrl}/recrutement/mes-candidatures`).subscribe({
      next: (response) => {
        if (response.success) {
          this.mesCandidatures = response.data;
          this.mesCandidaturesFiltrees = [...this.mesCandidatures];
        }
        this.isLoadingHistorique = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erreur:', error);
        this.errorHistorique = error.error?.message || 'Erreur lors du chargement de l\'historique';
        this.isLoadingHistorique = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Filtrer les campagnes
   */
  filtrerCampagnes(): void {
    this.campagnesFiltrees = this.campagnes.filter(c => {
      const matchSearch = !this.searchTerm ||
        c.titreCampagne.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        c.description?.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchSearch;
    });
  }

  /**
   * Filtrer l'historique
   */
  filtrerHistorique(): void {
    this.mesCandidaturesFiltrees = this.mesCandidatures.filter(c => {
      const matchSearch = !this.searchTerm ||
        c.profil?.titreProfil?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        c.campagne?.titreCampagne?.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchStatut = !this.filtreStatutHistorique || c.statusCandidature === this.filtreStatutHistorique;
      return matchSearch && matchStatut;
    });
  }

  /**
   * Ouvrir le modal de détails campagne
   */
  voirDetails(campagne: CampagneRecrutement): void {
    this.selectedCampagne = campagne;
    this.selectedProfil = null;
    this.showDetailModal = true;
    this.loadProfilsCampagne(campagne.idcampagne);
  }

  /**
   * Charger les profils d'une campagne
   */
  loadProfilsCampagne(campagneId: number): void {
    this.loadingProfils = true;
    this.http.get<any>(`${this.apiUrl}/recrutement/campagnes/${campagneId}/profils`).subscribe({
      next: (response) => {
        if (response.success && this.selectedCampagne) {
          this.selectedCampagne.profils = response.data;
        }
        this.loadingProfils = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erreur:', error);
        this.loadingProfils = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Fermer le modal de détails
   */
  fermerDetailModal(): void {
    this.showDetailModal = false;
    this.selectedCampagne = null;
    this.selectedProfil = null;
  }

  /**
   * Sélectionner un profil pour postuler
   */
  selectProfil(profil: ProfilRecrutement): void {
    this.selectedProfil = profil;
    this.documentsUploades = {};
    this.errorDocuments = '';
    this.showPostulerModal = true;
  }

  /**
   * Fermer le modal postuler
   */
  fermerPostulerModal(): void {
    this.showPostulerModal = false;
    this.selectedProfil = null;
    this.documentsUploades = {};
    this.errorDocuments = '';
  }

  /**
   * Déclencher le clic sur un input file via son ID
   */
  triggerFileInput(inputId: string): void {
    // Utiliser setTimeout pour s'assurer que l'input est bien rendu
    setTimeout(() => {
      const input = document.getElementById(inputId) as HTMLInputElement;
      if (input) {
        input.click();
      }
    }, 0);
  }

  /**
   * Gestion de la sélection de fichier pour les documents complémentaires
   */
  onDocumentFileChange(event: Event, typeDocument: string): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    // Vérifier le type de fichier (accepter les PDF)
    if (file.type !== 'application/pdf') {
      this.errorDocuments = 'Seuls les fichiers PDF sont acceptés';
      input.value = ''; // Réinitialiser l'input
      this.cdr.detectChanges();
      return;
    }

    // Vérifier la taille (max 5Mo)
    if (file.size > 5 * 1024 * 1024) {
      this.errorDocuments = 'Le fichier ne doit pas dépasser 5 Mo';
      input.value = ''; // Réinitialiser l'input
      this.cdr.detectChanges();
      return;
    }

    this.errorDocuments = '';

    // Stocker le fichier avec une copie explicite pour éviter les problèmes de référence
    this.documentsUploades = {
      ...this.documentsUploades,
      [typeDocument]: file
    };

    // Réinitialiser l'input pour permettre de resélectionner le même fichier
    input.value = '';

    // Forcer la mise à jour de l'interface
    this.cdr.detectChanges();
  }

  /**
   * Gestion de la sélection de fichier
   */
  onFileSelected(event: Event, typeDocument: string): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    // Vérifier le type de fichier
    if (file.type !== 'application/pdf') {
      this.errorDocuments = 'Seuls les fichiers PDF sont acceptés';
      this.cdr.detectChanges();
      return;
    }

    // Vérifier la taille (max 5Mo)
    if (file.size > 5 * 1024 * 1024) {
      this.errorDocuments = 'Le fichier ne doit pas dépasser 5 Mo';
      this.cdr.detectChanges();
      return;
    }

    this.errorDocuments = '';
    this.documentsUploades[typeDocument] = file;

    // Réinitialiser l'input pour permettre de resélectionner le même fichier
    input.value = '';

    // Forcer la mise à jour de l'interface
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  /**
   * Supprimer un document uploadé
   */
  removeDocument(typeDocument: string): void {
    delete this.documentsUploades[typeDocument];
    this.cdr.detectChanges();
  }

  /**
   * TrackBy pour ngFor des documents
   */
  trackByDocCode(index: number, doc: DocumentRequis): string {
    return doc.code;
  }

  /**
   * Labels des documents
   */
  private documentLabels: { [key: string]: string } = {
    'DEMANDE_MANUSCRITE': 'Demande manuscrite adressée au DG',
    'CNIB': 'Copie légalisée de la CNIB',
    'DIPLOMES': 'Copies légalisées des diplômes',
    'EXTRAIT_NAISSANCE': 'Extrait d\'acte de naissance',
    'CERTIFICAT_NATIONALITE': 'Certificat de nationalité',
    'CASIER_JUDICIAIRE': 'Casier judiciaire (bulletin n°3)',
    'VISITE_MEDICALE': 'Certificat de visite et contre-visite médicale',
    'ATTESTATION_TRAVAIL': 'Attestations/Certificats de travail',
    'PERMIS_CONDUIRE': 'Copie légalisée du permis de conduire',
  };

  /**
   * Obtenir les documents requis pour le profil sélectionné
   */
  getDocumentsRequisProfil(): DocumentRequis[] {
    if (!this.selectedProfil?.documentsRequis) return [];

    return this.selectedProfil.documentsRequis.map(code => ({
      code,
      label: this.documentLabels[code] || code,
      required: true
    }));
  }

  /**
   * Obtenir les documents requis pour le profil sélectionné (sans DEMANDE_MANUSCRITE car déjà dans les obligatoires)
   */
  getDocumentsRequisProfilFiltres(): DocumentRequis[] {
    return this.getDocumentsRequisProfil().filter(doc => doc.code !== 'DEMANDE_MANUSCRITE');
  }

  /**
   * Vérifier si on peut soumettre la candidature
   */
  canSubmitCandidature(): boolean {
    // Le CV est toujours obligatoire
    if (!this.documentsUploades['CV']) {
      return false;
    }

    // La demande manuscrite est obligatoire (remplace la lettre de motivation)
    if (!this.documentsUploades['DEMANDE_MANUSCRITE']) {
      return false;
    }

    // Vérifier les documents requis par le profil (sauf DEMANDE_MANUSCRITE déjà vérifiée)
    const documentsRequis = this.getDocumentsRequisProfil();
    for (const doc of documentsRequis) {
      if (doc.required && doc.code !== 'DEMANDE_MANUSCRITE' && !this.documentsUploades[doc.code]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculer le nombre de documents uploadés
   */
  getUploadedDocumentsCount(): number {
    return Object.keys(this.documentsUploades).length;
  }

  /**
   * Calculer le nombre total de documents requis
   */
  getTotalRequiredDocuments(): number {
    // CV + Demande manuscrite + autres documents du profil (sans dupliquer DEMANDE_MANUSCRITE)
    const docsRequisProfil = this.getDocumentsRequisProfil().filter(d => d.code !== 'DEMANDE_MANUSCRITE');
    return 2 + docsRequisProfil.length;
  }

  /**
   * Calculer le pourcentage de progression de l'upload
   */
  getUploadProgress(): number {
    const total = this.getTotalRequiredDocuments();
    if (total === 0) return 0;
    return Math.min(100, (this.getUploadedDocumentsCount() / total) * 100);
  }

  /**
   * Postuler à un profil avec documents
   */
  postuler(): void {
    if (!this.selectedProfil || !this.canSubmitCandidature()) return;

    this.isPostulating = true;
    this.errorDocuments = '';

    // Étape 1: Créer la candidature
    this.http.post<any>(`${this.apiUrl}/recrutement/candidatures`, {
      profil_idprofil: this.selectedProfil.idprofil
    }).subscribe({
      next: (response) => {
        if (response.success) {
          const candidatureId = response.data.idcandidature;

          // Étape 2: Uploader les documents
          this.uploadAllDocuments(candidatureId);
        } else {
          this.errorDocuments = response.message || 'Erreur lors de la candidature';
          this.isPostulating = false;
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        console.error('Erreur:', error);
        this.errorDocuments = error.error?.message || 'Erreur lors de la candidature';
        this.isPostulating = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Uploader tous les documents pour une candidature
   */
  private uploadAllDocuments(candidatureId: number): void {
    const documentsToUpload = Object.entries(this.documentsUploades);
    let uploadedCount = 0;
    let hasError = false;

    if (documentsToUpload.length === 0) {
      this.finalizeCandidature();
      return;
    }

    documentsToUpload.forEach(([typeDocument, file], index) => {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('typeDocument', typeDocument);
      formData.append('ordre', (index + 1).toString());

      this.http.post<any>(
        `${this.apiUrl}/recrutement/candidatures/${candidatureId}/documents`,
        formData
      ).subscribe({
        next: () => {
          uploadedCount++;
          if (uploadedCount === documentsToUpload.length && !hasError) {
            this.finalizeCandidature();
          }
        },
        error: (error) => {
          console.error('Erreur upload document:', error);
          hasError = true;
          // On continue quand même pour ne pas bloquer
          uploadedCount++;
          if (uploadedCount === documentsToUpload.length) {
            this.finalizeCandidature();
          }
        }
      });
    });
  }

  /**
   * Finaliser la candidature après upload des documents
   */
  private finalizeCandidature(): void {
    this.isPostulating = false;
    alert('Votre candidature a été soumise avec succès !');
    this.fermerPostulerModal();
    this.fermerDetailModal();
    this.loadCampagnesActives();
    this.loadMesCandidatures();
    this.cdr.detectChanges();
  }

  /**
   * Voir détails d'une candidature
   */
  voirDetailsCandidature(candidature: MaCandidatureRecrutement): void {
    this.selectedCandidature = candidature;
    this.showCandidatureDetailModal = true;
  }

  /**
   * Fermer modal détails candidature
   */
  fermerCandidatureDetailModal(): void {
    this.showCandidatureDetailModal = false;
    this.selectedCandidature = null;
  }

  /**
   * Calculer le nombre de jours restants
   */
  getJoursRestants(dateFin: string): number {
    const fin = new Date(dateFin);
    const today = new Date();
    const diff = fin.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculer le nombre total de postes
   */
  getTotalPostes(campagne: CampagneRecrutement): number {
    return campagne.profils?.reduce((sum, p) => sum + p.nombrePostes, 0) || 0;
  }

  /**
   * Vérifier si on peut postuler à un profil
   */
  canPostuler(profil: ProfilRecrutement): boolean {
    // Vérifier si le profil est actif et pas complet
    if (profil.statusProfil !== 'ACTIF' || profil.nombreCandidaturesActuelles >= profil.nombreCandidaturesMax) {
      return false;
    }
    // Vérifier si le candidat a déjà postulé à ce profil
    return !this.hasAlreadyApplied(profil.idprofil);
  }

  /**
   * Vérifier si le candidat a déjà postulé à un profil
   */
  hasAlreadyApplied(profilId: number): boolean {
    return this.mesCandidatures.some(c => c.profil?.idprofil === profilId);
  }

  /**
   * Obtenir le message d'indisponibilité d'un profil
   */
  getProfilIndisponibleMessage(profil: ProfilRecrutement): string {
    if (this.hasAlreadyApplied(profil.idprofil)) {
      return 'Déjà postulé';
    }
    if (profil.nombreCandidaturesActuelles >= profil.nombreCandidaturesMax) {
      return 'Complet';
    }
    if (profil.statusProfil !== 'ACTIF') {
      return 'Fermé';
    }
    return '';
  }

  /**
   * Calculer le total des profils disponibles
   */
  getTotalProfilsDisponibles(): number {
    let total = 0;
    this.campagnes.forEach(c => {
      if (c.profils) {
        c.profils.forEach(p => {
          total += p.nombrePostes;
        });
      }
    });
    return total;
  }

  /**
   * Obtenir la classe CSS pour un statut de candidature
   */
  getStatutClass(statut: string): string {
    const classes: { [key: string]: string } = {
      'SOUMISE': 'bg-yellow-100 text-yellow-700',
      'EN_EXAMEN': 'bg-blue-100 text-blue-700',
      'RETENUE': 'bg-green-100 text-green-700',
      'REJETEE': 'bg-red-100 text-red-700',
      'LISTE_ATTENTE': 'bg-orange-100 text-orange-700',
    };
    return classes[statut] || 'bg-gray-100 text-gray-700';
  }

  /**
   * Obtenir le libellé d'un statut
   */
  getStatutLabel(statut: string): string {
    const labels: { [key: string]: string } = {
      'SOUMISE': 'Soumise',
      'EN_EXAMEN': 'En examen',
      'RETENUE': 'Retenue',
      'REJETEE': 'Rejetée',
      'LISTE_ATTENTE': 'Liste d\'attente',
    };
    return labels[statut] || statut;
  }

  /**
   * Obtenir les statuts uniques
   */
  getStatutsUniques(): string[] {
    return [...new Set(this.mesCandidatures.map(c => c.statusCandidature))];
  }

  /**
   * Compter par statut
   */
  getCountByStatut(statut: string): number {
    return this.mesCandidatures.filter(c => c.statusCandidature === statut).length;
  }

  /**
   * Calculer les candidatures restantes pour un profil
   */
  getCandidaturesRestantes(profil: ProfilRecrutement): number {
    return Math.max(0, profil.nombreCandidaturesMax - profil.nombreCandidaturesActuelles);
  }

  /**
   * Obtenir la classe CSS pour les candidatures restantes
   */
  getCandidaturesRestantesClass(profil: ProfilRecrutement): string {
    const restantes = this.getCandidaturesRestantes(profil);
    const pourcentage = (profil.nombreCandidaturesActuelles / profil.nombreCandidaturesMax) * 100;

    if (restantes === 0) {
      return 'bg-red-100 text-red-700';
    } else if (pourcentage >= 80) {
      return 'bg-orange-100 text-orange-700';
    } else if (pourcentage >= 50) {
      return 'bg-yellow-100 text-yellow-700';
    } else {
      return 'bg-green-100 text-green-700';
    }
  }

  /**
   * Calculer le pourcentage de progression
   */
  getProgressPercentage(profil: ProfilRecrutement): number {
    if (profil.nombreCandidaturesMax === 0) return 0;
    return Math.min(100, (profil.nombreCandidaturesActuelles / profil.nombreCandidaturesMax) * 100);
  }

  /**
   * Obtenir la classe CSS pour la barre de progression
   */
  getProgressBarClass(profil: ProfilRecrutement): string {
    const pourcentage = this.getProgressPercentage(profil);

    if (pourcentage >= 100) {
      return 'bg-red-500';
    } else if (pourcentage >= 80) {
      return 'bg-orange-500';
    } else if (pourcentage >= 50) {
      return 'bg-yellow-500';
    } else {
      return 'bg-green-500';
    }
  }
}
