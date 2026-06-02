// src/core/services/dashboard.service.ts - Service pour le dashboard admin
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// Interfaces pour les données du dashboard
export interface MainStats {
  candidats: {
    total: number;
    change: number;
    changeType: 'increase' | 'decrease' | 'neutral';
  };
  stages: {
    total: number;
    enCours: number;
    change: number;
    changeType: 'increase' | 'decrease' | 'neutral';
  };
  recrutements: {
    campagnesActives: number;
    totalCandidatures: number;
  };
  offres: {
    actives: number;
    total: number;
  };
}

export interface SecondaryStats {
  aidesSociales: {
    active: number;
    demandes: number;
  };
  utilisateurs: {
    total: number;
    admins: number;
  };
  candidaturesEnAttente: number;
  tauxValidation: number;
}

export interface RecentActivity {
  type: 'candidat' | 'stage' | 'recrutement' | 'offre' | 'aide';
  action: string;
  description: string;
  user: string;
  date: Date;
  status: string | null;
}

export interface PendingItem {
  id: number;
  type: 'stage' | 'recrutement' | 'offre' | 'aide';
  title: string;
  subtitle: string;
  date: Date;
  priority: 'high' | 'medium' | 'low';
}

export interface ChartData {
  labels: string[];
  candidats: number[];
  stagesValides: number[];
}

export interface DashboardData {
  mainStats: MainStats;
  secondaryStats: SecondaryStats;
  recentActivities: RecentActivity[];
  pendingItems: PendingItem[];
  chartData?: ChartData;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = `${environment.apiUrl}/dashboard`;

  constructor(private http: HttpClient) {}

  /**
   * Récupérer toutes les données du dashboard
   */
  getDashboardData(): Observable<ApiResponse<DashboardData>> {
    return this.http.get<ApiResponse<DashboardData>>(this.apiUrl);
  }

  /**
   * Récupérer les statistiques principales
   */
  getMainStats(): Observable<ApiResponse<MainStats>> {
    return this.http.get<ApiResponse<MainStats>>(`${this.apiUrl}/main-stats`);
  }

  /**
   * Récupérer les statistiques secondaires
   */
  getSecondaryStats(): Observable<ApiResponse<SecondaryStats>> {
    return this.http.get<ApiResponse<SecondaryStats>>(`${this.apiUrl}/secondary-stats`);
  }

  /**
   * Récupérer les activités récentes
   */
  getRecentActivities(limit: number = 10): Observable<ApiResponse<RecentActivity[]>> {
    return this.http.get<ApiResponse<RecentActivity[]>>(`${this.apiUrl}/activities?limit=${limit}`);
  }

  /**
   * Récupérer les éléments en attente
   */
  getPendingItems(limit: number = 10): Observable<ApiResponse<PendingItem[]>> {
    return this.http.get<ApiResponse<PendingItem[]>>(`${this.apiUrl}/pending?limit=${limit}`);
  }
}
