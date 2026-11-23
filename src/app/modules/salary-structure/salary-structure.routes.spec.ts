import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ResolveStart, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';
import { routes } from '../../app.routes';
import { AuthSessionStore } from '../auth/application/auth-session.store';

describe('Company salary workflow', () => {
  const id = 'db42f487-c606-4926-af02-22ad9d75f984';
  const employee = 'e6c78de7-9dce-45de-b822-1071ac318af3';
  const assignmentId = '36a651cb-8db4-4f6d-9c61-fabb174eb782';
  const structure = 'ad37c70c-d6a1-42a3-94df-da34a601e7a2';
  const base = '/api/v1/salary-structure/';
  const revision = {
    id, employeeId: employee, previousAssignmentId: assignmentId, effectiveFrom: '2026-12-01',
    status: 'PENDING_APPROVAL', reason: 'Contract amendment', requestedBy: 5, createdAt: '2026-11-18T08:00:00Z',
    proposedData: { baseSalary: '120000.95', currency: 'AOA', components: [], structureVersionId: structure },
    previousAssignment: { id: assignmentId, baseSalary: '120000.01', currency: 'AOA', structureVersionId: structure },
    impact: { snapshotsToReview: 0 },
  };

  beforeEach(() => TestBed.configureTestingModule({
    providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
  }));

  async function open(path: string, permissions: string[], actor = 5, roles: string[] = []) {
    const claims = btoa(JSON.stringify({
      sub: String(actor), sessionId: '3', roles, permissions: ['salary-structure:assignments:read'],
      exp: 4102444800, type: 'access',
    }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature', refreshToken: 'refresh' });
    const http = TestBed.inject(HttpTestingController);
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);
    const resolving = firstValueFrom(router.events.pipe(filter(event => event instanceof ResolveStart)));
    const navigation = harness.navigateByUrl('/salary-structure/23/' + path);
    await resolving;
    const scope = http.expectOne('/api/v1/company/context');
    expect(scope.request.headers.get('X-Company-Id')).toBe('23');
    scope.flush({ data: { company: { id: 23, name: 'Sample company', status: 'ACTIVE' }, permissions } });
    await navigation;
    const button = (label: string) => [...harness.routeNativeElement!.querySelectorAll('button')]
      .find(item => item.textContent.trim() === label);
    return { harness, http, button };
  }

  it('protects individual salary reads even with a platform administrator claim', async () => {
    const { harness, http } = await open('assignments/' + id, ['salary-structure:read'], 5, ['SUPER_ADMIN']);
    expect(harness.routeNativeElement?.textContent).toContain('Your company permissions do not include access');
    http.expectNone(request => request.url.startsWith(base));
    http.verify();
  });

  it('shows an exact comparison but hides decisions from the requester', async () => {
    const { harness, http, button } = await open('revisions/' + id, ['salary-structure:revisions:read', 'salary-structure:revisions:approve']);
    const read = http.expectOne(base + 'revisions/' + id);
    expect(read.request.headers.get('X-Company-Id')).toBe('23');
    read.flush({ data: revision });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('0,94 Kz');
    expect(harness.routeNativeElement?.textContent).toContain('Another authorized user');
    expect(button('Approve revision')).toBeUndefined();
    http.verify();
  });

  it('confirms application of an approved revision with a stable retry key', async () => {
    const { harness, http, button } = await open('revisions/' + id, ['salary-structure:revisions:read', 'salary-structure:revisions:apply'], 6);
    const url = base + 'revisions/' + id;
    http.expectOne(url).flush({ data: { ...revision, status: 'APPROVED' } });
    harness.detectChanges();
    button('Apply revision')!.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    const form = harness.routeNativeElement!.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    http.expectNone(url + '/apply');
    form.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    harness.detectChanges();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const apply = http.expectOne(url + '/apply');
    expect(apply.request.headers.get('X-Company-Id')).toBe('23');
    expect(apply.request.body.idempotencyKey).toBe('admin-apply:' + id);
    apply.flush({ data: { id: assignmentId } });
    http.expectOne(url).flush({ data: { ...revision, status: 'APPLIED', appliedAssignmentId: assignmentId } });
    harness.detectChanges();
    expect(button('Apply revision')).toBeUndefined();
    http.verify();
  });

  it('opens history without resolving or writing a payroll snapshot', async () => {
    const { harness, http } = await open('history?employee=' + employee, ['salary-structure:history:read']);
    const history = http.expectOne(base + 'employees/' + employee + '/history');
    expect(history.request.headers.get('X-Company-Id')).toBe('23');
    history.flush({ data: { assignments: [], components: [] } });
    harness.detectChanges();
    http.expectNone(request => request.url.endsWith('/snapshot') || request.url.endsWith('/current'));
    expect(harness.routeNativeElement?.textContent).toContain('No assignments recorded.');
    http.verify();
  });

  it('keeps individual-pay reports out of a catalog reporting role', async () => {
    const { harness, http } = await open('reports', ['salary-structure:reports:read', 'salary-structure:export']);
    const catalog = http.expectOne(request => request.url === base + 'reports/components');
    catalog.flush({ data: { data: [], total: 0, page: 1, limit: 20 } });
    harness.detectChanges();
    const reportOptions = Array.from(harness.routeNativeElement!.querySelectorAll('select[name="report"] option'))
      .map(option => option.textContent.trim());
    expect(reportOptions).toEqual(['Component catalog', 'Structure catalog']);
    http.expectNone(request => request.url === base + 'reports/revisions' || request.url === base + 'assignments');
    http.verify();
  });
});
