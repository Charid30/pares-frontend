// src/core/services/user.service.ts - Service de gestion des utilisateurs et agents
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Agent,
  Role,
  Service,
  Direction,
  CreateAgentDTO,
  UpdateAgentDTO,
  ApiResponse,
  PaginatedResponse,
  UserStats
} from '../models/user.model';

export interface AgentFilters {
  search?: string;
  role?: number;
  service?: number;
  direction?: number;
  page?: number;
  limit?: number;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  /**
   * Récupérer tous les rôles
   */
  getRoles(): Observable<ApiResponse<Role[]>> {
    return this.http.get<ApiResponse<Role[]>>(`${this.apiUrl}/roles`);
  }

  /**
   * Récupérer tous les services
   */
  getServices(): Observable<ApiResponse<Service[]>> {
    return this.http.get<ApiResponse<Service[]>>(`${this.apiUrl}/services`);
  }

  /**
   * Récupérer toutes les directions (pour le rattachement direct d'un agent sans service)
   */
  getDirections(): Observable<ApiResponse<Direction[]>> {
    return this.http.get<ApiResponse<Direction[]>>(`${this.apiUrl}/directions`);
  }

  /**
   * Récupérer tous les agents avec filtres et pagination
   */
  getAgents(filters?: AgentFilters): Observable<ApiResponse<PaginatedResponse<Agent>>> {
    let params = new HttpParams();

    if (filters) {
      if (filters.search) params = params.set('search', filters.search);
      if (filters.role) params = params.set('role', filters.role.toString());
      if (filters.service) params = params.set('service', filters.service.toString());
      if (filters.direction) params = params.set('direction', filters.direction.toString());
      if (filters.page) params = params.set('page', filters.page.toString());
      if (filters.limit) params = params.set('limit', filters.limit.toString());
    }

    return this.http.get<ApiResponse<PaginatedResponse<Agent>>>(`${this.apiUrl}/agents`, { params });
  }

  /**
   * Récupérer un agent par ID
   */
  getAgentById(id: number): Observable<ApiResponse<Agent>> {
    return this.http.get<ApiResponse<Agent>>(`${this.apiUrl}/agents/${id}`);
  }

  /**
   * Créer un nouvel agent
   */
  createAgent(data: CreateAgentDTO): Observable<ApiResponse<Agent>> {
    return this.http.post<ApiResponse<Agent>>(`${this.apiUrl}/agents`, data);
  }

  /**
   * Mettre à jour un agent
   */
  updateAgent(id: number, data: UpdateAgentDTO): Observable<ApiResponse<Agent>> {
    return this.http.put<ApiResponse<Agent>>(`${this.apiUrl}/agents/${id}`, data);
  }

  /**
   * Supprimer un agent
   */
  deleteAgent(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/agents/${id}`);
  }

  /**
   * Changer le mot de passe d'un agent
   */
  changePassword(id: number, newPassword: string, confirmNewPassword: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/agents/${id}/change-password`, { newPassword, confirmNewPassword });
  }

  /**
   * Récupérer les statistiques des utilisateurs
   */
  getStats(): Observable<ApiResponse<UserStats>> {
    return this.http.get<ApiResponse<UserStats>>(`${this.apiUrl}/agents/stats`);
  }
}
