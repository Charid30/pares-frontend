// src/app/core/services/recrutement.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, Observable, throwError, timeout } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Campagne {
  idcampagne: number;
  titre: string;
  description: string;
  dateDebut: string;
  dateFin: string;
  nombrePostes: number;
  statusCampagne: 'BROUILLON' | 'ACTIVE' | 'CLOTUREE' | 'ANNULEE';
  localisation?: string;
  profilsCount?: number;
}

export interface CampagnesResponse {
  success: boolean;
  data: Campagne[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}


@Injectable({
  providedIn: 'root'
})
export class RecrutementService {
  private apiUrl = `${environment.apiUrl}/recrutement`;
  private readonly TIMEOUT_DURATION = 5000; // 10 secondes

  constructor(private http: HttpClient) {}

  /**
   * Récupérer les campagnes de recrutement actives avec pagination
   * @param page - Numéro de la page (défaut: 1)
   * @param limit - Nombre d'éléments par page (défaut: 5)
   */
  getCampagnesActives(page: number = 1, limit: number = 5): Observable<CampagnesResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString())
      .set('statusCampagne', 'ACTIVE');

    return this.http.get<CampagnesResponse>(
      `${this.apiUrl}/campagnes/actives`,
      { params }
    ).pipe(
      timeout(this.TIMEOUT_DURATION),
      catchError((error) => {
        if (error.name === 'TimeoutError') {
          return throwError(() => new Error('Le serveur met trop de temps à répondre. Veuillez réessayer.'));
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Récupérer une campagne par ID
   */
  getCampagneById(id: number): Observable<{ success: boolean; data: Campagne }> {
    return this.http.get<{ success: boolean; data: Campagne }>(
      `${this.apiUrl}/campagnes/${id}`
    ).pipe(
      timeout(this.TIMEOUT_DURATION),
      catchError((error) => {
        if (error.name === 'TimeoutError') {
          return throwError(() => new Error('Le serveur met trop de temps à répondre.'));
        }
        return throwError(() => error);
      })
    );
  }
}