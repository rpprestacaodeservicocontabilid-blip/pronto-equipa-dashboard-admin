import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { ComponentCardComponent } from '../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { CompaniesService, Company, CompanyProfile } from './companies.service';

@Component({
  selector: 'app-tenancy-company-profile',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, ComponentCardComponent, PageBreadcrumbComponent],
  templateUrl: './company-profile.component.html',
})
export class CompanyProfileComponent {
  private readonly service = inject(CompaniesService);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });
  readonly id = computed(() => {
    const value = Number(this.params().get('id'));
    return Number.isSafeInteger(value) && value > 0 ? value : undefined;
  });
  readonly company = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.service.get(params).pipe(map(response => response.data)),
  });
  private readonly loadedCompanyId = computed(() => this.company.hasValue() ? this.company.value().id : undefined);
  private readonly memberPage = signal({ id: 0, page: 1 });
  readonly members = rxResource({
    params: () => {
      const id = this.id();
      const selection = this.memberPage();
      return id && this.loadedCompanyId() === id ? { id, page: selection.id === id ? selection.page : 1 } : undefined;
    },
    stream: ({ params }) => this.service.members(params.id, params.page),
  });
  private readonly draft = signal<{ id: number; fields: CompanyProfile } | null>(null);
  readonly profile = computed(() => {
    const draft = this.draft();
    return draft?.id === this.id() ? draft?.fields : undefined;
  });
  readonly saving = signal(false);
  private readonly result = signal<{ id: number; message: string; error?: boolean } | null>(null);
  readonly message = computed(() => {
    const result = this.result();
    return result?.id === this.id() ? result : null;
  });
  readonly errorMessage = apiErrorMessage;
  readonly fields: readonly {
    key: keyof CompanyProfile; title: string; max: number; type?: string; required?: boolean;
  }[] = [
    { key: 'name', title: 'Legal name', max: 150, required: true },
    { key: 'nif', title: 'NIF', max: 50 },
    { key: 'email', title: 'Contact email', max: 255, type: 'email' },
    { key: 'phone', title: 'Telephone', max: 30, type: 'tel' },
    { key: 'timezone', title: 'Time zone', max: 60, required: true },
    { key: 'locale', title: 'Locale', max: 10, required: true },
  ];

  edit(company: Company) {
    const { id, name, nif, email, phone, timezone, locale } = company;
    this.result.set(null);
    this.draft.set({ id, fields: { name, nif, email, phone, timezone, locale } });
  }

  cancel() { this.draft.set(null); }

  showMembers(page: number) {
    const id = this.id();
    if (id) this.memberPage.set({ id, page });
  }

  async save() {
    const id = this.id();
    const profile = this.profile();
    if (!id || !profile || this.saving() || !this.company.hasValue()) return;
    if (profile.name.trim().length < 2 || !profile.timezone.trim() || profile.locale.trim().length < 2) {
      this.result.set({ id, message: 'Enter a valid name, time zone and locale.', error: true });
      return;
    }

    const current = this.company.value();
    const normalized: CompanyProfile = {
      name: profile.name.trim(), nif: profile.nif?.trim() || null,
      email: profile.email?.trim() || null, phone: profile.phone?.trim() || null,
      timezone: profile.timezone.trim(), locale: profile.locale.trim(),
    };
    const changes = this.fields
      .filter(({ key }) => current[key] !== normalized[key])
      .map(({ key }) => [key, normalized[key]]);
    if (!changes.length) {
      this.cancel();
      return;
    }

    this.saving.set(true);
    this.result.set(null);
    try {
      const { data } = await firstValueFrom(this.service.update(id, Object.fromEntries(changes)));
      if (id === this.id()) {
        this.cancel();
        this.company.set(data);
        this.result.set({ id, message: 'Company profile updated.' });
      }
    } catch (error) {
      this.result.set({ id, message: apiErrorMessage(error), error: true });
    } finally {
      this.saving.set(false);
    }
  }
}
