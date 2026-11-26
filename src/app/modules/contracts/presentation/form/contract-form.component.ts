import { Component, DestroyRef, Input, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import { contractErrorMessage } from '../contract-errors';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import {
  CompanyContext, ContractTerms, ContractType, Department, DocumentSummary, EmployeeSummary, EmploymentContract,
} from '../../domain/contracts.models';
import { ContractsApi } from '../../infrastructure/contracts-api.service';
import { contractAmount, contractSalaryPattern, departmentNumber, employeeName, formatContractDate, normalizeContractSalary } from '../format-contract';
import { ContractDocumentPickerComponent } from '../documents/contract-document-picker.component';

@Component({
  selector: 'app-contract-form',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, RouterLink, ComponentCardComponent, ContractDocumentPickerComponent],
  templateUrl: './contract-form.component.html',
})
export class ContractFormComponent implements OnInit {
  @Input({ required: true }) context!: CompanyContext;
  @Input() id = '';

  private readonly api = inject(ContractsApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly steps = [$localize`:@@contracts-employee:Employee`, $localize`:@@contracts-contract-type:Contract type`, $localize`:@@contracts-compensation:Compensation`, $localize`:@@contracts-working-conditions:Working conditions`, $localize`:@@contracts-documents:Documents`, $localize`:@@contracts-review:Review`];
  protected readonly editTitle = $localize`:@@contracts-edit-contract-draft:Edit contract draft`;
  protected readonly createTitle = $localize`:@@contracts-new-contract:New contract`;
  protected readonly step = signal(0);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly loadError = signal('');
  protected readonly contract = signal<EmploymentContract | null>(null);
  protected readonly saved = signal<EmploymentContract | null>(null);
  protected readonly employee = signal<EmployeeSummary | null>(null);
  protected readonly employees = signal<EmployeeSummary[]>([]);
  protected readonly employeePage = signal(1);
  protected readonly employeePages = signal(0);
  protected readonly searching = signal(false);
  protected employeeSearch = '';
  protected readonly types = signal<ContractType[]>([]);
  protected readonly departments = signal<Department[]>([]);
  protected document: DocumentSummary | null = null;
  protected documentType = 'CONTRACT';
  protected readonly employeeName = employeeName;
  protected readonly amount = contractAmount;
  protected readonly date = formatContractDate;
  protected readonly form = this.fb.group({
    contractNumber: ['', [Validators.required, Validators.maxLength(50)]],
    typeCode: ['', Validators.required],
    startDate: ['', Validators.required],
    endDate: '',
    hiringRegime: '',
    probationDays: ['', Validators.pattern(/^\d*$/)],
    currency: ['AOA', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
    salaryAmount: ['', Validators.pattern(contractSalaryPattern)],
    payFrequency: '',
    allowances: '',
    paymentTerms: '',
    workingHours: '',
    schedule: '',
    workplace: '',
    department: '',
    jobTitle: '',
    notes: '',
  });

  protected get canAttach() {
    return ['contracts.documents.manage', 'documents:read', 'documents:read-sensitive']
      .every(permission => this.context.permissions.includes(permission));
  }

  protected get canPreview() { return this.context.permissions.includes('documents:preview'); }

  protected readonly departmentName = computed(() => {
    const id = this.employee()?.departmentId;
    return id ? this.departments().find(department => String(department.id) === String(id))?.name ?? departmentNumber(id) : '';
  });

  ngOnInit() { this.load(); }

  protected load() {
    this.loadError.set('');
    this.loading.set(true);
    const companyId = this.context.company.id;
    const grant = this.id ? 'contracts.update' : 'contracts.create';
    if (!this.context.permissions.includes(grant)) {
      this.loadError.set($localize`:@@contracts-your-company-role-does-not-allow-this-contract-operation:Your company role does not allow this contract operation.`);
      this.loading.set(false);
      return;
    }
    forkJoin({
      types: this.api.types(companyId),
      contract: this.id ? this.api.get(companyId, this.id) : of(null),
      departments: this.context.permissions.includes('organization:read')
        ? this.api.departments(companyId).pipe(catchError(() => of([]))) : of([]),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ types, contract, departments }) => {
        this.types.set(types);
        this.departments.set(departments);
        this.contract.set(contract);
        if (contract && contract.status !== 'DRAFT') {
          this.loadError.set($localize`:@@contracts-only-a-draft-can-be-edited:Only a draft can be edited.`);
        } else if (contract) {
          this.patchDraft(contract);
        } else if (this.context.permissions.includes('employees.read')) {
          this.searchEmployees(1);
        } else {
          this.loadError.set($localize`:@@contracts-your-company-role-needs-employee-access-to-select-a-worker-for-a-new-contract:Your company role needs employee access to select a worker for a new contract.`);
        }
        this.loading.set(false);
      },
      error: error => { this.loadError.set(contractErrorMessage(error)); this.loading.set(false); },
    });
  }

