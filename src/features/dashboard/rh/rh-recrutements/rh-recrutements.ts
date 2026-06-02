import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RhService, Campagne, Candidature } from '../../../../core/services/rh.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-rh-recrutements',
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './rh-recrutements.html',
  styleUrl: './rh-recrutements.css',
})
export class RhRecrutements implements OnInit {
  campagnes: Campagne[] = [];
  filteredCampagnes: Campagne[] = [];
  selectedCampagne: Campagne | null = null;
  candidatures: Candidature[] = [];
  filteredCandidatures: Candidature[] = [];

  loading = true;
  loadingCandidatures = false;
  error: string | null = null;

  // Filtres
  searchTerm = '';
  filtreStatut = '';
  filtreCandidatureStatut = '';

  // Pagination
  page = 1;
  limit = 20;
  total = 0;
  totalPages = 0;

  // Modal évaluation
  showEvalModal = false;
  selectedCandidature: Candidature | null = null;
  evalForm = { statusCandidature: '', noteEvaluation: '', commentaireRecruteur: '', motifRefus: '' };
  saving = false;

  readonly STATUTS_CAMPAGNE = [
    { value: '', label: 'Tous les statuts' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'BROUILLON', label: 'Brouillon' },
    { value: 'CLOTUREE', label: 'Clôturée' },
    { value: 'ANNULEE', label: 'Annulée' },
  ];

  readonly STATUTS_CANDIDATURE = [
    { value: '', label: 'Toutes' },
    { value: 'SOUMISE', label: 'Soumise' },
    { value: 'EN_EXAMEN', label: 'En examen' },
    { value: 'RETENUE', label: 'Retenue' },
    { value: 'REJETEE', label: 'Rejetée' },
    { value: 'LISTE_ATTENTE', label: "Liste d'attente" },
  ];

  // Permissions pour le module RECRUTEMENT
  canCreate   = false;
  canEdit     = false;
  canValidate = false;
  canReject   = false;
  canDelete   = false;

  constructor(
    private rhService: RhService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    // Charger les permissions depuis AuthService
    this.canCreate   = this.authService.hasPermission('RECRUTEMENT', 'CREER');
    this.canEdit     = this.authService.hasPermission('RECRUTEMENT', 'MODIFIER');
    this.canValidate = this.authService.hasPermission('RECRUTEMENT', 'VALIDER');
    this.canReject   = this.authService.hasPermission('RECRUTEMENT', 'REJETER');
    this.canDelete   = this.authService.hasPermission('RECRUTEMENT', 'SUPPRIMER');
    this.loadCampagnes();
  }

  loadCampagnes(): void {
    this.loading = true;
    this.error = null;

    const filters: any = { page: this.page, limit: this.limit };
    if (this.filtreStatut) filters.statusCampagne = this.filtreStatut;
    if (this.searchTerm.trim()) filters.search = this.searchTerm.trim();

    this.rhService.getCampagnes(filters).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.campagnes = res.data.items;
            this.filteredCampagnes = this.campagnes;
            this.total = res.data.total;
            this.totalPages = res.data.totalPages;
          }
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          console.error('Erreur chargement campagnes:', err);
          this.error = 'Impossible de charger les campagnes de recrutement.';
          this.loading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  selectCampagne(campagne: Campagne): void {
    this.selectedCampagne = campagne;
    this.loadCandidatures(campagne.idcampagne);
  }

  loadCandidatures(campagneId: number): void {
    this.loadingCandidatures = true;
    this.rhService.getCandidaturesByCampagne(campagneId).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.candidatures = res.data;
            this.applyFilterCandidatures();
          }
          this.loadingCandidatures = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          console.error('Erreur chargement candidatures:', err);
          this.loadingCandidatures = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  applyFilterCandidatures(): void {
    this.filteredCandidatures = this.candidatures.filter(c => {
      if (this.filtreCandidatureStatut && c.statusCandidature !== this.filtreCandidatureStatut) return false;
      return true;
    });
  }

  onSearch(): void { this.page = 1; this.loadCampagnes(); }
  onFilterChange(): void { this.page = 1; this.loadCampagnes(); }
  clearFilters(): void { this.searchTerm = ''; this.filtreStatut = ''; this.page = 1; this.loadCampagnes(); }

  openEvalModal(cand: Candidature): void {
    this.selectedCandidature = cand;
    this.evalForm = {
      statusCandidature: cand.statusCandidature,
      noteEvaluation: cand.noteEvaluation?.toString() || '',
      commentaireRecruteur: cand.commentaireRecruteur || '',
      motifRefus: cand.motifRefus || '',
    };
    this.showEvalModal = true;
  }

  closeEvalModal(): void { this.showEvalModal = false; this.selectedCandidature = null; }

  saveEvaluation(): void {
    if (!this.selectedCandidature || !this.evalForm.statusCandidature) return;
    this.saving = true;

    const data: any = { statusCandidature: this.evalForm.statusCandidature };
    if (this.evalForm.noteEvaluation) data.noteEvaluation = parseFloat(this.evalForm.noteEvaluation);
    if (this.evalForm.commentaireRecruteur) data.commentaireRecruteur = this.evalForm.commentaireRecruteur;
    if (this.evalForm.motifRefus) data.motifRefus = this.evalForm.motifRefus;

    this.rhService.evaluateCandidature(this.selectedCandidature.idcandidature, data).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success && this.selectedCampagne) {
            this.loadCandidatures(this.selectedCampagne.idcampagne);
            this.closeEvalModal();
          }
          this.saving = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          console.error('Erreur évaluation:', err);
          this.saving = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  getStatutCampagneClass(statut: string): string {
    switch (statut) {
      case 'ACTIVE': return 'bg-green-100 text-green-700';
      case 'BROUILLON': return 'bg-gray-100 text-gray-600';
      case 'CLOTUREE': return 'bg-blue-100 text-blue-700';
      case 'ANNULEE': return 'bg-red-100 text-red-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  }

  getStatutCandidatureClass(statut: string): string {
    switch (statut) {
      case 'SOUMISE': return 'bg-gray-100 text-gray-600';
      case 'EN_EXAMEN': return 'bg-amber-100 text-amber-700';
      case 'RETENUE': return 'bg-green-100 text-green-700';
      case 'REJETEE': return 'bg-red-100 text-red-600';
      case 'LISTE_ATTENTE': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  }

  getCandidatInitiales(c: Candidature): string {
    if (!c.candidat) return '?';
    return `${c.candidat.nom.charAt(0)}${c.candidat.prenom.charAt(0)}`.toUpperCase();
  }

  getCandidatNomComplet(c: Candidature): string {
    if (!c.candidat) return `Candidat #${c.candidats_idcandidats}`;
    return `${c.candidat.prenom} ${c.candidat.nom}`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }
}
