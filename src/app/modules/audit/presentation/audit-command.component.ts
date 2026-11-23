import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { AuditCommand } from '../domain/audit-commands';
import { auditLabel } from '../domain/audit.models';

type InputValue = string | number | boolean | null;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-audit-command',
  standalone: true,
  imports: [FormsModule, ComponentCardComponent],
  templateUrl: './audit-command.component.html',
  styleUrl: './audit.css',
})
export class AuditCommandComponent implements OnInit {
  @Input({ required: true }) command!: AuditCommand;
  @Input() recordId = '';
  @Input() busy = false;
  @Output() submitted = new EventEmitter<Record<string, unknown>>();
  @Output() closed = new EventEmitter<void>();
  protected values: Record<string, InputValue> = {};
  protected readonly error = signal('');
  protected readonly label = auditLabel;

  ngOnInit() {
    this.values = Object.fromEntries(this.command.fields.map(field => [field.name,
      field.name === 'recordIds' && uuid.test(this.recordId) ? this.recordId : field.initial ?? (field.kind === 'check' ? false : null),
    ]));
  }

  protected submit() {
    if (this.busy) return;
    this.error.set('');
    const result: Record<string, unknown> = {};
    for (const field of this.command.fields) {
      const raw = this.values[field.name];
      const value = typeof raw === 'string' ? raw.trim() : raw;
      if (field.required && (value === '' || value == null)) {
        this.error.set('Enter ' + field.label.toLowerCase() + '.');
        return;
      }
      if (value === '' || value == null) continue;
      if (field.kind === 'ids') {
        const items = [...new Set(String(value).split(/[\s,]+/).filter(Boolean).map(item => item.toLowerCase()))];
        if (!items.length || items.length > 1000 || items.some(item => !uuid.test(item))) {
          this.error.set('Enter up to 1,000 valid audit record IDs.');
          return;
        }
        result[field.name] = items;
      } else if (field.kind === 'number') {
        if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > (field.max ?? 1000)) {
          this.error.set(field.label + ' must be a valid whole number.');
          return;
        }
        result[field.name] = value;
      } else if (field.kind === 'reason' && String(value).length < 3) {
        this.error.set(field.label + ' must contain at least three characters.');
        return;
      } else {
        result[field.name] = value;
      }
    }
    if (result['investigationId'] && !uuid.test(String(result['investigationId']))) {
      this.error.set('Enter a valid investigation ID.');
      return;
    }
    if (this.command.path === 'admin/legal-holds' &&
      (Boolean(result['resourceType']) !== Boolean(result['resourceId']) ||
        (!result['wholeScope'] && !result['recordIds'] && !result['resourceId']))) {
      this.error.set('Choose the entire scope, enter record IDs, or provide both the resource type and ID.');
      return;
    }
    this.submitted.emit(result);
  }
}
