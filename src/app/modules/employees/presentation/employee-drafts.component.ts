import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { employeeErrorMessage } from './employee-display';
import { AuthService } from '../../../core/auth/auth.service';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { RegistrationDetails, RegistrationsPage, RegistrationStatus } from '../domain/employee-administration';
import { employeeGrants, hasEmployeeGrants } from '../domain/employee-navigation';
import { emptyEmployee, normalizeEmployee, registrationFields } from '../domain/employee-registration';
import { EmployeesApi } from '../infrastructure/employees-api.service';

const labels: Record<RegistrationStatus, string> = { DRAFT: $localize`:@@employees-draft:Draft`, PENDING: $localize`:@@employees-pending-review:Pending review`, APPROVED: $localize`:@@employees-approved:Approved`, REJECTED: $localize`:@@employees-rejected:Rejected` };

@Component({
  selector: 'app-employee-drafts', standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, ComponentCardComponent],
  templateUrl: './employee-drafts.component.html',
})
export class EmployeeDraftsComponent implements OnInit {
  protected readonly copy = {
    noNumber: $localize`:@@employees-no-employee-number:No employee number`,
    newDraft: $localize`:@@employees-new-draft:New draft`,
  };

  @Input({ required: true }) company = 0;
  @Input() permissions: readonly string[] = [];
  private readonly auth = inject(AuthService);
  private readonly api = inject(EmployeesApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly fields = registrationFields;
  protected readonly labels = labels;
  protected readonly statuses = Object.keys(labels) as RegistrationStatus[];
  protected readonly result = signal<RegistrationsPage | null>(null);
  protected readonly selected = signal<RegistrationDetails | null>(null);
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected status: RegistrationStatus | '' = '';
  private appliedStatus: RegistrationStatus | '' = '';
  protected draft = emptyEmployee();
  protected reason = '';
  protected confirmed = false;

  ngOnInit() { this.list(); }
  protected get canDraft() {
    return hasEmployeeGrants(this.permissions, [employeeGrants.create, employeeGrants.personalManage]);
  }
  protected get canEdit() {
    const selected = this.selected();
    return this.canDraft && (!selected || (selected.status === 'DRAFT' && selected.createdBy === this.actorId));
  }
  protected get canReview() {
    const selected = this.selected();
    return !!selected && selected.status === 'PENDING' && selected.createdBy !== this.actorId
      && this.permissions.includes('employees.registration.review');
  }
  private get actorId() { return Number(this.auth.claims()?.sub); }

  protected list(page = 1, apply = false) {
    if (this.loading()) return;
    if (apply) this.appliedStatus = this.status;
    this.loading.set(true);
    this.error.set('');
    this.api.registrations(this.company, page, this.appliedStatus || undefined).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: data => { this.result.set(data); this.loading.set(false); },
      error: error => { this.result.set(null); this.error.set(employeeErrorMessage(error)); this.loading.set(false); },
    });
  }
  protected newDraft() {
    if (this.busy() || !this.canDraft) return;
    this.selected.set(null);
    this.draft = emptyEmployee();
    this.notice.set('');
    this.error.set('');
    this.open.set(true);
  }
  protected inspect(id: string) {
    if (this.busy()) return;
    this.send(this.api.registration(this.company, id));
  }

  protected save(submit = false) {
    if (this.busy() || !this.canEdit) return;
    if (!submit) {
      const content = Object.fromEntries(Object.entries(this.draft)
        .filter(([, value]) => value !== null && (typeof value !== 'string' || value.trim() !== '')));
      this.send(this.api.saveDraft(this.company, content, this.selected() ?? undefined), $localize`:@@employees-draft-saved:Draft saved.`);
      return;
    }
    const selected = this.selected();
    if (!selected) return;
    try {
      const content = normalizeEmployee(this.draft);
      this.send(this.api.saveDraft(this.company, content, selected), $localize`:@@employees-draft-saved:Draft saved.`, saved =>
        this.send(this.api.registrationAction(this.company, saved, 'submit'), $localize`:@@employees-registration-submitted-for-review:Registration submitted for review.`));
    } catch (error) { this.error.set(employeeErrorMessage(error)); }
  }

  protected decide(action: 'approve' | 'reject') {
    const selected = this.selected();
    const reason = this.reason.trim();
    if (this.busy() || !selected || !this.canReview || !this.confirmed ||
      (action === 'reject' && reason.length < 3)) return;
    this.send(this.api.registrationAction(this.company, selected, action, reason || undefined),
      action === 'approve' ? $localize`:@@employees-registration-approved-the-employee-profile-is-active:Registration approved. The employee profile is active.` : $localize`:@@employees-registration-rejected:Registration rejected.`);
  }

  private send(request: Observable<RegistrationDetails>, notice?: string, after?: (data: RegistrationDetails) => void) {
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: data => {
        this.selected.set(data);
        this.open.set(true);
        this.draft = { ...emptyEmployee(), ...data.content };
        this.reason = '';
        this.confirmed = false;
        this.busy.set(false);
        if (notice) this.notice.set(notice);
        if (after) after(data);
        else if (notice) this.list();
      },
      error: error => { this.error.set(employeeErrorMessage(error)); this.busy.set(false); },
    });
  }
}
