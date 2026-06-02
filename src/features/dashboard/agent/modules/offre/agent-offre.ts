// src/features/dashboard/agent/modules/offre/agent-offre.ts
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';

interface Offre {
  idoffres: number;
  typeOffre: string;
  titre: string;
  description: string | null;
  cnib_filename: string | null;
  demandeOffre_filename: string | null;
  statusOffre: 'BROUILLON' | 'EN_ATTENTE' | 'EN_TRAITEMENT' | 'VALIDEE' | 'REJETEE' | 'ACTIVE' | 'CLOTUREE';
  motifRefus: string | null;
  createdDate: string;
  lastModifiedDate?: string;
  candidatCreateur?: {
    idcandidats: number;
    nom: string;
    prenom: string;
    email: string;
    telephone?: string;
  };
}

@Component({
  selector: 'app-agent-offre',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agent-offre.html',
})
export class AgentOffre implements OnInit {

  offres: Offre[] = [];
  offresFiltrees: Offre[] = [];
  loading = false;
  erreur = '';
  search = '';
  filtreStatut = '';
  filtreType = '';

  // Permissions (réactives)
  get peutConsulter(): boolean { return this.authService.hasPermission('OFFRE', 'CONSULTER'); }
  get peutCreer():    boolean { return this.authService.hasPermission('OFFRE', 'CREER'); }
  get peutModifier(): boolean { return this.authService.hasPermission('OFFRE', 'MODIFIER'); }
  get peutValider():  boolean { return this.authService.hasPermission('OFFRE', 'VALIDER'); }
  get peutRejeter():  boolean { return this.authService.hasPermission('OFFRE', 'REJETER'); }
  get peutSupprimer():boolean { return this.authService.hasPermission('OFFRE', 'SUPPRIMER'); }

  // Statistiques statuts
  statsStatuts = [
    { value: 'EN_ATTENTE',    label: 'En attente',    dot: 'bg-red-500',    ringClass: 'ring-red-400',    count: 0 },
    { value: 'EN_TRAITEMENT', label: 'En traitement', dot: 'bg-amber-400',  ringClass: 'ring-amber-400',  count: 0 },
    { value: 'VALIDEE',       label: 'Validées',       dot: 'bg-green-500',  ringClass: 'ring-green-400',  count: 0 },
    { value: 'REJETEE',       label: 'Rejetées',       dot: 'bg-red-500',    ringClass: 'ring-red-400',    count: 0 },
  ];

  // Modal créer
  showCreateModal = false;
  soumission = false;
  formErreur = '';
  form = {
    typeOffre: '', titre: '', description: '', conditionsRequises: '',
    documentsRequis: '', dateDebut: '', dateFin: '',
    nombreCandidaturesMax: null as number | null, statusOffre: 'BROUILLON',
  };

  // Modal traitement
  showTraitementModal = false;
  selectedOffre: Offre | null = null;
  erreurEval = '';
  evaluation = { statusOffre: '', motifRefus: '' };

  decisionsDisponibles = [
    { value: 'EN_TRAITEMENT', label: 'En traitement', activeClass: 'border-amber-400 bg-amber-50 text-amber-700' },
    { value: 'VALIDEE',       label: 'Valider',        activeClass: 'border-green-400 bg-green-50 text-green-700' },
    { value: 'REJETEE',       label: 'Rejeter',        activeClass: 'border-red-400 bg-red-50 text-red-700' },
  ];

  // Modal détail
  showDetailModal = false;
  detailOffre: Offre | null = null;

  // Modal suppression
  showDeleteModal = false;
  offreASupprimer: Offre | null = null;
  soumissionDelete = false;

  // Modal modifier
  showEditModal = false;
  offreAModifier: Offre | null = null;
  soumissionEdit = false;
  erreurEdit = '';
  editForm = {
    typeOffre: '', titre: '', description: '', conditionsRequises: '',
    documentsRequis: '', dateDebut: '', dateFin: '',
    nombreCandidaturesMax: null as number | null, statusOffre: '',
  };

