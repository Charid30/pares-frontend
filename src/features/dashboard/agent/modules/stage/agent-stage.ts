import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { saveAs } from 'file-saver';
import { AuthService } from '../../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';

interface Candidat {
  idcandidats: number;
  nom: string;
  prenom: string;
  email: string;
}

interface StageDocument {
  iddocument: number;
  typeDocument: string;
}

interface Stage {
  idstage: number;
  typeStage: string;
  statusStage: 'EN_ATTENTE' | 'ACCEPTE' | 'EN_COURS' | 'TERMINE' | 'REJETE' | 'ANNULE';
  dateDebut?: string;
  dateFin?: string;
  dateDebutEffective?: string;
  dateFinEffective?: string;
  dateDebutSouhaitee?: string;
  dureeStage?: number;
  domaineStage?: string;
  service?: string;
  commentaireAdmin?: string;
  createdDate: string;
  candidat?: Candidat;
  documents?: StageDocument[];
  // Documents soumis par le candidat (filenames)
  cv_filename?: string;
  cnib_filename?: string;
  casierJudiciaire_filename?: string;
  lettreMotivation_filename?: string;
  lettreRecommandation_filename?: string;
  dernierDiplome_filename?: string;
}

interface StageStats {
  total: number;
  enAttente: number;
  enCours: number;
  accepte: number;
  termine: number;
  rejete: number;
}

@Component({
  selector: 'app-agent-stage',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterLink],
  templateUrl: './agent-stage.html',
})
export class AgentStage implements OnInit {

  // ── Données ────────────────────────────────────────────────
  stages: Stage[] = [];
  stagesFiltres: Stage[] = [];
  stats: StageStats = { total: 0, enAttente: 0, enCours: 0, accepte: 0, termine: 0, rejete: 0 };

  // ── État ──────────────────────────────────────────────────
  isLoading = false;
  erreur = '';
  successMessage = '';

  // ── Filtres ───────────────────────────────────────────────
  search = '';
  filtreStatut = '';
  filtreType = '';

  // ── Modals ────────────────────────────────────────────────
  showDetailModal = false;
  detailStage: Stage | null = null;
  loadingDetailDocs = false;
  stageEnDecision: Stage | null = null;
  decisionType: 'ACCEPTE' | 'REJETE' = 'ACCEPTE';

  // ── Champs décision ───────────────────────────────────────
  dateDebut = '';
  dateFin = '';
  commentaire = '';
  conventionFile: File | null = null;
  soumission = false;
  errorDecision = '';

  // ── Modal MODIFIER ────────────────────────────────────────
  showEditStageModal = false;
  stageAModifier: Stage | null = null;
  editDateDebut = '';
  editDateFin = '';
  editCommentaire = '';
  soumissionEdit = false;
  errorEdit = '';

  // ── Modal SUPPRIMER ───────────────────────────────────────
  showDeleteStageModal = false;
  stageASupprimer: Stage | null = null;
  soumissionSupprimer = false;

  // ── Modal CREER document ──────────────────────────────────
  showDocModal = false;
  docStageId: number | null = null;
  docType: 'CONVENTION' | 'ATTESTATION' = 'CONVENTION';
  docDateEmission = '';
  docFile: File | null = null;
  soumissionDoc = false;
  errorDoc = '';
  stageHasConvention = false;
  checkingConvention = false;
  downloadingAllDocs = false;
  private agentNomComplet = '';

  private apiUrl = environment.apiUrl;

  // ── Permissions ───────────────────────────────────────────
  get peutConsulter(): boolean { return this.authService.hasPermission('STAGE', 'CONSULTER'); }
  get peutValider(): boolean   { return this.authService.hasPermission('STAGE', 'VALIDER'); }
  get peutRejeter(): boolean   { return this.authService.hasPermission('STAGE', 'REJETER'); }
  get peutCreer(): boolean     { return this.authService.hasPermission('STAGE', 'CREER'); }
  get peutModifier(): boolean  { return this.authService.hasPermission('STAGE', 'MODIFIER'); }
  get peutSupprimer(): boolean { return this.authService.hasPermission('STAGE', 'SUPPRIMER'); }

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Charger le nom/prénom de l'agent connecté (pour les documents)
    this.http.get<any>(`${this.apiUrl}/auth/profile`).subscribe({
      next: (res) => {
        const agent = res.data?.agents?.[0];
        if (agent) {
          this.agentNomComplet = `${agent.prenom || ''} ${agent.nom || ''}`.trim();
        }
      },
      error: () => {} // non bloquant
    });

