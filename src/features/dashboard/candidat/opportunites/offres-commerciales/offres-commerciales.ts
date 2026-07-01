// offres-commerciales.ts — Demandes d'offres côté Candidat (v2 : pagination)
// SQL table `offres` : creePar='CANDIDAT', typeOffre, titre, description, cnib, demandeOffre
// SQL statusOffre : BROUILLON | EN_ATTENTE | EN_TRAITEMENT | VALIDEE | REJETEE | ACTIVE | CLOTUREE
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ChangeDetectorRef, OnInit, NgZone } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../../environments/environment';
import { Loader } from '../../../../../shared/components/loader/loader';

// Table `offres` — entrée créée par le candidat (creePar='CANDIDAT')
interface MaDemandeOffre {
  idoffres: number;
  typeOffre: string;
  titre: string;          // = objet de la soumission
  description: string | null;
  cnib_filename: string | null;
  demandeOffre_filename: string | null;
  // statusOffre SQL : EN_ATTENTE | EN_TRAITEMENT | VALIDEE | REJETEE | CLOTUREE
  statusOffre: 'BROUILLON' | 'EN_ATTENTE' | 'EN_TRAITEMENT' | 'VALIDEE' | 'REJETEE' | 'ACTIVE' | 'CLOTUREE';
  motifRefus: string | null;
  createdDate: string;
  lastModifiedDate: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

@Component({
  selector: 'app-offres-commerciales',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DatePipe, Loader],
  templateUrl: './offres-commerciales.html',
  styleUrl: './offres-commerciales.css',
})
export class OffresCommerciales implements OnInit {

  // ── Liste des demandes du candidat ────────────────────────────────────────
  mesDemandes: MaDemandeOffre[] = [];
  mesDemandesFiltrees: MaDemandeOffre[] = [];
  isLoading = false;
  errorMessage = '';

  // ── Pagination ────────────────────────────────────────────────────────────
  pagination: Pagination = {
    total: 0, page: 1, limit: 10,
    totalPages: 0, hasNext: false, hasPrev: false,
  };
  pageSize = 10;
  pageSizeOptions = [5, 10, 20, 50];

  // ── Filtres ───────────────────────────────────────────────────────────────
  searchTerm = '';
  filtreStatut = '';

  // ── Compteurs (sur toutes les pages — chargés séparément) ─────────────────
  countEnAttente = 0;
  countEnTraitement = 0;
  countValidee = 0;
  countRejetee = 0;

  // ── Modal création ────────────────────────────────────────────────────────
  showCreateModal = false;
  etapeCreate: 1 | 2 = 1;
  isSubmitting = false;
  successMessage = '';
  errorCreate = '';

  // Formulaire création
  // Champs SQL : typeOffre, titre (=objet), description (optionnel)
  // Fichiers SQL : cnib (MEDIUMBLOB), demandeOffre (MEDIUMBLOB)
  form = {
    typeOffre: '',
    titre: '',          // objet de la soumission
    description: '',    // optionnel
    cnib: null as File | null,
    demandeOffre: null as File | null,  // lettre manuscrite + offre PDF fusionnés ou offre seule
  };

  // ── Identifiant fiscal candidat (IFU ou récépissé) ────────────────────────
  candidatIfu: string | null = null;
  candidatRecipisse: string | null = null;
  ifuLoaded = false;

  /** Vrai si le candidat possède un IFU ou un récépissé */
  get hasDocumentFiscal(): boolean {
    return !!(this.candidatIfu || this.candidatRecipisse);
  }

