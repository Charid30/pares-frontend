// src/core/services/admin-stage.service.ts - Service pour la gestion admin des stages
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// Interfaces pour les stages
export interface CandidatInfo {
  idcandidats: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
}

export interface RapportStage {
  idrapport: number;
  stage_idstage: number;
  titreRapport: string;
  natureRapport: string;
  rapportPdf_filename: string;
  rapportPdf_size: number;
  statusRapport: 'SOUMIS' | 'EN_EVALUATION' | 'VALIDE' | 'REFUSE';
  noteRapport: number | null;
  commentaireEvaluateur: string | null;
  motifRefus: string | null;
  evaluePar: string | null;
  dateEvaluation: string | null;
  createdDate: string;
  createdBy: string | null;
  stage?: Stage;
}

export interface EvaluateRapportData {
  statusRapport: 'EN_EVALUATION' | 'VALIDE' | 'REFUSE';
  motifRefus?: string;
}

export interface CreateAttestationData {
  stage_idstage: number;
  rapport_idrapport: number;
  typeDocument: 'ATTESTATION';
  dateEmission: string;
}

export interface Direction {
  iddirection: number;
  nom: string;
  accronyme: string;
}

export interface DemandeModificationStage {
  id: number;
  stage_idstage: number;
  candidat_id: number;
  type: 'SUSPENSION' | 'ANNULATION';
  motif: string;
  dateDebut: string | null;
  justification_filename: string | null;
  lettreManuscrite_filename: string | null;
  status: 'EN_ATTENTE' | 'APPROUVEE' | 'REJETEE';
  reponse_drh: string | null;
  createdDate: string;
  processedDate: string | null;
  processedBy: string | null;
  stage?: Stage;
  candidat?: CandidatInfo;
}

export interface Stage {
  idstage: number;
  typeStage: 'SOUTENANCE' | 'PERFECTIONNEMENT';
  niveau: 'CAP' | 'BEPC' | 'BEP' | 'BAC' | 'LICENCE' | 'MASTER' | 'DOCTORAT' | null;
  dernierDiplome_filename: string | null;
  domaineStage: string;
  dureeStage: number;
  dureeStageSouhaitee?: number | null;
  dateDebutSouhaitee: string;
  dateDebutEffective: string | null;
  dateDebutProposee: string | null;
  dateFinEffective: string | null;
  statusStage: 'EN_ATTENTE' | 'EN_COURS_DE_TRAITEMENT' | 'ACCEPTE' | 'REJETE' | 'EN_COURS' | 'TERMINE' | 'EXPIRE' | 'RAPPORT_SOUMIS' | 'PROGRAMMATION_EN_COURS' | 'SUSPENDU' | 'ANNULE';
  motifRefus: string | null;
  documentsRejetes?: string | null;
  estRenouvellement: number;
  createdDate: string;
  candidat: CandidatInfo;
  rapport?: RapportStage;
  direction_iddirection?: number | null;
  service_idservice?: number | null;
  direction?: { iddirection: number; nom: string; accronyme: string };
}

export interface RenouvellementInfo {
  idrenouvellement: number;
  stage_actuel_idstage: number;
  stage_nouveau_idstage: number;
  lettreMotivationRenouvellement_filename: string | null;
  lettreMotivationRenouvellement_size: number | null;
  conventionStageEnCours_filename: string | null;
  conventionStageEnCours_size: number | null;
  dureeDemandee: number;
  statusRenouvellement: 'EN_ATTENTE' | 'ACCEPTE' | 'REJETE';
  motifRefus: string | null;
  dateRenouvellement: string;
}

export interface StageDetails extends Stage {
  cv_filename: string | null;
  cnib_filename: string | null;
  casierJudiciaire_filename: string | null;
  lettreMotivation_filename: string | null;
  lettreRecommandation_filename: string | null;
  dernierDiplome_filename: string | null;
  stage_parent_idstage: number | null;
  rapport?: any;
  documents?: any[];
  stageParent?: Stage;
  /** Infos de renouvellement (peuplé uniquement si estRenouvellement = 1) */
  renouvellementInfo?: RenouvellementInfo | null;
  // Champs d'affectation (aussi présents dans Stage, redéclarés ici pour le strict template checker)
  direction_iddirection?: number | null;
  service_idservice?: number | null;
}

export interface StageStats {
  total: number;
  enAttente: number;
  enCoursDeTraitement: number;
  acceptes: number;
  enCours: number;
  termines: number;
  expires: number;
  rejetes: number;
  rapportsSoumis: number;
  programmationEnCours: number;
  suspendus: number;
  annules: number;
}

