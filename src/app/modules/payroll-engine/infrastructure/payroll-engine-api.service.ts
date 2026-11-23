import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { companyScope } from '../../../core/api/company-workspace-api';
import { EngineScenario, EngineSimulation } from '../domain/engine.models';

@Injectable({ providedIn: 'root' })
export class PayrollEngineApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);

  simulate(companyId: number, scenario: EngineScenario) {
    return this.http.post<{ data: EngineSimulation }>(
      this.config.apiBaseUrl + '/payroll/engine/simulate', scenario, companyScope(companyId),
    ).pipe(map(response => response.data));
  }
}
