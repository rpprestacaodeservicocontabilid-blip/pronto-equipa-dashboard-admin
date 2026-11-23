import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ResolveStart, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';
import { routes } from '../../app.routes';
import { AuthSessionStore } from '../auth/application/auth-session.store';

describe('Tenant loan workflow', () => {
  const recordId = 'db42f487-c606-4926-af02-22ad9d75f984';
  const employeeId = 'e6c78de7-9dce-45de-b822-1071ac318af3';
  const applicationUrl = '/api/v1/loans/applications/' + recordId;
  const pending = {
    id: recordId, employeeId, requestedAmount: '120000.25', currency: 'AOA', loanType: 'LOAN',
    status: 'PENDING_APPROVAL', version: 2, firstDueDate: '2026-12-31', frequency: 'MONTHLY', installmentCount: 6,
    annualInterestBps: 0, reason: 'Application test', createdAt: '2026-11-15T08:00:00Z', createdBy: 5, approvals: [],
  };

  beforeEach(() => TestBed.configureTestingModule({
    providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
  }));

  async function open(url: string, permissions: string[], actor = 5, roles: string[] = []) {
    const claims = btoa(JSON.stringify({
      sub: String(actor), sessionId: '3', roles, permissions: ['loans.applications.decide'], exp: 4102444800, type: 'access',
    }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature', refreshToken: 'refresh' });
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const harness = await RouterTestingHarness.create();
    const resolving = firstValueFrom(router.events.pipe(filter(event => event instanceof ResolveStart)));
    const navigation = harness.navigateByUrl(url);
    await resolving;
    const context = http.expectOne('/api/v1/company/context');
    expect(context.request.headers.get('X-Company-Id')).toBe('18');
    context.flush({ data: { company: { id: 18, name: 'Example Company', status: 'ACTIVE' }, permissions } });
    await navigation;
    const button = (title: string) => Array.from(harness.routeNativeElement!.querySelectorAll('button'))
      .find(item => item.textContent.trim() === title);
    return { harness, http, button };
  }

  it('does not authorize a platform user from global claims', async () => {
    const { harness, http } = await open('/loans/18/applications/' + recordId, [], 6, ['SUPER_ADMIN']);
    expect(harness.routeNativeElement?.textContent).toContain('Your company permissions do not include access');
    http.expectNone(request => request.url.startsWith('/api/v1/loans'));
    http.verify();
  });

  it('hides decisions for the applicant even with approval permission', async () => {
    const { harness, http, button } = await open('/loans/18/applications/' + recordId,
      ['loans.applications.read', 'loans.applications.decide']);
    const record = http.expectOne(applicationUrl);
    expect(record.request.headers.get('X-Company-Id')).toBe('18');
    record.flush({ data: pending });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Another authorized user');
    expect(button('Approve')).toBeUndefined();
    expect(button('Reject')).toBeUndefined();
    http.verify();
  });

  it('requires confirmation and posts a scoped approval before refreshing state', async () => {
    const { harness, http, button } = await open('/loans/18/applications/' + recordId,
      ['loans.applications.read', 'loans.applications.decide'], 6);
    http.expectOne(applicationUrl).flush({ data: pending });
    harness.detectChanges();
    button('Approve')!.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    const submit = () => harness.routeNativeElement!.querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(button('Approve application')?.disabled).toBeTrue();
    submit();
    http.expectNone(applicationUrl + '/decision');
    harness.routeNativeElement!.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    harness.detectChanges();
    submit();
    const decision = http.expectOne(applicationUrl + '/decision');
    expect(decision.request.method).toBe('POST');
    expect(decision.request.headers.get('X-Company-Id')).toBe('18');
    expect(decision.request.body.decision).toBe('APPROVED');
    const approved = { ...pending, status: 'APPROVED', version: 3 };
    decision.flush({ data: approved });
    http.expectOne(applicationUrl).flush({ data: approved });
    harness.detectChanges();
    expect(button('Approve')).toBeUndefined();
    http.verify();
  });

  it('reconciles the amount confirmed by Payroll using the same deduction reference', async () => {
    const { harness, http, button } = await open('/loans/18/deductions',
      ['loans.deductions.read', 'loans.deductions.confirm']);
    const row = {
      id: recordId, loanId: employeeId, installmentId: recordId, requestedAmount: '100.00', confirmedAmount: null,
      payrollRunId: null, status: 'REQUESTED', createdAt: '2026-11-15T08:00:00Z', updatedAt: '2026-11-15T08:00:00Z',
    };
    const refresh = (record: object) => {
      const result = http.expectOne(request => request.url === '/api/v1/loans/deductions');
      expect(result.request.headers.get('X-Company-Id')).toBe('18');
      result.flush({ data: [record], total: 1, page: 1, limit: 20 });
      harness.detectChanges();
    };
    refresh(row);
    button('Reconcile')!.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    const setInput = (name: string, value: string) => {
      const control = harness.routeNativeElement!.querySelector<HTMLInputElement>('input[name=' + name + ']')!;
      control.value = value;
      control.dispatchEvent(new Event('input'));
    };
    setInput('reference', 'Payroll-November');
    setInput('amount', '40,05');
    harness.routeNativeElement!.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    harness.detectChanges();
    button('Reconcile payroll deduction')!.click();
    const confirm = http.expectOne('/api/v1/loans/deductions/' + recordId + '/confirm');
    expect(confirm.request.headers.get('X-Company-Id')).toBe('18');
    expect(confirm.request.body).toEqual({
      payrollRunId: 'Payroll-November', confirmedAmount: '40.05', idempotencyKey: 'web-confirm:' + recordId,
    });
    const reconciled = { ...row, status: 'PARTIAL', confirmedAmount: '40.05', payrollRunId: 'Payroll-November' };
    confirm.flush({ data: reconciled });
    refresh(reconciled);
    expect(button('Reconcile')).toBeUndefined();
    expect(harness.routeNativeElement?.textContent).toContain('40,05 Kz');
    http.verify();
  });
});
