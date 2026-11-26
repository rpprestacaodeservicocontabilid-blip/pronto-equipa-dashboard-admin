import { Component } from '@angular/core';
import { activeLocale, LANGUAGES, selectLocale } from '../../../core/i18n/locale';
import { GridShapeComponent } from '../../../shared/components/common/grid-shape/grid-shape.component';
import { RouterModule } from '@angular/router';
import { ThemeToggleTwoComponent } from '../../../shared/components/common/theme-toggle-two/theme-toggle-two.component';

@Component({
  selector: 'app-auth-page-layout',
  imports: [
    GridShapeComponent,
    RouterModule,
    ThemeToggleTwoComponent
  ],
  templateUrl: './auth-page-layout.component.html',
  styles: ``
})
export class AuthPageLayoutComponent {
  protected readonly languages = LANGUAGES;
  protected readonly currentLocale = activeLocale();
  protected readonly selectLocale = selectLocale;
}
