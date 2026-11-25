import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComponentCardComponent } from '../../shared/components/common/component-card/component-card.component';
import { intervals, label, Limit, metrics, Plan, PlanInput, planTypes, Price, Row } from './subscriptions.models';

@Component({
  selector: 'app-subscription-plan-editor', standalone: true, imports: [FormsModule, ComponentCardComponent],
  templateUrl: './plan-editor.component.html', styleUrl: './subscriptions.css',
})
export class PlanEditorComponent implements OnInit {
  @Input() plan: Plan | null = null;
  @Input() catalogue: Row[] = [];
  @Input() busy = false;
  @Output() readonly submitted = new EventEmitter<PlanInput>();
  @Output() readonly closed = new EventEmitter<void>();
  protected get intervals() { return this.plan && this.draft.prices.some(price => price.interval === 'CUSTOM') ? [...intervals, 'CUSTOM'] : intervals; }
  protected readonly types = planTypes;
  protected readonly metrics = metrics;
  protected readonly label = label;
  protected readonly policies = ['HARD', 'SOFT', 'OVERAGE'];
  protected draft: PlanInput = { code: '', name: '', description: '', type: 'STANDARD', prices: [], features: {}, limits: {} };
  protected error = '';

  ngOnInit() {
    if (!this.plan) { this.addPrice(); return; }
    const source = this.plan.currentVersion ?? this.plan.versions?.[0] ?? this.plan;
    this.draft = { code: this.plan.code, name: source.name, type: source.type, description: source.description ?? '',
      prices: (source.prices ?? []).map(price => ({ ...price })), features: { ...source.features },
      limits: Object.fromEntries(Object.entries(source.limits ?? {}).map(([metric, limit]) => [metric, { ...limit }])) };
    if (!this.draft.prices.length) this.addPrice();
  }

  protected addPrice() { this.draft.prices.push({ currency: 'AOA', interval: 'MONTHLY', amount: '' }); }
  protected limit(metric: string): Limit | undefined { return this.draft.limits[metric]; }
  protected toggleLimit(metric: string, enabled: boolean) {
    if (enabled) this.draft.limits[metric] = { value: '0', policy: 'HARD' };
    else delete this.draft.limits[metric];
  }
  protected submit() {
    const prices: Price[] = this.draft.prices.map(price => ({ currency: price.currency.trim().toUpperCase(),
      interval: price.interval, amount: price.amount.trim(), ...(price.interval === 'CUSTOM' ? { customDays: price.customDays } : {}) }));
    if (new Set(prices.map(price => price.interval)).size !== prices.length) {
      this.error = 'Use one price per billing interval.'; return;
    }
    this.error = '';
    this.submitted.emit({ ...this.draft, code: this.draft.code.trim().toUpperCase(), name: this.draft.name.trim(),
      prices, limits: Object.fromEntries(Object.entries(this.draft.limits).map(([key, limit]) => [key, {
        ...limit, value: limit.value === '' ? null : limit.value,
      }])) });
  }
}
