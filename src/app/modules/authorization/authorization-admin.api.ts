import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_CONFIG } from '../../core/api/api-config';

export type PermissionScope = 'PLATFORM' | 'TENANT' | 'GLOBAL';
export interface PermissionEntry {
  id: number;
  name: string;
  description: string | null;
  scope: PermissionScope;
  resource: string;
  action: string;
}
export interface RoleEntry {
  id: number;
  name: string;
  description: string | null;
  companyId: number | null;
  isSystem: boolean;
  permissions: PermissionEntry[];
}
export interface Overview {
  platformRoles: number;
  companyRoles: number;
  permissions: number;
  platformAssignments: number;
}
export interface UserAccess {
  user: { id: number; name: string; email: string; status: string; disabled: boolean };
  membershipStatus: string | null;
  roles: RoleEntry[];
}
export interface SimulationResult {
  allowed: boolean;
  scope: 'TENANT' | 'PLATFORM';
  permission: string;
  reason: 'GRANTED' | 'DENIED_BY_POLICY' | 'ACCOUNT_INACTIVE';
}
export interface AuthorizationPage<T> { items: T[]; page: number; limit: number; total: number }

@Injectable({ providedIn: 'root' })
export class AuthorizationAdminApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_CONFIG).apiBaseUrl + '/authorization/admin';

  overview() {
    return this.http.get<{ data: Overview }>(this.base + '/overview').pipe(map(result => result.data));
  }

  permissions(page: number, search: string, scope?: PermissionScope) {
    return this.http.get<{ data: AuthorizationPage<PermissionEntry> }>(this.base + '/permissions', {
      params: { page, search, ...(scope ? { scope } : {}) },
    }).pipe(map(result => result.data));
  }

  roles(page: number, search: string, companyId?: number) {
    return this.http.get<{ data: AuthorizationPage<RoleEntry> }>(this.base + '/roles', {
      params: { page, search, ...(companyId ? { companyId } : {}) },
    }).pipe(map(result => result.data));
  }

  userAccess(userId: number, companyId?: number) {
    return this.http.get<{ data: UserAccess }>(`${this.base}/users/${userId}/access`, {
      params: companyId ? { companyId } : {},
    }).pipe(map(result => result.data));
  }

  simulate(userId: number, permissionId: number, companyId?: number) {
    return this.http.post<{ data: SimulationResult }>(this.base + '/simulate', {
      userId, permissionId, ...(companyId ? { companyId } : {}),
    }).pipe(map(result => result.data));
  }

}
