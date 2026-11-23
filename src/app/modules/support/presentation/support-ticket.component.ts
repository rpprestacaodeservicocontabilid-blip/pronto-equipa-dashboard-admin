import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { distinctUntilChanged, filter, firstValueFrom, map, startWith } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { SupportWorkspace } from '../application/support-workspace.service';
import { area, select, SupportAction, SupportField, text } from '../domain/support-forms';
import { priorities, progressOptions, SupportCompany, supportLabel, SupportMessage, SupportRow, SupportTicket, ticketCan, TicketStatus } from '../domain/support.models';
import { supportGrant } from '../domain/support.navigation';
import { SupportApi } from '../infrastructure/support-api.service';
import { SupportActionComponent } from './support-action.component';
import { SupportCompanyPickerComponent } from './support-company-picker.component';

@Component({
  selector: 'app-support-ticket',
  standalone: true,
  imports: [DatePipe, RouterLink, ComponentCardComponent, PageBreadcrumbComponent, SupportActionComponent, SupportCompanyPickerComponent],
  templateUrl: './support-ticket.component.html',
  styleUrl: './support.css',
})
export class SupportTicketComponent implements OnInit {
  private readonly api = inject(SupportApi);
  private readonly workspace = inject(SupportWorkspace);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private id = '';
  private version = 0;
  private get endpoint() { return 'tickets/' + encodeURIComponent(this.id); }
  protected readonly company = this.workspace.company;
  protected readonly ticket = signal<SupportTicket | null>(null);
  protected readonly notes = signal<SupportMessage[] | null>(null);
  protected readonly history = signal<SupportRow[] | null>(null);
  protected readonly macros = signal<SupportRow[]>([]);
  protected readonly command = signal<SupportAction | null>(null);
  protected readonly busy = signal(false);
  protected readonly writing = signal(false);
  protected readonly secondaryBusy = signal(false);
  protected readonly error = signal('');
  protected readonly actionError = signal('');
  protected readonly notice = signal('');
  protected readonly label = supportLabel;
  protected readonly transitions = computed(() => {
    const ticket = this.ticket();
    if (!ticket) return [];
    const result: SupportAction[] = [];
    const next = progressOptions(ticket.status);
    if (next.length) result.push(this.operation('Change status', 'status', 'tickets:update',
      [select('status', 'New status', next)]));
    for (const [state, title, path, grant] of [
      ['RESOLVED', 'Resolve', 'resolve', 'tickets:resolve'], ['CLOSED', 'Close ticket', 'close', 'tickets:close'],
      ['OPEN', 'Reopen', 'reopen', 'tickets:reopen'], ['CANCELLED', 'Cancel ticket', 'cancel', 'tickets:update'],
    ] as const) {
      if (ticketCan(ticket.status, state)) result.push(this.operation(title, path, grant,
        state === 'RESOLVED' ? [area('resolution', 'Resolution')] : [], 'Apply this action to ' + ticket.ticketNumber + '.'));
    }
    return result.filter(action => this.can(action.grant));
  });

