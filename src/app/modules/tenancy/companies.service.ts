import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_CONFIG } from '../../core/api/api-config';

export type CompanyStatus = 'ACTIVE' | 'SUSPENDED';

export interface Company {
  id: number; name: string; slug: string; nif: string | null; email: string | null;
  phone: string | null; status: CompanyStatus; timezone: string; locale: string;
  createdAt: string; updatedAt: string;
}
export type CompanyProfile = Pick<Company, 'name' | 'nif' | 'email' | 'phone' | 'timezone' | 'locale'>;

export interface CompanyMember {
  id: number;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  roleName: string | null;
  status: string;
}

export interface CompanySummary {
  total: number;
  active: number;
  suspended: number;
}

export interface DirectoryPage<T> {
  success: boolean;
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

@Injectable({ providedIn: 'root' })
export class CompaniesService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = inject(API_CONFIG).apiBaseUrl + '/platform/companies';

  list(page: number, search: string, status?: CompanyStatus) {
    return this.http.get<DirectoryPage<Company>>(this.endpoint, {
      params: { page, limit: 20, ...(search ? { search } : {}), ...(status ? { status } : {}) },
    });
  }

  summary() {
    return this.http.get<{ data: CompanySummary }>(this.endpoint + '/summary');
  }

  get(id: number) {
    return this.http.get<{ data: Company }>(`${this.endpoint}/${id}`);
  }

  members(id: number, page: number) {
    return this.http.get<DirectoryPage<CompanyMember>>(`${this.endpoint}/${id}/members`, {
      params: { page, limit: 20 },
    });
  }

  update(id: number, profile: Partial<CompanyProfile>) {
    return this.http.patch<{ data: Company }>(`${this.endpoint}/${id}`, profile);
  }

  changeStatus(id: number, action: 'activate' | 'suspend', reason: string) {
    return this.http.patch<{ success: boolean; data: Company }>(
      `${this.endpoint}/${id}/${action}`, { reason });
  }
}
