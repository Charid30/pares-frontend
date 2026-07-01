// src/core/services/permission.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  Permission,
  PermissionMeta,
  RoleWithPermissions,
} from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private apiUrl = `${environment.apiUrl}/permissions`;

  constructor(private http: HttpClient) {}

  // ── Rôles ──────────────────────────────────────────────────────────────────

  getAllRoles(): Observable<ApiResponse<RoleWithPermissions[]>> {
    return this.http.get<ApiResponse<RoleWithPermissions[]>>(`${this.apiUrl}/roles`);
  }

  createRole(accronyme: string, description: string, lectureGlobale = false): Observable<ApiResponse<RoleWithPermissions>> {
    return this.http.post<ApiResponse<RoleWithPermissions>>(`${this.apiUrl}/roles`, { accronyme, description, lectureGlobale });
  }

  updateRole(roleId: number, accronyme: string, description: string, lectureGlobale?: boolean): Observable<ApiResponse<RoleWithPermissions>> {
    return this.http.put<ApiResponse<RoleWithPermissions>>(`${this.apiUrl}/roles/${roleId}`, { accronyme, description, lectureGlobale });
  }

  deleteRole(roleId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/roles/${roleId}`);
  }

  // ── Permissions ────────────────────────────────────────────────────────────

  getModulesActions(): Observable<ApiResponse<PermissionMeta>> {
    return this.http.get<ApiResponse<PermissionMeta>>(`${this.apiUrl}/meta`);
  }

  getPermissionsByRole(roleId: number): Observable<ApiResponse<RoleWithPermissions>> {
    return this.http.get<ApiResponse<RoleWithPermissions>>(`${this.apiUrl}/roles/${roleId}/permissions`);
  }

  updateRolePermissions(
    roleId: number,
    permissions: { module: string; action: string }[]
  ): Observable<ApiResponse<RoleWithPermissions>> {
    return this.http.put<ApiResponse<RoleWithPermissions>>(
      `${this.apiUrl}/roles/${roleId}/permissions`,
      { permissions }
    );
  }

  removePermission(permissionId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${permissionId}`);
  }
}
