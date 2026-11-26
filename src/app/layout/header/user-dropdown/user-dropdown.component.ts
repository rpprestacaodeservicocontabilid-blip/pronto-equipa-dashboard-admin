import { activeLocale, LANGUAGES, selectLocale } from '../../../core/i18n/locale';
import { inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/api/api-error';
import { ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { DropdownService } from '../../../core/services/dropdown.service';
import { ButtonComponent } from '../../../shared/components/ui/button/button.component';

@Component({
  selector: 'app-user-dropdown',
  templateUrl: './user-dropdown.component.html',
  imports: [ButtonComponent, CommonModule, RouterModule]
})
export class UserDropdownComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  signingOut = false;
  signOutError = '';
  signOut(event: Event) {
    event.preventDefault();
    if (this.signingOut) return;
    this.signingOut = true;
    this.signOutError = '';
    this.auth.logout().subscribe({
      error: error => {
        this.signOutError = apiErrorMessage(error);
        this.signingOut = false;
        this.cdr.markForCheck();
      },
      complete: () => {
        this.signingOut = false;
        this.closeDropdown();
      },
    });
  }
  readonly dropdownId = 'user-dropdown';
  isOpen = false;
  subDropdownOpen = false;
  readonly currentLocale = activeLocale();
  readonly languages = LANGUAGES;

  private sub = new Subscription();

  constructor(
    private elementRef: ElementRef,
    private dropdownService: DropdownService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.dropdownService.activeDropdown$.subscribe((activeId) => {
        this.isOpen = activeId === this.dropdownId;
        if (!this.isOpen) {
          this.subDropdownOpen = false;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.clearSubCloseTimer();
    this.sub.unsubscribe();
  }

  get currentLang() {
    return this.languages.find((l) => l.id === this.currentLocale) || this.languages[0];
  }

  toggleDropdown(event?: Event): void {
    event?.stopPropagation();
    this.dropdownService.toggle(this.dropdownId);
  }

  closeDropdown(): void {
    this.dropdownService.close(this.dropdownId);
  }

  private subCloseTimer?: ReturnType<typeof setTimeout>;

  toggleSubDropdown(event: Event): void {
    event.stopPropagation();
    this.clearSubCloseTimer();
    this.subDropdownOpen = !this.subDropdownOpen;
  }

  /** Language flyout opens on hover (like Next.js). */
  openSubDropdown(): void {
    this.clearSubCloseTimer();
    this.subDropdownOpen = true;
  }

  /** Closes the language flyout right away (pointer moved onto another menu item, like Laravel/Vue). */
  closeSubDropdown(): void {
    this.clearSubCloseTimer();
    if (this.subDropdownOpen) {
      this.subDropdownOpen = false;
      this.cdr.detectChanges();
    }
  }

  /** Small delay so the pointer can travel from the trigger to the flyout. */
  scheduleCloseSubDropdown(): void {
    this.clearSubCloseTimer();
    this.subCloseTimer = setTimeout(() => {
      this.subDropdownOpen = false;
      this.cdr.detectChanges();
    }, 120);
  }

  private clearSubCloseTimer(): void {
    if (this.subCloseTimer) {
      clearTimeout(this.subCloseTimer);
      this.subCloseTimer = undefined;
    }
  }

  selectLanguage(id: string, event?: Event): void {
    event?.stopPropagation();
    selectLocale(id);
    this.closeDropdown();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen && !this.elementRef.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }
}
