import { Component, ViewEncapsulation, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { LEGAL_GRANTS } from '../domain/legal.models';
import { LegalSection } from '../domain/legal-navigation';
import { LegalAnalysisComponent } from './legal-analysis.component';
import { LegalAuditComponent } from './legal-audit.component';
import { LegalCatalogComponent } from './legal-catalog.component';
import { LegalSourcesComponent } from './legal-sources.component';

@Component({
  selector: 'app-legal-workspace',
  standalone: true,
  imports: [PageBreadcrumbComponent, ComponentCardComponent, RouterLink, LegalCatalogComponent, LegalSourcesComponent, LegalAnalysisComponent, LegalAuditComponent],
  styleUrl: '../../../shared/components/common/company-workspace/workspace.css',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './legal-workspace.component.html',
})
export class LegalWorkspaceComponent {
  protected readonly section = inject(ActivatedRoute).snapshot.data['section'] as LegalSection;
  protected readonly auth = inject(AuthService);
  protected readonly grants = LEGAL_GRANTS;
}