  ngOnInit() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      startWith(null),
      map(() => ({ ticket: this.route.snapshot.paramMap.get('id') ?? '', company: Number(this.route.snapshot.queryParamMap.get('companyId')) })),
      distinctUntilChanged((before, after) => before.ticket === after.ticket && before.company === after.company),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ ticket, company }) => {
      this.id = ticket;
      if (Number.isSafeInteger(company) && company > 0 && company <= 2147483647 && this.company()?.id !== company)
        this.workspace.choose({ id: company, name: 'Company' });
      this.reset();
      if (this.company()) void this.load();
    });
  }
  protected can(code: string) { return this.auth.claims()?.permissions.includes(supportGrant(code)) ?? false; }
  protected editable(status: TicketStatus) { return status !== 'CANCELLED' && status !== 'CLOSED'; }
  protected choose(company: SupportCompany) {
    this.reset();
    this.workspace.choose(company);
    void this.router.navigate(['/support/tickets'], { queryParams: { companyId: company.id } });
  }

  private reset() {
    this.version++;
    this.ticket.set(null);
    this.notes.set(null);
    this.history.set(null);
    this.macros.set([]);
    this.command.set(null);
    this.error.set('');
    this.actionError.set('');
    this.notice.set('');
    this.busy.set(false);
  }

  protected async load() {
    const company = this.company();
    if (!company) return;
    const version = ++this.version;
    this.busy.set(true);
    this.error.set('');
    try {
      const ticket = await firstValueFrom(this.api.ticket(company.id, this.id));
      if (version === this.version) this.ticket.set(ticket);
    } catch (error) {
      if (version === this.version) { this.ticket.set(null); this.error.set(apiErrorMessage(error)); }
    } finally { if (version === this.version) this.busy.set(false); }
  }

  protected open(action: SupportAction) {
    this.actionError.set('');
    this.notice.set('');
    this.command.set(action);
  }

  protected edit(ticket: SupportTicket, kind: 'details' | 'priority' | 'escalate' | 'automatic') {
    if (kind === 'details') this.open({
      title: 'Edit ticket', path: this.endpoint, method: 'PATCH', grant: 'tickets:update',
      fields: [
        { ...text('subject', 'Subject', 3), initial: ticket.subject },
        { ...text('categoryCode', 'Category code', 2, 80), initial: ticket.categoryCode },
        { ...text('affectedModule', 'Affected module', 0, 80), initial: ticket.affectedModule },
      ],
    });
    if (kind === 'priority') this.open({ ...this.operation('Change priority', 'priority', 'tickets:update',
      [select('priority', 'Priority', priorities, ticket.priority)]), method: 'PATCH' });
    if (kind === 'escalate') this.open(this.operation('Escalate ticket', 'escalate', 'escalations:create', [area('reason', 'Reason', 3, 2000)]));
    if (kind === 'automatic') this.open({ ...this.operation('Assign automatically', 'assign', 'tickets:assign', [],
      'Assign this ticket to an available platform agent.'), constants: { automatic: true } });
  }

  protected async reply(internal: boolean) {
    const company = this.company();
    if (!company) return;
    const version = this.version;
    this.macros.set([]);
    this.open({ ...this.operation(internal ? 'Save internal note' : 'Send public reply', internal ? 'internal-notes' : 'messages',
      internal ? 'internal-notes:create' : 'messages:create', [area('body', internal ? 'Note' : 'Reply', 1, 12000)],
      internal ? 'Visible to authorized platform staff.' : 'Visible to authorized participants on this ticket.'),
      idempotent: true, constants: { visibility: internal ? 'INTERNAL' : 'PUBLIC' },
    });
    if (!internal && this.can('macros:read')) {
      try {
        const templates = await firstValueFrom(this.api.directory(company.id, 'macros'));
        if (version === this.version) this.macros.set(templates);
      } catch { if (version === this.version) this.macros.set([]); }
    }
  }

  protected async selectOperation(kind: 'assign' | 'transfer' | 'incidents') {
    const company = this.company();
    if (!company || this.secondaryBusy()) return;
    const version = this.version;
    this.secondaryBusy.set(true);
    this.actionError.set('');
    try {
      if (kind === 'incidents') {
        const rows = await firstValueFrom(this.api.directory(company.id, 'incidents'));
        if (version !== this.version) return;
        this.open(this.operation('Link incident', 'incidents', 'incidents:manage', [this.selectRows('incidentId', 'Incident', rows, 'title')]));
      } else {
        const teams = this.can('teams:read') ? await firstValueFrom(this.api.directory(company.id, 'teams')) : [];
        if (version !== this.version) return;
        const teamField = this.selectRows('teamId', 'Team', teams.filter(team => team.status === 'ACTIVE'), 'name');
        if (kind === 'transfer') this.open(this.operation('Transfer ticket', 'transfer', 'tickets:transfer', [teamField]));
        else {
          const agents = this.can('agents:read') ? await firstValueFrom(this.api.directory(company.id, 'agents')) : [];
          if (version !== this.version) return;
          const agentField = this.selectRows('agentId', 'Agent', agents.filter(agent => agent.status === 'AVAILABLE'), 'name', 'agentUserId');
          this.open(this.operation('Assign ticket', 'assign', 'tickets:assign', [{ ...teamField, required: false }, { ...agentField, required: false }]));
        }
      }
    } catch (error) { if (version === this.version) this.actionError.set(apiErrorMessage(error)); }
    finally { this.secondaryBusy.set(false); }
  }

  protected async supplement(kind: 'notes' | 'history') {
    const company = this.company();
    if (!company || this.secondaryBusy()) return;
    const version = this.version;
    this.secondaryBusy.set(true);
    this.actionError.set('');
    try {
      if (kind === 'notes' && this.can('internal-notes:read')) {
        const rows = await firstValueFrom(this.api.messages(company.id, this.id));
        if (version === this.version) this.notes.set(rows.filter(row => row.visibility === 'INTERNAL'));
      } else if (kind === 'history') {
        const rows = await firstValueFrom(this.api.history(company.id, this.id));
        if (version === this.version) this.history.set(rows);
      }
    } catch (error) { if (version === this.version) this.actionError.set(apiErrorMessage(error)); }
    finally { this.secondaryBusy.set(false); }
  }

  protected async submit(input: Record<string, unknown>) {
    const company = this.company(), command = this.command();
    if (!company || !command || this.writing() || !this.can(command.grant)) return;
    if (command.path.endsWith('/assign') && !input['automatic'] && !input['teamId'] && !input['agentId']) {
      this.actionError.set('Choose a team or an available agent.'); return;
    }
    this.writing.set(true);
    const version = this.version;
    this.actionError.set('');
    this.notice.set('');
    try {
      await firstValueFrom(this.api.request(company.id, command.method ?? 'POST', command.path, input));
      if (version !== this.version || this.company() !== company) return;
      this.command.set(null);
      this.notice.set('Changes saved.');
      this.history.set(null);
      this.notes.set(null);
      await this.load();
    } catch (error) { if (version === this.version) this.actionError.set(apiErrorMessage(error)); }
    finally { this.writing.set(false); }
  }

  private operation(title: string, path: string, grant: string, fields: readonly SupportField[], explanation?: string): SupportAction {
    return { title, grant, path: this.endpoint + '/' + path, fields, explanation };
  }
  private selectRows(key: string, label: string, rows: SupportRow[], name: string, value = 'id'): SupportField {
    return { key, label, kind: 'choice', required: true, choices: rows.flatMap(row => {
      const id = row[value];
      return typeof id === 'string' || typeof id === 'number' ? [{ value: id, label: String(row[name] ?? id) }] : [];
    }) };
  }
}
