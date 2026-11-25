import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { DocumentsApi, storageUrl } from '../../documents/documents-api.service';
import { employeeGrants, EmployeeSection } from '../domain/employee-navigation';
import { BankAccount, Dependent, DependentInput, Employee, EmployeeHistory, EmployeePersonal, EmployeeProfessional, EmployeeStatus, employeeStatuses, statusOptions } from '../domain/employee.models';
import { EmployeesApi } from '../infrastructure/employees-api.service';

interface LinkedDocument { id: string; name: string; status: string; categoryCode: string | null; expiresAt: string | null }
const documentsPageSize = 25;
const emptyBank = (): BankAccount => ({ bankName: '', accountName: '', accountNumber: '', iban: null, currency: 'AOA' });
const emptyDependent = (): DependentInput => ({ fullName: '', relationship: '', dateOfBirth: null, fiscalDependent: false });
const optional = (value: string | null | undefined) => value?.trim() || null;

@Component({
  selector: 'app-employee-profile', standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, ComponentCardComponent],
  templateUrl: './employee-profile.component.html',
})
export class EmployeeProfileComponent implements OnInit {
  @Input({ required: true }) company = 0;
  @Input({ required: true }) employeeId = '';
  @Input() permissions: readonly string[] = [];
  @Input() view: EmployeeSection['view'] = 'profile';
  private readonly api = inject(EmployeesApi);
  private readonly documentsApi = inject(DocumentsApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly grants = employeeGrants;
  protected readonly labels = employeeStatuses;
  protected readonly employee = signal<Employee | null>(null);
  protected readonly history = signal<EmployeeHistory | null>(null);
  protected readonly bank = signal<BankAccount | null>(null);
  protected readonly dependents = signal<Dependent[]>([]);
  protected readonly documents = signal<LinkedDocument[]>([]);
  protected readonly link = signal<{ id: string; url: string } | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected documentsPage = 1;
  protected readonly documentsPageSize = documentsPageSize;
  protected firstName = '';
  protected lastName = '';
  protected personal: EmployeePersonal = { dateOfBirth: null, nationality: null, email: null, phone: null };
  protected job: EmployeeProfessional = { departmentId: null, jobTitle: null, jobCategory: null };
  protected bankDraft = emptyBank();
  protected dependent = emptyDependent();
  protected nextStatus: EmployeeStatus | '' = '';
  protected effectiveDate = '';
  protected reason = '';
  protected terminationReason = '';
  protected confirmed = false;
  protected documentId = '';

  ngOnInit() { this.load(); }

  protected allowed(grant: string) { return this.permissions.includes(grant); }

  protected load(page = this.documentsPage) {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.link.set(null);
    forkJoin({
      employee: this.api.get(this.company, this.employeeId),
      personal: this.view === 'personal' ? this.api.personal(this.company, this.employeeId) : of(null),
      bank: this.view === 'bank' ? this.api.bank(this.company, this.employeeId) : of(null),
      dependents: this.view === 'dependents' ? this.api.dependents(this.company, this.employeeId) : of([]),
      history: this.view === 'history' ? this.api.history(this.company, this.employeeId) : of(null),
      documents: this.view === 'documents' ? this.documentsApi.get<LinkedDocument[]>(this.company, '', {
        employeeId: this.employeeId, page, limit: documentsPageSize,
      }) : of([]),
    }).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: data => {
        this.employee.set(data.employee);
        const { firstName, lastName, departmentId, jobTitle, jobCategory } = data.employee;
        this.firstName = firstName;
        this.lastName = lastName;
        this.job = { departmentId, jobTitle, jobCategory };
        if (data.personal) this.personal = { ...data.personal, dateOfBirth: data.personal.dateOfBirth?.slice(0, 10) ?? null };
        this.bank.set(data.bank);
        this.bankDraft = emptyBank();
        this.dependents.set(data.dependents);
        this.history.set(data.history);
        this.documents.set(data.documents);
        this.documentsPage = page;
        this.loading.set(false);
      },
      error: error => { this.error.set(apiErrorMessage(error)); this.loading.set(false); },
    });
  }

  protected statusChoices(current: EmployeeStatus): EmployeeStatus[] {
    if (current === 'TERMINATED') return this.allowed(this.grants.rehire) ? ['ACTIVE' as const] : [];
    return statusOptions.filter(status => status !== current &&
      this.allowed(status === 'TERMINATED' ? this.grants.terminate : this.grants.status));
  }
  protected saveNames() {
    if (!this.allowed(this.grants.update) || !this.firstName.trim() || !this.lastName.trim()) return;
    this.save(this.api.rename(this.company, this.employeeId, { firstName: this.firstName.trim(), lastName: this.lastName.trim() }), 'Employee name updated.');
  }
  protected savePersonal() {
    if (!this.allowed(this.grants.personalManage)) return;
    this.save(this.api.updatePersonal(this.company, this.employeeId, {
      dateOfBirth: this.personal.dateOfBirth || null, nationality: optional(this.personal.nationality),
      email: optional(this.personal.email), phone: optional(this.personal.phone),
    }), 'Personal data updated.');
  }
  protected saveTransfer() {
    if (!this.allowed(this.grants.transfer) || !this.effectiveDate || !this.reason.trim() ||
      (this.job.departmentId !== null && (!Number.isSafeInteger(this.job.departmentId) || this.job.departmentId < 1))) return;
    this.save(this.api.transfer(this.company, this.employeeId, {
      departmentId: this.job.departmentId, jobTitle: optional(this.job.jobTitle), jobCategory: optional(this.job.jobCategory),
      effectiveFrom: this.effectiveDate, reason: this.reason.trim(),
    }), 'Transfer recorded.');
  }
  protected saveStatus() {
    const employee = this.employee();
    const status = this.nextStatus;
    if (!employee || !status || !this.statusChoices(employee.status).includes(status) || !this.confirmed ||
      !this.effectiveDate || !this.reason.trim() || (status === 'TERMINATED' && !this.terminationReason.trim())) return;
    const action = status === 'TERMINATED' ? 'termination' : employee.status === 'TERMINATED' ? 'rehire' : 'status';
    this.save(this.api.changeStatus(this.company, this.employeeId, action, {
      effectiveAt: this.effectiveDate, reason: this.reason.trim(),
      ...(action === 'status' ? { status } : {}),
      ...(action === 'termination' ? { terminationReason: this.terminationReason.trim() } : {}),
    }), 'Employment status updated.');
  }
  protected saveBank() {
    const { bankName, accountName, accountNumber, iban, currency } = this.bankDraft;
    if (!this.allowed(this.grants.bankManage) || !bankName.trim() || !accountName.trim() || !accountNumber.trim()) return;
    this.save(this.api.updateBank(this.company, this.employeeId, {
      bankName: bankName.trim(), accountName: accountName.trim(), accountNumber: accountNumber.trim(),
      iban: optional(iban), currency: currency.trim().toUpperCase(),
    }), 'Bank account updated.');
  }
  protected saveDependent() {
    if (!this.allowed(this.grants.dependentManage) || !this.dependent.fullName.trim() || !this.dependent.relationship.trim()) return;
    this.save(this.api.addDependent(this.company, this.employeeId, {
      fullName: this.dependent.fullName.trim(), relationship: this.dependent.relationship.trim(),
      dateOfBirth: this.dependent.dateOfBirth || null, fiscalDependent: this.dependent.fiscalDependent,
    }), 'Dependent added.');
  }
  protected mask(value: string | null) {
    if (!value) return '—';
    return value.length > 4 ? '•••• ' + value.slice(-4) : '••••';
  }

  protected download(document: LinkedDocument) {
    if (this.busy() || !this.allowed('documents:download') || !['ACTIVE', 'ARCHIVED'].includes(document.status)) return;
    this.busy.set(true);
    this.error.set('');
    this.link.set(null);
    this.documentsApi.get<{ url: string }>(this.company, '/' + encodeURIComponent(document.id) + '/download')
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: result => {
          try { this.link.set({ id: document.id, url: storageUrl(result.url) }); }
          catch (error) { this.error.set(apiErrorMessage(error)); }
          this.busy.set(false);
        },
        error: error => { this.error.set(apiErrorMessage(error)); this.busy.set(false); },
      });
  }

  protected attachDocument() {
    const id = this.documentId.trim();
    if (!this.allowed('documents:associations:create') || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) return;
    this.save(this.documentsApi.write(this.company, '/' + encodeURIComponent(id) + '/associations',
      { entityType: 'EMPLOYEE', entityId: this.employeeId }), 'Document associated.');
  }

  private save(request: Observable<unknown>, notice: string) {
    if (this.busy() || this.loading()) return;
    this.error.set('');
    this.notice.set('');
    this.busy.set(true);
    request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        this.busy.set(false);
        this.notice.set(notice);
        this.nextStatus = '';
        this.effectiveDate = '';
        this.reason = '';
        this.terminationReason = '';
        this.confirmed = false;
        this.dependent = emptyDependent();
        this.documentId = '';
        this.load();
      },
      error: error => { this.error.set(apiErrorMessage(error)); this.busy.set(false); },
    });
  }
}
