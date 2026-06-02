// src/core/services/admin-candidat.service.ts - Service Admin pour gestion des candidats
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Candidat {
  idcandidats: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  createdDate: string;
  lastmodifiedDate: string;
  user?: {
    idusers: number;
    username: string;
  };
  stagesCount?: number;
  candidaturesCount?: number;
}

export interface CandidatDetails extends Candidat {
  stages: any[];
  candidatures: any[];
  stats: {
    totalStages: number;
    stagesEnCours: number;
    stagesTermines: number;
    totalCandidatures: number;
    candidaturesRetenues: number;
  };
}

export interface CandidatStats {
  total: number;
  thisMonth: number;
  lastMonth: number;
  change: number;
  withStages: number;
  withCandidatures: number;
}

export interface CandidatFilters {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
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
  message?: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class AdminCandidatService {
  private apiUrl = `${environment.apiUrl}/admin/candidats`;

  constructor(private http: HttpClient) {}

  /**
   * Récupérer la liste des candidats avec filtres et pagination
   */
  getCandidats(filters: CandidatFilters = {}): Observable<ApiResponse<PaginatedResponse<Candidat>>> {
    let params = new HttpParams();

    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    if (filters.search) params = params.set('search', filters.search);
    if (filters.sortBy) params = params.set('sortBy', filters.sortBy);
    if (filters.sortOrder) params = params.set('sortOrder', filters.sortOrder);

    return this.http.get<ApiResponse<PaginatedResponse<Candidat>>>(this.apiUrl, { params });
  }

  /**
   * Récupérer les statistiques des candidats
   */
  getStats(): Observable<ApiResponse<CandidatStats>> {
    return this.http.get<ApiResponse<CandidatStats>>(`${this.apiUrl}/stats`);
  }

  /**
   * Récupérer un candidat par ID avec ses détails
   */
  getCandidatById(id: number): Observable<ApiResponse<CandidatDetails>> {
    return this.http.get<ApiResponse<CandidatDetails>>(`${this.apiUrl}/${id}`);
  }

  /**
   * Mettre à jour un candidat
   */
  updateCandidat(id: number, data: Partial<Candidat>): Observable<ApiResponse<Candidat>> {
    return this.http.put<ApiResponse<Candidat>>(`${this.apiUrl}/${id}`, data);
  }

  /**
   * Supprimer un candidat (soft delete)
   */
  deleteCandidat(id: number): Observable<ApiResponse<{ message: string }>> {
    return this.http.delete<ApiResponse<{ message: string }>>(`${this.apiUrl}/${id}`);
  }
}
