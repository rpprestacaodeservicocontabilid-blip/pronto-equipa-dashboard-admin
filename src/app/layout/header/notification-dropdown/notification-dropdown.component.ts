import { DatePipe, DOCUMENT } from '@angular/common';
import { Component, DestroyRef, ElementRef, HostListener, NgZone, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { timer } from 'rxjs';
import { DropdownService } from '../../../core/services/dropdown.service';
import { NotificationInbox } from '../../../modules/notifications/application/notification-inbox.service';
import { InboxItem } from '../../../modules/notifications/domain/notifications.models';
import { NotificationsApi } from '../../../modules/notifications/infrastructure/notifications-api.service';

@Component({
  selector: 'app-notification-dropdown',
  standalone: true,
  templateUrl: './notification-dropdown.component.html',
  imports: [DatePipe, RouterLink],
})
export class NotificationDropdownComponent {
  private readonly dropdown = inject(DropdownService);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly api = inject(NotificationsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  protected readonly inbox = inject(NotificationInbox);
  protected readonly open = signal(false);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly items = signal<InboxItem[]>([]);
  private readonly key = computed(() => this.inbox.identity() + ':' + this.inbox.company());

  constructor() {
    this.dropdown.activeDropdown$.pipe(takeUntilDestroyed()).subscribe(id => this.open.set(id === 'notification-dropdown'));
    effect(onCleanup => {
      const identity = this.inbox.identity();
      const company = this.inbox.company();
      if (!this.open() || !identity) { this.items.set([]); return; }
      const key = this.key();
      this.items.set([]);
      this.loading.set(true);
      this.failed.set(false);
      const request = this.api.inbox(company, 1).subscribe({
        next: entries => {
          if (key !== this.key() || !this.open()) return;
          this.items.set(entries.slice(0, 5));
          this.loading.set(false);
          this.inbox.refresh();
        },
        error: () => {
          if (key !== this.key() || !this.open()) return;
          this.loading.set(false);
          this.failed.set(true);
        },
      });
      onCleanup(() => request.unsubscribe());
    });
    const zone = inject(NgZone);
    zone.runOutsideAngular(() => timer(15000, 45000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.document.visibilityState === 'visible') zone.run(() => this.inbox.refresh());
    }));
  }

  protected toggle() { this.dropdown.toggle('notification-dropdown'); }
  protected close() { this.dropdown.close('notification-dropdown'); }

  @HostListener('document:click', ['$event'])
  protected outside(event: MouseEvent) {
    if (this.open() && !this.element.nativeElement.contains(event.target as Node)) this.close();
  }

  @HostListener('keydown.escape', ['$event'])
  protected escape(event: Event) {
    if (!this.open()) return;
    event.stopPropagation();
    this.close();
    this.element.nativeElement.querySelector('button')?.focus();
  }
}
