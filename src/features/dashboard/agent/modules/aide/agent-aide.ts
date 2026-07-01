// src/features/dashboard/agent/modules/aide/agent-aide.ts
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';
import { StatCard } from '../../../../../shared/components/stat-card/stat-card';

interface Aide {
  idaide: number;
  titre: string;
  description?: string;
  typeAide: string;
  montant?: number;
  statusAide: 'EN_ATTENTE' | 'VALIDEE' | 'REJETEE' | 'EXPIREE';
  creePar: 'CANDIDAT' | 'ADMIN';
  createdDate: string;
  candidatCreateur?: { idcandidats: number; nom: string; prenom: string; email: string };
  agentCreateur?: { idagents: number; nom: string; prenom: string };
  // Fichiers joints
  cnib_filename?: string;
  cnib_size?: number;
  demandeAide_filename?: string;
  demandeAide_size?: number;
}

@Component({
  selector: 'app-agent-aide',
  standalone: true,
  imports: [CommonModule, FormsModule, StatCard],
  templateUrl: './agent-aide.html',
})
export class AgentAide implements OnInit {

  aides: Aide[] = [];
  aidesFiltrees: Aide[] = [];
  loading = false;
  erreur = '';
  search = '';
  filtreStatut = '';
  filtreType = '';

  // Permissions (réactives)
  get peutConsulter(): boolean { return this.authService.hasPermission('AIDE', 'CONSULTER'); }
  get peutCreer(): boolean { return this.authService.hasPermission('AIDE', 'CREER'); }
  get peutModifier(): boolean { return this.authService.hasPermission('AIDE', 'MODIFIER'); }
  get peutValider(): boolean { return this.authService.hasPermission('AIDE', 'VALIDER'); }
  get peutRejeter(): boolean { return this.authService.hasPermission('AIDE', 'REJETER'); }
  get peutSupprimer(): boolean { return this.authService.hasPermission('AIDE', 'SUPPRIMER'); }

