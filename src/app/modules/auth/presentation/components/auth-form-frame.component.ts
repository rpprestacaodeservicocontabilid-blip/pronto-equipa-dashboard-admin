import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthPageLayoutComponent } from '../../../../layout/shell/auth-page-layout/auth-page-layout.component';
@Component({
  selector: 'app-auth-form-frame', standalone: true, imports: [AuthPageLayoutComponent, RouterLink],
  template: `<app-auth-page-layout>
    <section class="flex w-full flex-1 flex-col lg:w-1/2">
      <div class="mx-auto w-full max-w-md sm:pt-10"><a routerLink="/signin" class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">Back to sign in</a></div>
      <div class="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
        <h1 class="mb-2 text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90">{{ title }}</h1>
        <p class="mb-6 text-sm text-gray-500 dark:text-gray-400">{{ description }}</p>
        @if (error) { <p role="alert" class="mb-4 rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/10 dark:text-error-400">{{ error }}</p> }
        @if (notice) { <p role="status" class="mb-4 rounded-lg bg-success-50 p-3 text-sm text-success-700 dark:bg-success-500/10 dark:text-success-400">{{ notice }}</p> }
        <ng-content />
      </div>
    </section>
  </app-auth-page-layout>`,
})
export class AuthFormFrameComponent {
  @Input() title = '';
  @Input() description = '';
  @Input() error = '';
  @Input() notice = '';
}
