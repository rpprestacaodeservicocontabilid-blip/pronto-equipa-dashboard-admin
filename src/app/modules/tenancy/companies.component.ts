import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CompaniesService, Company, CompanyStatus, DirectoryPage } from './companies.service';
import { apiErrorMessage } from '../../core/api/api-error';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { ComponentCardComponent } from '../../shared/components/common/component-card/component-card.component';

@Component({
  selector: 'app-platform-companies', standalone: true,
  imports: [FormsModule, RouterLink, PageBreadcrumbComponent, ComponentCardComponent],
  templateUrl: './companies.component.html',
})
export class CompaniesComponent implements OnInit {
  private readonly service = inject(CompaniesService);
  private readonly routeData = inject(ActivatedRoute).snapshot.data;
  readonly title: string = this.routeData['title'];
  private readonly status: CompanyStatus | undefined = this.routeData['status'];
  readonly result = signal<DirectoryPage<Company> | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly pending = signal<Company | null>(null);
  search = '';
  reason = '';
  private appliedSearch = '';

  ngOnInit() { void this.load(); }

  async load(page = 1, applySearch = false) {
    if (this.busy()) return;
    if (applySearch) this.appliedSearch = this.search.trim();
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await firstValueFrom(this.service.list(page, this.appliedSearch, this.status));
      const lastPage = result.pagination.totalPages;
      this.result.set(page <= lastPage ? result :
        await firstValueFrom(this.service.list(lastPage, this.appliedSearch, this.status)));
    }
    catch (error) { this.error.set(apiErrorMessage(error)); this.result.set(null); }
    finally { this.busy.set(false); }
  }

  selectStatusChange(company: Company) {
    this.reason = '';
    this.notice.set('');
    this.error.set('');
    this.pending.set(company);
  }

  async confirmStatus() {
    const company = this.pending();
    const reason = this.reason.trim();
    if (!company || reason.length < 3 || reason.length > 500 || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    const page = this.result()?.pagination.page ?? 1;
    try {
      const action = company.status === 'ACTIVE' ? 'suspend' : 'activate';
      const { data } = await firstValueFrom(this.service.changeStatus(company.id, action, reason));
      this.notice.set(data.name + (data.status === 'SUSPENDED' ? ' was suspended.' : ' was reactivated.'));
      this.pending.set(null);
    } catch (error) { this.error.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); }
    if (!this.pending()) await this.load(page);
  }
}
