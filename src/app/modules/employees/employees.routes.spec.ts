import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ResolveStart, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';
import { routes } from '../../app.routes';
import { AuthSessionStore } from '../auth/application/auth-session.store';
import { previewEmployeeRows, previewEmployees } from './domain/employee-registration';
import { readEmployeeWorkbook } from './domain/employee-workbook';

describe('Employee administration', () => {
  const employeeId = '56d7fe07-a502-4daf-989e-f2548a8ab791';
  const endpoint = '/api/v1/company/employees';
  let http: HttpTestingController;

  async function open(path: string, permissions: string[]) {
    const claims = btoa(JSON.stringify({ sub: '9', sessionId: '4', roles: ['SUPER_ADMIN'], permissions: ['employees.read'],
      exp: 4102444800, type: 'access' }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature' });
    const harness = await RouterTestingHarness.create();
    const resolving = firstValueFrom(TestBed.inject(Router).events.pipe(filter(event => event instanceof ResolveStart)));
    const navigation = harness.navigateByUrl('/employees/18/' + path);
    await resolving;
    const context = http.expectOne('/api/v1/company/context');
    expect(context.request.headers.get('X-Company-Id')).toBe('18');
    context.flush({ data: { company: { id: 18, name: 'Test company', status: 'ACTIVE' }, permissions } });
    await navigation;
    return harness;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('loads the active directory in the company scope', async () => {
    const harness = await open('active', ['employees.read']);
    const list = http.expectOne(request => request.url === endpoint);
    expect(list.request.headers.get('X-Company-Id')).toBe('18');
    expect(list.request.params.get('status')).toBe('ACTIVE');
    list.flush({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('No employees found.');
  });

  it('does not fetch a bank account based on the platform role or token permissions', async () => {
    const harness = await open('details/' + employeeId + '/bank', ['employees.read']);
    http.expectNone(request => request.url.startsWith(endpoint));
    expect(harness.routeNativeElement?.textContent).toContain('This section requires employee permissions');
  });

  it('filters documents by the employee and sends the company scope', async () => {
    const harness = await open('details/' + employeeId + '/documents', ['employees.read', 'documents:read', 'documents:read-sensitive']);
    http.expectOne(endpoint + '/' + employeeId).flush({ data: {
      id: employeeId, companyId: 18, employeeNumber: 'EMP001', firstName: 'Ana', lastName: 'Silva', status: 'ACTIVE',
    } });
    const documents = http.expectOne(request => request.url === '/api/v1/documents');
    expect(documents.request.params.get('employeeId')).toBe(employeeId);
    expect(documents.request.headers.get('X-Company-Id')).toBe('18');
    documents.flush({ data: [] });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('No documents on this page.');
  });

  it('previews valid CSV rows and reports duplicate employee numbers and invalid dates', () => {
    const result = previewEmployees(
      'employeeNumber;firstName;lastName;admissionDate\n1;"Ana; Maria";Silva;2026-11-25\n1;João;Silva;2026-11-25\n2;João;Silva;2026-02-30',
    );
    expect(result.employees[0].firstName).toBe('Ana; Maria');
    expect(result.errors.map(error => error.record)).toEqual([2, 3]);
  });

  it('reads a compressed XLSX worksheet and converts Excel admission dates', async () => {
    // Workbook with one data row and an Excel serial date in D2.
    const fixture = 'UEsDBBQAAAAIAHNReV1ehBxVmwAAAOcAAAAPAAAAeGwvd29ya2Jvb2sueG1sjI8xDoMwEAS/Yt0DMKRIgTBVUvAMBx+xhc9n+RyF/D4ShD7VSiPtrHZ4c1kfzKvaKCYx4GvNvdYyeyQrDWdMG8WFC9kqDZenllzQOvGIlaK+tO1Vkw0JDkNf/nHwsoQZbzy/CFM9JAWjrYGT+JAFxmFfkF+qZAkN3ClH/iAKqB1PzkAHqvTBGSiT60CPgz6b+jw3fgEAAP//AwBQSwMEFAAAAAgAc1F5XYQ1WxXkAAAAGwIAABgAAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWx00ttqwzAMBuBXCb5flaTbYMMxtMsuVwZ9Ai1VFzMfgqUl3duPlBHKiO+MrU/oR9ZTTF/cE0lx8S5wo3qR4RmAu5488iYOFC7enWPyKLyJ6RN4SISnK/IO6rJ8BI82KKOvdy0KGp3iVKRGVcrobj7sKlVIo2xwNtBRkjLastFiyA8u/hAdvv0HJQ1iNMwv0P3JfU6ebWI5oKcV9JJDDrOmzRk8ectsY2hR/kFIcVrC1kvYOtPp9e39riyrtZQ5sgu4li9XfrRuXAPtPNxo7h/qp62G8XZ6uFkbLP/B/AIAAP//AwBQSwMEFAAAAAgAc1F5XRLFBTt6AAAAnAAAABoAAAB4bC9fcmVscy93b3JrYm9vay54bWwucmVsc1TOPQrDMAxA4asYHSBKOnQotvespRcQiWqH+A9LUB+/0Cmd3vbx7JMT6VGLxKOJGTkVcRBV2wNRtsiZZKqNy8jpXXsmlan2gI22kwLjbZ7v2K8GeHs1zbo76Ou+gHlRD6wOPrWfEplV8JdlGjkBeot/M/4LAAD//wMAUEsBAhQAFAAAAAgAc1F5XV6EHFWbAAAA5wAAAA8AAAAAAAAAAAAAAAAAAAAAAHhsL3dvcmtib29rLnhtbFBLAQIUABQAAAAIAHNReV2ENVsV5AAAABsCAAAYAAAAAAAAAAAAAAAAAMgAAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWxQSwECFAAUAAAACABzUXldEsUFO3oAAACcAAAAGgAAAAAAAAAAAAAAAADiAQAAeGwvX3JlbHMvd29ya2Jvb2sueG1sLnJlbHNQSwUGAAAAAAMAAwDLAAAAlAIAAAAA';
    const data = Uint8Array.from(atob(fixture), item => item.charCodeAt(0));
    const preview = previewEmployeeRows(await readEmployeeWorkbook(data.buffer));
    expect(preview.errors).toEqual([]);
    expect(preview.employees[0]).toEqual(jasmine.objectContaining({
      employeeNumber: 'EMP-001', firstName: 'Ana', lastName: 'Silva', admissionDate: '2024-01-02',
    }));
  });

  it('does not fetch fiscal data without the company fiscal permission', async () => {
    const harness = await open('details/' + employeeId + '/tax', ['employees.read', 'employees.personal.read']);
    http.expectNone(request => request.url.startsWith(endpoint));
    expect(harness.routeNativeElement?.textContent).toContain('This section requires employee permissions');
  });
});
