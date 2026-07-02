// src/features/dashboard/agent/modules/audience/agent-audience.ts
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';
import { StatCard } from '../../../../../shared/components/stat-card/stat-card';

interface DirectionInfo {
  iddirection: number;
  nom: string;
  accronyme: string;
}

interface DemandeAudience {
  iddemande: number;
  modeSoumission: 'FICHIER' | 'FORMULAIRE';
  pourM?: string;
  pendant?: string;
  contact?: string;
  actionCochee?: string;
  motif?: string;
  dateAudience: string;
  heureAudience: string;
  status: 'EN_ATTENTE' | 'ACCEPTE' | 'REJETE' | 'ANNULE';
  commentaireAdmin?: string;
  createdDate: string;
  fichier_filename?: string;
  fichier_size?: number;
  candidat?: { idcandidats: number; nom: string; prenom: string; email: string; telephone?: string };
  direction_iddirection?: number | null;
  direction?: DirectionInfo;
}

@Component({
  selector: 'app-agent-audience',
  standalone: true,
  imports: [CommonModule, FormsModule, StatCard],
  templateUrl: './agent-audience.html',
})
export class AgentAudience implements OnInit {

  demandes: DemandeAudience[] = [];
  demandesFiltrees: DemandeAudience[] = [];
  loading = false;
  erreur = '';
  search = '';
  filtreStatut = '';
  filtreMode = '';
  demandeEnDecision: DemandeAudience | null = null;
  decisionType: 'ACCEPTE' | 'REJETE' = 'ACCEPTE';
  commentaire = '';
  soumission = false;
  showDetailModal = false;
  detailDemande: DemandeAudience | null = null;

  // Preview PDF
  showPreviewModal = false;
  previewBlobUrl: string | null = null;
  previewSafeUrl: SafeResourceUrl | null = null;
  previewTitle = '';
  private previewDemande: DemandeAudience | null = null;

  // Permissions (réactives)
  get peutConsulter():  boolean { return this.authService.hasPermission('DEMANDE_AUDIENCE', 'CONSULTER'); }
  get peutValider():    boolean { return this.authService.hasPermission('DEMANDE_AUDIENCE', 'VALIDER'); }
  get peutRejeter():    boolean { return this.authService.hasPermission('DEMANDE_AUDIENCE', 'REJETER'); }
  get peutAffecter():   boolean { return this.authService.hasPermission('DEMANDE_AUDIENCE', 'MODIFIER'); }
  get peutTransferer(): boolean { return this.authService.hasPermission('DEMANDE_AUDIENCE', 'TRANSFERER'); }

  // Affectation direction (dans modal détail)
  directions: DirectionInfo[] = [];
  affectationForm = { direction_iddirection: null as number | null };
  savingAffectation = false;

  // Modal transfert dédié
  showTransfertModal = false;
  demandeATransferer: DemandeAudience | null = null;
  directionCibleId: number | null = null;
  soumissionTransfert = false;
  errorTransfert = '';

  // Toasts
  toasts: { id: number; title: string; message: string; type: 'success' | 'error' | 'warning' }[] = [];
  private toastIdCounter = 0;

