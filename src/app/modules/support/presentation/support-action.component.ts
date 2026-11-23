import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { SupportAction } from '../domain/support-forms';
import { SupportRow } from '../domain/support.models';

@Component({
  selector: 'app-support-action',
  standalone: true,
  imports: [FormsModule, ComponentCardComponent],
  styleUrl: './support.css',
  template: `
    <app-component-card [title]="action.title">
      @if (action.explanation) { <p class="sup-muted mb-3">{{ action.explanation }}</p> }
      @if (error()) { <p class="sup-error mb-3" role="alert">{{ error() }}</p> }
      <form class="space-y-4" (ngSubmit)="submit()">
        @if (templates.length) {
          <label class="sup-label">Insert quick reply
            <select class="sup-input" name="template" [ngModel]="null" (ngModelChange)="insert($event)">
              <option [ngValue]="null">Choose a saved reply</option>
              @for (template of templates; track template.id) { <option [ngValue]="template">{{ template['name'] }}</option> }
            </select>
          </label>
        }
        @if (action.fields.length) {
          <div class="grid gap-3 sm:grid-cols-2">
            @for (field of action.fields; track field.key) {
              @if (field.kind === 'textarea') {
                <label class="sup-label sm:col-span-2">{{ field.label }}
                  <textarea class="sup-input" rows="4" [name]="field.key" [required]="!!field.required" [maxlength]="field.max ?? 12000" [(ngModel)]="values[field.key]"></textarea>
                </label>
              } @else if (field.kind === 'choice') {
                <label class="sup-label">{{ field.label }}
                  <select class="sup-input" [name]="field.key" [required]="!!field.required" [(ngModel)]="values[field.key]">
                    <option [ngValue]="null">Choose an option</option>
                    @for (option of field.choices; track option.value) { <option [ngValue]="option.value">{{ option.label }}</option> }
                  </select>
                </label>
              } @else if (field.kind === 'number') {
                <label class="sup-label">{{ field.label }}
                  <input class="sup-input" type="number" [name]="field.key" [required]="!!field.required" [min]="field.min ?? 0" [max]="field.max ?? 999999" [(ngModel)]="values[field.key]">
                </label>
              } @else {
                <label class="sup-label">{{ field.label }}
                  <input class="sup-input" [name]="field.key" [required]="!!field.required" [maxlength]="field.max ?? 200" [(ngModel)]="values[field.key]">
                </label>
              }
            }
          </div>
        }
        <div class="flex flex-wrap gap-2">
          <button type="submit" class="sup-button" [disabled]="busy">{{ busy ? 'Saving…' : action.title }}</button>
          <button type="button" class="sup-secondary" [disabled]="busy" (click)="closed.emit()">Cancel</button>
        </div>
      </form>
    </app-component-card>
  `,
})
export class SupportActionComponent implements OnInit {
  @Input({ required: true }) action!: SupportAction;
  @Input() templates: SupportRow[] = [];
  @Input() busy = false;
  @Output() submitted = new EventEmitter<Record<string, unknown>>();
  @Output() closed = new EventEmitter<void>();
  protected readonly error = signal('');
  protected values: Record<string, string | number | null> = {};
  private replay?: { fingerprint: string; key: string };

  ngOnInit() { this.values = Object.fromEntries(this.action.fields.map(field => [field.key, field.initial ?? null])); }

  protected insert(template: SupportRow | null) {
    if (typeof template?.['content'] === 'string') this.values['body'] = template['content'];
  }

  protected submit() {
    if (this.busy) return;
    this.error.set('');
    const data: Record<string, unknown> = { ...this.action.constants };
    for (const field of this.action.fields) {
      const raw = this.values[field.key];
      const value = typeof raw === 'string' ? raw.trim() : raw;
      if (value == null || value === '') {
        if (!field.required) continue;
        this.error.set('Enter ' + field.label.toLowerCase() + '.'); return;
      }
      if (field.kind === 'number' && (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (field.min ?? 0) || value > (field.max ?? Infinity))) {
        this.error.set(field.label + ' must be a whole number within the allowed range.'); return;
      }
      if (typeof value === 'string' && (value.length < (field.min ?? 0) || value.length > (field.max ?? 200))) {
        this.error.set(field.label + ' has an invalid length.'); return;
      }
      data[field.key] = field.kind === 'list' ? [...new Set(String(value).split(',').map(item => item.trim()).filter(Boolean))] : value;
    }
    if (this.action.path === 'agents' && typeof data['userId'] === 'number') data['code'] = String(data['userId']);
    if (this.action.idempotent) {
      const fingerprint = JSON.stringify(data);
      if (this.replay?.fingerprint !== fingerprint) this.replay = { fingerprint, key: globalThis.crypto.randomUUID() };
      data['idempotencyKey'] = this.replay.key;
    }
    this.submitted.emit(data);
  }
}
