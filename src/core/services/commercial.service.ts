// src/core/services/commercial.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// =====================================================
// INTERFACES - OFFRES COMMERCIALES
// =====================================================

export interface Offre {
  idoffres: number;
  creePar: 'ADMIN' | 'CANDIDAT';
  typeOffre: string;
  titre: string;
  description: string;
  conditionsRequises?: string;
  documentsRequis?: string;
  dateDebut?: string;
  dateFin?: string;
  nombreCandidaturesMax?: number;
  nombreCandidaturesActuelles: number;
  statusOffre: 'BROUILLON' | 'EN_ATTENTE' | 'EN_TRAITEMENT' | 'VALIDEE' | 'REJETEE' | 'ACTIVE' | 'CLOTUREE';
  motifRefus?: string;
  createdDate: string;
  lastmodifiedDate?: string;
  candidatCreateur?: {
    idcandidats: number;
    nom: string;
    prenom: string;
    email: string;
    telephone?: string;
  };
  agentCreateur?: {
    idagents: number;
    nom: string;
    prenom: string;
    matricule: string;
  };
  candidatures?: CandidatureOffre[];
}

export interface CandidatureOffre {
  idcandidature: number;
  offres_idoffres: number;
  candidats_idcandidats: number;
  statusCandidature: 'SOUMISE' | 'EN_EXAMEN' | 'VALIDEE' | 'REJETEE';
  motifRefus?: string;
  commentaireAgent?: string;
  evaluePar?: string;
  dateEvaluation?: string;
  dateCandidature: string;
  candidat?: {
    idcandidats: number;
    nom: string;
    prenom: string;
    email: string;
    telephone?: string;
  };
  offre?: Offre;
}

export interface OffreFilters {
  creePar?: 'ADMIN' | 'CANDIDAT';
  statusOffre?: string;
  typeOffre?: string;
  page?: number;
  limit?: number;
}

// =====================================================
// INTERFACES - DASHBOARD COMMERCIAL
// =====================================================

export interface CommercialStats {
  offresActives: number;
  offresEnAttente: number;
  candidaturesTotal: number;
  candidaturesEnAttente: number;
  offresCloturees: number;
  tauxValidation: number;
  offresParMois: { mois: string; total: number }[];
  candidaturesParMois: { mois: string; total: number }[];
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class CommercialService {
  private apiUrl = `${environment.apiUrl}/offres`;

  constructor(private http: HttpClient) {}

  // =====================================================
  // OFFRES
  // =====================================================

  /**
   * Obtenir toutes les offres avec filtres
   */
  getAllOffres(filters: OffreFilters = {}): Observable<ApiResponse<Offre[]>> {
    let params = new HttpParams();
    if (filters.creePar) params = params.set('creePar', filters.creePar);
    if (filters.statusOffre) params = params.set('statusOffre', filters.statusOffre);
    if (filters.typeOffre) params = params.set('typeOffre', filters.typeOffre);
    return this.http.get<ApiResponse<Offre[]>>(this.apiUrl, { params });
  }

  /**
   * Créer une offre (par admin/agent commercial)
   */
  createOffre(data: Partial<Offre>): Observable<ApiResponse<Offre>> {
    return this.http.post<ApiResponse<Offre>>(`${this.apiUrl}/admin`, data);
  }

  /**
   * Obtenir une offre par ID
   */
  getOffreById(id: number): Observable<ApiResponse<Offre>> {
    return this.http.get<ApiResponse<Offre>>(`${this.apiUrl}/${id}`);
  }

  /**
   * Mettre à jour une offre
   */
  updateOffre(id: number, data: Partial<Offre>): Observable<ApiResponse<Offre>> {
    return this.http.put<ApiResponse<Offre>>(`${this.apiUrl}/${id}`, data);
  }

  /**
   * Évaluer une offre candidat (valider ou rejeter)
   */
  evaluateOffre(id: number, data: { statusOffre: string; motifRefus?: string }): Observable<ApiResponse<Offre>> {
    return this.http.put<ApiResponse<Offre>>(`${this.apiUrl}/${id}/evaluer`, data);
  }

  /**
   * Supprimer une offre
   */
  deleteOffre(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/${id}`);
  }

  // =====================================================
  // CANDIDATURES
  // =====================================================

  /**
   * Obtenir les candidatures d'une offre
   */
  getCandidaturesByOffre(offreId: number): Observable<ApiResponse<CandidatureOffre[]>> {
    return this.http.get<ApiResponse<CandidatureOffre[]>>(`${this.apiUrl}/${offreId}/candidatures`);
  }

  /**
   * Évaluer une candidature
   */
  evaluateCandidature(id: number, data: {
    statusCandidature: string;
    commentaireAgent?: string;
    motifRefus?: string;
  }): Observable<ApiResponse<CandidatureOffre>> {
    return this.http.put<ApiResponse<CandidatureOffre>>(`${this.apiUrl}/candidatures/${id}/evaluer`, data);
  }

  // =====================================================
  // STATISTIQUES DASHBOARD (calculées localement)
  // =====================================================

  /**
   * Calculer les stats à partir des offres
   */
  computeStats(offres: Offre[]): CommercialStats {
    const offresActives = offres.filter(o => o.statusOffre === 'ACTIVE').length;
    const offresEnAttente = offres.filter(o => o.statusOffre === 'EN_ATTENTE' || o.statusOffre === 'EN_TRAITEMENT').length;
    const offresCloturees = offres.filter(o => o.statusOffre === 'CLOTUREE').length;
    const candidaturesTotal = offres.reduce((sum, o) => sum + (o.nombreCandidaturesActuelles || 0), 0);
    const candidaturesValidees = offres.filter(o => o.statusOffre === 'VALIDEE').length;
    const tauxValidation = offres.length > 0 ? Math.round((candidaturesValidees / offres.length) * 100) : 0;

    return {
      offresActives,
      offresEnAttente,
      candidaturesTotal,
      candidaturesEnAttente: offresEnAttente,
      offresCloturees,
      tauxValidation,
      offresParMois: [],
      candidaturesParMois: []
    };
  }
}
