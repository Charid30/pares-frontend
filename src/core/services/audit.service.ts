// src/core/services/audit.service.ts — Service pour les logs d'audit (admin)
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuditLog {
  id: number;
  agent_id: number | null;
  agent_nom: string | null;
  action: string;
  module: string;
  entity_id: number | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  createdAt: string;
}

export interface AuditLogsResponse {
  success: boolean;
  data: AuditLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AuditMeta {
  modules: string[];
  actions: string[];
}

export interface AuditFilters {
  module?: string;
  action?: string;
  agentNom?: string;
  dateDebut?: string;
  dateFin?: string;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class AuditService {

  private readonly base = `${environment.apiUrl}/admin/audit`;

  constructor(private http: HttpClient) {}

  getAuditLogs(filters: AuditFilters = {}): Observable<AuditLogsResponse> {
    let params = new HttpParams();
    if (filters.module)    params = params.set('module',    filters.module);
    if (filters.action)    params = params.set('action',    filters.action);
    if (filters.agentNom)  params = params.set('agentNom',  filters.agentNom);
    if (filters.dateDebut) params = params.set('dateDebut', filters.dateDebut);
    if (filters.dateFin)   params = params.set('dateFin',   filters.dateFin);
    if (filters.page)      params = params.set('page',      String(filters.page));
    if (filters.limit)     params = params.set('limit',     String(filters.limit));
    return this.http.get<AuditLogsResponse>(this.base, { params });
  }

  getMeta(): Observable<{ success: boolean; data: AuditMeta }> {
    return this.http.get<{ success: boolean; data: AuditMeta }>(`${this.base}/meta`);
  }
}
