import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { isPayrollId } from '../../payroll/domain/payroll-format';
import { payrollQuery } from '../../payroll/presentation/payroll-ui';
import { legalLabel } from '../domain/legal-format';
import { LegalRulesApi } from '../infrastructure/legal-rules-api.service';

@Component({
  selector: 'app-legal-audit', standalone: true,
  imports: [FormsModule, RouterLink, ComponentCardComponent],
  templateUrl: './legal-audit.component.html',
})
export class LegalAuditComponent {
  private readonly api = inject(LegalRulesApi);
  protected readonly request = signal<{ purpose: string; cursor?: number; throughSequence?: number } | null>(null);
  protected readonly result = payrollQuery(this.request, request => request
    ? this.api.audit(request.purpose, request.cursor, request.throughSequence) : of(null));
  protected readonly label = legalLabel;
  protected readonly isRecordId = isPayrollId;
  protected purpose = '';
  protected search(nextCursor?: number, throughSequence?: number) {
    const purpose = nextCursor !== undefined ? this.request()?.purpose : this.purpose.trim();
    if (purpose && purpose.length >= 3) this.request.set({ purpose, cursor: nextCursor, throughSequence });
  }
}
