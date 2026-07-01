// admin-direction.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, PaginatedResponse, ServiceItem } from './admin-service.service';

export interface DirectionItem {
  iddirection: number;
  nom: string;
  accronyme: string;
  createdDate?: string;
  createdBy?: string;
  lastModifiedDate?: string;
  lastModifiedBy?: string;
  del?: number;
  services?: ServiceItem[];
}

export interface DirectionFilters {
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateDirectionData {
  nom: string;
  accronyme: string;
  serviceIds?: number[];
}

export interface UpdateDirectionData {
  nom?: string;
  accronyme?: string;
  serviceIds?: number[];
}

@Injectable({ providedIn: 'root' })
export class AdminDirectionService {
  private apiUrl = `${environment.apiUrl}/admin/directions`;

  constructor(private http: HttpClient) {}

  getDirections(
    filters: DirectionFilters = {},
  ): Observable<ApiResponse<PaginatedResponse<DirectionItem>>> {
    let params = new HttpParams();
    if (filters.search) params = params.set('search', filters.search);
    if (filters.page)   params = params.set('page', filters.page.toString());
    if (filters.limit)  params = params.set('limit', filters.limit.toString());
    return this.http.get<ApiResponse<PaginatedResponse<DirectionItem>>>(this.apiUrl, { params });
  }

  getDirectionById(id: number): Observable<ApiResponse<DirectionItem>> {
    return this.http.get<ApiResponse<DirectionItem>>(`${this.apiUrl}/${id}`);
  }

  createDirection(data: CreateDirectionData): Observable<ApiResponse<DirectionItem>> {
    return this.http.post<ApiResponse<DirectionItem>>(this.apiUrl, data);
  }

  updateDirection(id: number, data: UpdateDirectionData): Observable<ApiResponse<DirectionItem>> {
    return this.http.put<ApiResponse<DirectionItem>>(`${this.apiUrl}/${id}`, data);
  }

  deleteDirection(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`);
  }

  /** Charge tous les services disponibles pour le multi-sélect */
  getAllServices(): Observable<ApiResponse<PaginatedResponse<ServiceItem>>> {
    const params = new HttpParams().set('limit', '200');
    return this.http.get<ApiResponse<PaginatedResponse<ServiceItem>>>(
      `${environment.apiUrl}/admin/services`,
      { params },
    );
  }
}
