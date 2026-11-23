import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { payrollQuery } from '../../payroll/presentation/payroll-ui';
import { legalLabel, safeLegalLink } from '../domain/legal-format';
import { SOURCE_TYPES, SourceInput } from '../domain/legal.models';
import { LegalRulesApi } from '../infrastructure/legal-rules-api.service';

const blankSource: SourceInput = { type: 'LAW', reference: '', title: '', issuer: '', publishedOn: '', officialUrl: '' };

@Component({
  selector: 'app-legal-sources', standalone: true, imports: [FormsModule, ComponentCardComponent],
  templateUrl: './legal-sources.component.html',
})
export class LegalSourcesComponent {
  private readonly api = inject(LegalRulesApi);
  private readonly destroy = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly revision = signal(0);
  protected readonly response = payrollQuery(this.revision, () => this.api.sources());
  protected readonly canCreate = computed(() => this.auth.claims()?.permissions.includes('legal-rules:create'));
  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly working = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly types = SOURCE_TYPES;
  protected readonly label = legalLabel;
  protected readonly link = safeLegalLink;
  protected readonly visible = computed(() => {
    const result = this.response();
    const filter = this.query().trim().toLowerCase();
    return result && 'data' in result ? result.data.filter(source =>
      [source.reference, source.title, source.issuer].some(text => text.toLowerCase().includes(filter))) : [];
  });
  protected draft: SourceInput = { ...blankSource };
  protected relationship: '' | 'AMENDS' | 'REPEALS' = '';

  protected reload() { this.revision.update(value => value + 1); }
  protected save() {
    if (this.working() || !this.canCreate()) return;
    this.error.set('');
    this.notice.set('');
    const { reference, title, issuer, publishedOn, officialUrl, effectiveFrom, documentUrl, articles, notes, relatedReference, type } = this.draft;
    const sourceUrl = safeLegalLink(officialUrl.trim());
    const attachment = safeLegalLink(documentUrl?.trim());
    if (!reference.trim() || !title.trim() || !issuer.trim() || !publishedOn || !sourceUrl || (documentUrl?.trim() && !attachment)) {
      this.error.set('Enter the reference, title, issuer, publication date and a valid official URL. Document links must use HTTP or HTTPS.');
      return;
    }
    if (this.relationship && (!relatedReference?.trim() || relatedReference.trim() === reference.trim())) {
      this.error.set('Enter a different related reference for the selected relationship.');
      return;
    }
    const body: SourceInput = {
      type, reference: reference.trim(), title: title.trim(), issuer: issuer.trim(), publishedOn, officialUrl: sourceUrl,
      ...(effectiveFrom ? { effectiveFrom } : {}), ...(attachment ? { documentUrl: attachment } : {}),
      ...(articles?.trim() ? { articles: articles.trim() } : {}), ...(notes?.trim() ? { notes: notes.trim() } : {}),
      ...(this.relationship ? { relation: this.relationship, relatedReference: relatedReference!.trim() } : {}),
    };
    this.working.set(true);
    this.api.registerSource(body).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.working.set(false))).subscribe({
      next: source => {
        this.notice.set(source.reference + ' registered.');
        this.open.set(false);
        this.draft = { ...blankSource };
        this.relationship = '';
        this.reload();
      },
      error: error => this.error.set(apiErrorMessage(error)),
    });
  }
}
