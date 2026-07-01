import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { saveAs } from 'file-saver';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';
import { StatCard } from '../../../../../shared/components/stat-card/stat-card';

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

interface AutorisationRenouvellement {
  id: number;
  expiresAt: string;
}

interface Stage {
  idstage: number;
  typeStage: string;
  statusStage: 'EN_ATTENTE' | 'PROGRAMMATION_EN_COURS' | 'ACCEPTE' | 'EN_COURS' | 'RAPPORT_SOUMIS' | 'TERMINE' | 'EXPIRE' | 'REJETE' | 'ANNULE' | 'SUSPENDU';
  autorisationsRenouvellement?: AutorisationRenouvellement[];
  // Calculé côté backend : false si ce stage n'est visible que via un rôle "lecture globale"
  // et n'appartient pas à la direction de l'agent connecté (actions alors masquées).
  peutAgir?: boolean;
  direction?: { iddirection: number; nom: string; accronyme: string };
  dateDebut?: string;
  dateFin?: string;
  dateDebutEffective?: string;
  dateFinEffective?: string;
  dateDebutSouhaitee?: string;
  dureeStage?: number;
  dureeStageSouhaitee?: number;
  domaineStage?: string;
  service?: string;
  commentaireAdmin?: string;
  createdDate: string;
  candidat?: Candidat;
  documents?: StageDocument[];
  rapport?: {
    idrapport: number;
    titreRapport: string;
    natureRapport: string;
    statusRapport: 'SOUMIS' | 'EN_EVALUATION' | 'VALIDE' | 'REFUSE';
    rapportPdf_filename: string;
  } | null;
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
  imports: [CommonModule, DatePipe, FormsModule, StatCard],
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

  // ── Filtres / Pagination ───────────────────────────────────
  search = '';
  filtreStatut = '';
  filtreType = '';
  page = 1;
  limit = 20;
  total = 0;
  totalPages = 1;

  // ── Modals ────────────────────────────────────────────────
  showDetailModal = false;
  detailStage: Stage | null = null;
  loadingDetailDocs = false;
  stageEnDecision: Stage | null = null;
  decisionType: 'ACCEPTE' | 'REJETE' | 'SUSPENDU' | 'ANNULE' | 'EN_COURS' = 'ACCEPTE';

  // ── Champs décision ───────────────────────────────────────
  dateDebut = '';
  dateFin = '';
  dureeAccordee: number | null = null;
  commentaire = '';
  conventionFile: File | null = null;
  soumission = false;
  errorDecision = '';

  // Documents non conformes sélectionnés lors d'un rejet
  documentsRejetesSelection: string[] = [];
  readonly DOCUMENTS_STAGE: { key: string; label: string }[] = [
    { key: 'cv', label: 'CV daté et signé' },
    { key: 'cnib', label: 'CNIB' },
    { key: 'casierJudiciaire', label: 'Casier judiciaire' },
    { key: 'lettreMotivation', label: 'Lettre de motivation signée' },
    { key: 'lettreRecommandation', label: 'Lettre de recommandation' },
    { key: 'dernierDiplome', label: 'Dernier diplôme légalisé' },
  ];

  /** La lettre de recommandation n'est exigée que pour les stages de soutenance, pas pour le perfectionnement. */
  get documentsDisponiblesRejet(): { key: string; label: string }[] {
    if (!this.stageEnDecision) return this.DOCUMENTS_STAGE;
    if (this.stageEnDecision.typeStage === 'PERFECTIONNEMENT') {
      return this.DOCUMENTS_STAGE.filter(d => d.key !== 'lettreRecommandation');
    }
    return this.DOCUMENTS_STAGE;
  }

  toggleDocumentRejete(key: string): void {
    const idx = this.documentsRejetesSelection.indexOf(key);
    if (idx > -1) this.documentsRejetesSelection.splice(idx, 1);
    else this.documentsRejetesSelection.push(key);
  }

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

