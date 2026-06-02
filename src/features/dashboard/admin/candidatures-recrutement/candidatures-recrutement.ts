// candidatures-recrutement.ts - Page dédiée aux candidatures reçues (Recrutement)
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminRecrutementService,
  Campagne,
  Profil,
  Candidature,
  DocumentCandidature,
  EvaluateCandidatureData
} from '../../../../core/services/admin-recrutement.service';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

@Component({
  selector: 'app-candidatures-recrutement',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './candidatures-recrutement.html',
  styleUrls: ['./candidatures-recrutement.css']
})
export class CandidaturesRecrutement implements OnInit {

  // ── Données ───────────────────────────────────────────
  toutesLesCandidatures: Candidature[] = [];
  candidaturesFiltrees: Candidature[] = [];
  loading = false;

  // ── Filtres ───────────────────────────────────────────
  searchCandidature = '';
  filtreCandidatureStatut = '';
  filtreCandidatureProfil = '';
  filtreCandidatureCampagne = '';

  // ── Caches pour les filtres ───────────────────────────
  profilsUniques: Profil[] = [];
  campagnesUniques: Campagne[] = [];

  // ── Stats par statut ─────────────────────────────────
  statsParStatut: { [key: string]: number } = {
    SOUMISE: 0, EN_VERIFICATION: 0, ACCEPTEE: 0, REJETEE: 0
  };

  // ── Panel de vérification du dossier ──────────────────
  showVerifPanel = false;
  candidatureEnVerif: Candidature | null = null;
  documents: DocumentCandidature[] = [];
  documentsLoading = false;
  // Décision
  decisionStatut = '';
  decisionMotif = '';
  soumettingDecision = false;

  // ── Toasts ────────────────────────────────────────────
  toasts: Toast[] = [];
  private toastId = 0;

  constructor(
    private recrutementService: AdminRecrutementService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.chargerTout();
  }

  // =====================================================
  // CHARGEMENT
  // =====================================================

