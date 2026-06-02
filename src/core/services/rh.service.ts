// src/core/services/rh.service.ts — Service centralisé pour les interfaces Ressources Humaines
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// =====================================================
// INTERFACES
// =====================================================
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

export interface Candidature {
  idcandidature: number;
  profil_idprofil: number;
  candidats_idcandidats: number;
  statusCandidature: 'SOUMISE' | 'EN_EXAMEN' | 'RETENUE' | 'REJETEE' | 'LISTE_ATTENTE';
  noteEvaluation: number | null;
  commentaireRecruteur: string | null;
  motifRefus: string | null;
  evaluePar: string | null;
  dateEvaluation: string | null;
  dateCandidature: string;
  candidat?: CandidatInfo;
  profil?: Profil;
}

export interface CandidatInfo {
  idcandidats: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
}

export interface Candidat {
  idcandidats: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  createdDate: string;
  lastmodifiedDate: string;
  user?: { idusers: number; username: string };
  stagesCount?: number;
  candidaturesCount?: number;
}

// Structure réelle de /dashboard/main-stats
export interface DashboardMainStats {
  candidats: { total: number; change: number; changeType: string };
  stages: { total: number; enCours: number; change: number; changeType: string };
  recrutements: { campagnesActives: number; totalCandidatures: number };
  offres: { actives: number; total: number };
}

// Structure réelle de /dashboard/secondary-stats
export interface DashboardSecondaryStats {
  aidesSociales: { active: number; demandes: number };
  utilisateurs: { total: number; admins: number };
  candidaturesEnAttente: number;
  tauxValidation: number;
}

// Structure d'une activité récente
export interface DashboardActivity {
  type: string;
  action: string;
  description: string;
  user: string;
  date: string;
  status: string | null;
}

// Structure d'un élément en attente
export interface DashboardPendingItem {
  id: number;
  type: string;
  title: string;
  subtitle: string;
  date: string;
  priority: 'high' | 'medium' | 'low';
}

// =====================================================
// PAGINATION & RÉPONSE API
// =====================================================
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface CandidatFilters {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface CampagneFilters {
  statusCampagne?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface EvaluateCandidatureData {
  statusCandidature: string;
  noteEvaluation?: number;
  commentaireRecruteur?: string;
  motifRefus?: string;
}

// =====================================================
// SERVICE
// =====================================================
@Injectable({
  providedIn: 'root'
})
export class RhService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // =====================================================
  // DASHBOARD — Routes accessibles à AGENT_RH
  // Endpoint : /api/dashboard/* (ADMIN + AGENT_RH + AGENT_FINANCIER + AGENT_COMMERCIAL)
  // NE PAS utiliser /api/admin/dashboard/* → réservé ADMIN uniquement (→ 403)
  // =====================================================

  /**
   * Stats principales : candidats, stages, recrutements, offres
   * GET /api/dashboard/main-stats
   */
  getDashboardMainStats(): Observable<ApiResponse<DashboardMainStats>> {
    return this.http.get<ApiResponse<DashboardMainStats>>(`${this.apiUrl}/dashboard/main-stats`);
  }

  /**
   * Stats secondaires : aides sociales, candidaturesEnAttente, tauxValidation
   * GET /api/dashboard/secondary-stats
   */
  getDashboardSecondaryStats(): Observable<ApiResponse<DashboardSecondaryStats>> {
    return this.http.get<ApiResponse<DashboardSecondaryStats>>(`${this.apiUrl}/dashboard/secondary-stats`);
  }

  /**
   * Activités récentes (candidats inscrits, stages, candidatures recrutement)
   * GET /api/dashboard/activities
   */
  getDashboardActivities(limit = 8): Observable<ApiResponse<DashboardActivity[]>> {
    return this.http.get<ApiResponse<DashboardActivity[]>>(
      `${this.apiUrl}/dashboard/activities?limit=${limit}`
    );
  }

  /**
   * Éléments en attente de traitement
   * GET /api/dashboard/pending
   */
  getDashboardPending(limit = 8): Observable<ApiResponse<DashboardPendingItem[]>> {
    return this.http.get<ApiResponse<DashboardPendingItem[]>>(
      `${this.apiUrl}/dashboard/pending?limit=${limit}`
    );
  }

  // =====================================================
  // RECRUTEMENTS — Campagnes
  // =====================================================

  getCampagnes(filters: CampagneFilters = {}): Observable<ApiResponse<PaginatedResponse<Campagne>>> {
    let params = new HttpParams();
    if (filters.statusCampagne) params = params.set('statusCampagne', filters.statusCampagne);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    return this.http.get<ApiResponse<PaginatedResponse<Campagne>>>(
      `${this.apiUrl}/recrutement/campagnes`, { params }
    );
  }

  getCampagneById(id: number): Observable<ApiResponse<Campagne>> {
    return this.http.get<ApiResponse<Campagne>>(`${this.apiUrl}/recrutement/campagnes/${id}`);
  }

  // =====================================================
  // RECRUTEMENTS — Profils (Offres d'emploi)
  // =====================================================

  getProfilsByCampagne(campagneId: number): Observable<ApiResponse<Profil[]>> {
    return this.http.get<ApiResponse<Profil[]>>(
      `${this.apiUrl}/recrutement/campagnes/${campagneId}/profils`
    );
  }

  getProfilById(id: number): Observable<ApiResponse<Profil>> {
    return this.http.get<ApiResponse<Profil>>(`${this.apiUrl}/recrutement/profils/${id}`);
  }

  // =====================================================
  // RECRUTEMENTS — Candidatures
  // =====================================================

  getCandidaturesByProfil(profilId: number): Observable<ApiResponse<Candidature[]>> {
    return this.http.get<ApiResponse<Candidature[]>>(
      `${this.apiUrl}/recrutement/profils/${profilId}/candidatures`
    );
  }

  getCandidaturesByCampagne(campagneId: number): Observable<ApiResponse<Candidature[]>> {
    return this.http.get<ApiResponse<Candidature[]>>(
      `${this.apiUrl}/recrutement/campagnes/${campagneId}/candidatures`
    );
  }

  getCandidatureById(id: number): Observable<ApiResponse<Candidature>> {
    return this.http.get<ApiResponse<Candidature>>(`${this.apiUrl}/recrutement/candidatures/${id}`);
  }

  evaluateCandidature(id: number, data: EvaluateCandidatureData): Observable<ApiResponse<Candidature>> {
    return this.http.put<ApiResponse<Candidature>>(
      `${this.apiUrl}/recrutement/candidatures/${id}/evaluer`, data
    );
  }

  downloadDocument(documentId: number): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/recrutement/documents/${documentId}/download`,
      { responseType: 'blob' }
    );
  }

  // =====================================================
  // CANDIDATS
  // =====================================================

  getCandidats(filters: CandidatFilters = {}): Observable<ApiResponse<PaginatedResponse<Candidat>>> {
    let params = new HttpParams();
    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    if (filters.search) params = params.set('search', filters.search);
    if (filters.sortBy) params = params.set('sortBy', filters.sortBy);
    if (filters.sortOrder) params = params.set('sortOrder', filters.sortOrder);
    return this.http.get<ApiResponse<PaginatedResponse<Candidat>>>(
      `${this.apiUrl}/admin/candidats`, { params }
    );
  }

  getCandidatById(id: number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/admin/candidats/${id}`);
  }

  getCandidatStats(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/admin/candidats/stats`);
  }
}
