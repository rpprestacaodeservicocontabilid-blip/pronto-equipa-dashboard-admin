import { Component, Input } from '@angular/core';
import { RoleEntry } from './authorization-admin.api';

@Component({
  selector: 'app-authorization-role-list',
  standalone: true,
  imports: [],
  template: `
    <div class="space-y-3">
      @for (role of roles; track role.id) {
        <details class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
          <summary class="cursor-pointer text-sm font-medium text-gray-900 dark:text-white">
            {{ role.name }}
            <span class="ms-2 text-xs font-normal text-gray-600 dark:text-gray-400">
              #{{ role.id }} · {{ role.companyId ? 'Company-specific' : 'Global' }}{{ role.isSystem ? ' · System role' : '' }}
              · {{ role.permissions.length }} mapped permissions
            </span>
          </summary>
          @if (role.description) {
            <p class="mt-3 text-sm text-gray-600 dark:text-gray-400">{{ role.description }}</p>
          }
          <ul class="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
            @for (permission of role.permissions; track permission.id) {
              <li class="flex flex-wrap items-center gap-2">
                <span class="font-mono break-all">{{ permission.name }}</span>
                <span class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">{{ permission.scope }}</span>
              </li>
            } @empty {
              <li>No permissions are mapped in this scope.</li>
            }
          </ul>
        </details>
      } @empty {
        <p class="text-sm text-gray-600 dark:text-gray-400">No roles found.</p>
      }
    </div>
  `,
})
export class AuthorizationRoleListComponent {
  @Input({ required: true }) roles: RoleEntry[] = [];
}
