// src/core/services/financier.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// =====================================================
// INTERFACES - AIDES SOCIALES
// =====================================================

export interface Aide {
  idaide: number;
  creePar: 'ADMIN' | 'CANDIDAT';
  typeAide: string;
  titre: string;
  description: string;
  conditionsRequises?: string;
  documentsRequis?: string[];
  dateDebut?: string;
  dateFin?: string;
  nombreBeneficiairesMax?: number;
  nombreBeneficiairesActuels: number;
  statusAide: 'BROUILLON' | 'EN_ATTENTE' | 'EN_TRAITEMENT' | 'VALIDEE' | 'REJETEE' | 'ACTIVE' | 'CLOTUREE';
  motifRefus?: string;
  createdDate: string;
  lastModifiedDate?: string;
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
  candidatures?: CandidatureAide[];
}

export interface CandidatureAide {
  idcandidature: number;
  aides_idaide: number;
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
  aide?: Aide;
}

export interface AideFilters {
  creePar?: 'ADMIN' | 'CANDIDAT';
  statusAide?: string;
  typeAide?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class FinancierService {
  private apiUrl = `${environment.apiUrl}/aides`;

  constructor(private http: HttpClient) {}

  /**
   * Obtenir toutes les aides (AGENT_FINANCIER + ADMIN)
   */
  getAllAides(filters: AideFilters = {}): Observable<ApiResponse<Aide[]>> {
    let params = new HttpParams();
    if (filters.creePar) params = params.set('creePar', filters.creePar);
    if (filters.statusAide) params = params.set('statusAide', filters.statusAide);
    if (filters.typeAide) params = params.set('typeAide', filters.typeAide);
    return this.http.get<ApiResponse<Aide[]>>(this.apiUrl, { params });
  }

  /**
   * Obtenir une aide par ID
   */
  getAideById(id: number): Observable<ApiResponse<Aide>> {
    return this.http.get<ApiResponse<Aide>>(`${this.apiUrl}/${id}`);
  }

  /**
   * Créer une aide (programme) par agent financier
   */
  createAide(data: Partial<Aide>): Observable<ApiResponse<Aide>> {
    return this.http.post<ApiResponse<Aide>>(`${this.apiUrl}/admin`, data);
  }

  /**
   * Mettre à jour une aide
   */
  updateAide(id: number, data: Partial<Aide>): Observable<ApiResponse<Aide>> {
    return this.http.put<ApiResponse<Aide>>(`${this.apiUrl}/${id}`, data);
  }

  /**
   * Évaluer une aide candidat (valider ou rejeter)
   */
  evaluateAide(id: number, data: { statusAide: string; motifRefus?: string }): Observable<ApiResponse<Aide>> {
    return this.http.put<ApiResponse<Aide>>(`${this.apiUrl}/${id}/evaluer`, data);
  }

  /**
   * Obtenir les candidatures d'une aide
   */
  getCandidaturesByAide(aideId: number): Observable<ApiResponse<CandidatureAide[]>> {
    return this.http.get<ApiResponse<CandidatureAide[]>>(`${this.apiUrl}/${aideId}/candidatures`);
  }

  /**
   * Évaluer une candidature à une aide
   */
  evaluateCandidature(id: number, data: {
    statusCandidature: string;
    commentaireAgent?: string;
    motifRefus?: string;
  }): Observable<ApiResponse<CandidatureAide>> {
    return this.http.put<ApiResponse<CandidatureAide>>(`${this.apiUrl}/candidatures/${id}/evaluer`, data);
  }
}
