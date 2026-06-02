// src/app/core/services/candidat.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ProfilCandidat {
  idcandidat: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  username: string;
  createdDate: string;
}

export interface StatsCandidat {
  totalCandidatures: number;
  candidaturesValidees: number;
  candidaturesEnAttente: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class CandidatService {
  private apiUrl = `${environment.apiUrl}/candidat`;

  constructor(private http: HttpClient) {}

  /**
   * Récupérer le profil du candidat connecté
   */
  getProfil(): Observable<ApiResponse<ProfilCandidat>> {
    return this.http.get<ApiResponse<ProfilCandidat>>(`${this.apiUrl}/profil`);
  }

  /**
   * Mettre à jour le profil du candidat
   */
  updateProfil(data: Partial<ProfilCandidat>): Observable<ApiResponse<ProfilCandidat>> {
    return this.http.put<ApiResponse<ProfilCandidat>>(`${this.apiUrl}/profil`, data);
  }

  /**
   * Récupérer les statistiques du candidat
   */
  getStats(): Observable<ApiResponse<StatsCandidat>> {
    return this.http.get<ApiResponse<StatsCandidat>>(`${this.apiUrl}/stats`);
  }



  /**
   * Récupérer une candidature spécifique
   */
  getCandidatureDetails(id: number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/candidatures/${id}`);
  }

  /**
   * Postuler à une campagne
   */
  postuler(profilId: number): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/postuler`, { profilId });
  }

  /**
   * Récupérer les documents du candidat
   */
  getDocuments(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/documents`);
  }

  /**
   * Upload un document
   */
  uploadDocument(formData: FormData): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/documents`, formData);
  }
}