    if (this.peutConsulter) {
      this.charger();
    } else {
      this.cdr.detectChanges();
    }
  }

  // ── Chargement ────────────────────────────────────────────
  charger(): void {
    this.isLoading = true;
    this.erreur = '';
    this.http.get<any>(`${this.apiUrl}/stages?limit=100`).subscribe({
      next: (res) => {
        this.stages = res.data?.items || [];
        this.calculerStats();
        this.filtrer();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.erreur = err.error?.message || 'Erreur lors du chargement des stages';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  calculerStats(): void {
    this.stats = {
      total:     this.stages.length,
      enAttente: this.stages.filter(s => s.statusStage === 'EN_ATTENTE').length,
      accepte:   this.stages.filter(s => s.statusStage === 'ACCEPTE').length,
      enCours:   this.stages.filter(s => s.statusStage === 'EN_COURS').length,
      termine:   this.stages.filter(s => s.statusStage === 'TERMINE').length,
      rejete:    this.stages.filter(s => s.statusStage === 'REJETE').length,
    };
  }

  filtrer(): void {
    this.stagesFiltres = this.stages.filter(s => {
      const txt = `${s.candidat?.nom || ''} ${s.candidat?.prenom || ''} ${s.candidat?.email || ''}`.toLowerCase();
      const matchSearch  = !this.search      || txt.includes(this.search.toLowerCase());
      const matchStatut  = !this.filtreStatut || s.statusStage === this.filtreStatut;
      const matchType    = !this.filtreType   || s.typeStage   === this.filtreType;
      return matchSearch && matchStatut && matchType;
    });
  }

  setFiltreStatut(val: string): void {
    this.filtreStatut = this.filtreStatut === val ? '' : val;
    this.filtrer();
    this.cdr.detectChanges();
  }

  effacerFiltres(): void {
    this.search = '';
    this.filtreStatut = '';
    this.filtreType = '';
    this.filtrer();
    this.cdr.detectChanges();
  }

  // ── Détail ────────────────────────────────────────────────
  voirDetail(s: Stage): void {
    this.detailStage = { ...s };
    this.showDetailModal = true;
    this.loadingDetailDocs = true;
    this.cdr.detectChanges();

    this.http.get<any>(`${this.apiUrl}/stages/${s.idstage}`).subscribe({
      next: (res) => {
        if (this.detailStage && this.detailStage.idstage === s.idstage) {
          this.detailStage.documents = res.data?.documents || [];
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
    this.detailStage = null;
    this.loadingDetailDocs = false;
    this.cdr.detectChanges();
  }

  hasDoc(type: 'CONVENTION' | 'ATTESTATION'): boolean {
    return (this.detailStage?.documents || []).some(d => d.typeDocument === type);
  }

  // ── Décision ──────────────────────────────────────────────
  ouvrirDecision(s: Stage, type: 'ACCEPTE' | 'REJETE'): void {
    this.stageEnDecision = s;
    this.decisionType = type;
    // Pré-remplir la date de début avec la date souhaitée par le candidat
    this.dateDebut = s.dateDebutSouhaitee ? s.dateDebutSouhaitee.substring(0, 10) : '';
    this.dateFin = '';
    this.commentaire = '';
    this.conventionFile = null;
    this.errorDecision = '';
    this.cdr.detectChanges();
  }

  fermerDecision(): void {
    this.stageEnDecision = null;
    this.errorDecision = '';
    this.cdr.detectChanges();
  }

  onConventionFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.conventionFile = input.files?.[0] || null;
  }

  confirmerDecision(): void {
    if (!this.stageEnDecision || this.soumission) return;
    if (this.decisionType === 'ACCEPTE' && !this.dateDebut) {
      this.errorDecision = 'La date de début effective est obligatoire.';
      this.cdr.detectChanges();
      return;
    }
    if (this.decisionType === 'ACCEPTE' && !this.conventionFile) {
      this.errorDecision = 'La convention de stage (PDF) est obligatoire pour accepter.';
      this.cdr.detectChanges();
      return;
    }
    this.soumission = true;
    this.errorDecision = '';

    const formData = new FormData();
    formData.append('statusStage', this.decisionType);
    if (this.decisionType === 'REJETE') {
      // Le backend attend "motifRefus" pour un rejet
      formData.append('motifRefus', this.commentaire);
    } else {
      if (this.commentaire) formData.append('commentaireAdmin', this.commentaire);
      formData.append('dateDebutEffective', this.dateDebut);
      if (this.conventionFile) formData.append('conventionStage', this.conventionFile);
    }

    // Valider que le motif est fourni pour un rejet
    if (this.decisionType === 'REJETE' && !this.commentaire.trim()) {
      this.errorDecision = 'Le motif de refus est obligatoire.';
      this.soumission = false;
      this.cdr.detectChanges();
      return;
    }

    const msg = this.decisionType === 'ACCEPTE' ? 'accepté' : 'rejeté';
    this.http.put<any>(`${this.apiUrl}/stages/${this.stageEnDecision.idstage}/statut`, formData).subscribe({
      next: () => {
        this.stageEnDecision = null;
        this.soumission = false;
        this.charger(); // Recharger depuis le serveur pour avoir le statut à jour
        this.showSuccessMessage(`Stage ${msg} avec succès !`);
      },
      error: (err) => {
        this.errorDecision = err.error?.message || 'Erreur lors de la décision';
        this.soumission = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── MODIFIER ──────────────────────────────────────────────
  ouvrirEditModal(s: Stage): void {
    this.stageAModifier = s;
    this.editDateDebut = s.dateDebut ? s.dateDebut.substring(0, 10) : '';
    this.editDateFin   = s.dateFin   ? s.dateFin.substring(0, 10)   : '';
    this.editCommentaire = s.commentaireAdmin || '';
    this.errorEdit = '';
    this.showEditStageModal = true;
    this.cdr.detectChanges();
  }

  fermerEditModal(): void {
    this.showEditStageModal = false;
    this.stageAModifier = null;
    this.soumissionEdit = false;
    this.cdr.detectChanges();
  }

  modifierStage(): void {
    if (!this.stageAModifier || this.soumissionEdit) return;
    this.soumissionEdit = true;
    this.errorEdit = '';

    const body: Record<string, any> = { commentaireAdmin: this.editCommentaire };
    if (this.editDateDebut) body['dateDebutEffective'] = this.editDateDebut;
    if (this.editDateFin)   body['dateFinEffective']   = this.editDateFin;

    this.http.put<any>(`${this.apiUrl}/stages/${this.stageAModifier.idstage}`, body).subscribe({
      next: () => {
        this.fermerEditModal();
        this.charger();
        this.showSuccessMessage('Stage modifié avec succès !');
      },
      error: (err) => {
        this.errorEdit = err.error?.message || 'Erreur lors de la modification';
        this.soumissionEdit = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── SUPPRIMER ─────────────────────────────────────────────
  ouvrirDeleteStageModal(s: Stage): void {
    this.stageASupprimer = s;
    this.showDeleteStageModal = true;
    this.cdr.detectChanges();
  }

  fermerDeleteStageModal(): void {
    this.showDeleteStageModal = false;
    this.stageASupprimer = null;
    this.soumissionSupprimer = false;
    this.cdr.detectChanges();
  }

  supprimerStage(): void {
    if (!this.stageASupprimer || this.soumissionSupprimer) return;
    this.soumissionSupprimer = true;

    this.http.delete<any>(`${this.apiUrl}/stages/${this.stageASupprimer.idstage}`).subscribe({
      next: () => {
        this.fermerDeleteStageModal();
        this.charger();
        this.showSuccessMessage('Stage supprimé avec succès !');
      },
      error: (err) => {
        this.erreur = err.error?.message || 'Erreur lors de la suppression';
        this.soumissionSupprimer = false;
        this.fermerDeleteStageModal();
        this.cdr.detectChanges();
      }
    });
  }

  // ── CREER document ────────────────────────────────────────
  ouvrirDocModal(s: Stage): void {
    this.docStageId = s.idstage;
    this.docType = 'CONVENTION';
    this.docDateEmission = new Date().toISOString().substring(0, 10);
    this.docFile = null;
    this.errorDoc = '';
    this.stageHasConvention = false;
    this.checkingConvention = true;
    this.showDocModal = true;
    this.cdr.detectChanges();

    // Vérifier si une convention est déjà jointe
    this.http.get<any>(`${this.apiUrl}/stages/${s.idstage}`).subscribe({
      next: (res) => {
        const docs: StageDocument[] = res.data?.documents || [];
        this.stageHasConvention = docs.some(d => d.typeDocument === 'CONVENTION');
        if (this.stageHasConvention) {
          this.docType = 'ATTESTATION';
        }
        this.checkingConvention = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.checkingConvention = false;
        this.cdr.detectChanges();
      }
    });
  }

  fermerDocModal(): void {
    this.showDocModal = false;
    this.docStageId = null;
    this.soumissionDoc = false;
    this.stageHasConvention = false;
    this.cdr.detectChanges();
  }

  onDocFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.docFile = input.files?.[0] || null;
  }

  creerDocument(): void {
    if (!this.docStageId || this.soumissionDoc) return;
    if (!this.docFile) { this.errorDoc = 'Veuillez sélectionner un fichier PDF'; this.cdr.detectChanges(); return; }
    if (!this.docDateEmission) { this.errorDoc = "La date d'émission est requise"; this.cdr.detectChanges(); return; }

    this.soumissionDoc = true;
    this.errorDoc = '';

    const formData = new FormData();
    formData.append('stage_idstage', String(this.docStageId));
    formData.append('typeDocument', this.docType);
    formData.append('dateEmission', this.docDateEmission);
    formData.append('document', this.docFile);
    if (this.agentNomComplet) formData.append('emetteurNom', this.agentNomComplet);

    this.http.post<any>(`${this.apiUrl}/stages/documents`, formData).subscribe({
      next: () => {
        this.showSuccessMessage('Document créé avec succès !');
        this.fermerDocModal();
        this.soumissionDoc = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorDoc = err.error?.message || 'Erreur lors de la création du document';
        this.soumissionDoc = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Documents candidat ────────────────────────────────────

  /** Retourne la liste des documents soumis par le candidat (non-vides) */
  getCandidatDocs(): { type: string; label: string; filename: string }[] {
    if (!this.detailStage) return [];
    const docs: { type: string; label: string; filename: string }[] = [];
    const map: { type: string; label: string; filenameKey: keyof Stage }[] = [
      { type: 'lettreMotivation',    label: 'Lettre de motivation',    filenameKey: 'lettreMotivation_filename'    },
      { type: 'cv',                  label: 'Curriculum vitae (CV)',   filenameKey: 'cv_filename'                  },
      { type: 'cnib',                label: 'Pièce d\'identité (CNIB)', filenameKey: 'cnib_filename'              },
      { type: 'casierJudiciaire',    label: 'Casier judiciaire',       filenameKey: 'casierJudiciaire_filename'    },
      { type: 'lettreRecommandation',label: 'Lettre de recommandation',filenameKey: 'lettreRecommandation_filename'},
      { type: 'dernierDiplome',      label: 'Dernier diplôme',         filenameKey: 'dernierDiplome_filename'      },
    ];
    for (const m of map) {
      const filename = this.detailStage[m.filenameKey] as string | undefined;
      if (filename) docs.push({ type: m.type, label: m.label, filename });
    }
    return docs;
  }

  /** Ouvre ou télécharge un blob PDF */
  private ouvrirOuTelechargerBlob(blob: Blob, filename: string, mode: 'voir' | 'telecharger'): void {
    const pdfBlob = new Blob([blob], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(pdfBlob);
    if (mode === 'voir') {
      const onglet = window.open(url, '_blank');
      if (onglet) {
        setTimeout(() => window.URL.revokeObjectURL(url), 10000);
      } else {
        this.showSuccessMessage('Autorisez les popups pour visualiser le document');
        window.URL.revokeObjectURL(url);
      }
    } else {
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 500);
    }
  }

  /** Télécharger un document soumis par le candidat */
  accederDocCandidatBlob(docType: string, filename: string, mode: 'voir' | 'telecharger'): void {
    if (!this.detailStage) return;
    this.http.get(`${this.apiUrl}/stages/${this.detailStage.idstage}/documents/${docType}`, { responseType: 'blob' }).subscribe({
      next: (blob) => this.ouvrirOuTelechargerBlob(blob, filename, mode),
      error: () => this.showSuccessMessage('Impossible de charger ce document')
    });
  }

  /** Télécharger tous les documents soumis par le candidat dans un ZIP */
  async telechargerTousDocs(): Promise<void> {
    if (!this.detailStage || this.downloadingAllDocs) return;
    const docs = this.getCandidatDocs();
    if (docs.length === 0) return;

    this.downloadingAllDocs = true;
    this.cdr.detectChanges();

    const stageId = this.detailStage.idstage;
    const candidatNom = `${this.detailStage.candidat?.prenom || ''}_${this.detailStage.candidat?.nom || ''}`.replace(/\s+/g, '_');

    const blobs = await Promise.all(
      docs.map(d =>
        firstValueFrom(
          this.http.get(`${this.apiUrl}/stages/${stageId}/documents/${d.type}`, { responseType: 'blob' })
        ).catch(() => null)
      )
    );

    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    blobs.forEach((blob, i) => {
      if (blob) zip.file(docs[i].filename, blob as Blob);
    });

    const content: Blob = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `Dossier_${candidatNom}.zip`);
    this.downloadingAllDocs = false;
    this.showSuccessMessage(`Dossier_${candidatNom}.zip téléchargé !`);
    this.cdr.detectChanges();
  }

  // ── Messages succès ───────────────────────────────────────
  showSuccessMessage(msg: string): void {
    this.successMessage = msg;
    this.cdr.detectChanges();
    setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
  }

  // ── Helpers UI ────────────────────────────────────────────
  getInitiales(s: Stage): string {
    if (!s.candidat) return '?';
    return ((s.candidat.nom?.[0] || '') + (s.candidat.prenom?.[0] || '')).toUpperCase() || '?';
  }

  getStatutLabel(s: string): string {
    const l: Record<string, string> = {
      EN_ATTENTE: 'En attente', ACCEPTE: 'Accepté', EN_COURS: 'En cours',
      TERMINE: 'Terminé', REJETE: 'Rejeté', ANNULE: 'Annulé',
    };
    return l[s] || s;
  }

  getTypeLabel(t: string): string {
    const l: Record<string, string> = {
      ACADEMIQUE: 'Académique', PROFESSIONNEL: 'Professionnel',
      PRE_EMPLOI: 'Pré-emploi', PERFECTIONNEMENT: 'Perfectionnement',
    };
    return l[t] || t;
  }

  getStatutBadgeClass(s: string): string {
    const c: Record<string, string> = {
      EN_ATTENTE: 'bg-amber-50 text-amber-700 border border-amber-200',
      ACCEPTE:    'bg-blue-50 text-blue-700 border border-blue-200',
      EN_COURS:   'bg-green-50 text-green-700 border border-green-200',
      TERMINE:    'bg-gray-100 text-gray-600 border border-gray-200',
      REJETE:     'bg-red-50 text-red-700 border border-red-200',
      ANNULE:     'bg-orange-50 text-orange-700 border border-orange-200',
    };
    return c[s] || 'bg-gray-100 text-gray-600 border border-gray-200';
  }

  getStatutBarClass(s: string): string {
    const c: Record<string, string> = {
      EN_ATTENTE: 'bg-amber-400', ACCEPTE: 'bg-blue-500',
      EN_COURS: 'bg-green-500', TERMINE: 'bg-gray-400',
      REJETE: 'bg-red-500', ANNULE: 'bg-orange-400',
    };
    return c[s] || 'bg-gray-300';
  }
}
