import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_CONFIG } from '../../core/api/api-config';

export interface Identity {
  id: number;
  name: string;
  email: string;
  status: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  disabledAt: string | null;
}
export interface IdentityDetails extends Identity {
  activeSessions: number;
  protectedAccount: boolean;
}
export interface IdentityPage { data: Identity[]; page: number; limit: number; total: number }
export type IdentityAction = 'disable' | 'enable' | 'revoke-sessions';

@Injectable({ providedIn: 'root' })
export class IdentityAdminApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_CONFIG).apiBaseUrl + '/identity/admin/identities';

  list(page: number, search: string, disabled: boolean) {
    return this.http.get<IdentityPage>(this.base, { params: { page, search, ...(disabled ? { disabled: 'true' } : {}) } });
  }
  detail(id: number) {
    return this.http.get<{ data: IdentityDetails }>(this.base + '/' + id).pipe(map(result => result.data));
  }
  rename(id: number, name: string) {
    return this.http.patch<{ data: Identity }>(this.base + '/' + id, { name });
  }
  act(id: number, action: IdentityAction, reason: string) {
    return this.http.post<{ data: Identity & { revoked: number } }>(this.base + '/' + id + '/' + action, { reason });
  }
}
