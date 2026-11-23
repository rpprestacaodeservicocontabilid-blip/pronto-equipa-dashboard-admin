import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ThemeToggleButtonComponent } from '../../../shared/components/common/theme-toggle/theme-toggle-button.component';
import { UserDropdownComponent } from '../../header/user-dropdown/user-dropdown.component';
import { SidebarService } from '../../../core/services/sidebar.service';
import { AuthService } from '../../../core/auth/auth.service';

import { ButtonComponent } from '../../../shared/components/ui/button/button.component';

@Component({
  selector: 'app-header',
  imports: [ButtonComponent,
    CommonModule,
    RouterModule,
    ThemeToggleButtonComponent,
    UserDropdownComponent,
  ],
  templateUrl: './app-header.component.html',
})
export class AppHeaderComponent {
  protected readonly auth = inject(AuthService);
  isApplicationMenuOpen = false;
  readonly isMobileOpen$;


  constructor(public sidebarService: SidebarService) {
    this.isMobileOpen$ = this.sidebarService.isMobileOpen$;
  }

  handleToggle() {
    if (window.innerWidth >= 1280) {
      this.sidebarService.toggleExpanded();
    } else {
      this.sidebarService.toggleMobileOpen();
    }
  }

  toggleApplicationMenu() {
    this.isApplicationMenuOpen = !this.isApplicationMenuOpen;
  }

}
