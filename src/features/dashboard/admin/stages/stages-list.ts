// src/features/dashboard/admin/stages/stages-list.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { saveAs } from 'file-saver';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AdminStageService, Stage, StageDetails, StageStats, StageFilters, RapportStage } from '../../../../core/services/admin-stage.service';
import { SearchService } from '../../../../core/services/search.service';
import { environment } from '../../../../environments/environment';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

@Component({
  selector: 'app-stages-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './stages-list.html',
  styles: [`
    .toast-enter {
      animation: slideInRight 0.3s ease-out;
    }
    .toast-leave {
      animation: slideOutRight 0.3s ease-in;
    }
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `]
})
export class StagesList implements OnInit, OnDestroy {
  // Donnees
  stages: Stage[] = [];
  stats: StageStats | null = null;
  selectedStage: StageDetails | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;
  totalPages = 0;

  // Filtres et recherche
  searchTerm = '';
  filtreStatut = '';
  filtreType = '';
  filtreDomaine = '';
  domaines: string[] = [];

  // Etat
  loading = false;
  submitting = false;
  error = '';

  // Modal de confirmation personnalisé
  confirmModal: {
    show: boolean;
    title: string;
    message: string;
    confirmText: string;
    confirmStyle: string;
    iconPath: string;
    iconColor: string;
    onConfirm: () => void;
  } = {
    show: false, title: '', message: '', confirmText: '', confirmStyle: '',
    iconPath: '', iconColor: '', onConfirm: () => {}
  };

  openConfirmModal(cfg: { title: string; message: string; confirmText: string; confirmStyle: string; iconPath: string; iconColor: string; onConfirm: () => void }): void {
    this.confirmModal = { show: true, ...cfg };
    this.cdr.detectChanges();
  }

  closeConfirmModal(): void {
    this.confirmModal.show = false;
    this.cdr.detectChanges();
  }

  executeConfirm(): void {
    this.confirmModal.show = false;
    this.confirmModal.onConfirm();
    this.cdr.detectChanges();
  }

  // Modal
  showModal = false;
  modalMode: 'view' | 'accept' | 'reject' | 'rapport' | 'attestation' = 'view';

  // Rapports
  rapports: RapportStage[] = [];
  selectedRapport: RapportStage | null = null;
  showRapportsModal = false;
  loadingRapports = false;
  filtreStatutRapport = '';

  // Formulaire d'acceptation/rejet
  acceptForm = {
    dateDebutEffective: '',
    conventionFile: null as File | null
  };
  rejectForm = {
    motifRefus: ''
  };

  // Formulaire d'evaluation du rapport
  evaluateRapportForm = {
    statusRapport: '' as 'EN_EVALUATION' | 'VALIDE' | 'REFUSE' | '',
    motifRefus: ''
  };

  // Formulaire d'attestation
  attestationForm = {
    dateEmission: '',
    attestationFile: null as File | null
  };

  // Toast notifications
  toasts: Toast[] = [];
  private toastId = 0;
  private searchSub?: Subscription;

  constructor(
    private adminStageService: AdminStageService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private searchService: SearchService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadStages();
    this.loadDomaines();
    this.searchSub = this.searchService.term$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
    ).subscribe(term => {
      this.searchTerm = term;
      this.currentPage = 1;
      this.loadStages();
    });

    // Ouvrir directement le détail si ?open=ID dans l'URL (depuis notification)
    const openId = this.route.snapshot.queryParamMap.get('open');
    if (openId) {
      this.adminStageService.getStageById(+openId).subscribe({
        next: (res) => {
          if (res.success) {
            this.selectedStage = res.data;
            this.modalMode = 'view';
            this.showModal = true;
            this.cdr.detectChanges();
          }
        },
      });
    }
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  // ==================== TOAST NOTIFICATIONS ====================
  showToast(type: 'success' | 'error' | 'warning' | 'info', title: string, message: string): void {
    const toast: Toast = {
      id: ++this.toastId,
      type,
      title,
      message
    };
    this.toasts.push(toast);
    this.cdr.detectChanges();

    setTimeout(() => {
      this.ngZone.run(() => {
        this.removeToast(toast.id);
      });
    }, 5000);
  }

