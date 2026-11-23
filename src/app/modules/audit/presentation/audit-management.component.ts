import { DatePipe, DecimalPipe, DOCUMENT, JsonPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { AuditPurpose } from '../application/audit-purpose.service';
import { AUDIT_NEW_COMMANDS, AuditCommand, auditReasons, auditRecordIds, auditRowCommand } from '../domain/audit-commands';
import { AuditChecks, AuditMetrics, AuditObject, AuditObjectPage, auditLabel } from '../domain/audit.models';
import { AUDIT_READ, auditGrant, AuditSection } from '../domain/audit.navigation';
import { AuditApi } from '../infrastructure/audit-api.service';
import { AuditCommandComponent } from './audit-command.component';
import { AuditPurposeComponent } from './audit-purpose.component';

const detailKeys: Record<string, readonly string[]> = {
  ALERT: ['type', 'eventType', 'severity', 'outcome', 'count', 'recordId', 'verificationId', 'acknowledgedBy', 'acknowledgedAt', 'reason'],
  INVESTIGATION: ['title', 'openedBy', 'reason', 'recordIds', 'events'],
  EVIDENCE: ['checksum', 'fileHash', 'signature', 'recordIds', 'investigationId', 'createdBy', 'byteLength'],
  EXPORT: ['requesterId', 'approverId', 'reason', 'purpose', 'filter', 'recordIds', 'hasMore', 'nextCursor', 'completedAt', 'decision'],
  INTEGRITY_RUN: ['assurance', 'throughSequence', 'checked', 'failures'],
  CHECKPOINT: ['sequence', 'recordHash', 'statement', 'signature'],
  POLICY: ['code', 'eventType', 'version', 'sensitive', 'severity', 'reason'],
  ALERT_RULE: ['code', 'eventType', 'severity', 'outcome', 'threshold', 'windowMinutes'],
  RETENTION: ['category', 'days', 'version', 'legalReference', 'automatic', 'reason'],
  RETENTION_RUN: ['cutoff', 'policyId', 'mode', 'archived', 'held', 'deleted', 'packages', 'completedAt'],
  LEGAL_HOLD: ['recordIds', 'resourceType', 'resourceId', 'wholeScope', 'reason', 'releasedAt', 'releasedBy'],
  OUTBOX: ['eventType', 'recordId', 'attempts', 'nextAttemptAt', 'publishedAt'],
  INGESTION_FAILURE: ['eventId', 'sourceId', 'attempts', 'errorType', 'recordId', 'recoveredAt'],
  RECONCILIATION: ['source', 'complete', 'scanned', 'ingested', 'duplicates', 'failed', 'errorType'],
};

@Component({
  selector: 'app-audit-management',
  standalone: true,
  imports: [DatePipe, DecimalPipe, JsonPipe, RouterLink, PageBreadcrumbComponent, ComponentCardComponent, AuditPurposeComponent, AuditCommandComponent],
  templateUrl: './audit-management.component.html',
  styleUrl: './audit.css',
})
export class AuditManagementComponent implements OnInit {
  private readonly api = inject(AuditApi);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);
  protected readonly purpose = inject(AuditPurpose);
  protected readonly section = this.route.snapshot.data['section'] as AuditSection;
  protected readonly newCommand = AUDIT_NEW_COMMANDS[this.section.path];
  protected readonly command = signal<AuditCommand | null>(null);
  protected readonly selected = signal<AuditObject | null>(null);
  protected readonly page = signal<AuditObjectPage | null>(null);
  protected readonly metrics = signal<AuditMetrics | null>(null);
  protected readonly loading = signal(false);
  protected readonly writing = signal(false);
  protected readonly error = signal('');
  protected readonly actionError = signal('');
  protected readonly notice = signal('');
  protected readonly label = auditLabel;
  protected readonly offset = signal(0);
  protected readonly pageSize = 25;
  protected readonly exposedMetrics = [
    ['openAlerts', 'Open alerts'], ['ingestionLagMs', 'Ingestion lag (ms)'], ['retries', 'Ingestion retries'],
    ['deadLetters', 'Failed ingest events'], ['pendingOutbox', 'Pending deliveries'],
    ['deadOutbox', 'Failed deliveries'], ['publishedEvents', 'Published events'], ['pendingExports', 'Pending exports'],
  ] as const;
  protected readonly actions = computed(() => this.rowCommands(this.selected()).filter(action => this.can(action.grant)));
  protected readonly currentDetails = computed(() => {
    const row = this.selected();
    return row ? (detailKeys[row.kind] ?? []).filter(key => row.data[key] != null)
      .map(key => ({ key, value: row.data[key] })) : [];
  });
  protected readonly canFindRecords = computed(() => this.auth.claims()?.permissions.includes(AUDIT_READ) && this.can('exports:create'));
  protected evidenceRecordId = '';
  private version = 0;

  ngOnInit() {
    if (this.section.path === 'evidence') this.evidenceRecordId = this.route.snapshot.queryParamMap.get('recordId') ?? '';
    if (this.purpose.value()) this.purposeChanged();
  }

  protected can(code: string) { return this.auth.claims()?.permissions.includes(auditGrant(code)) ?? false; }

  protected purposeChanged() {
    this.version++;
    this.close();
    this.notice.set('');
    this.actionError.set('');
    this.page.set(null);
    this.metrics.set(null);
    void this.load(0);
    if (this.evidenceRecordId && this.newCommand && this.can(this.newCommand.grant)) this.open(this.newCommand);
  }

  protected async load(offset = this.offset()) {
    const context = this.purpose.current();
    if (!context) return;
    const scope = { purpose: context.purpose };
    const version = ++this.version;
    this.loading.set(true);
    this.error.set('');
    try {
      if (this.section.view === 'metrics') {
        const items = await firstValueFrom(this.api.metrics(scope));
        if (version === this.version && context === this.purpose.current()) this.metrics.set(items);
      } else {
        const items = await firstValueFrom(this.api.objects(scope, this.section.endpoint, offset, this.pageSize));
        if (version === this.version && context === this.purpose.current()) {
          this.page.set(items);
          this.offset.set(offset);
          const id = this.selected()?.id;
          this.selected.set(items.items.find(row => row.id === id) ?? null);
        }
      }
    } catch (error) {
      if (version === this.version) this.error.set(apiErrorMessage(error));
    } finally {
      if (version === this.version) this.loading.set(false);
    }
  }

  protected show(row: AuditObject) {
    this.command.set(null);
    this.selected.set(row);
    this.actionError.set('');
  }

  protected close() {
    this.command.set(null);
    this.selected.set(null);
  }

  protected open(command: AuditCommand) {
    if (this.writing() || !this.can(command.grant)) return;
    this.command.set(command);
    this.actionError.set('');
    this.notice.set('');
  }

  protected async submit(input: Record<string, unknown>) {
    const command = this.command();
    const context = this.purpose.current();
    if (!command || !context || !this.can(command.grant) || this.writing()) return;
    const selected = this.selected();
    this.writing.set(true);
    this.actionError.set('');
    try {
      const result = await firstValueFrom(this.api.post<AuditObject | AuditChecks | Record<string, unknown>>({ purpose: context.purpose }, command.path, input));
      if (this.purpose.current() !== context) return;
      this.command.set(null);
      this.evidenceRecordId = '';
      if (command.feedback === 'verification') {
        const checks = result as AuditChecks;
        const reference = checks.checksum ? ' · ' + checks.checksum : '';
        if (checks.valid) this.notice.set('Verification passed' + reference + '.');
        else this.actionError.set('Verification found an integrity problem. Review the verification results.');
      } else if (command.feedback === 'reconciliation') {
        const counts = result as Record<string, unknown>;
        this.notice.set(`Reconciliation completed. Scanned ${counts['scanned']}, ingested ${counts['ingested']}, duplicates ${counts['duplicates']}, failed ${counts['failed']}.`);
      } else {
        const status = 'status' in result && typeof result.status === 'string' ? ' · ' + auditLabel(result.status) : '';
        this.notice.set('Action recorded' + status + '.');
      }
      await this.load(selected ? this.offset() : 0);
    } catch (error) {
      if (this.purpose.current() === context) this.actionError.set(apiErrorMessage(error));
    } finally { this.writing.set(false); }
  }

  protected canDownload(row: AuditObject) {
    return row.status === 'READY' && (row.kind === 'EVIDENCE' ? this.can('evidence:download') :
      row.kind === 'EXPORT' && this.can('exports:download') && this.ownsExport(row));
  }

  protected async download(row: AuditObject) {
    const context = this.purpose.current();
    if (this.writing() || !this.canDownload(row) || !context) return;
    this.writing.set(true);
    this.actionError.set('');
    try {
      const file = await firstValueFrom(this.api.download({ purpose: context.purpose }, this.section.endpoint + '/' + encodeURIComponent(row.id) + '/download'));
      if (this.purpose.current() !== context) return;
      const url = URL.createObjectURL(file);
      const link = this.document.createElement('a');
      link.href = url;
      link.download = `audit-${row.kind.toLowerCase()}-${row.id}.json`;
      link.click();
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.notice.set('Download started.');
    } catch (error) {
      if (this.purpose.current() === context) this.actionError.set(apiErrorMessage(error));
    }
    finally { this.writing.set(false); }
  }

  protected value(row: AuditObject, key: string) {
    const raw = key === 'type' ? row.data['type'] ?? row.data['eventType'] : row.data[key];
    if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
    return typeof raw === 'string' || typeof raw === 'number' ? raw : '—';
  }

  private ownsExport(row: AuditObject) {
    return String(row.data['requesterId'] ?? '') === this.auth.claims()?.sub;
  }

  private rowCommands(row: AuditObject | null): AuditCommand[] {
    if (!row) return [];
    const path = this.section.endpoint + '/' + encodeURIComponent(row.id);
    switch (row.kind) {
      case 'INVESTIGATION':
        return row.status === 'OPEN' ? [
          auditRowCommand('Attach records', path + '/evidence', 'investigations:update', auditRecordIds),
          auditRowCommand('Close investigation', path + '/close', 'investigations:close', auditReasons),
        ] : [];
      case 'EVIDENCE':
        return [{ ...auditRowCommand('Verify evidence', path + '/verify', 'evidence:verify'), feedback: 'verification' }];
      case 'EXPORT':
        return row.status === 'PENDING_APPROVAL' && !this.ownsExport(row) ? [
          auditRowCommand('Approve export', path + '/approve', 'exports:approve', auditReasons),
          auditRowCommand('Reject export', path + '/reject', 'exports:reject', auditReasons),
        ] : [];
      case 'LEGAL_HOLD':
        return row.status === 'ACTIVE' ? [auditRowCommand('Release legal hold', path + '/release', 'legal-holds:release', auditReasons)] : [];
      case 'RETENTION':
        return row.status === 'ACTIVE' ? [auditRowCommand('Run archive', path + '/execute', 'retention:manage', [],
          'Run the current retention policy. Legal holds and open investigations protect matching records.')] : [];
      case 'OUTBOX':
        return ['DEAD', 'RETRY'].includes(row.status) ? [auditRowCommand('Retry delivery', path + '/retry', 'administration:manage', auditReasons)] : [];
      case 'INGESTION_FAILURE':
        return ['DEAD', 'RETRY'].includes(row.status) ? [auditRowCommand('Retry ingestion', path + '/retry', 'administration:manage', [],
          'Replay this event from its validated source payload.')] : [];
      case 'ALERT':
        return row.status === 'OPEN' ? [auditRowCommand('Acknowledge alert', path + '/acknowledge', 'alerts:manage', auditReasons)] : [];
      default:
        return [];
    }
  }
}