  chargerTout(): void {
    this.loading = true;
    this.toutesLesCandidatures = [];
    this.candidaturesFiltrees = [];
    this.campagnesUniques = [];
    this.profilsUniques = [];

    this.recrutementService.getAllCampagnes({ limit: 100 }).subscribe({
      next: (r) => {
        const campagnes = r.success ? r.data.items : [];
        this.campagnesUniques = campagnes;

        if (campagnes.length === 0) {
          this.loading = false;
          this.cdr.detectChanges();
          return;
        }

        let remaining = campagnes.length;
        campagnes.forEach(campagne => {
          this.recrutementService.getCandidaturesByCampagne(campagne.idcampagne).subscribe({
            next: (res) => {
              this.ngZone.run(() => {
                if (res.success) {
                  this.toutesLesCandidatures = [...this.toutesLesCandidatures, ...res.data];
                }
                remaining--;
                if (remaining === 0) this.finaliser();
              });
            },
            error: () => {
              this.ngZone.run(() => {
                remaining--;
                if (remaining === 0) this.finaliser();
              });
            }
          });
        });
      },
      error: () => {
        this.showToast('Erreur', 'Impossible de charger les données', 'error');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private finaliser(): void {
    // Profils uniques
    const profilsMap = new Map<number, Profil>();
    this.toutesLesCandidatures.forEach(c => {
      if (c.profil && !profilsMap.has(c.profil.idprofil)) {
        profilsMap.set(c.profil.idprofil, c.profil);
      }
    });
    this.profilsUniques = Array.from(profilsMap.values());

    // Stats
    this.statsParStatut = {
      SOUMISE:        this.toutesLesCandidatures.filter(c => c.statusCandidature === 'SOUMISE').length,
      EN_VERIFICATION:this.toutesLesCandidatures.filter(c => c.statusCandidature === 'EN_VERIFICATION').length,
      ACCEPTEE:       this.toutesLesCandidatures.filter(c => c.statusCandidature === 'ACCEPTEE').length,
      REJETEE:        this.toutesLesCandidatures.filter(c => c.statusCandidature === 'REJETEE').length,
    };

    this.filtrerCandidatures();
    this.loading = false;
    this.cdr.detectChanges();
  }

  actualiser(): void {
    this.chargerTout();
  }

  // =====================================================
  // FILTRES
  // =====================================================

  filtrerCandidatures(): void {
    this.candidaturesFiltrees = this.toutesLesCandidatures.filter(c => {
      const matchStatut = !this.filtreCandidatureStatut
        || c.statusCandidature === this.filtreCandidatureStatut;
      const matchProfil = !this.filtreCandidatureProfil
        || c.profil?.idprofil === parseInt(this.filtreCandidatureProfil);
      const matchCampagne = !this.filtreCandidatureCampagne
        || c.profil?.campagne_idcampagne === parseInt(this.filtreCandidatureCampagne);
      const q = this.searchCandidature.toLowerCase();
      const matchSearch = !q
        || `${c.candidat?.prenom} ${c.candidat?.nom}`.toLowerCase().includes(q)
        || (c.candidat?.email || '').toLowerCase().includes(q);
      return matchStatut && matchProfil && matchCampagne && matchSearch;
    });
  }

  // =====================================================
  // PANEL VÉRIFICATION DOSSIER
  // =====================================================

  ouvrirVerifPanel(candidature: Candidature): void {
    this.candidatureEnVerif = candidature;
    this.decisionStatut = '';
    this.decisionMotif = '';
    this.documents = [];
    this.documentsLoading = true;
    this.showVerifPanel = true;

    // Charger la candidature complète avec ses documents
    this.recrutementService.getCandidatureById(candidature.idcandidature).subscribe({
      next: (r) => {
        this.ngZone.run(() => {
          if (r.success) {
            this.documents = r.data.documents || [];

            // Auto-passer en EN_VERIFICATION si encore SOUMISE
            if (candidature.statusCandidature === 'SOUMISE') {
              this.recrutementService.evaluateCandidature(candidature.idcandidature, {
                statusCandidature: 'EN_VERIFICATION'
              }).subscribe({
                next: () => {
                  this.ngZone.run(() => {
                    candidature.statusCandidature = 'EN_VERIFICATION';
                    this.finaliserSansReload();
                    this.cdr.detectChanges();
                  });
                }
              });
            }
          }
          this.documentsLoading = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.documentsLoading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  private finaliserSansReload(): void {
    this.statsParStatut = {
      SOUMISE:        this.toutesLesCandidatures.filter(c => c.statusCandidature === 'SOUMISE').length,
      EN_VERIFICATION:this.toutesLesCandidatures.filter(c => c.statusCandidature === 'EN_VERIFICATION').length,
      ACCEPTEE:       this.toutesLesCandidatures.filter(c => c.statusCandidature === 'ACCEPTEE').length,
      REJETEE:        this.toutesLesCandidatures.filter(c => c.statusCandidature === 'REJETEE').length,
    };
    this.filtrerCandidatures();
  }

  fermerVerifPanel(): void {
    this.showVerifPanel = false;
    this.candidatureEnVerif = null;
    this.documents = [];
    this.decisionStatut = '';
    this.decisionMotif = '';
  }

  soumettreDecision(): void {
    if (!this.candidatureEnVerif || !this.decisionStatut) return;
    if (this.decisionStatut === 'REJETEE' && !this.decisionMotif.trim()) return;

    this.soumettingDecision = true;
    const payload: EvaluateCandidatureData = {
      statusCandidature: this.decisionStatut,
      motifRefus: this.decisionStatut === 'REJETEE' ? this.decisionMotif.trim() : undefined
    };

    this.recrutementService.evaluateCandidature(this.candidatureEnVerif.idcandidature, payload).subscribe({
      next: (r) => {
        if (r.success) {
          const label = this.decisionStatut === 'ACCEPTEE' ? 'acceptée' : 'rejetée';
          this.showToast('Succès', `Candidature ${label} avec succès`, 'success');
          this.fermerVerifPanel();
          this.actualiser();
        }
        this.soumettingDecision = false;
      },
      error: (err) => {
        this.showToast('Erreur', err.error?.message || 'Erreur lors de la décision', 'error');
        this.soumettingDecision = false;
      }
    });
  }

  // =====================================================
  // DOCUMENTS
  // =====================================================

  voirDocument(doc: DocumentCandidature): void {
    this.recrutementService.downloadDocument(doc.iddocument).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      },
      error: () => this.showToast('Erreur', 'Impossible d\'ouvrir le document', 'error')
    });
  }

  telechargerDocument(doc: DocumentCandidature): void {
    this.recrutementService.downloadDocument(doc.iddocument).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.document_filename;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.showToast('Erreur', 'Impossible de télécharger le document', 'error')
    });
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  getDocumentIcon(filename: string): string {
    const ext = filename?.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z';
    return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
  }

  // =====================================================
  // HELPERS
  // =====================================================

  getNomCampagne(campagneId?: number): string {
    if (!campagneId) return '—';
    const c = this.campagnesUniques.find(c => c.idcampagne === campagneId);
    return c?.titreCampagne || '—';
  }

  getInitiales(prenom?: string, nom?: string): string {
    return `${prenom?.charAt(0) || ''}${nom?.charAt(0) || ''}`.toUpperCase();
  }

  formatDate(date: string): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatDateShort(date: string): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }

  getStatutClass(status: string): string {
    const classes: { [key: string]: string } = {
      'SOUMISE':        'bg-yellow-100 text-yellow-700',
      'EN_VERIFICATION':'bg-blue-100 text-blue-700',
      'ACCEPTEE':       'bg-green-100 text-green-700',
      'REJETEE':        'bg-red-100 text-red-700',
    };
    return classes[status] || 'bg-gray-100 text-gray-700';
  }

  getStatutDot(status: string): string {
    const classes: { [key: string]: string } = {
      'SOUMISE':        'bg-yellow-400',
      'EN_VERIFICATION':'bg-blue-500',
      'ACCEPTEE':       'bg-green-500',
      'REJETEE':        'bg-red-500',
    };
    return classes[status] || 'bg-gray-400';
  }

  getStatutLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'SOUMISE':        'Soumise',
      'EN_VERIFICATION':'En vérification',
      'ACCEPTEE':       'Acceptée',
      'REJETEE':        'Rejetée',
    };
    return labels[status] || status;
  }

  peutPrendreDecision(status: string): boolean {
    return status === 'SOUMISE' || status === 'EN_VERIFICATION' || status === 'EN_EXAMEN';
  }

  trackByCandidatureId = (i: number, c: Candidature) => c.idcandidature;

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