  removeToast(id: number): void {
    const index = this.toasts.findIndex(t => t.id === id);
    if (index > -1) {
      this.toasts.splice(index, 1);
      this.cdr.detectChanges();
    }
  }

  getToastIcon(type: string): string {
    switch (type) {
      case 'success': return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'error': return 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'warning': return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
      case 'info': return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
      default: return '';
    }
  }

  getToastBgClass(type: string): string {
    switch (type) {
      case 'success': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'info': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  }

  // ==================== DATA LOADING ====================
  loadDomaines(): void {
    this.adminStageService.getDomaines().subscribe({
      next: (response) => {
        if (response.success) {
          this.domaines = response.data;
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Erreur chargement domaines:', err)
    });
  }

  loadStats(): void {
    this.adminStageService.getStats().subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.stats = response.data;
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error('Erreur chargement stats:', err);
        this.cdr.detectChanges();
      }
    });
  }

  loadStages(): void {
    this.loading = true;
    this.error = '';

    const filters: StageFilters = {
      page: this.currentPage,
      limit: this.pageSize
    };

    if (this.searchTerm) {
      filters.search = this.searchTerm;
    }

    if (this.filtreStatut) {
      filters.statusStage = this.filtreStatut;
    }

    if (this.filtreType) {
      filters.typeStage = this.filtreType;
    }

    if (this.filtreDomaine) {
      filters.domaineStage = this.filtreDomaine;
    }

    this.adminStageService.getStages(filters).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.stages = response.data.items;
            this.totalItems = response.data.total;
            this.totalPages = response.data.totalPages;
          }
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.error = 'Erreur lors du chargement des stages';
          this.loading = false;
          console.error('Erreur:', err);
          this.cdr.detectChanges();
        });
      }
    });
  }

  // ==================== SEARCH & FILTER ====================
  onSearch(): void {
    this.currentPage = 1;
    this.loadStages();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadStages();
  }

  // ==================== PAGINATION ====================
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadStages();
    }
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  // ==================== MODAL MANAGEMENT ====================
  openViewModal(stage: Stage): void {
    this.modalMode = 'view';
    this.loading = true;
    this.showModal = true;

    this.adminStageService.getStageById(stage.idstage).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.selectedStage = response.data;
          }
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.showToast('error', 'Erreur', 'Impossible de charger les details du stage');
          this.loading = false;
          this.showModal = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  openAcceptModal(stage: Stage): void {
    this.modalMode = 'accept';
    this.selectedStage = stage as StageDetails;
    // Pre-remplir avec la date souhaitee par le candidat
    this.acceptForm.dateDebutEffective = stage.dateDebutSouhaitee ? stage.dateDebutSouhaitee.split('T')[0] : '';
    this.showModal = true;
  }

  openRejectModal(stage: Stage): void {
    this.modalMode = 'reject';
    this.selectedStage = stage as StageDetails;
    this.rejectForm.motifRefus = '';
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedStage = null;
    this.selectedRapport = null;
    this.acceptForm = { dateDebutEffective: '', conventionFile: null };
    this.rejectForm = { motifRefus: '' };
    this.evaluateRapportForm = { statusRapport: '', motifRefus: '' };
    this.attestationForm = { dateEmission: '', attestationFile: null };
  }

  // ==================== FILE UPLOAD ====================
  onConventionFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.type !== 'application/pdf') {
        this.showToast('error', 'Erreur', 'Seuls les fichiers PDF sont acceptes');
        input.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        this.showToast('error', 'Erreur', 'Le fichier ne doit pas depasser 5 Mo');
        input.value = '';
        return;
      }
      this.acceptForm.conventionFile = file;
    }
  }

  // ==================== ACTIONS ====================
  accepterStage(): void {
    if (!this.selectedStage) return;

    if (!this.acceptForm.dateDebutEffective) {
      this.showToast('error', 'Erreur', 'La date de debut effective est obligatoire');
      return;
    }

    if (!this.acceptForm.conventionFile) {
      this.showToast('error', 'Erreur', 'La convention de stage (PDF) est obligatoire');
      return;
    }

    this.submitting = true;
    const stageName = `${this.selectedStage.candidat.prenom} ${this.selectedStage.candidat.nom}`;

    this.adminStageService.updateStatus(
      this.selectedStage.idstage,
      {
        statusStage: 'ACCEPTE',
        dateDebutEffective: this.acceptForm.dateDebutEffective
      },
      this.acceptForm.conventionFile
    ).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.closeModal();
            this.loadStages();
            this.loadStats();
            this.showToast('success', 'Accepte !', `La demande de stage de ${stageName} a ete acceptee`);
          }
          this.submitting = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.showToast('error', 'Erreur', err.error?.message || 'Erreur lors de l\'acceptation');
          this.submitting = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  refuserStage(): void {
    if (!this.selectedStage) return;

    if (!this.rejectForm.motifRefus.trim()) {
      this.showToast('error', 'Erreur', 'Le motif de refus est obligatoire');
      return;
    }

    this.submitting = true;
    const stageName = `${this.selectedStage.candidat.prenom} ${this.selectedStage.candidat.nom}`;

    this.adminStageService.updateStatus(this.selectedStage.idstage, {
      statusStage: 'REJETE',
      motifRefus: this.rejectForm.motifRefus
    }).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.closeModal();
            this.loadStages();
            this.loadStats();
            this.showToast('info', 'Refuse', `La demande de stage de ${stageName} a ete refusee`);
          }
          this.submitting = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.showToast('error', 'Erreur', err.error?.message || 'Erreur lors du refus');
          this.submitting = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  mettreEnTraitement(stage: Stage): void {
    this.openConfirmModal({
      title: 'Mettre en traitement',
      message: `Confirmez-vous la prise en charge de la demande de <strong>${stage.candidat.prenom} ${stage.candidat.nom}</strong> ?`,
      confirmText: 'Mettre en traitement',
      confirmStyle: 'bg-orange-500 hover:bg-orange-600 text-white',
      iconPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      iconColor: 'text-orange-500',
      onConfirm: () => {
        this.submitting = true;
        this.adminStageService.updateStatus(stage.idstage, {
          statusStage: 'EN_COURS_DE_TRAITEMENT'
        }).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.loadStages();
            this.loadStats();
            this.showToast('success', 'En traitement', `La demande de ${stage.candidat.prenom} ${stage.candidat.nom} est maintenant en cours de traitement`);
          }
          this.submitting = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.showToast('error', 'Erreur', err.error?.message || 'Erreur lors de la mise en traitement');
          this.submitting = false;
          this.cdr.detectChanges();
        });
      }
    });
      }
    });
  }

  demarrerStage(stage: Stage): void {
    this.openConfirmModal({
      title: 'Démarrer le stage',
      message: `Confirmez-vous le démarrage du stage de <strong>${stage.candidat.prenom} ${stage.candidat.nom}</strong> ?`,
      confirmText: 'Démarrer',
      confirmStyle: 'bg-green-600 hover:bg-green-700 text-white',
      iconPath: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      iconColor: 'text-green-500',
      onConfirm: () => {
        this.submitting = true;
        this.adminStageService.updateStatus(stage.idstage, {
      statusStage: 'EN_COURS'
    }).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.loadStages();
            this.loadStats();
            this.showToast('success', 'Demarre !', `Le stage de ${stage.candidat.prenom} ${stage.candidat.nom} est maintenant en cours`);
          }
          this.submitting = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.showToast('error', 'Erreur', err.error?.message || 'Erreur lors du demarrage');
          this.submitting = false;
          this.cdr.detectChanges();
        });
      }
    });
      }
    });
  }

  expirerStage(stage: Stage): void {
    this.openConfirmModal({
      title: 'Marquer comme expiré',
      message: `Confirmez-vous que le stage de <strong>${stage.candidat.prenom} ${stage.candidat.nom}</strong> est expiré ?`,
      confirmText: 'Marquer expiré',
      confirmStyle: 'bg-gray-600 hover:bg-gray-700 text-white',
      iconPath: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      iconColor: 'text-gray-500',
      onConfirm: () => {
        this.submitting = true;
        this.adminStageService.updateStatus(stage.idstage, {
      statusStage: 'EXPIRE'
    }).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.loadStages();
            this.loadStats();
            this.showToast('success', 'Expire !', `Le stage de ${stage.candidat.prenom} ${stage.candidat.nom} a ete marque comme expire`);
          }
          this.submitting = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.showToast('error', 'Erreur', err.error?.message || 'Erreur');
          this.submitting = false;
          this.cdr.detectChanges();
        });
      }
    });
      }
    });
  }

  /**
   * Ouvre ou télécharge un blob PDF
   * @param blob     le Blob reçu du serveur
   * @param filename nom du fichier pour le téléchargement
   * @param mode     'voir' → nouvel onglet | 'telecharger' → force le download
   */
  private ouvrirOuTelechargerBlob(blob: Blob, filename: string, mode: 'voir' | 'telecharger'): void {
    const pdfBlob = new Blob([blob], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(pdfBlob);

    if (mode === 'voir') {
      const onglet = window.open(url, '_blank');
      if (onglet) {
        setTimeout(() => window.URL.revokeObjectURL(url), 10000);
      } else {
        this.showToast('warning', 'Popup bloqué', 'Autorisez les popups pour visualiser le document');
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
  }

  /** Voir ou télécharger un document soumis par le candidat */
  accederDocument(documentType: string, filename: string, mode: 'voir' | 'telecharger'): void {
    if (!this.selectedStage) return;

    this.adminStageService.downloadDocument(this.selectedStage.idstage, documentType).subscribe({
      next: (blob) => this.ouvrirOuTelechargerBlob(blob, filename, mode),
      error: () => this.showToast('error', 'Erreur', 'Impossible de charger le document')
    });
  }

  /** Voir ou télécharger la lettre de renouvellement */
  accederLettreRenouvellement(mode: 'voir' | 'telecharger'): void {
    const renouv = this.selectedStage?.renouvellementInfo;
    if (!renouv) return;
    const filename = renouv.lettreMotivationRenouvellement_filename || `lettre_renouvellement_${renouv.idrenouvellement}.pdf`;

    this.adminStageService.downloadLettreRenouvellement(renouv.idrenouvellement).subscribe({
      next: (blob) => this.ouvrirOuTelechargerBlob(blob, filename, mode),
      error: () => this.showToast('error', 'Erreur', 'Impossible de charger la lettre de renouvellement')
    });
  }

  /** Voir ou télécharger la convention du renouvellement */
  accederConventionRenouvellement(mode: 'voir' | 'telecharger'): void {
    const renouv = this.selectedStage?.renouvellementInfo;
    if (!renouv) return;
    const filename = renouv.conventionStageEnCours_filename || `convention_stage_en_cours_${renouv.idrenouvellement}.pdf`;

    this.adminStageService.downloadConventionRenouvellement(renouv.idrenouvellement).subscribe({
      next: (blob) => this.ouvrirOuTelechargerBlob(blob, filename, mode),
      error: () => this.showToast('error', 'Erreur', 'Impossible de charger la convention')
    });
  }

  /** Alias rétrocompatibilité */
  downloadDocument(documentType: string): void { this.accederDocument(documentType, `${documentType}_${this.selectedStage?.idstage}.pdf`, 'telecharger'); }
  downloadLettreRenouvellement(): void { this.accederLettreRenouvellement('telecharger'); }
  downloadConventionRenouvellement(): void { this.accederConventionRenouvellement('telecharger'); }

  /** Télécharger tous les documents soumis dans un ZIP nommé après le candidat */
  async downloadAllDocuments(): Promise<void> {
    if (!this.selectedStage) return;

    const docs = [
      { key: 'cv',                   filename: this.selectedStage.cv_filename },
      { key: 'cnib',                 filename: this.selectedStage.cnib_filename },
      { key: 'casierJudiciaire',     filename: this.selectedStage.casierJudiciaire_filename },
      { key: 'lettreMotivation',     filename: this.selectedStage.lettreMotivation_filename },
      { key: 'lettreRecommandation', filename: this.selectedStage.lettreRecommandation_filename },
      { key: 'dernierDiplome',       filename: this.selectedStage.dernierDiplome_filename },
    ].filter((d): d is { key: string; filename: string } => !!d.filename);

    if (docs.length === 0) {
      this.showToast('warning', 'Aucun document', 'Ce dossier ne contient aucun document.');
      return;
    }

    const stageId = this.selectedStage.idstage;
    const candidatNom = `${this.selectedStage.candidat.prenom}_${this.selectedStage.candidat.nom}`.replace(/\s+/g, '_');
    this.showToast('info', 'Préparation...', 'Création du dossier en cours...');

    const blobs = await Promise.all(
      docs.map(d =>
        firstValueFrom(this.adminStageService.downloadDocument(stageId, d.key)).catch(() => null)
      )
    );

    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    blobs.forEach((blob, i) => {
      if (blob) zip.file(docs[i].filename, blob);
    });

    const content: Blob = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `Dossier_${candidatNom}.zip`);
    this.showToast('success', 'Téléchargé', `Dossier_${candidatNom}.zip`);
  }

  // ==================== HELPERS ====================
  getCandidatName(stage: Stage): string {
    return `${stage.candidat.prenom} ${stage.candidat.nom}`;
  }

  getInitials(stage: Stage): string {
    return `${stage.candidat.prenom.charAt(0)}${stage.candidat.nom.charAt(0)}`.toUpperCase();
  }

  formatDate(date: string | null): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatDateTime(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getDureeLabel(duree: number): string {
    return duree === 1 ? '1 mois' : `${duree} mois`;
  }

  getStatutClass(statut: string): string {
    const classes: { [key: string]: string } = {
      'EN_ATTENTE': 'bg-yellow-100 text-yellow-700',
      'EN_COURS_DE_TRAITEMENT': 'bg-orange-100 text-orange-700',
      'ACCEPTE': 'bg-green-100 text-green-700',
      'EN_COURS': 'bg-blue-100 text-blue-700',
      'TERMINE': 'bg-teal-100 text-teal-700',
      'REJETE': 'bg-red-100 text-red-700',
      'EXPIRE': 'bg-gray-100 text-gray-700',
      'RAPPORT_SOUMIS': 'bg-purple-100 text-purple-700'
    };
    return classes[statut] || 'bg-gray-100 text-gray-700';
  }

  getStatutLabel(statut: string): string {
    const labels: { [key: string]: string } = {
      'EN_ATTENTE': 'En attente',
      'EN_COURS_DE_TRAITEMENT': 'En traitement',
      'ACCEPTE': 'Accepte',
      'EN_COURS': 'En cours',
      'TERMINE': 'Termine',
      'REJETE': 'Rejete',
      'EXPIRE': 'Expire',
      'RAPPORT_SOUMIS': 'Rapport soumis'
    };
    return labels[statut] || statut;
  }

  getTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'SOUTENANCE': 'Soutenance',
      'PERFECTIONNEMENT': 'Perfectionnement'
    };
    return labels[type] || type;
  }

  getNiveauLabel(niveau: string | null): string {
    if (!niveau) return 'N/A';
    const labels: { [key: string]: string } = {
      'LICENCE': 'Licence',
      'MASTER': 'Master',
      'DOCTORAT': 'Doctorat'
    };
    return labels[niveau] || niveau;
  }

  // ==================== EXPORT ====================
  exporterStages(): void {
    let url = `${environment.apiUrl}/stages/export`;
    const params: string[] = [];
    if (this.filtreStatut) params.push(`statusStage=${encodeURIComponent(this.filtreStatut)}`);
    if (this.filtreType)   params.push(`typeStage=${encodeURIComponent(this.filtreType)}`);
    if (params.length)     url += '?' + params.join('&');

    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const today = new Date().toISOString().slice(0, 10);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `stages_${today}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        this.showToast('success', 'Export', 'Fichier CSV téléchargé avec succès');
        this.cdr.detectChanges();
      },
      error: () => {
        this.showToast('error', 'Export', 'Impossible de générer le fichier CSV');
        this.cdr.detectChanges();
      },
    });
  }

  // ==================== RAPPORTS DE STAGE ====================

  /**
   * Ouvrir le modal des rapports de stage
   */
  openRapportsModal(): void {
    this.showRapportsModal = true;
    this.loadRapports();
  }

  closeRapportsModal(): void {
    this.showRapportsModal = false;
    this.rapports = [];
    this.selectedRapport = null;
    this.filtreStatutRapport = '';
  }

  loadRapports(): void {
    this.loadingRapports = true;
    const filters: { statusRapport?: string } = {};
    if (this.filtreStatutRapport) {
      filters.statusRapport = this.filtreStatutRapport;
    }

    this.adminStageService.getRapports(filters).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.rapports = response.data;
          }
          this.loadingRapports = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.showToast('error', 'Erreur', 'Impossible de charger les rapports');
          this.loadingRapports = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  onFiltreRapportChange(): void {
    this.loadRapports();
  }

  /**
   * Telecharger le PDF d'un rapport
   */
  downloadRapport(rapport: RapportStage): void {
    this.adminStageService.downloadRapport(rapport.idrapport).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = rapport.rapportPdf_filename || `rapport_${rapport.idrapport}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.showToast('success', 'Telecharge', 'Le rapport a ete telecharge');
      },
      error: (err) => {
        this.showToast('error', 'Erreur', 'Impossible de telecharger le rapport');
      }
    });
  }

  /**
   * Ouvrir le modal d'evaluation d'un rapport
   */
  openEvaluateRapportModal(rapport: RapportStage): void {
    // Fermer le modal des rapports d'abord
    this.showRapportsModal = false;

    this.selectedRapport = rapport;
    this.modalMode = 'rapport';
    this.evaluateRapportForm = {
      statusRapport: '',
      motifRefus: rapport.motifRefus || ''
    };
    this.showModal = true;
  }

  /**
   * Evaluer un rapport (valider, refuser, mettre en evaluation)
   */
  evaluateRapport(): void {
    if (!this.selectedRapport) return;

    if (!this.evaluateRapportForm.statusRapport) {
      this.showToast('error', 'Erreur', 'Veuillez selectionner un statut');
      return;
    }

    if (this.evaluateRapportForm.statusRapport === 'REFUSE' && !this.evaluateRapportForm.motifRefus.trim()) {
      this.showToast('error', 'Erreur', 'Le motif de refus est obligatoire');
      return;
    }

    this.submitting = true;
    const data: any = {
      statusRapport: this.evaluateRapportForm.statusRapport
    };

    if (this.evaluateRapportForm.motifRefus) {
      data.motifRefus = this.evaluateRapportForm.motifRefus;
    }

    this.adminStageService.evaluateRapport(this.selectedRapport.idrapport, data).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.closeModal();
            this.loadRapports();
            const statusLabel = this.getRapportStatutLabel(data.statusRapport);
            this.showToast('success', 'Rapport evalue', `Le rapport a ete marque comme "${statusLabel}"`);

            // Si le rapport est valide, proposer de creer une attestation
            if (data.statusRapport === 'VALIDE') {
              this.showToast('info', 'Attestation', 'Vous pouvez maintenant creer une attestation pour ce candidat');
            }
          }
          this.submitting = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.showToast('error', 'Erreur', err.error?.message || 'Erreur lors de l\'evaluation');
          this.submitting = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  /**
   * Ouvrir le modal de creation d'attestation
   */
  openAttestationModal(rapport: RapportStage): void {
    if (rapport.statusRapport !== 'VALIDE') {
      this.showToast('warning', 'Attention', 'Le rapport doit etre valide avant de creer une attestation');
      return;
    }

    // Fermer le modal des rapports d'abord
    this.showRapportsModal = false;

    this.selectedRapport = rapport;
    this.modalMode = 'attestation';
    this.attestationForm = {
      dateEmission: new Date().toISOString().split('T')[0],
      attestationFile: null
    };
    this.showModal = true;
  }

  onAttestationFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.type !== 'application/pdf') {
        this.showToast('error', 'Erreur', 'Seuls les fichiers PDF sont acceptes');
        input.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        this.showToast('error', 'Erreur', 'Le fichier ne doit pas depasser 5 Mo');
        input.value = '';
        return;
      }
      this.attestationForm.attestationFile = file;
    }
  }

  /**
   * Creer une attestation de stage
   */
  createAttestation(): void {
    if (!this.selectedRapport || !this.selectedRapport.stage) return;

    if (!this.attestationForm.attestationFile) {
      this.showToast('error', 'Erreur', 'Le fichier PDF de l\'attestation est obligatoire');
      return;
    }

    if (!this.attestationForm.dateEmission) {
      this.showToast('error', 'Erreur', 'La date d\'emission est obligatoire');
      return;
    }

    this.submitting = true;
    const data = {
      stage_idstage: this.selectedRapport.stage_idstage,
      rapport_idrapport: this.selectedRapport.idrapport,
      typeDocument: 'ATTESTATION' as const,
      dateEmission: this.attestationForm.dateEmission
    };

    this.adminStageService.createAttestation(data, this.attestationForm.attestationFile).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.closeModal();
            this.loadRapports();
            this.showToast('success', 'Attestation creee', 'L\'attestation de stage a ete creee et sera disponible pour le candidat');
          }
          this.submitting = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.showToast('error', 'Erreur', err.error?.message || 'Erreur lors de la creation de l\'attestation');
          this.submitting = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  // ==================== HELPERS RAPPORTS ====================

  getRapportStatutClass(statut: string): string {
    const classes: { [key: string]: string } = {
      'SOUMIS': 'bg-yellow-100 text-yellow-700',
      'EN_EVALUATION': 'bg-blue-100 text-blue-700',
      'VALIDE': 'bg-green-100 text-green-700',
      'REFUSE': 'bg-red-100 text-red-700'
    };
    return classes[statut] || 'bg-gray-100 text-gray-700';
  }

  getRapportStatutLabel(statut: string): string {
    const labels: { [key: string]: string } = {
      'SOUMIS': 'Soumis',
      'EN_EVALUATION': 'En evaluation',
      'VALIDE': 'Valide',
      'REFUSE': 'Refuse'
    };
    return labels[statut] || statut;
  }

  getCandidatNameFromRapport(rapport: RapportStage): string {
    if (rapport.stage && rapport.stage.candidat) {
      return `${rapport.stage.candidat.prenom} ${rapport.stage.candidat.nom}`;
    }
    return 'N/A';
  }

  getInitialsFromRapport(rapport: RapportStage): string {
    if (rapport.stage && rapport.stage.candidat) {
      return `${rapport.stage.candidat.prenom.charAt(0)}${rapport.stage.candidat.nom.charAt(0)}`.toUpperCase();
    }
    return 'NA';
  }

  formatFileSize(size: number): string {
    if (size < 1024) return `${size} o`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} Ko`;
    return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
  }
}
