// admin-service.service.ts - Service Angular pour la gestion des services
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ServiceItem {
  idservice: number;
  accronyme: string;
  description: string;
  createdDate?: string;
  createdBy?: string;
  lastmodifiedDate?: string;
  lastmodifiedBy?: string;
  del?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface ServiceFilters {
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateServiceData {
  accronyme: string;
  description: string;
}

export interface UpdateServiceData {
  accronyme?: string;
  description?: string;
}

export interface ServiceStats {
  total: number;
}

@Injectable({ providedIn: 'root' })
export class AdminServiceService {
  private apiUrl = `${environment.apiUrl}/admin/services`;

  constructor(private http: HttpClient) {}

  getServices(filters: ServiceFilters = {}): Observable<ApiResponse<PaginatedResponse<ServiceItem>>> {
    let params = new HttpParams();
    if (filters.search) params = params.set('search', filters.search);
    if (filters.page)   params = params.set('page', filters.page.toString());
    if (filters.limit)  params = params.set('limit', filters.limit.toString());
    return this.http.get<ApiResponse<PaginatedResponse<ServiceItem>>>(this.apiUrl, { params });
  }

  getServiceById(id: number): Observable<ApiResponse<ServiceItem>> {
    return this.http.get<ApiResponse<ServiceItem>>(`${this.apiUrl}/${id}`);
  }

  createService(data: CreateServiceData): Observable<ApiResponse<ServiceItem>> {
    return this.http.post<ApiResponse<ServiceItem>>(this.apiUrl, data);
  }

  updateService(id: number, data: UpdateServiceData): Observable<ApiResponse<ServiceItem>> {
    return this.http.put<ApiResponse<ServiceItem>>(`${this.apiUrl}/${id}`, data);
  }

  deleteService(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`);
  }

  getStats(): Observable<ApiResponse<ServiceStats>> {
    return this.http.get<ApiResponse<ServiceStats>>(`${this.apiUrl}/stats`);
  }
}
