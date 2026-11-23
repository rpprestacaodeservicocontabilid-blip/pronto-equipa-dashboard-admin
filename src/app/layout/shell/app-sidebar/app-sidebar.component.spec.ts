import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, ResolveStart, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';
import { routes } from '../../../app.routes';
import { SidebarService } from '../../../core/services/sidebar.service';
import { AuthSessionStore } from '../../../modules/auth/application/auth-session.store';
import { moveVisible } from './sidebar-order';

describe('Sidebar module navigation', () => {
  const storageKey = 'prontoequipas.sidebar.92081';
  const claims = btoa(JSON.stringify({
    sub: '92081', sessionId: '3', roles: [], permissions: [], exp: 4102444800, type: 'access',
  }));

  beforeEach(() => {
    localStorage.removeItem(storageKey);
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature', refreshToken: 'refresh' });
  });
  afterEach(() => localStorage.removeItem(storageKey));

  it('keeps hidden menu positions when reordering the available items', () => {
    expect(moveVisible(['a', 'hidden', 'b', 'c'], ['a', 'b', 'c'], 2, 0)).toEqual(['c', 'hidden', 'a', 'b']);
  });

  it('carries a subsection through company selection and saves keyboard reordering', async () => {
    const harness = await RouterTestingHarness.create();
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    await harness.navigateByUrl('/salary-structure');
    http.expectOne('/api/v1/companies').flush({ data: [{ id: 18, name: 'Example Company', status: 'ACTIVE' }] });
    harness.detectChanges();
    const nav = harness.routeNativeElement!.querySelector('nav[aria-label="Main navigation"]')!;
    const modules = () => Array.from(nav.querySelectorAll(':scope > ul > li > div > button[aria-expanded]'))
      .map(button => button.getAttribute('aria-label'));
    expect(modules().slice(0, 2)).toEqual(['Contracts', 'Organization']);
    const handle = nav.querySelector<HTMLButtonElement>('button[aria-label="Reorder Organization"]')!;
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    harness.detectChanges();
    expect(modules().slice(0, 2)).toEqual(['Organization', 'Contracts']);
    expect(JSON.parse(localStorage.getItem(storageKey)!).modules).toContain('organization');
    const reports = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a')).find(link => link.textContent.trim() === 'Reports')!;
    expect(reports.getAttribute('href')).toBe('/salary-structure?section=reports');
    const selected = firstValueFrom(router.events.pipe(filter(event => event instanceof NavigationEnd)));
    reports.click();
    await selected;
    harness.detectChanges();
    const companyLink = harness.routeNativeElement!.querySelector('a[href="/salary-structure/18/reports"]');
    expect(companyLink?.textContent).toContain('Example Company');
    http.verify();
  });

  it('opens the active submenu and filters links by the company permissions', async () => {
    const harness = await RouterTestingHarness.create();
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const resolving = firstValueFrom(router.events.pipe(filter(event => event instanceof ResolveStart)));
    const navigation = harness.navigateByUrl('/contracts/18');
    await resolving;
    http.expectOne('/api/v1/company/context').flush({ data: {
      company: { id: 18, name: 'Example Company', status: 'ACTIVE' },
      permissions: ['contracts.read', 'salary-structure:reports:read'],
    } });
    await navigation;
    http.expectOne(request => request.url === '/api/v1/contracts').flush({ data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } });
    http.expectOne('/api/v1/contracts/types').flush({ data: [] });
    harness.detectChanges();
    const nav = harness.routeNativeElement!.querySelector('nav[aria-label="Main navigation"]')!;
    expect(nav.querySelector('button[aria-label="Contracts"]')?.getAttribute('aria-expanded')).toBe('true');
    expect(nav.querySelector('a[href="/contracts/18"][aria-current="page"]')).not.toBeNull();
    expect(nav.querySelector('a[href="/contracts/18/new"]')).toBeNull();
    TestBed.inject(SidebarService).setMobileOpen(true);
    nav.querySelector<HTMLButtonElement>('button[aria-label="Salary structure"]')!.click();
    harness.detectChanges();
    expect(nav.querySelector('a[href="/salary-structure/18/reports"]')).not.toBeNull();
    expect(nav.querySelector('a[href="/salary-structure/18/assignments"]')).toBeNull();
    http.verify();
  });

  it('reorders a nested menu with a pointer without moving the parent module', async () => {
    TestBed.inject(SidebarService).setMobileOpen(true);
    const harness = await RouterTestingHarness.create();
    const http = TestBed.inject(HttpTestingController);
    await harness.navigateByUrl('/contracts');
    http.expectOne('/api/v1/companies').flush({ data: [] });
    harness.detectChanges();
    const nav = harness.routeNativeElement!.querySelector('nav[aria-label="Main navigation"]')!;
    const submenu = nav.querySelector('#sidebar-module-contracts')!;
    const source = submenu.querySelector<HTMLButtonElement>('button[aria-label="Reorder All contracts"]')!;
    const destination = submenu.querySelector<HTMLButtonElement>('button[aria-label="Reorder Overview"]')!;
    const start = source.getBoundingClientRect();
    const target = destination.getBoundingClientRect();
    const x = Math.round(start.left + start.width / 2);
    const y = Math.round(start.top + start.height / 2);
    const end = Math.round(target.top + 4);
    const mouse = (event: string, point: number) => new MouseEvent(event, {
      bubbles: true, cancelable: true, detail: 1, button: 0, buttons: event === 'mouseup' ? 0 : 1,
      clientX: x, clientY: point, screenX: x + 100, screenY: point + 100,
    });
    source.dispatchEvent(mouse('mousedown', y));
    document.dispatchEvent(mouse('mousemove', y - 8));
    expect(document.querySelector('.cdk-drag-preview')).not.toBeNull();
    document.dispatchEvent(mouse('mousemove', end));
    document.dispatchEvent(mouse('mouseup', end));
    await new Promise(resolve => setTimeout(resolve, 300));
    harness.detectChanges();
    expect(submenu.querySelector('ul a')?.textContent.trim()).toBe('All contracts');
    expect(nav.querySelector(':scope > ul > li > div > button')?.getAttribute('aria-label')).toBe('Contracts');
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    expect(saved['contracts/']?.slice(0, 2)).toEqual(['all', '']);
    http.verify();
  });
});