export interface StageFilters {
  page?: number;
  limit?: number;
  statusStage?: string;
  typeStage?: string;
  domaineStage?: string;
  search?: string;
}

export interface StageSuivi {
  idstage: number;
  candidat: CandidatInfo;
  typeStage: string;
  domaineStage: string;
  dureeStage: number;
  dateDebutEffective: string;
  dateFinEffective: string | null;
  estRenouvellement: number;
  stage_parent_idstage: number | null;
  // Infos chaîne cumulative
  dateDebutChaine: string | null;
  moisConsommes: number;
  moisRestantsAvantLimit: number;
  renouvellementPossible: boolean;
  joursRestants: number | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface UpdateStatusData {
  statusStage: string;
  dateDebutEffective?: string;
  dureeAccordee?: number;
  motifRefus?: string;
  documentsRejetes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminStageService {
  private apiUrl = `${environment.apiUrl}/stages`;

  constructor(private http: HttpClient) {}

  /**
   * Recuperer les statistiques des stages
   */
  getStats(): Observable<ApiResponse<StageStats>> {
    return this.http.get<ApiResponse<StageStats>>(`${this.apiUrl}/stats`);
  }

  /**
   * Recuperer la liste des stages avec pagination et filtres
   */
  getDomaines(): Observable<ApiResponse<string[]>> {
    return this.http.get<ApiResponse<string[]>>(`${this.apiUrl}/domaines`);
  }

  getStages(filters: StageFilters = {}): Observable<ApiResponse<PaginatedResponse<Stage>>> {
    let params = new HttpParams();

    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    if (filters.statusStage) params = params.set('statusStage', filters.statusStage);
    if (filters.typeStage) params = params.set('typeStage', filters.typeStage);
    if (filters.domaineStage) params = params.set('domaineStage', filters.domaineStage);
    if (filters.search) params = params.set('search', filters.search);

    return this.http.get<ApiResponse<PaginatedResponse<Stage>>>(this.apiUrl, { params });
  }

  /**
   * Recuperer un stage par son ID
   */
  getStageById(id: number): Observable<ApiResponse<StageDetails>> {
    return this.http.get<ApiResponse<StageDetails>>(`${this.apiUrl}/${id}`);
  }

  /**
   * Mettre a jour le statut d'un stage (accepter, refuser, etc.)
   * Si acceptation, conventionFile est requis
   */
  updateStatus(id: number, data: UpdateStatusData, conventionFile?: File): Observable<ApiResponse<Stage>> {
    // Si c'est une acceptation avec convention, utiliser FormData
    if (data.statusStage === 'ACCEPTE' && conventionFile) {
      const formData = new FormData();
      formData.append('statusStage', data.statusStage);
      if (data.dateDebutEffective) {
        formData.append('dateDebutEffective', data.dateDebutEffective);
      }
      if (data.dureeAccordee) {
        formData.append('dureeAccordee', String(data.dureeAccordee));
      }
      formData.append('conventionStage', conventionFile, conventionFile.name);
      return this.http.put<ApiResponse<Stage>>(`${this.apiUrl}/${id}/statut`, formData);
    }
    // Sinon, envoyer en JSON normal
    return this.http.put<ApiResponse<Stage>>(`${this.apiUrl}/${id}/statut`, data);
  }

  /**
   * Telecharger un document de stage
   */
  downloadDocument(stageId: number, documentType: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${stageId}/documents/${documentType}`, {
      responseType: 'blob'
    });
  }

  // =====================================================
  // RAPPORTS DE STAGE
  // =====================================================

  /**
   * Recuperer tous les rapports de stage
   */
  getRapports(filters: { statusRapport?: string } = {}): Observable<ApiResponse<RapportStage[]>> {
    let params = new HttpParams();
    if (filters.statusRapport) params = params.set('statusRapport', filters.statusRapport);
    return this.http.get<ApiResponse<RapportStage[]>>(`${this.apiUrl}/rapports`, { params });
  }

  /**
   * Recuperer un rapport par ID
   */
  getRapportById(id: number): Observable<ApiResponse<RapportStage>> {
    return this.http.get<ApiResponse<RapportStage>>(`${this.apiUrl}/rapports/${id}`);
  }

  /**
   * Telecharger le PDF d'un rapport
   */
  downloadRapport(rapportId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/rapports/${rapportId}/download`, {
      responseType: 'blob'
    });
  }

  /**
   * Evaluer un rapport de stage (valider, refuser, mettre en evaluation)
   */
  evaluateRapport(rapportId: number, data: EvaluateRapportData): Observable<ApiResponse<RapportStage>> {
    return this.http.put<ApiResponse<RapportStage>>(`${this.apiUrl}/rapports/${rapportId}/evaluer`, data);
  }

  // =====================================================
  // ATTESTATIONS
  // =====================================================

  /**
   * Creer une attestation de stage
   */
  createAttestation(data: CreateAttestationData, attestationFile: File): Observable<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('stage_idstage', data.stage_idstage.toString());
    formData.append('rapport_idrapport', data.rapport_idrapport.toString());
    formData.append('typeDocument', 'ATTESTATION');
    formData.append('dateEmission', data.dateEmission);
    formData.append('document', attestationFile, attestationFile.name);

    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/documents`, formData);
  }

  /**
   * Telecharger un document (convention ou attestation)
   */
  downloadDocumentStage(documentId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/documents/${documentId}/download`, {
      responseType: 'blob'
    });
  }

  // =====================================================
  // NOUVEAU WORKFLOW STAGES
  // =====================================================

  /**
   * Mettre à jour les champs administratifs d'un stage (direction, service, dates, commentaire…)
   */
  updateStage(id: number, data: {
    direction_iddirection?: number | null;
    service_idservice?: number | null;
    dateDebutEffective?: string | null;
    dateFinEffective?: string | null;
    dureeStage?: number;
    commentaireAdmin?: string | null;
  }): Observable<ApiResponse<Stage>> {
    return this.http.put<ApiResponse<Stage>>(`${this.apiUrl}/${id}`, data);
  }

  /**
   * Approuver un stage (EN_ATTENTE → PROGRAMMATION_EN_COURS).
   * dateDebutProposee, si fournie, doit être le 1er ou le 15 du mois.
   */
  approuverStage(id: number, dateDebutProposee?: string | null): Observable<ApiResponse<Stage>> {
    return this.http.put<ApiResponse<Stage>>(`${this.apiUrl}/${id}/approuver`, { dateDebutProposee: dateDebutProposee || null });
  }

  /**
   * Exiger le remplacement d'un ou plusieurs documents sans rejeter la demande.
   * La demande garde son statut courant.
   */
  exigerDocuments(id: number, types: string[]): Observable<ApiResponse<Stage>> {
    return this.http.put<ApiResponse<Stage>>(`${this.apiUrl}/${id}/exiger-document`, { types });
  }

  /**
   * Récupérer la convention de stage jointe (PDF)
   */
  downloadConvention(stageId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${stageId}/convention`, { responseType: 'blob' });
  }

  /**
   * Récupérer les demandes de modification (suspension/annulation)
   */
  getDemandesModification(filters: { status?: string } = {}): Observable<ApiResponse<DemandeModificationStage[]>> {
    let params = new HttpParams();
    if (filters.status) params = params.set('status', filters.status);
    return this.http.get<ApiResponse<DemandeModificationStage[]>>(`${this.apiUrl}/demandes-modification`, { params });
  }

  /**
   * Évaluer une demande de modification (approuver ou rejeter)
   */
  evaluerDemandeModification(id: number, data: { status: 'APPROUVEE' | 'REJETEE'; reponse_drh?: string }): Observable<ApiResponse<DemandeModificationStage>> {
    return this.http.put<ApiResponse<DemandeModificationStage>>(`${this.apiUrl}/demandes-modification/${id}/evaluer`, data);
  }

  /** Télécharger un fichier joint d'une demande de modification (justification | lettre) */
  downloadDemandeModificationFichier(id: number, champ: 'justification' | 'lettre'): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/demandes-modification/${id}/${champ}`, { responseType: 'blob' });
  }

  // =====================================================
  // RENOUVELLEMENTS - DOCUMENTS
  // =====================================================

  /**
   * Récupérer la liste des stages EN_COURS avec durée cumulée (onglet Suivi) - paginée
   */
  getStagesSuivi(filters: { search?: string; page?: number; limit?: number } = {}): Observable<ApiResponse<PaginatedResponse<StageSuivi>>> {
    let params = new HttpParams();
    if (filters.search) params = params.set('search', filters.search);
    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    return this.http.get<ApiResponse<PaginatedResponse<StageSuivi>>>(`${this.apiUrl}/suivi`, { params });
  }

  /**
   * Télécharger la lettre de demande de renouvellement soumise par le candidat
   */
  downloadLettreRenouvellement(renouvellementId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/renouvellements/${renouvellementId}/lettre`, {
      responseType: 'blob'
    });
  }

  /**
   * Télécharger la convention du stage en cours copiée lors du renouvellement
   */
  downloadConventionRenouvellement(renouvellementId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/renouvellements/${renouvellementId}/convention`, {
      responseType: 'blob'
    });
  }
}