  // ── Modal TRANSFERER (vers une autre direction) ────────────
  showTransfertModal = false;
  stageATransferer: Stage | null = null;
  directionsTransfert: { iddirection: number; nom: string; accronyme: string }[] = [];
  directionCibleId: number | null = null;
  soumissionTransfert = false;
  errorTransfert = '';

  get directionCibleLabel(): string | null {
    const d = this.directionsTransfert.find(d => d.iddirection === this.directionCibleId);
    return d ? `${d.nom} (${d.accronyme})` : null;
  }

  // Un stage rejeté/annulé, ou déjà commencé/terminé/suspendu, ne peut plus être transféré
  // vers une autre direction (le transfert n'a de sens qu'avant le début effectif du stage).
  peutTransfererStatut(s: Stage): boolean {
    return ['EN_ATTENTE', 'PROGRAMMATION_EN_COURS', 'ACCEPTE'].includes(s.statusStage);
  }

  // ── Modal CREER document ──────────────────────────────────
  showDocModal = false;
  docStageId: number | null = null;
  docRapportId: number | null = null;
  docType: 'CONVENTION' | 'ATTESTATION' = 'CONVENTION';
  docDateEmission = '';
  docFile: File | null = null;
  soumissionDoc = false;
  errorDoc = '';
  stageHasConvention = false;
  checkingConvention = false;
  downloadingAllDocs = false;
  // "Voir tout" — visionneuse plein écran de tous les documents
  showViewAllModal = false;
  viewingAllDocs = false;
  viewAllDocUrls: { label: string; url: string; safeUrl: SafeResourceUrl }[] = [];
  // "Imprimer tout"
  printingAllDocs = false;
  private agentNomComplet = '';

  // ── Autorisation de renouvellement ────────────────────────
  soumissionAutorisation = false;
  errorAutorisation = '';

  get peutAutoriserRenouvellement(): boolean {
    return this.authService.hasRole('ADMIN');
  }

  getAutorisationActive(s: Stage): AutorisationRenouvellement | null {
    const a = s.autorisationsRenouvellement;
    if (!a || a.length === 0) return null;
    const now = new Date();
    const valid = a.find(x => new Date(x.expiresAt) > now);
    return valid || null;
  }