  protected searchEmployees(page: number) {
    if (this.searching()) return;
    this.searching.set(true);
    this.error.set('');
    this.api.employees(this.context.company.id, page, this.employeeSearch.trim())
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: result => {
          this.employees.set(result.data);
          this.employeePage.set(result.pagination.page);
          this.employeePages.set(result.pagination.totalPages);
          this.searching.set(false);
        },
        error: error => { this.error.set(contractErrorMessage(error)); this.searching.set(false); },
      });
  }

  protected pickEmployee(id: string) {
    if (this.employee()?.id === id) return;
    const worker = this.employees().find(entry => entry.id === id) ?? null;
    this.employee.set(worker);
    this.form.patchValue({ jobTitle: worker?.jobTitle ?? '', department: this.departmentName() });
  }

  protected employeeIsListed(id: string) {
    return this.employees().some(entry => entry.id === id);
  }

  protected next() {
    this.error.set('');
    const problem = this.validateStep(this.step());
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.step.update(step => step + 1);
  }

  protected previous() {
    this.error.set('');
    this.step.update(step => step - 1);
  }

  protected async save(submit: boolean) {
    if (this.saving() || this.saved()) return;
    for (let step = 0; step < this.steps.length - 1; step++) {
      const problem = this.validateStep(step);
      if (problem) {
        this.step.set(step);
        this.error.set(problem);
        return;
      }
    }
    this.saving.set(true);
    this.error.set('');
    const companyId = this.context.company.id;
    const existing = this.contract();
    const raw = this.form.getRawValue();
    const { contractNumber, typeCode, startDate, endDate, currency, salaryAmount, ...conditions } = raw;
    const terms: ContractTerms = { ...existing?.terms, ...conditions };
    const fields = {
      typeCode, startDate, endDate: endDate || null, currency: currency.toUpperCase(),
      salaryAmount: salaryAmount ? normalizeContractSalary(salaryAmount) : null, terms,
    };
    try {
      let contract = await this.result(existing
        ? this.api.update(companyId, existing, fields)
        : this.api.create(companyId, { ...fields, contractNumber: contractNumber.trim(), employeeId: this.employee()!.id }));
      this.saved.set(contract);
      if (this.document) {
        contract = await this.result(this.api.attachDocument(companyId, contract.id, this.document.id, this.documentType));
        this.saved.set(contract);
      }
      if (submit) {
        contract = await this.result(this.api.act(companyId, contract, 'submit', {}));
        this.saved.set(contract);
      }
      await this.router.navigate(['/contracts', companyId, 'details', contract.id]);
    } catch (error) {
      if (!this.destroyRef.destroyed) {
        const message = contractErrorMessage(error);
        this.error.set(this.saved() ? $localize`:@@contracts-the-draft-was-saved-open-it-to-complete-the-remaining-action:The draft was saved. Open it to complete the remaining action.` + ' ' + message : message);
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected typeName(code: string) { return this.types().find(type => type.code === code)?.name ?? code; }
  protected requiresEndDate() { return this.types().find(type => type.code === this.form.controls.typeCode.value)?.requiresEndDate ?? false; }

  private validateStep(step: number) {
    const { contractNumber, typeCode, startDate, endDate, currency, salaryAmount, probationDays } = this.form.getRawValue();
    if (step === 0 && !this.id && (!this.employee() || !contractNumber.trim() || contractNumber.length > 50)) {
      return $localize`:@@contracts-select-an-employee-and-enter-a-contract-number-of-up-to-50-characters:Select an employee and enter a contract number of up to 50 characters.`;
    }
    if (step === 1) {
      if (!typeCode || !startDate) return $localize`:@@contracts-select-a-contract-type-and-enter-a-start-date:Select a contract type and enter a start date.`;
      if (this.requiresEndDate() && !endDate) return $localize`:@@contracts-this-contract-type-requires-an-end-date:This contract type requires an end date.`;
      if (endDate && endDate < startDate) return $localize`:@@contracts-the-end-date-must-be-on-or-after-the-start-date:The end date must be on or after the start date.`;
      if (probationDays && !/^\d+$/.test(probationDays)) return $localize`:@@contracts-enter-a-whole-number-of-probation-days:Enter a whole number of probation days.`;
    }
    if (step === 2 && (!/^[A-Za-z]{3}$/.test(currency) || (salaryAmount && !contractSalaryPattern.test(salaryAmount)))) {
      return $localize`:@@contracts-enter-a-three-letter-currency-code-and-a-non-negative-salary-with-up-to-two-decimal-places:Enter a three-letter currency code and a non-negative salary with up to two decimal places.`;
    }
    return '';
  }

  private patchDraft(contract: EmploymentContract) {
    this.form.patchValue({
      ...contract.terms,
      contractNumber: contract.contractNumber, typeCode: contract.typeCode, startDate: contract.startDate,
      endDate: contract.endDate ?? '', currency: contract.currency, salaryAmount: contract.salaryAmount ?? '',
    });
    if (this.context.permissions.includes('employees.read')) {
      this.api.employee(this.context.company.id, contract.employeeId)
        .pipe(takeUntilDestroyed(this.destroyRef), catchError(() => of(null)))
        .subscribe(employee => this.employee.set(employee));
    }
  }

  private result<T>(request: import('rxjs').Observable<T>) {
    return firstValueFrom(request.pipe(takeUntilDestroyed(this.destroyRef)));
  }
}
