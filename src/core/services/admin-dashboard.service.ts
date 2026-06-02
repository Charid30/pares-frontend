// src/core/services/admin-dashboard.service.ts - Service pour le dashboard admin
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MenuBadges {
  stagesEnAttente: number;
  rapportsEnAttente: number;
  candidaturesEnAttente: number;
  stagesEnCours: number;
  audiencesEnAttente: number;
}

export interface DashboardStats {
  candidats: {
    total: number;
    thisMonth: number;
    withStages: number;
    withCandidatures: number;
  };
  stages: {
    total: number;
    enAttente: number;
    enCours: number;
    termines: number;
  };
  recrutements: {
    campagnesActives: number;
    candidaturesEnAttente: number;
    totalCandidatures: number;
  };
  rapports: {
    total: number;
    enAttente: number;
    valides: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AdminDashboardService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Récupérer les badges pour le menu (compteurs d'actions en attente)
   */
  getMenuBadges(): Observable<{ success: boolean; data: MenuBadges }> {
    return this.http.get<{ success: boolean; data: MenuBadges }>(`${this.apiUrl}/admin/dashboard/badges`);
  }

  /**
   * Récupérer les statistiques complètes du dashboard
   */
  getDashboardStats(): Observable<{ success: boolean; data: DashboardStats }> {
    return this.http.get<{ success: boolean; data: DashboardStats }>(`${this.apiUrl}/admin/dashboard/stats`);
  }

  /**
   * Récupérer les activités récentes (≤ 3 jours) pour la cloche
   */
  getRecentActivities(): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/admin/dashboard/recent-activities`);
  }
}
