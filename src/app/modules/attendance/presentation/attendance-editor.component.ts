import { Component, DestroyRef, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { Observable } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { UUID, UUID_PATTERN, dateKey } from '../domain/attendance-format';
import { Employee, PUNCH_TYPES, PunchType } from '../domain/attendance.models';
import { AttendanceApi } from '../infrastructure/attendance-api.service';

export type EditorAction = 'punch' | 'calculate' | 'justify' | 'correct' | 'rectify' | 'period'
  | 'approve' | 'reject' | 'return' | 'validate' | 'close';

export interface EditorRequest {
  action: EditorAction;
  id?: string;
  resource?: 'justifications' | 'corrections';
  employeeId?: string;
  date?: string;
}

const TITLES: Record<EditorAction, string> = {
  punch: 'Record a manual punch', calculate: 'Recalculate a workday', justify: 'Submit justification',
  correct: 'Request correction', rectify: 'Request post-close rectification', period: 'Create a period',
  approve: 'Approve request', reject: 'Reject request', return: 'Return for correction',
  validate: 'Validate period', close: 'Close period and generate snapshot',
};

@Component({
  selector: 'app-attendance-editor',
  standalone: true,
  imports: [FormsModule, ComponentCardComponent],
  templateUrl: './attendance-editor.component.html',
})
export class AttendanceEditorComponent {
  @Input({ required: true }) request!: EditorRequest;
  @Input({ required: true }) company!: number;
  @Input() employees: Employee[] = [];
  @Output() readonly cancelled = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<string>();

  private readonly api = inject(AttendanceApi);
  private readonly destroy = inject(DestroyRef);
  private readonly idempotencyKey = crypto.randomUUID();
  protected readonly busy = signal(false);
  protected readonly confirmed = signal(false);
  protected readonly error = signal('');
  protected readonly titles = TITLES;
  protected readonly types = Object.entries(PUNCH_TYPES);
  protected readonly uuidPattern = UUID_PATTERN;
  protected readonly today = dateKey();

  protected save(form: NgForm) {
    if (form.invalid || this.busy() || (this.request.action === 'close' && !this.confirmed())) return;
    this.error.set('');
    let operation: Observable<unknown>;
    try {
      operation = this.operation(form.value);
    } catch (error) {
      this.error.set(apiErrorMessage(error));
      return;
    }
    this.busy.set(true);
    operation.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        this.busy.set(false);
        this.saved.emit(TITLES[this.request.action] + ' · completed.');
      },
      error: error => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(error));
      },
    });
  }

  private operation(values: Record<string, string | undefined>): Observable<unknown> {
    const { action, id, resource } = this.request;
    const company = this.company;
    const reason = values['reason']?.trim() ?? '';
    const employeeId = values['employeeId'] ?? '';
    const punchType = values['punchType'] as PunchType | '';
    const occurredAt = values['occurredAt'] ? new Date(values['occurredAt']).toISOString() : undefined;
    switch (action) {
      case 'punch':
        return this.api.createPunch(company, {
          employeeId, punchType: punchType as PunchType, occurredAt: occurredAt!,
          workDate: values['workDate'] || undefined, idempotencyKey: this.idempotencyKey,
        });
      case 'calculate':
        return this.api.calculate(company, employeeId, values['workDate']!);
      case 'justify': {
        const occurrence = id ?? values['recordId'] ?? '';
        if (!UUID.test(occurrence) || !reason) throw new Error('Enter a valid occurrence ID and a reason.');
        return this.api.justify(company, occurrence, reason, values['evidence']?.trim() || undefined);
      }
      case 'correct':
      case 'rectify': {
        const record = (action === 'correct' ? id : undefined) ?? values['recordId'] ?? '';
        if (!UUID.test(record) || !reason) throw new Error('Enter a valid time record ID and a reason.');
        if (!punchType && !occurredAt) throw new Error('Enter a revised time or select a revised punch type.');
        return this.api.correct(company, record, { reason, occurredAt, punchType: punchType || undefined },
          action === 'rectify' ? id : undefined);
      }
      case 'period': {
        const start = values['startDate']!;
        const end = values['endDate']!;
        if (start > end) throw new Error('The start date must be on or before the end date.');
        return this.api.createPeriod(company, start, end);
      }
      case 'approve':
      case 'reject':
      case 'return':
        if (action !== 'approve' && !reason) throw new Error('Enter a reason for the decision.');
        return this.api.decide(company, resource!, id!, action, reason || undefined);
      case 'validate':
      case 'close':
        return this.api.periodAction(company, id!, action);
    }
  }
}
