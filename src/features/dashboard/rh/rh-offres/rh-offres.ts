import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RhService, Campagne, Profil } from '../../../../core/services/rh.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-rh-offres',
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './rh-offres.html',
  styleUrl: './rh-offres.css',
})
export class RhOffres implements OnInit {
  campagnes: Campagne[] = [];
  selectedCampagne: Campagne | null = null;
  profils: Profil[] = [];
  selectedProfil: Profil | null = null;

  loading = true;
  loadingProfils = false;
  error: string | null = null;

  searchTerm = '';
  filtreStatut = '';

  page = 1;
  limit = 50;
  total = 0;
  totalPages = 0;

  readonly STATUTS = [
    { value: '', label: 'Toutes les campagnes' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'BROUILLON', label: 'Brouillon' },
    { value: 'CLOTUREE', label: 'Clôturée' },
    { value: 'ANNULEE', label: 'Annulée' },
  ];

  // Permissions module RECRUTEMENT (offres = profils de recrutement)
  canCreate   = false;
  canEdit     = false;
  canValidate = false;
  canDelete   = false;

  constructor(
    private rhService: RhService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.canCreate   = this.authService.hasPermission('RECRUTEMENT', 'CREER');
    this.canEdit     = this.authService.hasPermission('RECRUTEMENT', 'MODIFIER');
    this.canValidate = this.authService.hasPermission('RECRUTEMENT', 'VALIDER');
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
            this.total = res.data.total;
            this.totalPages = res.data.totalPages;
            // Auto-select première campagne active
            if (!this.selectedCampagne && this.campagnes.length > 0) {
              const active = this.campagnes.find(c => c.statusCampagne === 'ACTIVE') || this.campagnes[0];
              this.selectCampagne(active);
            }
          }
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          console.error('Erreur chargement campagnes:', err);
          this.error = 'Impossible de charger les campagnes.';
          this.loading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  selectCampagne(campagne: Campagne): void {
    this.selectedCampagne = campagne;
    this.selectedProfil = null;
    this.loadProfils(campagne.idcampagne);
  }

  loadProfils(campagneId: number): void {
    this.loadingProfils = true;
    this.rhService.getProfilsByCampagne(campagneId).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) this.profils = res.data;
          this.loadingProfils = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.loadingProfils = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  onSearch(): void { this.page = 1; this.loadCampagnes(); }
  onFilterChange(): void { this.page = 1; this.loadCampagnes(); }

  getStatutCampagneClass(statut: string): string {
    switch (statut) {
      case 'ACTIVE': return 'bg-green-100 text-green-700';
      case 'BROUILLON': return 'bg-gray-100 text-gray-600';
      case 'CLOTUREE': return 'bg-blue-100 text-blue-700';
      case 'ANNULEE': return 'bg-red-100 text-red-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  }

  getStatutProfilClass(statut: string): string {
    switch (statut) {
      case 'ACTIF': return 'bg-green-100 text-green-700';
      case 'POURVUE': return 'bg-blue-100 text-blue-700';
      case 'ANNULE': return 'bg-red-100 text-red-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  }

  getPourcentageRemplissage(profil: Profil): number {
    if (!profil.nombreCandidaturesMax || profil.nombreCandidaturesMax === 0) return 0;
    return Math.min(Math.round((profil.nombreCandidaturesActuelles / profil.nombreCandidaturesMax) * 100), 100);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