  statsStatuts = [
    { value: 'EN_ATTENTE', label: 'En attente', dot: 'bg-amber-400', ringClass: 'ring-amber-400', count: 0, accent: 'amber',   icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { value: 'ACCEPTE',    label: 'Acceptées',  dot: 'bg-green-500', ringClass: 'ring-green-400', count: 0, accent: 'emerald', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { value: 'REJETE',     label: 'Rejetées',   dot: 'bg-red-500',   ringClass: 'ring-red-400',   count: 0, accent: 'rose',    icon: 'M6 18L18 6M6 6l12 12' },
    { value: 'ANNULE',     label: 'Annulées',   dot: 'bg-gray-400',  ringClass: 'ring-gray-400',  count: 0, accent: 'slate',   icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
  ];

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    if (!this.peutConsulter) return;
    this.charger();
    if (this.peutAffecter || this.peutTransferer) this.loadDirections();
  }

  loadDirections(): void {
    this.http.get<any>(`${this.apiUrl}/stages/directions`).subscribe({
      next: (res) => {
        if (res.success) {
          this.directions = res.data;
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Erreur chargement directions:', err),
    });
  }

  charger(): void {
    this.loading = true;
    this.erreur = '';
    this.http.get<any>(`${this.apiUrl}/demandes-audience?limit=50`).subscribe({
      next: (res) => {
        this.demandes = res.data?.data || res.data?.items || res.data || [];
        this.calculerStats();
        this.filtrer();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.erreur = err.error?.message || 'Erreur lors du chargement';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  calculerStats(): void {
    this.statsStatuts.forEach(s => {
      s.count = this.demandes.filter(d => d.status === s.value).length;
    });
  }

  filtrer(): void {
    this.demandesFiltrees = this.demandes.filter(d => {
      const nom = `${d.candidat?.nom || ''} ${d.candidat?.prenom || ''} ${d.candidat?.email || ''}`.toLowerCase();
      const matchSearch = !this.search || nom.includes(this.search.toLowerCase());
      const matchStatut = !this.filtreStatut || d.status === this.filtreStatut;
      const matchMode = !this.filtreMode || d.modeSoumission === this.filtreMode;
      return matchSearch && matchStatut && matchMode;
    });
  }

  effacerFiltres(): void {
    this.search = '';
    this.filtreStatut = '';
    this.filtreMode = '';
    this.filtrer();
  }

  getInitiales(d: DemandeAudience): string {
    if (!d.candidat) return '?';
    return ((d.candidat.nom?.[0] || '') + (d.candidat.prenom?.[0] || '')).toUpperCase() || '?';
  }

  voirDetail(d: DemandeAudience): void {
    this.detailDemande = d;
    this.affectationForm = { direction_iddirection: d.direction_iddirection ?? null };
    this.showDetailModal = true;
    this.cdr.detectChanges();
  }

  fermerDetail(): void {
    this.showDetailModal = false;
    this.detailDemande = null;
  }

  getDirectionLabel(dirId: any): string {
    const dir = this.directions.find(d => d.iddirection === +dirId);
    return dir ? `${dir.accronyme} — ${dir.nom}` : '—';
  }

  sauvegarderAffectation(): void {
    if (!this.detailDemande) return;
    this.savingAffectation = true;
    this.http.put<any>(
      `${this.apiUrl}/demandes-audience/${this.detailDemande.iddemande}`,
      { direction_iddirection: this.affectationForm.direction_iddirection }
    ).subscribe({
      next: (res) => {
        if (res.success && this.detailDemande) {
          this.detailDemande.direction_iddirection = this.affectationForm.direction_iddirection;
          const dir = this.directions.find(d => d.iddirection === this.affectationForm.direction_iddirection);
          this.detailDemande.direction = dir;
        }
        this.showToast('Succès', 'Direction affectée avec succès');
        this.savingAffectation = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.showToast('Erreur', err.error?.message || 'Impossible d\'affecter la direction', 'error');
        this.savingAffectation = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ── Modal Transfert ──
  peutTransfererStatut(d: DemandeAudience): boolean {
    return d.status !== 'REJETE' && d.status !== 'ANNULE';
  }

  ouvrirTransfertModal(d: DemandeAudience): void {
    this.demandeATransferer = d;
    this.directionCibleId = d.direction_iddirection ?? null;
    this.errorTransfert = '';
    this.soumissionTransfert = false;
    this.showTransfertModal = true;
  }

  fermerTransfertModal(): void {
    if (this.soumissionTransfert) return;
    this.showTransfertModal = false;
    this.demandeATransferer = null;
    this.directionCibleId = null;
    this.errorTransfert = '';
  }

  confirmerTransfert(): void {
    if (!this.demandeATransferer || !this.directionCibleId || this.soumissionTransfert) return;
    this.soumissionTransfert = true;
    this.errorTransfert = '';
    this.http.put<any>(`${this.apiUrl}/demandes-audience/${this.demandeATransferer.iddemande}/transferer`, {
      direction_iddirection: this.directionCibleId,
    }).subscribe({
      next: (res) => {
        if (res.success && this.demandeATransferer) {
          const updated = res.data;
          const idx = this.demandes.findIndex(d => d.iddemande === this.demandeATransferer!.iddemande);
          if (idx !== -1) this.demandes[idx] = { ...this.demandes[idx], ...updated };
          this.filtrer();
        }
        this.fermerTransfertModal();
        this.showToast('Succès', 'Demande transférée avec succès');
      },
      error: (err) => {
        this.errorTransfert = err.error?.message || 'Erreur lors du transfert';
        this.soumissionTransfert = false;
        this.cdr.detectChanges();
      },
    });
  }

  ouvrirDecision(d: DemandeAudience, type: 'ACCEPTE' | 'REJETE'): void {
    this.demandeEnDecision = d;
    this.decisionType = type;
    this.commentaire = '';
  }

  confirmerDecision(): void {
    if (!this.demandeEnDecision) return;
    if (this.decisionType === 'REJETE' && !this.commentaire.trim()) return;
    this.soumission = true;
    this.http.put(`${this.apiUrl}/demandes-audience/${this.demandeEnDecision.iddemande}/statut`, {
      status: this.decisionType,
      commentaireAdmin: this.commentaire || null,
    }).subscribe({
      next: () => {
        if (this.demandeEnDecision) {
          this.demandeEnDecision.status = this.decisionType;
          this.demandeEnDecision.commentaireAdmin = this.commentaire || undefined;
        }
        this.calculerStats();
        this.filtrer();
        this.showToast('Succès', `Demande ${this.decisionType === 'ACCEPTE' ? 'acceptée' : 'rejetée'}`);
        this.demandeEnDecision = null;
        this.soumission = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.showToast('Erreur', err.error?.message || 'Erreur lors de la décision', 'error');
        this.soumission = false;
        this.cdr.detectChanges();
      },
    });
  }

  telechargerFichier(d: DemandeAudience): void {
    this.http.get(`${this.apiUrl}/demandes-audience/${d.iddemande}/fichier`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = d.fichier_filename || `audience_${d.iddemande}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.showToast('Erreur', 'Erreur lors du téléchargement du fichier', 'error');
        this.cdr.detectChanges();
      },
    });
  }

  previewFichier(d: DemandeAudience): void {
    this.previewDemande = d;
    this.previewTitle = d.fichier_filename || `audience_${d.iddemande}.pdf`;
    this.http.get(`${this.apiUrl}/demandes-audience/${d.iddemande}/fichier`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        if (this.previewBlobUrl) URL.revokeObjectURL(this.previewBlobUrl);
        this.previewBlobUrl = URL.createObjectURL(blob);
        this.previewSafeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.previewBlobUrl);
        this.showPreviewModal = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.showToast('Erreur', 'Impossible d\'ouvrir le fichier', 'error');
        this.cdr.detectChanges();
      },
    });
  }

  fermerPreview(): void {
    this.showPreviewModal = false;
    if (this.previewBlobUrl) { URL.revokeObjectURL(this.previewBlobUrl); this.previewBlobUrl = null; }
    this.previewSafeUrl = null;
    this.previewDemande = null;
    this.cdr.detectChanges();
  }

  downloadFromPreview(): void {
    if (!this.previewBlobUrl) return;
    const a = document.createElement('a');
    a.href = this.previewBlobUrl;
    a.download = this.previewTitle;
    a.click();
  }

  formatSize(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  showToast(title: string, message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    const id = ++this.toastIdCounter;
    this.toasts.push({ id, title, message, type });
    setTimeout(() => this.dismissToast(id), 4000);
  }

  dismissToast(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.cdr.detectChanges();
  }

  getStatutBarClass(s: string): string {
    const c: Record<string, string> = {
      EN_ATTENTE: 'bg-amber-400', ACCEPTE: 'bg-green-500',
      REJETE: 'bg-red-500', ANNULE: 'bg-gray-400',
    };
    return c[s] || 'bg-gray-300';
  }

  getStatutLabel(s: string): string {
    const l: Record<string, string> = { EN_ATTENTE: 'En attente', ACCEPTE: 'Acceptée', REJETE: 'Rejetée', ANNULE: 'Annulée' };
    return l[s] || s;
  }

  getStatutClass(s: string): string {
    const c: Record<string, string> = {
      EN_ATTENTE: 'bg-amber-100 text-amber-700',
      ACCEPTE: 'bg-green-100 text-green-700',
      REJETE: 'bg-red-100 text-red-700',
      ANNULE: 'bg-gray-100 text-gray-700',
    };
    return c[s] || 'bg-gray-100 text-gray-700';
  }
}
