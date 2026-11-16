import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_CONFIG } from '../../../core/api/api-config';

export interface Company {
  id: number; name: string; slug: string; nif: string | null; email: string | null;
  phone: string | null; status: string; timezone: string; locale: string; createdAt: string;
}
export interface CompanyPage {
  success: boolean;
  data: Company[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
@Injectable({ providedIn: 'root' })
export class CompaniesService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);
  list(page = 1, search = '') {
    return this.http.get<CompanyPage>(`${this.config.apiBaseUrl}/platform/companies`, {
      params: { page, limit: 20, search },
    });
  }
  changeStatus(id: number, action: 'activate' | 'suspend') {
    return this.http.patch<{ success: boolean; data: Company }>(
      `${this.config.apiBaseUrl}/platform/companies/${id}/${action}`, {});
  }
}