  autoriserRenouvellement(s: Stage): void {
    if (this.soumissionAutorisation) return;
    this.soumissionAutorisation = true;
    this.errorAutorisation = '';
    this.http.put<any>(`${this.apiUrl}/stages/${s.idstage}/autoriser-renouvellement`, {}).subscribe({
      next: (res) => {
        this.soumissionAutorisation = false;
        // Mettre à jour le stage dans le détail et dans la liste
        const autorisation: AutorisationRenouvellement = {
          id: res.data?.id,
          expiresAt: res.data?.expiresAt,
        };
        if (this.detailStage && this.detailStage.idstage === s.idstage) {
          this.detailStage = { ...this.detailStage, autorisationsRenouvellement: [autorisation] };
        }
        this.showSuccessMessage('Autorisation accordée — valide 7 jours. Le candidat a été notifié.');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorAutorisation = err.error?.message || 'Erreur lors de l\'autorisation';
        this.soumissionAutorisation = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Modal ÉVALUER rapport de stage ─────────────────────────
  showEvalRapportModal = false;
  rapportEnEvaluation: Stage | null = null;
  evalRapportDecision: 'VALIDE' | 'REFUSE' = 'VALIDE';
  motifRefusRapport = '';
  soumissionEvalRapport = false;
  errorEvalRapport = '';

  private apiUrl = environment.apiUrl;

  // ── Permissions ───────────────────────────────────────────
  get peutConsulter(): boolean  { return this.authService.hasPermission('STAGE', 'CONSULTER'); }
  get peutApprouver(): boolean  { return this.authService.hasPermission('STAGE', 'APPROUVER'); }
  get peutValider(): boolean    { return this.authService.hasPermission('STAGE', 'VALIDER') || this.authService.hasRole('ADMIN'); }
  get peutRejeter(): boolean    { return this.authService.hasPermission('STAGE', 'REJETER') || this.authService.hasRole('ADMIN'); }
  get peutCreer(): boolean      { return this.authService.hasPermission('STAGE', 'CREER'); }
  get peutModifier(): boolean   { return this.authService.hasPermission('STAGE', 'MODIFIER'); }
  get peutSupprimer(): boolean  { return this.authService.hasPermission('STAGE', 'SUPPRIMER'); }
  get peutTransferer(): boolean { return this.authService.hasPermission('STAGE', 'TRANSFERER'); }

  // ── Mode d'affichage (déterminé par la route) ──────────────
  // 'direction' (par défaut) : menu d'action "Stage [ACCRONYME]", filtré/actionnable
  //   uniquement sur la direction de l'agent, même s'il a par ailleurs un rôle
  //   "lecture globale" — évite tout mélange avec les demandes hors direction.
  // 'global' : menu "Stage" générique en lecture seule (vue sous-admin), aucune action.
  scope: 'direction' | 'global' = 'direction';
  readOnly = false;

  // Filtre de statut imposé par la route (écrans dédiés "Vue globale" : En attente / Approuvé /
  // En cours). Peut contenir plusieurs statuts séparés par une virgule (ex. 'ACCEPTE,EN_COURS').
  statusFilter: string | null = null;

  // Restreint les boutons d'action visibles à une liste de transitions précises, quelles que
  // soient les permissions de l'utilisateur (ex. écran "Stage Approuvé" : seul "Accepter"
  // (ACCEPTE) est autorisé, même si le rôle a aussi REJETER). null = pas de restriction
  // (écrans normaux). Clés possibles : 'APPROUVER', 'ACCEPTE', 'SUSPENDU', 'REPRENDRE',
  // 'ANNULE', 'REJETE', 'DOC', 'MODIFIER', 'SUPPRIMER'.
  allowedTransitions: string[] | null = null;

  // Un agent peut ne voir certains stages que via un rôle "lecture globale" (sous-admin) :
  // dans ce cas peutAgir=false côté backend et les boutons d'action doivent être masqués,
  // même si l'agent a par ailleurs la permission STAGE:APPROUVER/VALIDER/REJETER via un autre rôle.
  peutAgirSur(s: Stage): boolean {
    return !this.readOnly && s.peutAgir !== false;
  }

  // Un écran dédié "Vue globale" peut restreindre l'action disponible à une transition précise
  // (ex. seul "Accepter" sur l'écran "Stage Approuvé"), indépendamment des permissions du rôle.
  actionAutorisee(transition: string): boolean {
    return !this.allowedTransitions || this.allowedTransitions.includes(transition);
  }

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {
    this.scope = this.route.snapshot.data['scope'] === 'global' ? 'global' : 'direction';
    this.readOnly = !!this.route.snapshot.data['readOnly'];
    this.statusFilter = this.route.snapshot.data['statusFilter'] || null;
    this.allowedTransitions = this.route.snapshot.data['allowedTransitions'] || null;
  }

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

    // Le statut de l'écran (route "Vue globale") reste prioritaire ; le filtre du
    // sélecteur ne s'applique que s'il correspond à un sous-ensemble cohérent —
    // sinon on respecte simplement le statut choisi par l'agent.
    const statusStage = this.filtreStatut || this.statusFilter || '';

    const params = new URLSearchParams({
      page: String(this.page),
      limit: String(this.limit),
      scope: this.scope,
      ...(statusStage ? { statusStage } : {}),
      ...(this.filtreType ? { typeStage: this.filtreType } : {}),
      ...(this.search ? { search: this.search } : {}),
    });

    this.http.get<any>(`${this.apiUrl}/stages?${params}`).subscribe({
      next: (res) => {
        this.stages = res.data?.items || [];
        this.stagesFiltres = this.stages;
        this.total = res.data?.total || 0;
        this.totalPages = res.data?.totalPages || 1;
        if (res.data?.stats) this.stats = res.data.stats;
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

  /** Recherche / filtres modifiés : on revient à la page 1 et on recharge depuis le serveur. */
  onFiltreChange(): void {
    this.page = 1;
    this.charger();
  }

  changerPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.page = p;
    this.charger();
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.page - 2);
    const end = Math.min(this.totalPages, this.page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  // ── Approbation ───────────────────────────────────────────
  approuverStage(s: Stage): void {
    if (this.soumission) return;
    this.soumission = true;
    this.http.put<any>(`${this.apiUrl}/stages/${s.idstage}/approuver`, {}).subscribe({
      next: () => {
        this.soumission = false;
        this.charger();
        this.showSuccessMessage('Demande approuvée — statut : Programmation en cours');
      },
      error: (err) => {
        this.erreur = err.error?.message || 'Erreur lors de l\'approbation';
        this.soumission = false;
        this.cdr.detectChanges();
      }
    });
  }

  setFiltreStatut(val: string): void {
    this.filtreStatut = this.filtreStatut === val ? '' : val;
    this.onFiltreChange();
  }

  effacerFiltres(): void {
    this.search = '';
    this.filtreStatut = '';
    this.filtreType = '';
    this.onFiltreChange();
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
  ouvrirDecision(s: Stage, type: 'ACCEPTE' | 'REJETE' | 'SUSPENDU' | 'ANNULE' | 'EN_COURS'): void {
    this.stageEnDecision = s;
    this.decisionType = type;
    // Pré-remplir la date de début avec la date souhaitée par le candidat
    this.dateDebut = s.dateDebutSouhaitee ? s.dateDebutSouhaitee.substring(0, 10) : '';
    this.dateFin = '';
    this.dureeAccordee = s.dureeStageSouhaitee || s.dureeStage || null;
    this.commentaire = '';
    this.conventionFile = null;
    this.documentsRejetesSelection = [];
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

    // Validations spécifiques selon le type
    if (this.decisionType === 'ACCEPTE') {
      if (!this.dateDebut) {
        this.errorDecision = 'La date de début effective est obligatoire.';
        this.cdr.detectChanges();
        return;
      }
      if (!this.dureeAccordee || this.dureeAccordee < 1) {
        this.errorDecision = 'La durée accordée est obligatoire.';
        this.cdr.detectChanges();
        return;
      }
      if (!this.conventionFile) {
        this.errorDecision = 'La convention de stage (PDF) est obligatoire pour accepter.';
        this.cdr.detectChanges();
        return;
      }
    }
    if (this.decisionType === 'REJETE' && !this.commentaire.trim()) {
      this.errorDecision = 'Le motif de refus est obligatoire.';
      this.cdr.detectChanges();
      return;
    }
    if (this.decisionType === 'REJETE' && this.documentsRejetesSelection.length === 0) {
      this.errorDecision = 'Veuillez sélectionner au moins un document non conforme.';
      this.cdr.detectChanges();
      return;
    }
    if ((this.decisionType === 'SUSPENDU' || this.decisionType === 'ANNULE') && !this.commentaire.trim()) {
      this.errorDecision = 'Le motif est obligatoire.';
      this.cdr.detectChanges();
      return;
    }

    this.soumission = true;
    this.errorDecision = '';

    const formData = new FormData();
    formData.append('statusStage', this.decisionType);

    if (this.decisionType === 'ACCEPTE') {
      formData.append('dateDebutEffective', this.dateDebut);
      formData.append('dureeAccordee', String(this.dureeAccordee));
      if (this.conventionFile) formData.append('conventionStage', this.conventionFile);
      if (this.commentaire) formData.append('motifRefus', '');
    } else if (this.decisionType === 'REJETE') {
      formData.append('motifRefus', this.commentaire);
      formData.append('documentsRejetes', this.documentsRejetesSelection.join(','));
    } else {
      // SUSPENDU, ANNULE, EN_COURS (reprise)
      if (this.commentaire) formData.append('motifRefus', this.commentaire);
    }

    const labels: Record<string, string> = {
      ACCEPTE:  'accepté',
      REJETE:   'rejeté',
      SUSPENDU: 'suspendu',
      ANNULE:   'annulé',
      EN_COURS: 'remis en cours',
    };

    this.http.put<any>(`${this.apiUrl}/stages/${this.stageEnDecision.idstage}/statut`, formData).subscribe({
      next: () => {
        this.stageEnDecision = null;
        this.soumission = false;
        this.charger();
        this.showSuccessMessage(`Stage ${labels[this.decisionType] ?? 'mis à jour'} avec succès !`);
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

  // ── TRANSFERER vers une autre direction ────────────────────
  ouvrirTransfertModal(s: Stage): void {
    this.stageATransferer = s;
    this.directionCibleId = null;
    this.errorTransfert = '';
    this.showTransfertModal = true;
    this.cdr.detectChanges();

    if (this.directionsTransfert.length === 0) {
      this.http.get<any>(`${this.apiUrl}/users/directions`).subscribe({
        next: (res) => {
          this.directionsTransfert = (res.data || []).filter(
            (d: any) => d.iddirection !== s.direction?.iddirection
          );
          this.cdr.detectChanges();
        },
        error: () => { /* non bloquant */ }
      });
    }
  }

  fermerTransfertModal(): void {
    this.showTransfertModal = false;
    this.stageATransferer = null;
    this.directionCibleId = null;
    this.soumissionTransfert = false;
    this.errorTransfert = '';
    this.cdr.detectChanges();
  }

  confirmerTransfert(): void {
    if (!this.stageATransferer || !this.directionCibleId || this.soumissionTransfert) return;
    this.soumissionTransfert = true;
    this.errorTransfert = '';

    this.http.put<any>(`${this.apiUrl}/stages/${this.stageATransferer.idstage}/transferer`, {
      direction_iddirection: this.directionCibleId,
    }).subscribe({
      next: () => {
        this.fermerTransfertModal();
        this.charger();
        this.showSuccessMessage('Stage transféré avec succès !');
      },
      error: (err) => {
        this.errorTransfert = err.error?.message || 'Erreur lors du transfert';
        this.soumissionTransfert = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── CREER document ────────────────────────────────────────
  ouvrirDocModal(s: Stage): void {
    this.docStageId = s.idstage;
    this.docRapportId = s.rapport?.idrapport ?? null;
    this.docType = s.statusStage === 'TERMINE' ? 'ATTESTATION' : 'CONVENTION';
    this.docDateEmission = new Date().toISOString().substring(0, 10);
    this.docFile = null;
    this.errorDoc = '';
    this.stageHasConvention = false;
    this.checkingConvention = true;
    this.showDocModal = true;
    this.cdr.detectChanges();

    // Vérifier si une convention est déjà jointe (et récupérer l'idrapport si absent)
    this.http.get<any>(`${this.apiUrl}/stages/${s.idstage}`).subscribe({
      next: (res) => {
        const docs: StageDocument[] = res.data?.documents || [];
        this.stageHasConvention = docs.some(d => d.typeDocument === 'CONVENTION');
        if (this.stageHasConvention && this.docType === 'CONVENTION') {
          this.docType = 'ATTESTATION';
        }
        if (!this.docRapportId && res.data?.rapport) {
          this.docRapportId = res.data.rapport.idrapport;
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
    this.docRapportId = null;
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
    if (this.docType === 'ATTESTATION' && !this.docRapportId) {
      this.errorDoc = "Aucun rapport validé n'est associé à ce stage";
      this.cdr.detectChanges();
      return;
    }

    this.soumissionDoc = true;
    this.errorDoc = '';

    const formData = new FormData();
    formData.append('stage_idstage', String(this.docStageId));
    formData.append('typeDocument', this.docType);
    formData.append('dateEmission', this.docDateEmission);
    formData.append('document', this.docFile);
    if (this.docType === 'ATTESTATION' && this.docRapportId) {
      formData.append('rapport_idrapport', String(this.docRapportId));
    }
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
      { type: 'lettreMotivation',    label: 'Lettre de motivation signée', filenameKey: 'lettreMotivation_filename' },
      { type: 'cv',                  label: 'CV daté et signé',        filenameKey: 'cv_filename'                  },
      { type: 'cnib',                label: 'Pièce d\'identité (CNIB)', filenameKey: 'cnib_filename'              },
      { type: 'casierJudiciaire',    label: 'Casier judiciaire',       filenameKey: 'casierJudiciaire_filename'    },
      { type: 'lettreRecommandation',label: 'Lettre de recommandation',filenameKey: 'lettreRecommandation_filename'},
      { type: 'dernierDiplome',      label: 'Dernier diplôme légalisé',filenameKey: 'dernierDiplome_filename'      },
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

  /** Une attestation a-t-elle déjà été jointe à ce stage ? */
  aDejaAttestation(s: Stage): boolean {
    return !!s.documents?.some(d => d.typeDocument === 'ATTESTATION');
  }

  /** Voir ou télécharger le rapport de stage soumis par le candidat */
  accederRapportBlob(s: Stage, mode: 'voir' | 'telecharger'): void {
    if (!s.rapport) return;
    this.http.get(`${this.apiUrl}/stages/rapports/${s.rapport.idrapport}/download`, { responseType: 'blob' }).subscribe({
      next: (blob) => this.ouvrirOuTelechargerBlob(blob, s.rapport!.rapportPdf_filename, mode),
      error: () => this.showSuccessMessage('Impossible de charger le rapport')
    });
  }

  /** Le rapport est-il en attente d'évaluation (pas encore validé/refusé) ? */
  rapportEnAttenteEvaluation(s: Stage): boolean {
    return !!s.rapport && (s.rapport.statusRapport === 'SOUMIS' || s.rapport.statusRapport === 'EN_EVALUATION');
  }

  // ── ÉVALUER rapport ─────────────────────────────────────────
  ouvrirEvalRapportModal(s: Stage, decision: 'VALIDE' | 'REFUSE'): void {
    this.rapportEnEvaluation = s;
    this.evalRapportDecision = decision;
    this.motifRefusRapport = '';
    this.errorEvalRapport = '';
    this.showEvalRapportModal = true;
    this.cdr.detectChanges();
  }

  fermerEvalRapportModal(): void {
    this.showEvalRapportModal = false;
    this.rapportEnEvaluation = null;
    this.soumissionEvalRapport = false;
    this.cdr.detectChanges();
  }

  confirmerEvalRapport(): void {
    if (!this.rapportEnEvaluation?.rapport || this.soumissionEvalRapport) return;
    if (this.evalRapportDecision === 'REFUSE' && !this.motifRefusRapport.trim()) {
      this.errorEvalRapport = 'Le motif de refus est requis';
      this.cdr.detectChanges();
      return;
    }

    this.soumissionEvalRapport = true;
    this.errorEvalRapport = '';

    const body: { statusRapport: string; motifRefus?: string } = { statusRapport: this.evalRapportDecision };
    if (this.evalRapportDecision === 'REFUSE') {
      body.motifRefus = this.motifRefusRapport.trim();
    }

    this.http.put<any>(`${this.apiUrl}/stages/rapports/${this.rapportEnEvaluation.rapport.idrapport}/evaluer`, body).subscribe({
      next: () => {
        const msg = this.evalRapportDecision === 'VALIDE'
          ? 'Rapport validé — le stage est maintenant Terminé, vous pouvez joindre l\'attestation.'
          : 'Rapport refusé.';
        this.showSuccessMessage(msg);
        this.fermerEvalRapportModal();
        this.charger();
      },
      error: (err) => {
        this.errorEvalRapport = err.error?.message || 'Erreur lors de l\'évaluation du rapport';
        this.soumissionEvalRapport = false;
        this.cdr.detectChanges();
      }
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

  /** Visionneuse plein écran — tous les documents affichés en une seule vue */
  async voirTousDocs(): Promise<void> {
    if (!this.detailStage || this.viewingAllDocs) return;
    const docs = this.getCandidatDocs();
    if (docs.length === 0) return;

    this.viewingAllDocs = true;
    this.viewAllDocUrls.forEach(d => window.URL.revokeObjectURL(d.url));
    this.viewAllDocUrls = [];
    this.cdr.detectChanges();

    const stageId = this.detailStage.idstage;
    const blobs = await Promise.all(
      docs.map(d =>
        firstValueFrom(
          this.http.get(`${this.apiUrl}/stages/${stageId}/documents/${d.type}`, { responseType: 'blob' })
        ).catch(() => null)
      )
    );

    blobs.forEach((blob, i) => {
      if (!blob) return;
      const url = window.URL.createObjectURL(new Blob([blob as Blob], { type: 'application/pdf' }));
      this.viewAllDocUrls.push({
        label: docs[i].label,
        url,
        safeUrl: this.sanitizer.bypassSecurityTrustResourceUrl(url),
      });
    });

    this.viewingAllDocs = false;
    this.showViewAllModal = true;
    this.cdr.detectChanges();
  }

  fermerViewAllModal(): void {
    this.viewAllDocUrls.forEach(d => window.URL.revokeObjectURL(d.url));
    this.viewAllDocUrls = [];
    this.showViewAllModal = false;
    this.cdr.detectChanges();
  }

  /** Ouvre une fenêtre d'impression avec tous les PDFs — recto simple */
  async imprimerTousDocs(): Promise<void> {
    if (!this.detailStage || this.printingAllDocs) return;
    const docs = this.getCandidatDocs();
    if (docs.length === 0) return;

    this.printingAllDocs = true;
    this.cdr.detectChanges();

    const stageId = this.detailStage.idstage;
    const candidatNom = `${this.detailStage.candidat?.prenom || ''} ${this.detailStage.candidat?.nom || ''}`.trim();

    const blobs = await Promise.all(
      docs.map(d =>
        firstValueFrom(
          this.http.get(`${this.apiUrl}/stages/${stageId}/documents/${d.type}`, { responseType: 'blob' })
        ).catch(() => null)
      )
    );

    const items: { label: string; url: string }[] = [];
    blobs.forEach((blob, i) => {
      if (!blob) return;
      items.push({
        label: docs[i].label,
        url: window.URL.createObjectURL(new Blob([blob as Blob], { type: 'application/pdf' })),
      });
    });

    if (items.length === 0) {
      this.printingAllDocs = false;
      this.cdr.detectChanges();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=960,height=700');
    if (!printWindow) {
      this.showSuccessMessage('Autorisez les popups pour lancer l\'impression');
      items.forEach(it => window.URL.revokeObjectURL(it.url));
      this.printingAllDocs = false;
      this.cdr.detectChanges();
      return;
    }

    const embedsHtml = items.map((it, idx) => `
      <div class="doc-page">
        <div class="doc-label">${idx + 1} / ${items.length} — ${it.label}</div>
        <embed src="${it.url}" type="application/pdf" width="100%" height="100%" />
      </div>`
    ).join('');

    printWindow.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Impression dossier — ${candidatNom}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;background:#f3f4f6}
    .notice{display:flex;align-items:flex-start;gap:10px;background:#fffbeb;border:1px solid #f59e0b;
            border-radius:8px;padding:12px 16px;margin:16px;font-size:13px;color:#92400e;line-height:1.5}
    .notice strong{color:#78350f}
    .doc-page{background:white;margin:16px;border-radius:8px;
              box-shadow:0 1px 6px rgba(0,0,0,.12);overflow:hidden;height:calc(100vh - 48px)}
    .doc-label{padding:9px 16px;background:#1e293b;color:white;font-size:12px;font-weight:600;
               letter-spacing:.3px;flex-shrink:0}
    embed{display:block;height:calc(100% - 36px);width:100%}
    @media print{
      @page{size:A4 portrait;margin:8mm}
      body{background:white}
      .notice{display:none}
      .doc-page{margin:0;box-shadow:none;border-radius:0;height:100vh;
                page-break-after:always;break-after:page}
      .doc-label{display:none}
      embed{height:100vh}
    }
  </style>
</head>
<body>
  <div class="notice">
    <svg width="18" height="18" fill="none" stroke="#d97706" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink:0;margin-top:1px">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    </svg>
    <span>
      <strong>Important :</strong> Dans la boîte de dialogue d'impression, sélectionnez
      <strong>Recto simple</strong> (désactivez le recto-verso / duplex).
      Les documents se chargeront dans quelques secondes avant que l'impression ne démarre.
    </span>
  </div>
  ${embedsHtml}
  <script>
    var loaded = 0;
    var total = document.querySelectorAll('embed').length;
    function tryPrint(){
      loaded++;
      if(loaded>=total){ setTimeout(function(){ window.print(); }, 800); }
    }
    document.querySelectorAll('embed').forEach(function(e){
      e.addEventListener('load', tryPrint);
      e.addEventListener('error', tryPrint);
    });
    // fallback si les events ne se déclenchent pas
    setTimeout(function(){ window.print(); }, 4000);
  </script>
</body>
</html>`);
    printWindow.document.close();

    this.printingAllDocs = false;
    this.cdr.detectChanges();

    // Libérer les URLs après 60 s (le dialogue d'impression a largement eu le temps de s'ouvrir)
    setTimeout(() => items.forEach(it => window.URL.revokeObjectURL(it.url)), 60000);
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
      EN_ATTENTE:             'En attente',
      PROGRAMMATION_EN_COURS: 'Programmation en cours',
      ACCEPTE:                'Accepté',
      EN_COURS:               'En cours',
      RAPPORT_SOUMIS:         'Rapport soumis',
      TERMINE:                'Terminé',
      REJETE:                 'Rejeté',
      ANNULE:                 'Annulé',
      SUSPENDU:               'Suspendu',
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
      EN_ATTENTE:             'bg-amber-50 text-amber-700 border border-amber-200',
      PROGRAMMATION_EN_COURS: 'bg-blue-50 text-blue-700 border border-blue-200',
      ACCEPTE:                'bg-emerald-50 text-emerald-700 border border-emerald-200',
      EN_COURS:               'bg-green-50 text-green-700 border border-green-200',
      RAPPORT_SOUMIS:         'bg-purple-50 text-purple-700 border border-purple-200',
      TERMINE:                'bg-gray-100 text-gray-600 border border-gray-200',
      REJETE:                 'bg-red-50 text-red-700 border border-red-200',
      ANNULE:                 'bg-orange-50 text-orange-700 border border-orange-200',
      SUSPENDU:               'bg-purple-50 text-purple-700 border border-purple-200',
    };
    return c[s] || 'bg-gray-100 text-gray-600 border border-gray-200';
  }

  getStatutBarClass(s: string): string {
    const c: Record<string, string> = {
      EN_ATTENTE:             'bg-amber-400',
      PROGRAMMATION_EN_COURS: 'bg-blue-500',
      ACCEPTE:                'bg-emerald-500',
      EN_COURS:               'bg-green-500',
      TERMINE:                'bg-gray-400',
      REJETE:                 'bg-red-500',
      ANNULE:                 'bg-orange-400',
      SUSPENDU:               'bg-purple-400',
    };
    return c[s] || 'bg-gray-300';
  }
}
