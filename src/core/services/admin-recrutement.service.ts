// src/core/services/admin-recrutement.service.ts - Service pour la gestion admin des recrutements
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// Interfaces pour les campagnes
export interface Campagne {
  idcampagne: number;
  titreCampagne: string;
  description: string | null;
  dateDebut: string;
  dateFin: string;
  statusCampagne: 'BROUILLON' | 'ACTIVE' | 'CLOTUREE' | 'ANNULEE';
  createdBy: string | null;
  createdDate: string;
  profils?: Profil[];
}

export interface Profil {
  idprofil: number;
  campagne_idcampagne: number;
  titreProfil: string;
  description: string | null;
  competencesRequises: string | null;
  conditionsRequises: string | null;
  nombrePostes: number;
  nombreCandidaturesMax: number;
  nombreCandidaturesActuelles: number;
  documentsRequis: string[] | null;
  statusProfil: 'ACTIF' | 'POURVUE' | 'ANNULE';
  createdDate: string;
  candidatures?: Candidature[];
  campagne?: Campagne;
}

export interface CandidatInfo {
  idcandidats: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
}

export interface Candidature {
  idcandidature: number;
  profil_idprofil: number;
  candidats_idcandidats: number;
  statusCandidature: 'SOUMISE' | 'EN_VERIFICATION' | 'ACCEPTEE' | 'REJETEE';
  motifRefus: string | null;
  evaluePar: string | null;
  dateEvaluation: string | null;
  dateCandidature: string;
  candidat?: CandidatInfo;
  profil?: Profil;
  documents?: DocumentCandidature[];
}

export interface DocumentCandidature {
  iddocument: number;
  candidature_idcandidature: number;
  typeDocument: string;
  document_filename: string;
  document_size: number;
  ordre: number;
  description: string | null;
  dateUpload: string;
}

export interface CampagneFilters {
  statusCampagne?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface CreateCampagneData {
  titreCampagne: string;
  description?: string;
  dateDebut: string;
  dateFin: string;
  statusCampagne?: string;
}

export interface UpdateCampagneData {
  titreCampagne?: string;
  description?: string;
  dateDebut?: string;
  dateFin?: string;
  statusCampagne?: string;
}

export interface CreateProfilData {
  campagne_idcampagne: number;
  titreProfil: string;
  description?: string;
  competencesRequises?: string;
  conditionsRequises?: string;
  nombrePostes?: number;
  nombreCandidaturesMax?: number;
  documentsRequis?: string[];
}

export interface UpdateProfilData {
  titreProfil?: string;
  description?: string;
  competencesRequises?: string;
  conditionsRequises?: string;
  nombrePostes?: number;
  nombreCandidaturesMax?: number;
  documentsRequis?: string[];
  statusProfil?: string;
}

export interface EvaluateCandidatureData {
  statusCandidature: string;
  motifRefus?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class AdminRecrutementService {
  private apiUrl = `${environment.apiUrl}/recrutement`;

  constructor(private http: HttpClient) {}

  // =====================================================
  // CAMPAGNES
  // =====================================================

  /**
   * Creer une campagne de recrutement
   */
  createCampagne(data: CreateCampagneData): Observable<ApiResponse<Campagne>> {
    return this.http.post<ApiResponse<Campagne>>(`${this.apiUrl}/campagnes`, data);
  }

  /**
   * Recuperer toutes les campagnes
   */
  getAllCampagnes(filters: CampagneFilters = {}): Observable<ApiResponse<PaginatedResponse<Campagne>>> {
    let params = new HttpParams();
    if (filters.statusCampagne) params = params.set('statusCampagne', filters.statusCampagne);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    return this.http.get<ApiResponse<PaginatedResponse<Campagne>>>(`${this.apiUrl}/campagnes`, { params });
  }

  /**
   * Recuperer une campagne par ID
   */
  getCampagneById(id: number): Observable<ApiResponse<Campagne>> {
    return this.http.get<ApiResponse<Campagne>>(`${this.apiUrl}/campagnes/${id}`);
  }

  /**
   * Mettre a jour une campagne
   */
  updateCampagne(id: number, data: UpdateCampagneData): Observable<ApiResponse<Campagne>> {
    return this.http.put<ApiResponse<Campagne>>(`${this.apiUrl}/campagnes/${id}`, data);
  }

  /**
   * Supprimer une campagne
   */
  deleteCampagne(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/campagnes/${id}`);
  }

  // =====================================================
  // PROFILS
  // =====================================================

  /**
   * Creer un profil de recrutement
   */
  createProfil(data: CreateProfilData): Observable<ApiResponse<Profil>> {
    return this.http.post<ApiResponse<Profil>>(`${this.apiUrl}/profils`, data);
  }

  /**
   * Recuperer les profils d'une campagne
   */
  getProfilsByCampagne(campagneId: number): Observable<ApiResponse<Profil[]>> {
    return this.http.get<ApiResponse<Profil[]>>(`${this.apiUrl}/campagnes/${campagneId}/profils`);
  }

  /**
   * Recuperer un profil par ID
   */
  getProfilById(id: number): Observable<ApiResponse<Profil>> {
    return this.http.get<ApiResponse<Profil>>(`${this.apiUrl}/profils/${id}`);
  }

  /**
   * Mettre a jour un profil
   */
  updateProfil(id: number, data: UpdateProfilData): Observable<ApiResponse<Profil>> {
    return this.http.put<ApiResponse<Profil>>(`${this.apiUrl}/profils/${id}`, data);
  }

  /**
   * Supprimer un profil
   */
  deleteProfil(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/profils/${id}`);
  }

  // =====================================================
  // CANDIDATURES
  // =====================================================

  /**
   * Recuperer les candidatures d'un profil
   */
  getCandidaturesByProfil(profilId: number): Observable<ApiResponse<Candidature[]>> {
    return this.http.get<ApiResponse<Candidature[]>>(`${this.apiUrl}/profils/${profilId}/candidatures`);
  }

  /**
   * Recuperer toutes les candidatures d'une campagne
   */
  getCandidaturesByCampagne(campagneId: number): Observable<ApiResponse<Candidature[]>> {
    return this.http.get<ApiResponse<Candidature[]>>(`${this.apiUrl}/campagnes/${campagneId}/candidatures`);
  }

  /**
   * Recuperer une candidature par ID
   */
  getCandidatureById(id: number): Observable<ApiResponse<Candidature>> {
    return this.http.get<ApiResponse<Candidature>>(`${this.apiUrl}/candidatures/${id}`);
  }

  /**
   * Evaluer une candidature
   */
  evaluateCandidature(id: number, data: EvaluateCandidatureData): Observable<ApiResponse<Candidature>> {
    return this.http.put<ApiResponse<Candidature>>(`${this.apiUrl}/candidatures/${id}/evaluer`, data);
  }

  // =====================================================
  // DOCUMENTS
  // =====================================================

  /**
   * Telecharger un document de candidature
   */
  downloadDocument(documentId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/documents/${documentId}/download`, {
      responseType: 'blob'
    });
  }
}
