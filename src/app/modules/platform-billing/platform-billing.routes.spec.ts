import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AUTH_STORAGE_KEY, AuthSessionStore } from '../auth/application/auth-session.store';
import { actionsFor, actionBody, mainActions } from './domain/billing-actions';
import { BillingRecord } from './domain/billing.models';

describe('Platform billing', () => {
  const api = '/api/v1/platform-billing/admin';
  const id = 'b7911a00-4567-42a9-91ad-000000000001';
  const record: BillingRecord = { id, companyId: 14, companyName: 'Example Company', kind: 'PAYMENT', key: 'bank:sample',
    status: 'PENDING', createdAt: '2026-11-20T00:00:00.000Z', updatedAt: '2026-11-20T00:00:00.000Z',
    data: { requestedBy: 2, amount: '10.00', currency: 'AOA', provider: 'Bank' } };
  let http: HttpTestingController;

  function signIn(roles: string[], permissions: string[] = []) {
    const payload = btoa(JSON.stringify({ sub: '2', sessionId: '54', roles, permissions, exp: 4102444800, type: 'access' }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + payload + '.signature' });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    localStorage.removeItem(AUTH_STORAGE_KEY);
  });

  it('denies platform records to tenant administrators', async () => {
    signIn(['ADMIN']);
    const harness = await RouterTestingHarness.create('/platform-billing/invoices');
    expect(TestBed.inject(Router).url).toBe('/access-denied?area=platform-billing&returnUrl=%2Fplatform-billing%2Finvoices');
    expect(harness.routeNativeElement?.textContent).toContain('Platform billing access required');
    http.expectNone(request => request.url.startsWith(api));
  });

  it('loads the platform overview and exposes the reorderable billing navigation', async () => {
    signIn(['SUPER_ADMIN']);
    const harness = await RouterTestingHarness.create('/platform-billing');
    await harness.fixture.whenStable();
    const overview = http.expectOne(api + '/overview');
    expect(overview.request.headers.has('X-Company-Id')).toBeFalse();
    overview.flush({ data: { months: [], totals: [], invoiceStatuses: {}, providers: [],
      alerts: { overdue: 7, pendingPayments: 0, failedEvents: 0, unmatched: 0 } } });
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/platform-billing/overview');
    expect(harness.routeNativeElement?.textContent).toContain('Overdue invoices');
    expect(harness.routeNativeElement?.querySelector('#sidebar-module-platform-billing a[href="/platform-billing/series"]')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('button[aria-label="Reorder Invoices"]')).not.toBeNull();
  });

  it('carries company and document filters to the administrative directory', async () => {
    signIn(['SUPER_ADMIN']);
    const harness = await RouterTestingHarness.create('/platform-billing/debit-notes?companyId=14&status=ISSUED');
    await harness.fixture.whenStable();
    const list = http.expectOne(request => request.url === api + '/records/INVOICE');
    expect(list.request.params.get('companyId')).toBe('14');
    expect(list.request.params.get('status')).toBe('ISSUED');
    expect(list.request.params.get('debit')).toBe('true');
    list.flush({ data: { items: [], next: null } });
  });

  it('shows payment confirmation only to another operator and requires evidence', () => {
    expect(actionsFor(record, '2')).toEqual([]);
    const [confirm] = actionsFor(record, '3');
    expect(confirm.path(record)).toBe('payments/' + id + '/confirm');
    expect(() => actionBody(confirm, { evidence: ' ' }, [], '', record)).toThrow();
    expect(actionBody(confirm, { evidence: 'Validated bank record #91' }, [], '', record)).toEqual({ evidence: 'Validated bank record #91' });
  });

  it('keeps statement imports structured and carries the operation key', () => {
    const body = actionBody(mainActions['statements'], { entries: 'REF-91,120.00,AOA,2026-11-20' }, [], 'operation-1');
    expect(body).toEqual({ operationKey: 'operation-1', entries: [
      { reference: 'REF-91', amount: '120.00', currency: 'AOA', occurredAt: '2026-11-19T23:00:00.000Z' },
    ] });
  });

  it('opens billing for a delegated payments reader and limits the menu and operations', async () => {
    signIn([], ['platform-billing:payments:read']);
    const harness = await RouterTestingHarness.create('/platform-billing');
    await harness.fixture.whenStable();
    http.expectOne(request => request.url === api + '/records/PAYMENT').flush({ data: { items: [], next: null } });
    harness.detectChanges();
    const view = harness.routeNativeElement!;
    expect(TestBed.inject(Router).url).toBe('/platform-billing/payments');
    expect(view.querySelector('button[aria-label="Reorder Payment allocations"]')).not.toBeNull();
    expect(view.querySelector('#sidebar-module-platform-billing a[href="/platform-billing/audit"]')).toBeNull();
    expect(view.textContent).not.toContain('Register unallocated receipt');
    await harness.navigateByUrl('/platform-billing/pending-payments');
    await harness.fixture.whenStable();
    const pending = http.expectOne(request => request.url === api + '/records/PAYMENT');
    expect(pending.request.params.get('status')).toBe('PENDING');
    pending.flush({ data: { items: [], next: null } });
    await harness.navigateByUrl('/platform-billing/audit');
    expect(TestBed.inject(Router).url).toContain('/access-denied');
    http.expectNone(request => request.url === api + '/records/AUDIT');
  });

  it('sends a separate, idempotent allocation for an available confirmed receipt', () => {
    const receipt = { ...record, status: 'CONFIRMED', data: { ...record.data, availableToAllocate: '10.00' } };
    const action = actionsFor(receipt, '2').find(item => item.id === 'allocate')!;
    expect(action.path(receipt)).toBe('payments/' + id + '/allocations');
    expect(action.permission).toBe('payments:allocate');
    const invoiceId = '7043ab07-5de6-43a1-9ac0-0b45170cdf20';
    expect(actionBody(action, { invoiceId, amount: '8.25' }, [], 'allocation-key', receipt)).toEqual({
      invoiceId, amount: '8.25', operationKey: 'allocation-key',
    });
  });
});
