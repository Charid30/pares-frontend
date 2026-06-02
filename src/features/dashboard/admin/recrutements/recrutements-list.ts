// recrutements-list.ts - Gestion des campagnes de recrutement
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminRecrutementService,
  Campagne,
  Profil,
  CreateCampagneData,
  UpdateCampagneData,
  CreateProfilData,
  UpdateProfilData,
} from '../../../../core/services/admin-recrutement.service';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

interface Stats {
  total: number;
  brouillon: number;
  active: number;
  cloturee: number;
}

// Profil temporaire pour la création multi-profils en étape 2
interface ProfilTemp {
  id: number;
  titreProfil: string;
  description: string;
  competencesRequises: string;
  conditionsRequises: string;
  nombrePostes: number;
  nombreCandidaturesMax: number;
  documentsRequis: string[];
}

@Component({
  selector: 'app-recrutements-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recrutements-list.html',
  styleUrls: ['./recrutements-list.css']
})
export class RecrutementsList implements OnInit {

  // ── Campagnes ─────────────────────────────────────────
  campagnes: Campagne[] = [];
  stats: Stats = { total: 0, brouillon: 0, active: 0, cloturee: 0 };
  searchTerm = '';
  filtreStatut = '';
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;
  totalPages = 1;
  loading = false;
  submitting = false;
  expandedCampagne: number | null = null;

  // ── Modal Campagne (2 étapes) ─────────────────────────
  showCampagneModal = false;
  editingCampagne: Campagne | null = null;
  campagneStep = 1;
  campagneStepError = '';

  // Étape 1 — infos campagne
  campagneInfo = {
    titreCampagne: '',
    description: '',
    dateDebut: '',
    dateFin: '',
    statusCampagne: 'BROUILLON' as string
  };

  // Étape 2 — profils temporaires
  profilsTemp: ProfilTemp[] = [];
  nextProfilTempId = 1;
  profilEnEdition: ProfilTemp | null = null;
  showProfilForm = false;
  profilFormData: ProfilTemp = this.getEmptyProfil();

  // ── Modal vue détail campagne + gestion profils ───────
  showViewModal = false;
  selectedCampagne: Campagne | null = null;

  // ── Modal édition profil existant ─────────────────────
  showProfilEditModal = false;
  editingProfil: Profil | null = null;
  profilEditData: UpdateProfilData & {
    titreProfil: string;
    description: string;
    competencesRequises: string;
    conditionsRequises: string;
    nombrePostes: number;
    nombreCandidaturesMax: number;
    documentsRequis: string[];
    statusProfil: string;
  } = this.getEmptyProfilEdit();

  // ── Modal suppression ─────────────────────────────────
  showDeleteModal = false;
  deleteMessage = '';
  deleteType: 'campagne' | 'profil' = 'campagne';
  deleteId: number | null = null;

  // ── Ajout rapide profil depuis la vue détail ───────────
  showAddProfilInView = false;
  addProfilInViewData: any = this.getEmptyProfilEdit();

  // ── Documents ─────────────────────────────────────────
  typesDocuments = [
    { code: 'CNIB', label: 'Copie légalisée de la CNIB' },
    { code: 'DIPLOMES', label: 'Copies légalisées des diplômes' },
    { code: 'EXTRAIT_NAISSANCE', label: 'Extrait d\'acte de naissance' },
    { code: 'CERTIFICAT_NATIONALITE', label: 'Certificat de nationalité' },
    { code: 'CASIER_JUDICIAIRE', label: 'Casier judiciaire (bulletin n°3)' },
    { code: 'VISITE_MEDICALE', label: 'Certificat de visite et contre-visite médicale' },
    { code: 'ATTESTATION_TRAVAIL', label: 'Attestations/Certificats de travail' },
    { code: 'PERMIS_CONDUIRE', label: 'Copie légalisée du permis de conduire' },
  ];

