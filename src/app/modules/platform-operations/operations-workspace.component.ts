import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api/api-error';
import { ComponentCardComponent } from '../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { OperationsSnapshot, PlatformOperationsApi } from './platform-operations.api';
import { OPERATIONS_SECTIONS, OperationsSection } from './platform-operations.navigation';

const statusLabels: Record<string, string> = {
  up: 'Up', degraded: 'Degraded', down: 'Down', ACTIVE: 'Active', PAUSED: 'Paused', UNAVAILABLE: 'Unavailable',
  NOT_STARTED: 'Not started', RUNNING: 'Running', STOPPED: 'Stopped',
};
const names: Record<string, string> = {
  database: 'Database', redis: 'Redis', rabbitmq: 'RabbitMQ', payroll: 'Payroll', notifications: 'Notifications',
  documents: 'Documents', payslips: 'Payslips', simulations: 'Simulations', subscriptions: 'Subscriptions',
  'contract-expiration': 'Contract expiry and alerts',
};

@Component({
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, ComponentCardComponent, PageBreadcrumbComponent],
  templateUrl: './operations-workspace.component.html',
  styleUrl: '../../shared/components/common/company-workspace/workspace.css',
  encapsulation: ViewEncapsulation.None,
})
export class OperationsWorkspaceComponent {
  private readonly api = inject(PlatformOperationsApi);
  protected readonly section: OperationsSection = inject(ActivatedRoute).snapshot.data['section'];
  protected readonly snapshot = rxResource<OperationsSnapshot, unknown>({ stream: () => this.api.snapshot(this.section.endpoint) });
  protected readonly errorMessage = apiErrorMessage;
  protected readonly shortcuts = OPERATIONS_SECTIONS.filter(section => section.path !== 'overview');
  protected readonly queueStates = ['waiting', 'active', 'delayed', 'paused', 'failed', 'completed'] as const;

  protected label(value: string | null) { return value ? statusLabels[value] ?? value : 'Unknown'; }
  protected name(value: string) { return names[value] ?? value; }
  protected mib(bytes: number) { return bytes / (1024 * 1024); }
}
