// src/features/dashboard/agent/modules/audience/agent-audience.ts
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';

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
}

@Component({
  selector: 'app-agent-audience',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  get peutConsulter(): boolean { return this.authService.hasPermission('DEMANDE_AUDIENCE', 'CONSULTER'); }
  get peutValider():   boolean { return this.authService.hasPermission('DEMANDE_AUDIENCE', 'VALIDER'); }
  get peutRejeter():   boolean { return this.authService.hasPermission('DEMANDE_AUDIENCE', 'REJETER'); }

  // Toasts
  toasts: { id: number; title: string; message: string; type: 'success' | 'error' | 'warning' }[] = [];
  private toastIdCounter = 0;

  statsStatuts = [
    { value: 'EN_ATTENTE', label: 'En attente', dot: 'bg-amber-400', ringClass: 'ring-amber-400', count: 0 },
    { value: 'ACCEPTE',    label: 'Acceptées',  dot: 'bg-green-500', ringClass: 'ring-green-400', count: 0 },
    { value: 'REJETE',     label: 'Rejetées',   dot: 'bg-red-500',   ringClass: 'ring-red-400',   count: 0 },
    { value: 'ANNULE',     label: 'Annulées',   dot: 'bg-gray-400',  ringClass: 'ring-gray-400',  count: 0 },
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
    this.showDetailModal = true;
    this.cdr.detectChanges();
  }

  fermerDetail(): void {
    this.showDetailModal = false;
    this.detailDemande = null;
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