  statsStatuts = [
    { value: 'EN_ATTENTE', label: 'En attente', dot: 'bg-amber-400', ringClass: 'ring-amber-400', count: 0, accent: 'amber',   icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { value: 'VALIDEE', label: 'Validées', dot: 'bg-green-500', ringClass: 'ring-green-400', count: 0, accent: 'emerald', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { value: 'REJETEE', label: 'Rejetées', dot: 'bg-red-500', ringClass: 'ring-red-400', count: 0, accent: 'rose',    icon: 'M6 18L18 6M6 6l12 12' },
    { value: 'EXPIREE', label: 'Expirées', dot: 'bg-gray-400', ringClass: 'ring-gray-400', count: 0, accent: 'slate',   icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  // Modal détail
  showDetailModal = false;
  detailAide: Aide | null = null;
  loadingDetailDocs = false;

  // Modal aperçu document
  showPreviewModal = false;
  previewBlobUrl: string | null = null;
  previewSafeUrl: SafeResourceUrl | null = null;
  previewTitle = '';
  private previewDocType: 'cnib' | 'demandeAide' | null = null;

  // Modal créer
  showModal = false;
  soumission = false;
  formErreur = '';
  form = {
    typeAide: '',
    titre: '',
    description: '',
    conditionsRequises: '',
    documentsRequis: '',
    dateDebut: '',
    dateFin: '',
    nombreBeneficiairesMax: null as number | null,
    statusAide: 'BROUILLON',
  };

  // Modal suppression
  showDeleteModal = false;
  aideASupprimer: Aide | null = null;
  soumissionDelete = false;

  // Modal modifier
  showEditModal = false;
  aideAModifier: Aide | null = null;
  soumissionEdit = false;
  erreurEdit = '';
  editForm = {
    typeAide: '', titre: '', description: '', conditionsRequises: '',
    documentsRequis: '', dateDebut: '', dateFin: '',
    nombreBeneficiairesMax: null as number | null, statusAide: '',
  };

  // Modal traitement (évaluation)
  showTraitementModal = false;
  aideATraiter: Aide | null = null;
  traitementDecision: 'VALIDEE' | 'REJETEE' | '' = '';
  traitementMotif = '';
  soumissionTraitement = false;
  erreurTraitement = '';

  // Toasts
  toasts: { id: number; title: string; message: string; type: 'success' | 'error' | 'warning' }[] = [];
  private toastIdCounter = 0;

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
  ) { }

  ngOnInit(): void {
    if (!this.peutConsulter) return;
    this.charger();
  }

  charger(): void {
    this.loading = true;
    this.erreur = '';
    this.http.get<any>(`${this.apiUrl}/aides?limit=50`).subscribe({
      next: (res) => {
        this.aides = res.data?.data || res.data || [];
        this.calculerStats();
        this.filtrer();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.erreur = err.error?.message || 'Erreur lors du chargement des aides';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  calculerStats(): void {
    this.statsStatuts.forEach(s => {
      s.count = this.aides.filter(a => a.statusAide === s.value).length;
    });
  }

  filtrer(): void {
    this.aidesFiltrees = this.aides.filter(a => {
      const matchSearch = !this.search || (a.titre || '').toLowerCase().includes(this.search.toLowerCase())
        || (a.candidatCreateur?.nom || '').toLowerCase().includes(this.search.toLowerCase())
        || (a.candidatCreateur?.prenom || '').toLowerCase().includes(this.search.toLowerCase());
      const matchStatut = !this.filtreStatut || a.statusAide === this.filtreStatut;
      const matchType = !this.filtreType || a.typeAide === this.filtreType;
      return matchSearch && matchStatut && matchType;
    });
  }

  effacerFiltres(): void {
    this.search = '';
    this.filtreStatut = '';
    this.filtreType = '';
    this.filtrer();
  }

  creerAide(): void {
    this.form = {
      typeAide: '', titre: '', description: '', conditionsRequises: '',
      documentsRequis: '', dateDebut: '', dateFin: '',
      nombreBeneficiairesMax: null, statusAide: 'BROUILLON',
    };
    this.formErreur = '';
    this.showModal = true;
  }

  fermerModal(): void {
    if (this.soumission) return;
    this.showModal = false;
    this.formErreur = '';
  }

  soumettre(): void {
    if (!this.form.typeAide) { this.formErreur = "Le type d'aide est requis"; return; }
    if (!this.form.titre.trim()) { this.formErreur = 'Le titre est requis'; return; }

    this.formErreur = '';
    this.soumission = true;

    const body: any = {
      typeAide: this.form.typeAide,
      titre: this.form.titre,
      description: this.form.description || undefined,
      conditionsRequises: this.form.conditionsRequises || undefined,
      documentsRequis: this.form.documentsRequis || undefined,
      statusAide: this.form.statusAide,
    };
    if (this.form.dateDebut) body.dateDebut = this.form.dateDebut;
    if (this.form.dateFin) body.dateFin = this.form.dateFin;
    if (this.form.nombreBeneficiairesMax) body.nombreBeneficiairesMax = this.form.nombreBeneficiairesMax;

    this.http.post<any>(`${this.apiUrl}/aides/admin`, body).subscribe({
      next: (res) => {
        const newAide = res.data;
        if (newAide) { this.aides.unshift(newAide); }
        this.calculerStats();
        this.filtrer();
        this.soumission = false;
        this.fermerModal();
        this.showToast('Succès', 'Aide créée avec succès');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.formErreur = err.error?.message || "Erreur lors de la création de l'aide";
        this.soumission = false;
        this.cdr.detectChanges();
      },
    });
  }

  evaluer(a: Aide, statut: 'VALIDEE' | 'REJETEE'): void {
    this.http.put(`${this.apiUrl}/aides/${a.idaide}/evaluer`, { statusAide: statut }).subscribe({
      next: () => {
        a.statusAide = statut;
        this.calculerStats();
        this.filtrer();
        this.showToast('Succès', `Aide ${statut === 'VALIDEE' ? 'validée' : 'rejetée'} avec succès`);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.showToast('Erreur', err.error?.message || 'Erreur', 'error');
        this.cdr.detectChanges();
      },
    });
  }

  // ── Modal Suppression ──
  ouvrirDeleteModal(a: Aide): void {
    this.aideASupprimer = a;
    this.soumissionDelete = false;
    this.showDeleteModal = true;
  }

  fermerDeleteModal(): void {
    if (this.soumissionDelete) return;
    this.showDeleteModal = false;
    this.aideASupprimer = null;
  }

  supprimerAide(): void {
    if (!this.aideASupprimer) return;
    this.soumissionDelete = true;
    this.http.delete(`${this.apiUrl}/aides/${this.aideASupprimer.idaide}`).subscribe({
      next: () => {
        this.aides = this.aides.filter(x => x.idaide !== this.aideASupprimer!.idaide);
        this.calculerStats();
        this.filtrer();
        this.fermerDeleteModal();
        this.showToast('Supprimé', 'Aide supprimée avec succès', 'warning');
        this.soumissionDelete = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.showToast('Erreur', err.error?.message || 'Erreur lors de la suppression', 'error');
        this.soumissionDelete = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ── Modal Modifier ──
  ouvrirEditModal(a: Aide): void {
    this.aideAModifier = a;
    this.editForm = {
      typeAide: a.typeAide || '',
      titre: a.titre || '',
      description: a.description || '',
      conditionsRequises: '',
      documentsRequis: '',
      dateDebut: '',
      dateFin: '',
      nombreBeneficiairesMax: null,
      statusAide: a.statusAide || '',
    };
    this.erreurEdit = '';
    this.soumissionEdit = false;
    this.showEditModal = true;
  }

  fermerEditModal(): void {
    if (this.soumissionEdit) return;
    this.showEditModal = false;
    this.aideAModifier = null;
    this.erreurEdit = '';
  }

  modifierAide(): void {
    if (!this.aideAModifier) return;
    if (!this.editForm.titre.trim()) { this.erreurEdit = 'Le titre est requis'; return; }
    this.erreurEdit = '';
    this.soumissionEdit = true;

    const body: any = {};
    if (this.editForm.typeAide) body.typeAide = this.editForm.typeAide;
    if (this.editForm.titre.trim()) body.titre = this.editForm.titre.trim();
    if (this.editForm.description) body.description = this.editForm.description;
    if (this.editForm.conditionsRequises) body.conditionsRequises = this.editForm.conditionsRequises;
    if (this.editForm.documentsRequis) body.documentsRequis = this.editForm.documentsRequis;
    if (this.editForm.dateDebut) body.dateDebut = this.editForm.dateDebut;
    if (this.editForm.dateFin) body.dateFin = this.editForm.dateFin;
    if (this.editForm.nombreBeneficiairesMax) body.nombreBeneficiairesMax = this.editForm.nombreBeneficiairesMax;
    if (this.editForm.statusAide) body.statusAide = this.editForm.statusAide;

    this.http.put<any>(`${this.apiUrl}/aides/${this.aideAModifier.idaide}`, body).subscribe({
      next: () => {
        this.fermerEditModal();
        this.showToast('Succès', 'Aide modifiée avec succès');
        this.soumissionEdit = false;
        this.cdr.detectChanges();
        this.charger();
      },
      error: (err) => {
        this.erreurEdit = err.error?.message || 'Erreur lors de la modification';
        this.soumissionEdit = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ── Modal Traitement ──
  ouvrirTraitementModal(a: Aide): void {
    this.aideATraiter = a;
    this.traitementDecision = '';
    this.traitementMotif = '';
    this.erreurTraitement = '';
    this.soumissionTraitement = false;
    this.showTraitementModal = true;
  }

  fermerTraitementModal(): void {
    if (this.soumissionTraitement) return;
    this.showTraitementModal = false;
    this.aideATraiter = null;
  }

  confirmerTraitement(): void {
    if (!this.aideATraiter || !this.traitementDecision) return;
    this.erreurTraitement = '';
    this.soumissionTraitement = true;
    const body: any = { statusAide: this.traitementDecision };
    if (this.traitementDecision === 'REJETEE' && this.traitementMotif.trim()) {
      body.motif = this.traitementMotif.trim();
    }
    this.http.put(`${this.apiUrl}/aides/${this.aideATraiter.idaide}/evaluer`, body).subscribe({
      next: () => {
        const statut = this.traitementDecision as 'VALIDEE' | 'REJETEE';
        this.aideATraiter!.statusAide = statut;
        this.calculerStats();
        this.filtrer();
        this.fermerTraitementModal();
        this.showToast('Succès', `Aide ${statut === 'VALIDEE' ? 'validée' : 'rejetée'} avec succès`);
        this.soumissionTraitement = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.erreurTraitement = err.error?.message || "Erreur lors de l'évaluation";
        this.soumissionTraitement = false;
        this.cdr.detectChanges();
      },
    });
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

  voirDetail(a: Aide): void {
    this.detailAide = { ...a };
    this.showDetailModal = true;
    this.loadingDetailDocs = true;
    this.cdr.detectChanges();

    this.http.get<any>(`${this.apiUrl}/aides/${a.idaide}`).subscribe({
      next: (res) => {
        if (this.detailAide?.idaide === a.idaide) {
          this.detailAide = {
            ...this.detailAide,
            cnib_filename: res.data?.cnib_filename || null,
            cnib_size: res.data?.cnib_size || null,
            demandeAide_filename: res.data?.demandeAide_filename || null,
            demandeAide_size: res.data?.demandeAide_size || null,
          };
        }
        this.loadingDetailDocs = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingDetailDocs = false;
        this.cdr.detectChanges();
      },
    });
  }

  fermerDetail(): void {
    this.showDetailModal = false;
    this.detailAide = null;
    this.loadingDetailDocs = false;
    this.cdr.detectChanges();
  }

  previewFichier(type: 'cnib' | 'demandeAide'): void {
    if (!this.detailAide) return;
    this.previewTitle = type === 'cnib'
      ? (this.detailAide.cnib_filename || 'CNIB')
      : (this.detailAide.demandeAide_filename || "Demande d'aide");
    this.previewDocType = type;
    this.http.get(`${this.apiUrl}/aides/${this.detailAide.idaide}/fichier/${type}`, { responseType: 'blob' }).subscribe({
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

  downloadFromPreview(): void {
    if (!this.previewBlobUrl || !this.detailAide || !this.previewDocType) return;
    const filename = this.previewDocType === 'cnib'
      ? (this.detailAide.cnib_filename || 'cnib.pdf')
      : (this.detailAide.demandeAide_filename || 'demande-aide.pdf');
    const a = document.createElement('a');
    a.href = this.previewBlobUrl; a.download = filename; a.click();
  }

  downloadFichier(type: 'cnib' | 'demandeAide'): void {
    if (!this.detailAide) return;
    const filename = type === 'cnib'
      ? (this.detailAide.cnib_filename || 'cnib.pdf')
      : (this.detailAide.demandeAide_filename || 'demande-aide.pdf');
    this.http.get(`${this.apiUrl}/aides/${this.detailAide.idaide}/fichier/${type}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.showToast('Erreur', 'Impossible de télécharger le fichier', 'error');
        this.cdr.detectChanges();
      },
    });
  }

  fermerPreview(): void {
    this.showPreviewModal = false;
    if (this.previewBlobUrl) { URL.revokeObjectURL(this.previewBlobUrl); this.previewBlobUrl = null; }
    this.previewSafeUrl = null;
    this.previewDocType = null;
    this.cdr.detectChanges();
  }

  formatSize(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  getInitiales(a: Aide): string {
    if (a.creePar === 'ADMIN') return 'AD';
    if (!a.candidatCreateur) return '?';
    return ((a.candidatCreateur.nom?.[0] || '') + (a.candidatCreateur.prenom?.[0] || '')).toUpperCase() || '?';
  }

  getStatutBarClass(s: string): string {
    const c: Record<string, string> = {
      EN_ATTENTE: 'bg-amber-400', VALIDEE: 'bg-green-500',
      REJETEE: 'bg-red-500', EXPIREE: 'bg-gray-400',
    };
    return c[s] || 'bg-gray-300';
  }

  getStatutLabel(s: string): string {
    const l: Record<string, string> = { EN_ATTENTE: 'En attente', VALIDEE: 'Validée', REJETEE: 'Rejetée', EXPIREE: 'Expirée' };
    return l[s] || s;
  }

  getStatutClass(s: string): string {
    const c: Record<string, string> = {
      EN_ATTENTE: 'bg-amber-100 text-amber-700',
      VALIDEE: 'bg-green-100 text-green-700',
      REJETEE: 'bg-red-100 text-red-700',
      EXPIREE: 'bg-gray-100 text-gray-700',
    };
    return c[s] || 'bg-gray-100 text-gray-700';
  }
}
