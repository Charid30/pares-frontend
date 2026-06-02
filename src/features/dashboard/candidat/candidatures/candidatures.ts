import { CommonModule } from '@angular/common';
import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { CandidatService } from '../../../../core/services/candidat.service';

interface Candidature {
  idcandidatures: number;
  poste: string;
  campagne: string;
  statut: string;
  dateCreation: string;
  dateModification?: string;
  motifRefus?: string;
}

@Component({
  selector: 'app-candidatures',
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './candidatures.html',
  styleUrl: './candidatures.css',
})
export class Candidatures implements OnInit {

  candidatures: Candidature[] = [];
  candidaturesFiltrees: Candidature[] = [];
  isLoading = false;
  errorMessage = '';

  filtreStatut = '';
  searchTerm = '';

  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  // ── Modal détails ─────────────────────────────────────
  showDetailsModal = false;
  selectedCandidature: Candidature | null = null;
  detailDocuments: any[] = [];
  loadingDetails = false;
  errorDocument = '';

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private candidatService: CandidatService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCandidatures();
  }

  loadCandidatures(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.http.get<any>(`${this.apiUrl}/candidat/candidatures`).subscribe({
      next: (response) => {
        if (response.success) {
          this.candidatures = response.data;
          this.candidaturesFiltrees = [...this.candidatures];
          this.calculerPagination();
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erreur lors du chargement des candidatures:', error);
        this.errorMessage = 'Erreur lors du chargement des candidatures';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  filtrerCandidatures(): void {
    this.candidaturesFiltrees = this.candidatures.filter(c => {
      const matchStatut = !this.filtreStatut || c.statut === this.filtreStatut;
      const matchSearch = !this.searchTerm ||
        c.poste.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        c.campagne.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchStatut && matchSearch;
    });
    this.currentPage = 1;
    this.calculerPagination();
  }

  calculerPagination(): void {
    this.totalPages = Math.ceil(this.candidaturesFiltrees.length / this.itemsPerPage);
  }

  // =====================================================
  // MODAL DÉTAILS
  // =====================================================

  voirDetails(id: number): void {
    const c = this.candidatures.find(c => c.idcandidatures === id);
    if (!c) return;
    this.selectedCandidature = c;
    this.detailDocuments = [];
    this.loadingDetails = true;
    this.errorDocument = '';
    this.showDetailsModal = true;

    this.candidatService.getCandidatureDetails(id).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.detailDocuments = r.data.documents || [];
          // Mettre à jour le motifRefus si disponible dans les détails
          if (this.selectedCandidature && r.data.motifRefus) {
            this.selectedCandidature = { ...this.selectedCandidature, motifRefus: r.data.motifRefus };
          }
        }
        this.loadingDetails = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingDetails = false;
        this.cdr.detectChanges();
      }
    });
  }

  fermerDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedCandidature = null;
    this.detailDocuments = [];
    this.errorDocument = '';
  }

  voirDocumentModal(doc: any): void {
    this.errorDocument = '';
    this.http.get(`${this.apiUrl}/recrutement/documents/${doc.iddocument}/download`, {
      responseType: 'blob'
    }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      },
      error: () => {
        this.errorDocument = 'Impossible d\'ouvrir le document';
        this.cdr.detectChanges();
      }
    });
  }

  telechargerDocumentModal(doc: any): void {
    this.errorDocument = '';
    this.http.get(`${this.apiUrl}/recrutement/documents/${doc.iddocument}/download`, {
      responseType: 'blob'
    }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.document_filename || doc.nom || 'document';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.errorDocument = 'Impossible de télécharger le document';
        this.cdr.detectChanges();
      }
    });
  }

  getDocumentIcon(filename: string): string {
    const ext = filename?.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z';
    if (['jpg','jpeg','png','gif'].includes(ext)) return 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z';
    return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
  }

  // =====================================================
  // ANNULATION
  // =====================================================

  annulerCandidature(id: number): void {
    if (confirm('Êtes-vous sûr de vouloir annuler cette candidature ?')) {
      this.http.delete(`${this.apiUrl}/candidat/candidatures/${id}`).subscribe({
        next: () => this.loadCandidatures(),
        error: () => {
          this.errorMessage = 'Erreur lors de l\'annulation de la candidature';
          this.cdr.detectChanges();
        }
      });
    }
  }

  // =====================================================
  // HELPERS STATUT — synchronisés avec l'admin (4 statuts)
  // + rétrocompatibilité anciens statuts (EN_EXAMEN, VALIDEE, REFUSEE)
  // =====================================================

  getStatutBadgeClass(statut: string): string {
    const classes: { [key: string]: string } = {
      'SOUMISE':         'bg-yellow-100 text-yellow-700',
      'EN_VERIFICATION': 'bg-blue-100 text-blue-700',
      'EN_EXAMEN':       'bg-blue-100 text-blue-700',
      'VALIDEE':         'bg-green-100 text-green-700',
      'ACCEPTEE':        'bg-green-100 text-green-700',
      'REJETEE':         'bg-red-100 text-red-700',
      'REFUSEE':         'bg-red-100 text-red-700',
    };
    return classes[statut] || 'bg-gray-100 text-gray-700';
  }

  getStatusBarClass(statut: string): string {
    const classes: { [key: string]: string } = {
      'SOUMISE':         'bg-yellow-400',
      'EN_VERIFICATION': 'bg-blue-500',
      'EN_EXAMEN':       'bg-blue-500',
      'VALIDEE':         'bg-green-500',
      'ACCEPTEE':        'bg-green-500',
      'REJETEE':         'bg-red-500',
      'REFUSEE':         'bg-red-500',
    };
    return classes[statut] || 'bg-gray-400';
  }

  getStatutLabel(statut: string): string {
    const labels: { [key: string]: string } = {
      'SOUMISE':         'Soumise',
      'EN_VERIFICATION': 'En vérification',
      'EN_EXAMEN':       'En examen',
      'VALIDEE':         'Validée',
      'ACCEPTEE':        'Acceptée',
      'REJETEE':         'Rejetée',
      'REFUSEE':         'Refusée',
    };
    return labels[statut] || statut;
  }

  getCountByStatut(statut: string): number {
    return this.candidatures.filter(c => c.statut === statut).length;
  }

  getCountEnCours(): number {
    return this.candidatures.filter(c =>
      c.statut === 'SOUMISE' || c.statut === 'EN_VERIFICATION' || c.statut === 'EN_EXAMEN'
    ).length;
  }

  getCountValidees(): number {
    return this.candidatures.filter(c =>
      c.statut === 'VALIDEE' || c.statut === 'ACCEPTEE'
    ).length;
  }

  getCountRejetees(): number {
    return this.candidatures.filter(c =>
      c.statut === 'REJETEE' || c.statut === 'REFUSEE'
    ).length;
  }

  isRejete(statut: string): boolean {
    return statut === 'REJETEE' || statut === 'REFUSEE';
  }

  // =====================================================
  // PAGINATION
  // =====================================================

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    return pages;
  }

  Math = Math;
}
