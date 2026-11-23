import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { DOCUMENT, NgClass, NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink } from '@angular/router';
import { combineLatest, filter, map, startWith } from 'rxjs';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { AuthService } from '../../../core/auth/auth.service';
import { SidebarService } from '../../../core/services/sidebar.service';
import { SafeHtmlPipe } from '../../../shared/pipe/safe-html.pipe';
import { SIDEBAR_MODULES, SidebarLink, SidebarModule } from '../../../navigation/sidebar-navigation';
import { moveVisible, ordered } from './sidebar-order';

type Preferences = Record<string, string[]>;
interface SidebarLocation { segments: string[]; fragment: string | null; context?: CompanyWorkspace }
interface MenuGroup { title: string; key: string; links: SidebarLink[] }
const MODULE_ORDER = 'modules';

function activeLocation(root: ActivatedRouteSnapshot): SidebarLocation {
  const segments: string[] = [];
  let context: CompanyWorkspace | undefined;
  for (let route: ActivatedRouteSnapshot | null = root; route; route = route.firstChild) {
    segments.push(...route.url.map(segment => segment.path));
    const company = route.data['access']?.context as CompanyWorkspace | undefined;
    if (company?.company.status === 'ACTIVE') context = company;
  }
  return { segments, context, fragment: root.fragment };
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [NgClass, NgTemplateOutlet, RouterLink, SafeHtmlPipe, CdkDropList, CdkDrag, CdkDragHandle, CdkScrollable],
  templateUrl: './app-sidebar.component.html',
  styleUrl: './app-sidebar.component.css',
})
export class AppSidebarComponent {
  protected readonly sidebar = inject(SidebarService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly location = toSignal(this.router.events.pipe(
    filter(event => event instanceof NavigationEnd),
    startWith(null),
    map(() => activeLocation(this.router.routerState.snapshot.root)),
  ), { requireSync: true });
  protected readonly width = toSignal(combineLatest([this.sidebar.isExpanded$, this.sidebar.isMobileOpen$, this.sidebar.isHovered$]).pipe(
    map(([expanded, mobile, hovered]) => ({ expanded, mobile, wide: expanded || mobile || hovered })),
  ), { requireSync: true });
  protected readonly company = computed(() => this.location().context?.company);
  protected readonly current = computed(() => this.location().segments[0]);
  protected readonly unfolded = signal<string | undefined>(undefined);
  protected readonly announcement = signal('');
  protected readonly dragDelay = { mouse: 0, touch: 180 };

  private readonly changes = signal<{ key: string; value: Preferences } | null>(null);
  private readonly preferenceKey = computed(() => {
    const user = this.auth.claims()?.sub;
    return user ? 'prontoequipas.sidebar.' + user : undefined;
  });
  private readonly preferences = computed(() => {
    const key = this.preferenceKey();
    const change = this.changes();
    return key && change?.key === key ? change.value : key ? this.loadOrder(key) : {};
  });
  private readonly sortedModules = computed(() => ordered(SIDEBAR_MODULES, this.preferences()[MODULE_ORDER], item => item.id));
  protected readonly modules = computed(() => this.sortedModules().filter(item =>
    (!item.platformOnly || this.auth.isPlatformAdmin()) &&
    (!item.platformPermission || this.auth.claims()?.permissions.includes(item.platformPermission)) &&
    (!item.visibleTo || item.visibleTo(this.auth.claims()?.permissions ?? []))));
  protected readonly groups = computed(() => {
    const nav = SIDEBAR_MODULES.find(item => item.id === this.unfolded());
    if (!nav) return [];
    const groups = new Map<string, SidebarLink[]>();
    for (const link of nav.links) {
      const group = link.group ?? '';
      const items = groups.get(group) ?? [];
      items.push(link);
      groups.set(group, items);
    }
    const permissions = nav.tenant ? this.location().context?.permissions : this.auth.claims()?.permissions;
    return [...groups].map(([title, links]): MenuGroup => {
      const key = nav.id + '/' + title;
      return { title, key, links: ordered(links, this.preferences()[key], item => this.linkId(item))
        .filter(link => !permissions || !link.requires || link.requires(permissions)) };
    }).filter(group => group.links.length);
  });

  constructor() {
    effect(() => this.unfolded.set(this.location().segments[0]));
  }

  protected toggle(id: string) {
    if (!this.width().wide) {
      this.sidebar.setExpanded(true);
      this.unfolded.set(id);
      return;
    }
    this.unfolded.update(open => open === id ? undefined : id);
  }

  protected hover() {
    if (!this.width().expanded) this.sidebar.setHovered(true);
  }

  protected closeMobile() {
    if (this.width().mobile) this.sidebar.setMobileOpen(false);
  }

  protected linkId(link: SidebarLink) { return link.id + (link.fragment ? '#' + link.fragment : ''); }

  protected destination(nav: SidebarModule, link: SidebarLink) {
    const path: (string | number)[] = ['/' + nav.id];
    const company = this.company();
    if (nav.tenant && !company) return path;
    if (nav.tenant && company) path.push(company.id);
    if (link.id) path.push(link.id);
    return path;
  }

  protected query(nav: SidebarModule, link: SidebarLink) {
    return nav.tenant && !this.company() && link.id ? { section: link.id } : undefined;
  }

  protected active(nav: SidebarModule, link: SidebarLink) {
    const { segments, fragment } = this.location();
    if (segments[0] !== nav.id) return false;
    if (!nav.tenant) return (segments[1] ?? '') === link.id && (!link.fragment ? !fragment : link.fragment === fragment);
    if (!segments[1]) return false;
    let section = segments[2] ?? '';
    if (nav.id === 'contracts' && section === 'details') section = 'all';
    if (nav.id === 'contracts' && section === 'dashboard') section = '';
    if ((nav.id === 'organization' || nav.id === 'leave') && section === 'overview') section = '';
    return section === link.id;
  }

  protected dropModules(event: CdkDragDrop<SidebarModule[]>) {
    if (event.isPointerOverContainer) this.moveModule(event.previousIndex, event.currentIndex);
  }

  protected dropLinks(event: CdkDragDrop<SidebarLink[]>, nav: SidebarModule, group: MenuGroup) {
    if (event.isPointerOverContainer) this.moveLink(nav, group, event.previousIndex, event.currentIndex);
  }

  protected keyModule(event: Event, index: number, delta: number) {
    event.preventDefault();
    this.moveModule(index, index + delta);
    this.keepFocus(event);
  }

  protected keyLink(event: Event, nav: SidebarModule, group: MenuGroup, index: number, delta: number) {
    event.preventDefault();
    this.moveLink(nav, group, index, index + delta);
    this.keepFocus(event);
  }

  private keepFocus(event: Event) {
    const handle = event.currentTarget as HTMLElement | null;
    this.document.defaultView?.requestAnimationFrame(() => handle?.focus({ preventScroll: true }));
  }

  private moveModule(from: number, to: number) {
    const visible = this.modules();
    this.reorder(MODULE_ORDER, this.sortedModules().map(item => item.id), visible.map(item => item.id), from, to, visible[from]?.title);
  }

  private moveLink(nav: SidebarModule, group: MenuGroup, from: number, to: number) {
    const complete = ordered(nav.links.filter(link => (link.group ?? '') === group.title), this.preferences()[group.key], item => this.linkId(item));
    this.reorder(group.key, complete.map(item => this.linkId(item)), group.links.map(item => this.linkId(item)), from, to, group.links[from]?.title);
  }

  private reorder(key: string, complete: string[], visible: string[], from: number, to: number, title?: string) {
    const userKey = this.preferenceKey();
    const updated = moveVisible(complete, visible, from, to);
    if (!userKey || updated === complete) return;
    const value = { ...this.preferences(), [key]: updated };
    this.changes.set({ key: userKey, value });
    this.announcement.set(title + ' moved to position ' + (to + 1) + ' of ' + visible.length + '.');
    try { this.document.defaultView?.localStorage.setItem(userKey, JSON.stringify(value)); } catch { /* session order remains available */ }
  }

  private loadOrder(key: string): Preferences {
    try {
      const parsed: unknown = JSON.parse(this.document.defaultView?.localStorage.getItem(key) ?? '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return Object.fromEntries(Object.entries(parsed).filter(([, value]) =>
        Array.isArray(value) && value.every((entry: unknown) => typeof entry === 'string')));
    } catch { return {}; }
  }
}
