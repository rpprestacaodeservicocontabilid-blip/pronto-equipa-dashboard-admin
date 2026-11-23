import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { UUID, label } from '../domain/loans-format';
import { AuditEvent } from '../domain/loans.models';
import { hasGrant } from '../domain/loans-sections';
import { LoansApi } from '../infrastructure/loans-api.service';

@Component({
  selector: 'app-loan-audit',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, ComponentCardComponent],
  templateUrl: './loan-audit.component.html',
})
export class LoanAuditComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input() resourceFilter = '';
  private readonly api = inject(LoansApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly events = signal<AuditEvent[] | null>(null);
  protected readonly cursor = signal<number | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly label = label;
  protected purpose = '';
  protected action = '';
  protected resource = '';
  private appliedPurpose = '';
  private filter: { action?: string; resourceId?: string } = {};
  private throughSequence?: number;
  protected get company() { return this.context.company.id; }

  ngOnInit() { this.resource = this.resourceFilter.slice(0, 150); }

  protected read(reset: boolean) {
    if (this.loading() || !hasGrant(this.context.permissions, 'audit:records:read-tenant')) return;
    if (reset) {
      this.appliedPurpose = this.purpose.trim();
      this.filter = {
        ...(this.action.trim() ? { action: this.action.trim() } : {}),
        ...(this.resource.trim() ? { resourceId: this.resource.trim() } : {}),
      };
      this.cursor.set(null);
      this.throughSequence = undefined;
      this.events.set(null);
    }
    if (!this.appliedPurpose) return;
    this.loading.set(true);
    this.error.set('');
    this.api.audit(this.company, this.appliedPurpose, this.filter, this.cursor() ?? undefined, this.throughSequence)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: result => {
          this.loading.set(false);
          this.cursor.set(result.nextCursor);
          this.throughSequence = result.throughSequence;
          this.events.update(rows => [...(rows ?? []), ...result.data]);
        },
        error: error => { this.loading.set(false); this.error.set(apiErrorMessage(error)); },
      });
  }

  protected isRenegotiation(event: AuditEvent) {
    return event.action === 'loans.renegotiation.requested' && event.resourceId && UUID.test(event.resourceId) &&
      hasGrant(this.context.permissions, 'renegotiations.decide');
  }
}
