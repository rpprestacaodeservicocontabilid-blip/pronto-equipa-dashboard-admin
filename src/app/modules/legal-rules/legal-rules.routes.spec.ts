import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AuthSessionStore } from '../auth/application/auth-session.store';
import { LegalDraft } from './domain/legal-draft';
import { LegalVersion } from './domain/legal.models';

describe('Platform legal rules', () => {
  const root = '/api/v1/legal-rules';
  const versionId = 'e9dbab00-5466-4616-aa78-639ff59f8762';
  const proposalId = '56fd850d-1901-4613-a9ae-62053a1fccc2';
  const updatedAt = '2026-11-19T10:00:00.000Z';
  const record: LegalVersion = {
    id: versionId, jurisdiction: 'AO', companyId: null, ruleSetId: 'Fixture', version: '1', effectiveFrom: '2026-11-01',
    effectiveTo: null, createdBy: 2, sourceReference: 'Fixture legislation', evidenceReference: 'Fixture review',
    createdAt: updatedAt, updatedAt, status: 'IN_REVIEW', submittedBy: 2, integrityHash: null,
    rules: {
      roundingPolicy: { mode: 'HALF_EVEN', scale: 2 }, laborRules: { prorationBasis: 'CALENDAR_DAYS' },
      incomeTaxRules: { calculation: 'PROGRESSIVE', brackets: [{ from: '0', rate: '0' }] },
      socialSecurityRules: { employeeRate: '0', employerRate: '0' }, deductionRules: {},
    },
  };
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function signIn(permissions: string[], sub = '5') {
    const state = btoa(JSON.stringify({ sub, sessionId: '1', roles: ['ADMIN'], permissions, exp: 4102444800, type: 'access' }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'token.' + state + '.signature', refreshToken: 'refresh' });
  }
  function list(items: LegalVersion[] = []) { return { data: { items, page: 1, limit: 100, total: items.length } }; }
  async function render(harness: RouterTestingHarness) {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }
  function button(harness: RouterTestingHarness, name: string) {
    return [...harness.routeNativeElement!.querySelectorAll('button')].find(item => item.textContent.trim() === name);
  }

  it('hides the entry and blocks direct navigation for a company-only administrator', async () => {
    signIn(['payroll:read']);
    const harness = await RouterTestingHarness.create('/legal-rules/overview');
      expect(TestBed.inject(Router).url).toBe('/access-denied?area=legal-rules&returnUrl=%2Flegal-rules%2Foverview');
    expect(harness.routeNativeElement?.querySelector('button[aria-label="Legal rules"]')).toBeNull();
    http.expectNone(request => request.url.startsWith(root));
  });

  it('opens the grouped and reorderable menu for delegated platform readers', async () => {
    signIn(['legal-rules:read']);
    const harness = await RouterTestingHarness.create('/legal-rules/overview');
    await render(harness);
    const versions = http.expectOne(request => request.url === root);
    expect(versions.request.headers.has('X-Company-Id')).toBeFalse();
    versions.flush(list([record]));
    http.expectOne(request => request.url === root + '/sources').flush({ data: { items: [], page: 1, limit: 1, total: 7 } });
    await render(harness);
    const sidebar = harness.routeNativeElement!.querySelector('#sidebar-module-legal-rules')!;
    expect(sidebar.querySelector('a[href="/legal-rules/overview"]')?.getAttribute('aria-current')).toBe('page');
    expect(sidebar.querySelector('button[aria-label="Reorder Approvals"]')).not.toBeNull();
    expect(sidebar.querySelector('a[href="/legal-rules/audit"]')).toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('Legal instruments');
  });

  it('requires a different reviewer and sends an explicit, version-checked rejection', async () => {
    signIn(['legal-rules:read', 'legal-rules:approve']);
    const harness = await RouterTestingHarness.create('/legal-rules/rule-sets/' + versionId);
    await render(harness);
    http.expectOne(root + '/' + versionId).flush({ data: record });
    http.expectOne(request => request.url === root + '/sources').flush(list());
    await render(harness);
    button(harness, 'Reject')!.click();
    await render(harness);
    expect(button(harness, 'Confirm reject')?.disabled).toBeTrue();
    const input = harness.routeNativeElement!.querySelector<HTMLTextAreaElement>('textarea[name="reason"]')!;
    input.value = 'Official reference needs review.';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await render(harness);
    button(harness, 'Confirm reject')!.click();
    const reject = http.expectOne(root + '/' + versionId + '/reject');
    expect(reject.request.body).toEqual({ expectedUpdatedAt: updatedAt, reason: input.value });
    reject.flush({ data: { ...record, status: 'REJECTED', rejectedAt: updatedAt, rejectedBy: 5, rejectionReason: input.value } });
    await render(harness);
    expect(harness.routeNativeElement?.textContent).toContain(input.value);
    expect(button(harness, 'Edit draft')).toBeUndefined();
  });

  it('prevents the author from approving their own version', async () => {
    signIn(['legal-rules:read', 'legal-rules:approve'], '2');
    const harness = await RouterTestingHarness.create('/legal-rules/rule-sets/' + versionId);
    await render(harness);
    http.expectOne(root + '/' + versionId).flush({ data: record });
    http.expectOne(request => request.url === root + '/sources').flush(list());
    await render(harness);
    expect(button(harness, 'Approve')).toBeUndefined();
    expect(button(harness, 'Reject')).toBeUndefined();
  });

  it('compares two versions through the platform impact endpoint with fictional inputs', async () => {
    signIn(['legal-rules:read']);
    const harness = await RouterTestingHarness.create('/legal-rules/impact');
    await render(harness);
    http.expectOne(request => request.url === root).flush(list([
      record, { ...record, id: proposalId, version: '2', effectiveFrom: '2026-12-01' },
    ]));
    await render(harness);
    function change(name: string, value: string, kind: 'select' | 'textarea') {
      const input = harness.routeNativeElement!.querySelector<HTMLInputElement>(kind + '[name="' + name + '"]')!;
      input.value = value;
      input.dispatchEvent(new Event(kind === 'select' ? 'change' : 'input', { bubbles: true }));
    }
    change('baseline', versionId, 'select');
    change('proposal', proposalId, 'select');
    change('salaries', '100000,50', 'textarea');
    await render(harness);
    button(harness, 'Run simulation')!.click();
    const request = http.expectOne(root + '/impact');
    expect(request.request.headers.has('X-Company-Id')).toBeFalse();
    expect(request.request.body).toEqual({
      baselineId: versionId, proposalId, baselineMonth: '2026-11', proposalMonth: '2026-12', salaries: ['100000.50'],
    });
    request.flush({ data: { engineVersion: '1.0.1', currency: 'AOA', rows: [] } });
    await render(harness);
    expect(harness.routeNativeElement?.textContent).toContain('Simulated impact');
  });

  it('validates contiguous brackets exactly and keeps official rate inputs blank for new drafts', () => {
    expect(new LegalDraft().input.rules.socialSecurityRules.employeeRate).toBe('');
    expect(LegalDraft.checkBrackets([
      { from: '0', to: '9007199254740999.01', rate: '0.01' },
      { from: '9007199254740999.02', rate: '0.02', to: null },
    ])).toContain('without gaps or overlaps');
  });
});