  // Toasts
  toasts: { id: number; title: string; message: string; type: 'success' | 'error' | 'warning' }[] = [];
  private toastIdCounter = 0;

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (!this.peutConsulter) return;
    this.charger();
  }

  charger(): void {
    this.loading = true;
    this.erreur = '';
    this.http.get<any>(`${this.apiUrl}/offres`).subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          this.offres = res.data;
        } else {
          this.offres = res.data?.data || res.data || [];
        }
        this.calculerStats();
        this.filtrer();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.erreur = err.error?.message || 'Erreur lors du chargement des offres';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  calculerStats(): void {
    this.statsStatuts.forEach(s => {
      s.count = this.offres.filter(o => o.statusOffre === s.value).length;
    });
  }

  filtrer(): void {
    this.offresFiltrees = this.offres.filter(o => {
      const nom = this.getNomSource(o).toLowerCase();
      const matchSearch = !this.search ||
        (o.titre || '').toLowerCase().includes(this.search.toLowerCase()) ||
        (o.typeOffre || '').toLowerCase().includes(this.search.toLowerCase()) ||
        nom.includes(this.search.toLowerCase());
      const matchStatut = !this.filtreStatut || o.statusOffre === this.filtreStatut;
      const matchType   = !this.filtreType   || o.typeOffre === this.filtreType;
      return matchSearch && matchStatut && matchType;
    });
  }

  effacerFiltres(): void {
    this.search = '';
    this.filtreStatut = '';
    this.filtreType = '';
    this.filtrer();
  }

  peutEvaluer(o: Offre): boolean {
    return o.statusOffre === 'EN_ATTENTE' || o.statusOffre === 'EN_TRAITEMENT';
  }

  // ── Modal Créer ──
  creerOffre(): void {
    this.form = { typeOffre: '', titre: '', description: '', conditionsRequises: '', documentsRequis: '', dateDebut: '', dateFin: '', nombreCandidaturesMax: null, statusOffre: 'BROUILLON' };
    this.formErreur = '';
    this.showCreateModal = true;
  }

  fermerCreateModal(): void {
    if (this.soumission) return;
    this.showCreateModal = false;
    this.formErreur = '';
  }

  soumettre(): void {
    if (!this.form.typeOffre) { this.formErreur = "Le type d'offre est requis"; return; }
    if (!this.form.titre.trim()) { this.formErreur = 'Le titre est requis'; return; }
    this.formErreur = '';
    this.soumission = true;

    const body: any = {
      typeOffre: this.form.typeOffre, titre: this.form.titre,
      description: this.form.description || undefined,
      conditionsRequises: this.form.conditionsRequises || undefined,
      documentsRequis: this.form.documentsRequis || undefined,
      statusOffre: this.form.statusOffre,
    };
    if (this.form.dateDebut) body.dateDebut = this.form.dateDebut;
    if (this.form.dateFin) body.dateFin = this.form.dateFin;
    if (this.form.nombreCandidaturesMax) body.nombreCandidaturesMax = this.form.nombreCandidaturesMax;

    this.http.post<any>(`${this.apiUrl}/offres/admin`, body).subscribe({
      next: () => {
        this.soumission = false;
        this.fermerCreateModal();
        this.showToast('Succès', 'Offre créée avec succès');
        this.cdr.detectChanges();
        this.charger();
      },
      error: (err) => {
        this.formErreur = err.error?.message || "Erreur lors de la création de l'offre";
        this.soumission = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ── Modal Traitement ──
  ouvrirTraitement(o: Offre): void {
    this.selectedOffre = o;
    this.evaluation = { statusOffre: '', motifRefus: '' };
    this.erreurEval = '';
    this.showTraitementModal = true;
  }

  fermerTraitement(): void {
    this.showTraitementModal = false;
    this.selectedOffre = null;
    this.erreurEval = '';
  }

  validerRapide(o: Offre): void {
    this.selectedOffre = o;
    this.evaluation = { statusOffre: 'VALIDEE', motifRefus: '' };
    this.erreurEval = '';
    this.showTraitementModal = true;
  }

  rejeterRapide(o: Offre): void {
    this.selectedOffre = o;
    this.evaluation = { statusOffre: 'REJETEE', motifRefus: '' };
    this.erreurEval = '';
    this.showTraitementModal = true;
  }

  enregistrerDecision(): void {
    if (!this.evaluation.statusOffre) { this.erreurEval = 'Veuillez choisir une décision.'; return; }
    if (this.evaluation.statusOffre === 'REJETEE' && !this.evaluation.motifRefus.trim()) {
      this.erreurEval = 'Le motif du refus est obligatoire en cas de rejet.'; return;
    }
    if (!this.selectedOffre) return;
    this.soumission = true;
    this.erreurEval = '';

    const body: any = { statusOffre: this.evaluation.statusOffre };
    if (this.evaluation.motifRefus.trim()) body.motifRefus = this.evaluation.motifRefus.trim();

    this.http.put<any>(`${this.apiUrl}/offres/${this.selectedOffre.idoffres}/evaluer`, body).subscribe({
      next: () => {
        this.fermerTraitement();
        this.showToast('Succès', 'Décision enregistrée avec succès');
        this.soumission = false;
        this.cdr.detectChanges();
        this.charger();
      },
      error: (err) => {
        this.erreurEval = err.error?.message || "Erreur lors de l'enregistrement.";
        this.soumission = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ── Modal Détail ──
  voirDetail(o: Offre): void { this.detailOffre = o; this.showDetailModal = true; }
  fermerDetail(): void { this.showDetailModal = false; this.detailOffre = null; }

  // ── Modal Suppression ──
  ouvrirDeleteModal(o: Offre): void {
    this.offreASupprimer = o;
    this.soumissionDelete = false;
    this.showDeleteModal = true;
  }

  fermerDeleteModal(): void {
    if (this.soumissionDelete) return;
    this.showDeleteModal = false;
    this.offreASupprimer = null;
  }

  supprimerOffre(): void {
    if (!this.offreASupprimer) return;
    this.soumissionDelete = true;
    this.http.delete(`${this.apiUrl}/offres/${this.offreASupprimer.idoffres}`).subscribe({
      next: () => {
        this.offres = this.offres.filter(x => x.idoffres !== this.offreASupprimer!.idoffres);
        this.calculerStats();
        this.filtrer();
        this.fermerDeleteModal();
        this.showToast('Supprimé', 'Offre supprimée avec succès', 'warning');
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
  ouvrirEditModal(o: Offre): void {
    this.offreAModifier = o;
    this.editForm = {
      typeOffre: o.typeOffre || '',
      titre: o.titre || '',
      description: o.description || '',
      conditionsRequises: '',
      documentsRequis: '',
      dateDebut: '',
      dateFin: '',
      nombreCandidaturesMax: null,
      statusOffre: o.statusOffre || '',
    };
    this.erreurEdit = '';
    this.soumissionEdit = false;
    this.showEditModal = true;
  }

  fermerEditModal(): void {
    if (this.soumissionEdit) return;
    this.showEditModal = false;
    this.offreAModifier = null;
    this.erreurEdit = '';
  }

  modifierOffre(): void {
    if (!this.offreAModifier) return;
    if (!this.editForm.titre.trim()) { this.erreurEdit = 'Le titre est requis'; return; }
    this.erreurEdit = '';
    this.soumissionEdit = true;

    const body: any = {};
    if (this.editForm.typeOffre) body.typeOffre = this.editForm.typeOffre;
    if (this.editForm.titre.trim()) body.titre = this.editForm.titre.trim();
    if (this.editForm.description) body.description = this.editForm.description;
    if (this.editForm.conditionsRequises) body.conditionsRequises = this.editForm.conditionsRequises;
    if (this.editForm.documentsRequis) body.documentsRequis = this.editForm.documentsRequis;
    if (this.editForm.dateDebut) body.dateDebut = this.editForm.dateDebut;
    if (this.editForm.dateFin) body.dateFin = this.editForm.dateFin;
    if (this.editForm.nombreCandidaturesMax) body.nombreCandidaturesMax = this.editForm.nombreCandidaturesMax;
    if (this.editForm.statusOffre) body.statusOffre = this.editForm.statusOffre;

    this.http.put<any>(`${this.apiUrl}/offres/${this.offreAModifier.idoffres}`, body).subscribe({
      next: () => {
        this.fermerEditModal();
        this.showToast('Succès', 'Offre modifiée avec succès');
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

  // ── Fichiers ──
  ouvrirFichier(id: number, type: 'cnib' | 'demandeOffre', filename: string, mode: 'view' | 'download'): void {
    this.http.get(`${this.apiUrl}/offres/${id}/fichier/${type}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        if (mode === 'view') {
          window.open(url, '_blank');
          setTimeout(() => URL.revokeObjectURL(url), 10000);
        } else {
          const a = document.createElement('a');
          a.href = url; a.download = filename; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        }
      },
      error: () => {
        this.showToast('Erreur', 'Impossible de récupérer le fichier.', 'error');
        this.cdr.detectChanges();
      },
    });
  }

  // ── Helpers ──
  getInitiales(o: Offre): string {
    if (o.candidatCreateur) {
      return ((o.candidatCreateur.prenom?.[0] || '') + (o.candidatCreateur.nom?.[0] || '')).toUpperCase() || '?';
    }
    return 'A';
  }

  getNomSource(o: Offre): string {
    if (o.candidatCreateur) return `${o.candidatCreateur.prenom} ${o.candidatCreateur.nom}`.trim();
    return 'Administration';
  }

  showToast(title: string, message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    const id = ++this.toastIdCounter;
    this.toasts.push({ id, title, message, type });
    setTimeout(() => this.dismissToast(id), 4000);
  }

  dismissToast(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  getStatutBarClass(s: string): string {
    const c: Record<string, string> = {
      EN_ATTENTE: 'bg-blue-500', EN_TRAITEMENT: 'bg-amber-400',
      VALIDEE: 'bg-green-500', REJETEE: 'bg-red-500',
      ACTIVE: 'bg-emerald-500', CLOTUREE: 'bg-gray-400', BROUILLON: 'bg-gray-300',
    };
    return c[s] || 'bg-gray-300';
  }

  getStatutLabel(s: string): string {
    const l: Record<string, string> = {
      EN_ATTENTE: 'En attente', EN_TRAITEMENT: 'En traitement',
      VALIDEE: 'Validée', REJETEE: 'Rejetée',
      ACTIVE: 'Active', CLOTUREE: 'Clôturée', BROUILLON: 'Brouillon',
    };
    return l[s] || s;
  }

  getStatutClass(s: string): string {
    const c: Record<string, string> = {
      EN_ATTENTE: 'bg-blue-100 text-blue-700', EN_TRAITEMENT: 'bg-amber-100 text-amber-700',
      VALIDEE: 'bg-green-100 text-green-700', REJETEE: 'bg-red-100 text-red-700',
      ACTIVE: 'bg-emerald-100 text-emerald-700', CLOTUREE: 'bg-gray-100 text-gray-600',
      BROUILLON: 'bg-gray-100 text-gray-500',
    };
    return c[s] || 'bg-gray-100 text-gray-600';
  }
}