  // ── Modal détail ──────────────────────────────────────────────────────────
  showDetailModal = false;
  selectedDemande: MaDemandeOffre | null = null;

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadMesDemandes();
    this.loadAllCounts();
    this.loadProfil();
  }

  // ─── Chargement IFU depuis le profil ──────────────────────────────────────
  loadProfil(): void {
    this.http.get<any>(`${this.apiUrl}/auth/profile`).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.candidatIfu      = res.data?.candidat?.ifu       ?? null;
            this.candidatRecipisse = res.data?.candidat?.recipisse ?? null;
          }
          this.ifuLoaded = true;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.ifuLoaded = true;
          this.cdr.detectChanges();
        });
      }
    });
  }

  // ─── Chargement (page courante) ───────────────────────────────────────────
  loadMesDemandes(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const params: Record<string, string> = {
      page: String(this.pagination.page),
      limit: String(this.pageSize),
    };

    this.http.get<any>(`${this.apiUrl}/offres/mes-offres`, { params }).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.mesDemandes = res.data;
            this.pagination = res.pagination;
            this.appliquerFiltres();
          }
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.errorMessage = err.error?.message || 'Erreur lors du chargement';
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  // ─── Chargement compteurs (toutes les pages) ──────────────────────────────
  loadAllCounts(): void {
    this.http.get<any>(`${this.apiUrl}/offres/mes-offres`, { params: { page: '1', limit: '1000' } }).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            const all: MaDemandeOffre[] = res.data;
            this.countEnAttente    = all.filter(d => d.statusOffre === 'EN_ATTENTE').length;
            this.countEnTraitement = all.filter(d => d.statusOffre === 'EN_TRAITEMENT').length;
            this.countValidee      = all.filter(d => d.statusOffre === 'VALIDEE').length;
            this.countRejetee      = all.filter(d => d.statusOffre === 'REJETEE').length;
            this.cdr.detectChanges();
          }
        });
      },
    });
  }

  // ─── Filtres (sur la page courante) ──────────────────────────────────────
  appliquerFiltres(): void {
    this.mesDemandesFiltrees = this.mesDemandes.filter(d => {
      const matchSearch = !this.searchTerm ||
        d.titre.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        d.typeOffre.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchStatut = !this.filtreStatut || d.statusOffre === this.filtreStatut;
      return matchSearch && matchStatut;
    });
  }

  effacerFiltres(): void {
    this.searchTerm = '';
    this.filtreStatut = '';
    this.mesDemandesFiltrees = [...this.mesDemandes];
  }

  // ─── Pagination ───────────────────────────────────────────────────────────
  allerPage(page: number): void {
    if (page < 1 || page > this.pagination.totalPages) return;
    this.pagination.page = page;
    this.loadMesDemandes();
  }

  changerPageSize(size: number): void {
    this.pageSize = size;
    this.pagination.page = 1;
    this.loadMesDemandes();
  }

  getPages(): number[] {
    const total = this.pagination.totalPages;
    const current = this.pagination.page;
    const pages: number[] = [];
    const delta = 2;
    const left = current - delta;
    const right = current + delta;
    let last = 0;

    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= left && i <= right)) {
        if (last && i - last > 1) pages.push(-1); // ellipsis marker
        pages.push(i);
        last = i;
      }
    }
    return pages;
  }

  // ─── Modal création ───────────────────────────────────────────────────────
  ouvrirCreateModal(): void {
    this.form = { typeOffre: '', titre: '', description: '', cnib: null, demandeOffre: null };
    this.errorCreate = '';
    this.successMessage = '';
    this.etapeCreate = 1;
    this.showCreateModal = true;
  }

  fermerCreateModal(): void {
    this.showCreateModal = false;
    this.errorCreate = '';
    this.etapeCreate = 1;
  }

  soumettreDemande(): void {
    if (!this.form.typeOffre || !this.form.titre) {
      this.errorCreate = 'Le type d\'offre et l\'objet sont obligatoires.';
      return;
    }
    if (!this.form.cnib) {
      this.errorCreate = 'La CNIB est obligatoire.';
      return;
    }
    if (!this.form.demandeOffre) {
      this.errorCreate = 'L\'offre en PDF est obligatoire.';
      return;
    }

    this.isSubmitting = true;
    this.errorCreate = '';

    const formData = new FormData();
    formData.append('typeOffre', this.form.typeOffre);
    formData.append('titre', this.form.titre);
    if (this.form.description) formData.append('description', this.form.description);
    formData.append('cnib', this.form.cnib);
    formData.append('demandeOffre', this.form.demandeOffre);

    this.http.post<any>(`${this.apiUrl}/offres/candidat`, formData).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.fermerCreateModal();
            this.pagination.page = 1;
            this.loadMesDemandes();
            this.loadAllCounts();
            this.successMessage = 'Votre demande d\'offre a été soumise avec succès !';
            setTimeout(() => this.successMessage = '', 5000);
          }
          this.isSubmitting = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.errorCreate = err.error?.message || 'Erreur lors de la soumission.';
          this.isSubmitting = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  // ─── Modal détail ─────────────────────────────────────────────────────────
  voirDetails(demande: MaDemandeOffre): void {
    this.selectedDemande = demande;
    this.showDetailModal = true;
  }

  fermerDetailModal(): void {
    this.showDetailModal = false;
    this.selectedDemande = null;
  }

  // ─── Gestion fichiers ─────────────────────────────────────────────────────
  onFileSelected(event: Event, field: 'cnib' | 'demandeOffre'): void {
    const file = (event.target as HTMLInputElement).files?.[0] || null;
    this.form[field] = file;
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  }

  // ─── Helpers statut ───────────────────────────────────────────────────────
  getStatutClass(statut: string): string {
    const classes: Record<string, string> = {
      'EN_ATTENTE':    'bg-blue-100 text-blue-700',
      'EN_TRAITEMENT': 'bg-amber-100 text-amber-700',
      'VALIDEE':       'bg-green-100 text-green-700',
      'REJETEE':       'bg-red-100 text-red-700',
      'CLOTUREE':      'bg-gray-100 text-gray-600',
      'BROUILLON':     'bg-gray-100 text-gray-500',
    };
    return classes[statut] || 'bg-gray-100 text-gray-600';
  }

  getStatutBarClass(statut: string): string {
    const classes: Record<string, string> = {
      'EN_ATTENTE':    'bg-blue-500',
      'EN_TRAITEMENT': 'bg-amber-400',
      'VALIDEE':       'bg-green-500',
      'REJETEE':       'bg-red-500',
      'CLOTUREE':      'bg-gray-400',
      'BROUILLON':     'bg-gray-300',
    };
    return classes[statut] || 'bg-gray-400';
  }

  getStatutLabel(statut: string): string {
    const labels: Record<string, string> = {
      'EN_ATTENTE':    'En attente',
      'EN_TRAITEMENT': 'En traitement',
      'VALIDEE':       'Validée',
      'REJETEE':       'Rejetée',
      'CLOTUREE':      'Clôturée',
      'BROUILLON':     'Brouillon',
    };
    return labels[statut] || statut;
  }

  getStatutIcon(statut: string): string {
    const icons: Record<string, string> = {
      'EN_ATTENTE':    'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      'EN_TRAITEMENT': 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      'VALIDEE':       'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      'REJETEE':       'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
      'CLOTUREE':      'M5 13l4 4L19 7',
    };
    return icons[statut] || 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
  }

  getTypeClass(type: string): string {
    const classes: Record<string, string> = {
      'VENTE':        'bg-blue-100 text-blue-700',
      'PARTENARIAT':  'bg-purple-100 text-purple-700',
      'DISTRIBUTION': 'bg-green-100 text-green-700',
      'SERVICE':      'bg-orange-100 text-orange-700',
      'AUTRE':        'bg-gray-100 text-gray-700',
    };
    return classes[type] || 'bg-gray-100 text-gray-700';
  }

  getCountByStatut(statut: string): number {
    switch(statut) {
      case 'EN_ATTENTE':    return this.countEnAttente;
      case 'EN_TRAITEMENT': return this.countEnTraitement;
      case 'VALIDEE':       return this.countValidee;
      case 'REJETEE':       return this.countRejetee;
      default: return 0;
    }
  }
}