  // ── Toasts ────────────────────────────────────────────
  toasts: Toast[] = [];
  private toastId = 0;

  constructor(
    private recrutementService: AdminRecrutementService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadCampagnes();
  }

  // =====================================================
  // CHARGEMENT CAMPAGNES
  // =====================================================

  loadCampagnes(): void {
    this.loading = true;
    const filters: any = { page: this.currentPage, limit: this.pageSize };
    if (this.filtreStatut) filters.statusCampagne = this.filtreStatut;
    if (this.searchTerm) filters.search = this.searchTerm;

    this.recrutementService.getAllCampagnes(filters).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          if (response.success) {
            this.campagnes = response.data.items;
            this.totalItems = response.data.total;
            this.totalPages = response.data.totalPages;
            this.currentPage = response.data.page;
            this.calculateStats();
          }
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.showToast('Erreur', 'Impossible de charger les campagnes', 'error');
          this.loading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  calculateStats(): void {
    this.stats = {
      total: this.totalItems,
      brouillon: this.campagnes.filter(c => c.statusCampagne === 'BROUILLON').length,
      active: this.campagnes.filter(c => c.statusCampagne === 'ACTIVE').length,
      cloturee: this.campagnes.filter(c => c.statusCampagne === 'CLOTUREE').length
    };
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.loadCampagnes();
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadCampagnes();
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(this.totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) { start = Math.max(1, end - maxVisible + 1); }
    for (let i = start; i <= end; i++) { pages.push(i); }
    return pages;
  }

  toggleCampagne(id: number): void {
    this.expandedCampagne = this.expandedCampagne === id ? null : id;
  }

  // =====================================================
  // MODAL CAMPAGNE — 2 ÉTAPES
  // =====================================================

  getEmptyProfil(): ProfilTemp {
    return {
      id: 0,
      titreProfil: '',
      description: '',
      competencesRequises: '',
      conditionsRequises: '',
      nombrePostes: 1,
      nombreCandidaturesMax: 100,
      documentsRequis: []
    };
  }

  getEmptyProfilEdit(): any {
    return {
      titreProfil: '',
      description: '',
      competencesRequises: '',
      conditionsRequises: '',
      nombrePostes: 1,
      nombreCandidaturesMax: 100,
      documentsRequis: [],
      statusProfil: 'ACTIF'
    };
  }

  openCreateCampagneModal(): void {
    this.editingCampagne = null;
    this.campagneStep = 1;
    this.campagneStepError = '';
    this.campagneInfo = { titreCampagne: '', description: '', dateDebut: '', dateFin: '', statusCampagne: 'BROUILLON' };
    this.profilsTemp = [];
    this.nextProfilTempId = 1;
    this.showProfilForm = false;
    this.profilFormData = this.getEmptyProfil();
    this.showCampagneModal = true;
  }

  openEditCampagneModal(campagne: Campagne): void {
    this.editingCampagne = campagne;
    this.campagneStep = 1;
    this.campagneStepError = '';
    this.campagneInfo = {
      titreCampagne: campagne.titreCampagne,
      description: campagne.description || '',
      dateDebut: campagne.dateDebut ? campagne.dateDebut.substring(0, 10) : '',
      dateFin: campagne.dateFin ? campagne.dateFin.substring(0, 10) : '',
      statusCampagne: campagne.statusCampagne
    };
    this.profilsTemp = [];
    this.showProfilForm = false;
    this.showCampagneModal = true;
  }

  closeCampagneModal(): void {
    this.showCampagneModal = false;
    this.editingCampagne = null;
    this.campagneStep = 1;
    this.campagneStepError = '';
    this.showProfilForm = false;
  }

  goToStep2(): void {
    this.campagneStepError = '';
    if (!this.campagneInfo.titreCampagne.trim() || this.campagneInfo.titreCampagne.trim().length < 5) {
      this.campagneStepError = 'Le titre est obligatoire (minimum 5 caractères).';
      return;
    }
    if (!this.campagneInfo.dateDebut) {
      this.campagneStepError = 'La date de début est obligatoire.';
      return;
    }
    if (!this.campagneInfo.dateFin) {
      this.campagneStepError = 'La date de fin est obligatoire.';
      return;
    }
    if (this.campagneInfo.dateFin <= this.campagneInfo.dateDebut) {
      this.campagneStepError = 'La date de fin doit être après la date de début.';
      return;
    }
    if (this.editingCampagne) {
      this.submitCampagne();
      return;
    }
    this.campagneStep = 2;
  }

  goToStep1(): void {
    this.campagneStep = 1;
    this.campagneStepError = '';
    this.showProfilForm = false;
  }

  // ── Gestion profils temporaires (étape 2) ─────────────

  openProfilForm(profil?: ProfilTemp): void {
    if (profil) {
      this.profilEnEdition = profil;
      this.profilFormData = { ...profil };
    } else {
      this.profilEnEdition = null;
      this.profilFormData = this.getEmptyProfil();
      this.profilFormData.id = this.nextProfilTempId++;
    }
    this.showProfilForm = true;
  }

  cancelProfilForm(): void {
    this.showProfilForm = false;
    this.profilEnEdition = null;
    this.profilFormData = this.getEmptyProfil();
  }

  saveProfilTemp(): void {
    if (!this.profilFormData.titreProfil.trim()) return;
    if (this.profilEnEdition) {
      const idx = this.profilsTemp.findIndex(p => p.id === this.profilEnEdition!.id);
      if (idx !== -1) this.profilsTemp[idx] = { ...this.profilFormData };
    } else {
      this.profilsTemp.push({ ...this.profilFormData });
    }
    this.cancelProfilForm();
  }

  removeProfilTemp(id: number): void {
    this.profilsTemp = this.profilsTemp.filter(p => p.id !== id);
  }

  toggleDocumentTemp(code: string): void {
    const idx = this.profilFormData.documentsRequis.indexOf(code);
    if (idx === -1) {
      this.profilFormData.documentsRequis = [...this.profilFormData.documentsRequis, code];
    } else {
      this.profilFormData.documentsRequis = this.profilFormData.documentsRequis.filter(c => c !== code);
    }
  }

  isDocumentInTemp(code: string): boolean {
    return this.profilFormData.documentsRequis.includes(code);
  }

  // ── Soumission finale ──────────────────────────────────

  submitCampagne(): void {
    this.submitting = true;
    const data: CreateCampagneData | UpdateCampagneData = {
      titreCampagne: this.campagneInfo.titreCampagne,
      description: this.campagneInfo.description,
      dateDebut: this.campagneInfo.dateDebut,
      dateFin: this.campagneInfo.dateFin,
      statusCampagne: this.campagneInfo.statusCampagne
    };

    if (this.editingCampagne) {
      this.recrutementService.updateCampagne(this.editingCampagne.idcampagne, data).subscribe({
        next: (response) => {
          if (response.success) {
            this.showToast('Succès', 'Campagne mise à jour avec succès', 'success');
            this.closeCampagneModal();
            this.loadCampagnes();
          }
          this.submitting = false;
        },
        error: (err) => {
          this.showToast('Erreur', err.error?.message || 'Erreur lors de la mise à jour', 'error');
          this.submitting = false;
        }
      });
    } else {
      this.recrutementService.createCampagne(data as CreateCampagneData).subscribe({
        next: (response) => {
          if (response.success) {
            const campagneId = response.data.idcampagne;
            if (this.profilsTemp.length > 0) {
              this.creerProfilsEnSequence(campagneId, 0);
            } else {
              this.showToast('Succès', 'Campagne créée avec succès', 'success');
              this.closeCampagneModal();
              this.loadCampagnes();
              this.submitting = false;
            }
          } else {
            this.submitting = false;
          }
        },
        error: (err) => {
          this.showToast('Erreur', err.error?.message || 'Erreur lors de la création', 'error');
          this.submitting = false;
        }
      });
    }
  }

  private creerProfilsEnSequence(campagneId: number, index: number): void {
    if (index >= this.profilsTemp.length) {
      this.showToast('Succès', `Campagne créée avec ${this.profilsTemp.length} profil(s)`, 'success');
      this.closeCampagneModal();
      this.loadCampagnes();
      this.submitting = false;
      return;
    }
    const p = this.profilsTemp[index];
    const profilData: CreateProfilData = {
      campagne_idcampagne: campagneId,
      titreProfil: p.titreProfil,
      description: p.description,
      competencesRequises: p.competencesRequises,
      conditionsRequises: p.conditionsRequises,
      nombrePostes: p.nombrePostes,
      nombreCandidaturesMax: p.nombreCandidaturesMax,
      documentsRequis: p.documentsRequis
    };
    this.recrutementService.createProfil(profilData).subscribe({
      next: () => this.creerProfilsEnSequence(campagneId, index + 1),
      error: () => this.creerProfilsEnSequence(campagneId, index + 1)
    });
  }

  // =====================================================
  // ACTIONS CAMPAGNE
  // =====================================================

  activerCampagne(campagne: Campagne): void {
    this.recrutementService.updateCampagne(campagne.idcampagne, { statusCampagne: 'ACTIVE' }).subscribe({
      next: (r) => { if (r.success) { this.showToast('Succès', 'Campagne activée', 'success'); this.loadCampagnes(); } },
      error: () => this.showToast('Erreur', 'Erreur lors de l\'activation', 'error')
    });
  }

  cloturerCampagne(campagne: Campagne): void {
    this.recrutementService.updateCampagne(campagne.idcampagne, { statusCampagne: 'CLOTUREE' }).subscribe({
      next: (r) => { if (r.success) { this.showToast('Succès', 'Campagne clôturée', 'success'); this.loadCampagnes(); } },
      error: () => this.showToast('Erreur', 'Erreur lors de la clôture', 'error')
    });
  }

  // =====================================================
  // MODAL VUE CAMPAGNE
  // =====================================================

  openViewCampagneModal(campagne: Campagne): void {
    this.loading = true;
    this.recrutementService.getCampagneById(campagne.idcampagne).subscribe({
      next: (r) => {
        this.ngZone.run(() => {
          if (r.success) { this.selectedCampagne = r.data; this.showViewModal = true; }
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.showToast('Erreur', 'Impossible de charger les détails', 'error');
          this.loading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  closeViewModal(): void {
    this.showViewModal = false;
    this.selectedCampagne = null;
    this.showAddProfilInView = false;
  }

  refreshCampagneDetails(): void {
    if (!this.selectedCampagne) return;
    this.recrutementService.getCampagneById(this.selectedCampagne.idcampagne).subscribe({
      next: (r) => {
        this.ngZone.run(() => {
          if (r.success) { this.selectedCampagne = r.data; this.loadCampagnes(); }
          this.cdr.detectChanges();
        });
      }
    });
  }

  openAddProfilInView(): void {
    this.addProfilInViewData = this.getEmptyProfilEdit();
    this.showAddProfilInView = true;
  }

  cancelAddProfilInView(): void {
    this.showAddProfilInView = false;
  }

  toggleDocumentInView(code: string): void {
    const idx = this.addProfilInViewData.documentsRequis.indexOf(code);
    if (idx === -1) {
      this.addProfilInViewData.documentsRequis = [...this.addProfilInViewData.documentsRequis, code];
    } else {
      this.addProfilInViewData.documentsRequis = this.addProfilInViewData.documentsRequis.filter((c: string) => c !== code);
    }
  }

  isDocumentInView(code: string): boolean {
    return this.addProfilInViewData.documentsRequis.includes(code);
  }

  submitAddProfilInView(): void {
    if (!this.selectedCampagne || !this.addProfilInViewData.titreProfil.trim()) return;
    this.submitting = true;
    const data: CreateProfilData = {
      campagne_idcampagne: this.selectedCampagne.idcampagne,
      titreProfil: this.addProfilInViewData.titreProfil,
      description: this.addProfilInViewData.description,
      competencesRequises: this.addProfilInViewData.competencesRequises,
      conditionsRequises: this.addProfilInViewData.conditionsRequises,
      nombrePostes: this.addProfilInViewData.nombrePostes,
      nombreCandidaturesMax: this.addProfilInViewData.nombreCandidaturesMax,
      documentsRequis: this.addProfilInViewData.documentsRequis
    };
    this.recrutementService.createProfil(data).subscribe({
      next: (r) => {
        if (r.success) {
          this.showToast('Succès', 'Profil ajouté', 'success');
          this.showAddProfilInView = false;
          this.refreshCampagneDetails();
        }
        this.submitting = false;
      },
      error: (err) => {
        this.showToast('Erreur', err.error?.message || 'Erreur', 'error');
        this.submitting = false;
      }
    });
  }

  // =====================================================
  // MODAL ÉDITION PROFIL EXISTANT
  // =====================================================

  openProfilEditModal(profil: Profil): void {
    this.editingProfil = profil;
    this.profilEditData = {
      titreProfil: profil.titreProfil,
      description: profil.description || '',
      competencesRequises: profil.competencesRequises || '',
      conditionsRequises: profil.conditionsRequises || '',
      nombrePostes: profil.nombrePostes,
      nombreCandidaturesMax: profil.nombreCandidaturesMax,
      documentsRequis: profil.documentsRequis ? [...profil.documentsRequis] : [],
      statusProfil: profil.statusProfil
    };
    this.showProfilEditModal = true;
  }

  closeProfilEditModal(): void {
    this.showProfilEditModal = false;
    this.editingProfil = null;
  }

  toggleDocumentEdit(code: string): void {
    const idx = this.profilEditData.documentsRequis.indexOf(code);
    if (idx === -1) {
      this.profilEditData.documentsRequis = [...this.profilEditData.documentsRequis, code];
    } else {
      this.profilEditData.documentsRequis = this.profilEditData.documentsRequis.filter(c => c !== code);
    }
  }

  isDocumentInEdit(code: string): boolean {
    return this.profilEditData.documentsRequis.includes(code);
  }

  submitProfilEdit(): void {
    if (!this.editingProfil) return;
    this.submitting = true;
    this.recrutementService.updateProfil(this.editingProfil.idprofil, this.profilEditData).subscribe({
      next: (r) => {
        if (r.success) {
          this.showToast('Succès', 'Profil mis à jour', 'success');
          this.closeProfilEditModal();
          this.refreshCampagneDetails();
        }
        this.submitting = false;
      },
      error: (err) => {
        this.showToast('Erreur', err.error?.message || 'Erreur', 'error');
        this.submitting = false;
      }
    });
  }

  // =====================================================
  // SUPPRESSION
  // =====================================================

  confirmDeleteCampagne(campagne: Campagne): void {
    this.deleteType = 'campagne';
    this.deleteId = campagne.idcampagne;
    this.deleteMessage = `Supprimer la campagne "${campagne.titreCampagne}" ? Cette action est irréversible.`;
    this.showDeleteModal = true;
  }

  confirmDeleteProfil(profil: Profil): void {
    this.deleteType = 'profil';
    this.deleteId = profil.idprofil;
    this.deleteMessage = `Supprimer le profil "${profil.titreProfil}" ? Cette action est irréversible.`;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.deleteId = null;
  }

  executeDelete(): void {
    if (!this.deleteId) return;
    this.submitting = true;

    if (this.deleteType === 'campagne') {
      this.recrutementService.deleteCampagne(this.deleteId).subscribe({
        next: (r) => {
          if (r.success) {
            this.showToast('Succès', 'Campagne supprimée', 'success');
            this.closeDeleteModal();
            this.loadCampagnes();
          }
          this.submitting = false;
        },
        error: () => { this.showToast('Erreur', 'Erreur lors de la suppression', 'error'); this.submitting = false; }
      });
    } else {
      this.recrutementService.deleteProfil(this.deleteId).subscribe({
        next: (r) => {
          if (r.success) {
            this.showToast('Succès', 'Profil supprimé', 'success');
            this.closeDeleteModal();
            this.refreshCampagneDetails();
          }
          this.submitting = false;
        },
        error: () => { this.showToast('Erreur', 'Erreur lors de la suppression', 'error'); this.submitting = false; }
      });
    }
  }

  // =====================================================
  // HELPERS
  // =====================================================

  getTotalCandidatures(campagne: Campagne): number {
    if (!campagne.profils) return 0;
    return campagne.profils.reduce((sum, p) => sum + (p.nombreCandidaturesActuelles || 0), 0);
  }

  getCandidaturesPercentage(profil: Profil): number {
    if (!profil.nombreCandidaturesMax || profil.nombreCandidaturesMax === 0) return 0;
    return Math.min(100, ((profil.nombreCandidaturesActuelles || 0) / profil.nombreCandidaturesMax) * 100);
  }

  getCandidaturesBarClass(profil: Profil): string {
    const p = this.getCandidaturesPercentage(profil);
    if (p >= 100) return 'bg-red-500';
    if (p >= 80) return 'bg-orange-500';
    if (p >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  }

  getCandidaturesTextClass(profil: Profil): string {
    const p = this.getCandidaturesPercentage(profil);
    if (p >= 100) return 'text-red-600';
    if (p >= 80) return 'text-orange-600';
    if (p >= 50) return 'text-yellow-600';
    return 'text-green-600';
  }

  formatDate(date: string): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatDateShort(date: string): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }

  getStatutLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'BROUILLON': 'Brouillon', 'ACTIVE': 'Active', 'CLOTUREE': 'Clôturée', 'ANNULEE': 'Annulée'
    };
    return labels[status] || status;
  }

  getStatutClass(status: string): string {
    const classes: { [key: string]: string } = {
      'BROUILLON': 'bg-yellow-100 text-yellow-700',
      'ACTIVE': 'bg-green-100 text-green-700',
      'CLOTUREE': 'bg-gray-100 text-gray-600',
      'ANNULEE': 'bg-red-100 text-red-700'
    };
    return classes[status] || 'bg-gray-100 text-gray-700';
  }

  getStatutDotClass(status: string): string {
    const classes: { [key: string]: string } = {
      'BROUILLON': 'bg-yellow-400',
      'ACTIVE': 'bg-green-500',
      'CLOTUREE': 'bg-gray-400',
      'ANNULEE': 'bg-red-500'
    };
    return classes[status] || 'bg-gray-400';
  }

  getProfilStatutClass(status: string): string {
    const classes: { [key: string]: string } = {
      'ACTIF': 'bg-green-100 text-green-700',
      'POURVUE': 'bg-blue-100 text-blue-700',
      'ANNULE': 'bg-red-100 text-red-700'
    };
    return classes[status] || 'bg-gray-100 text-gray-700';
  }

  // TrackBy
  trackByCampagneId = (i: number, c: Campagne) => c.idcampagne;
  trackByProfilId = (i: number, p: Profil) => p.idprofil;
  trackByProfilTempId = (i: number, p: ProfilTemp) => p.id;

  // =====================================================
  // TOASTS
  // =====================================================

  showToast(title: string, message: string, type: 'success' | 'error' | 'info'): void {
    const toast: Toast = { id: ++this.toastId, type, title, message };
    this.toasts.push(toast);
    setTimeout(() => this.removeToast(toast.id), 4000);
  }

  removeToast(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }
}
