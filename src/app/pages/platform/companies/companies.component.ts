import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CompaniesService, Company, CompanyPage } from './companies.service';
import { apiErrorMessage } from '../../../core/api/api-error';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
@Component({
  selector: 'app-platform-companies', standalone: true,
  imports: [FormsModule, PageBreadcrumbComponent, ComponentCardComponent],
  templateUrl: './companies.component.html',
})
export class CompaniesComponent implements OnInit {
  private readonly service = inject(CompaniesService);
  readonly result = signal<CompanyPage | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly pending = signal<Company | null>(null);
  search = ''; private appliedSearch = '';
  ngOnInit() { void this.load(); }
  async load(page = 1, applySearch = false) {
    if (this.busy()) return;
    if (applySearch) this.appliedSearch = this.search.trim();
    this.busy.set(true); this.error.set('');
    try { this.result.set(await firstValueFrom(this.service.list(page, this.appliedSearch))); }
    catch (error) { this.error.set(apiErrorMessage(error)); this.result.set(null); }
    finally { this.busy.set(false); }
  }
  async confirmStatus() {
    const company = this.pending();
    if (!company || this.busy()) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try {
      const response = await firstValueFrom(this.service.changeStatus(company.id, company.status === 'ACTIVE' ? 'suspend' : 'activate'));
      this.result.update(result => result ? { ...result, data: result.data.map(row => row.id === company.id ? response.data : row) } : null);
      this.notice.set(`Company status updated: ${response.data.name}.`);
      this.pending.set(null);
    } catch (error) { this.error.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); }
  }
}
