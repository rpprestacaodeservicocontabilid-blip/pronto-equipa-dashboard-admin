import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AuthSessionStore } from '../auth/application/auth-session.store';
import { AuditPurpose } from './application/audit-purpose.service';
import { AUDIT_READ, auditGrant } from './domain/audit.navigation';

describe('Platform audit workspace', () => {
  let http: HttpTestingController;
  const purpose = 'Revisão – caso 23';
  const reasonHeader = 'utf8:' + encodeURIComponent(purpose);
  const auth = (permissions: string[]) => {
    const claims = btoa(JSON.stringify({
      sub: '9932', sessionId: '17', roles: ['SUPER_ADMIN'], permissions, exp: 4102444800, type: 'access',
    }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature' });
  };
  const record = {
    id: '80f89f2c-1067-41d4-868e-1f34b527f0c8', sequence: 12, eventType: 'audit.test',
    module: 'audit', severity: 'HIGH', outcome: 'SUCCESS', occurredAt: '2026-11-19T08:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('uses current permissions and requires a purpose before querying the audit trail', async () => {
    auth([AUDIT_READ]);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/audit/exports');
    expect(TestBed.inject(Router).url).toContain('/access-denied?area=audit');
    await harness.navigateByUrl('/audit/records');
    http.expectNone(request => request.url.includes('/admin/audit/'));
    const view = harness.routeNativeElement!;
    const input = view.querySelector<HTMLInputElement>('input[name="purpose"]')!;
    input.value = purpose;
    input.dispatchEvent(new Event('input'));
    harness.detectChanges();
    view.querySelector<HTMLButtonElement>('app-audit-purpose button[type="submit"]')!.click();
    const search = http.expectOne(request => request.url === '/api/v1/admin/audit/records');
    expect(search.request.headers.get('X-Audit-Purpose')).toBe(reasonHeader);
    expect(search.request.headers.has('X-Company-Id')).toBeFalse();
    search.flush({ data: { data: [record], throughSequence: 50, nextCursor: 12 } });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(view.querySelector('button[aria-label="Reorder All records"]')).not.toBeNull();
    expect(view.textContent).toContain('audit.test');
    Array.from(view.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.trim() === 'Next')!.click();
    const next = http.expectOne(request => request.url === '/api/v1/admin/audit/records');
    expect(next.request.params.get('cursor')).toBe('12');
    expect(next.request.params.get('throughSequence')).toBe('50');
    next.flush({ data: { data: [], throughSequence: 50, nextCursor: null } });
  });

  it('uses the tenant API for an explicitly selected company and limits export decisions to a second actor', async () => {
    auth([AUDIT_READ, auditGrant('exports:read'), auditGrant('exports:approve'), auditGrant('exports:reject')]);
    TestBed.inject(AuditPurpose).set(purpose);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/audit/companies');
    http.expectOne('/api/v1/companies').flush({ data: [{ id: 81, name: 'Empresa A', status: 'ACTIVE' }] });
    await harness.fixture.whenStable();
    harness.detectChanges();
    http.expectNone(request => request.url.endsWith('/audit/records'));
    const company = harness.routeNativeElement!.querySelector<HTMLSelectElement>('select[name="company"]')!;
    company.selectedIndex = 1;
    company.dispatchEvent(new Event('change'));
    const search = http.expectOne(request => request.url === '/api/v1/audit/records');
    expect(search.request.headers.get('X-Company-Id')).toBe('81');
    expect(search.request.headers.get('X-Audit-Purpose')).toBe(reasonHeader);
    search.flush({ data: { data: [], throughSequence: 0, nextCursor: null } });

    await harness.navigateByUrl('/audit/exports');
    const rows = [9932, 18].map(requesterId => ({
      id: 'export-' + requesterId, kind: 'EXPORT', key: '', status: 'PENDING_APPROVAL',
      data: { requesterId }, createdAt: record.occurredAt, updatedAt: record.occurredAt,
    }));
    http.expectOne(request => request.url === '/api/v1/admin/audit/exports').flush({ data: { items: rows, total: 2 } });
    await harness.fixture.whenStable();
    harness.detectChanges();
    const view = harness.routeNativeElement!;
    view.querySelector<HTMLButtonElement>('button[aria-label="View export-9932"]')!.click();
    harness.detectChanges();
    expect(view.textContent).not.toContain('Approve export');
    view.querySelector<HTMLButtonElement>('button[aria-label="View export-18"]')!.click();
    harness.detectChanges();
    expect(view.textContent).toContain('Approve export');
  });
});
