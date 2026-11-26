import { registerLocaleData } from '@angular/common';
import portuguese from '@angular/common/locales/pt-AO';
import spanish from '@angular/common/locales/es';
import chinese from '@angular/common/locales/zh';
import { loadTranslations } from '@angular/localize';

export const LANGUAGES = [
  { id: 'pt-AO', name: 'Português (Angola)' },
  { id: 'en', name: 'English' },
  { id: 'es', name: 'Español' },
  { id: 'zh-Hans', name: '简体中文' },
] as const;

export type Locale = typeof LANGUAGES[number]['id'];
const storageKey = 'prontoequipas.locale';
const defaultLocale: Locale = 'pt-AO';
const catalogues = {
  'pt-AO': () => import('./messages.pt-AO.json'),
  es: () => import('./messages.es.json'),
  'zh-Hans': () => import('./messages.zh-Hans.json'),
};
type TranslationLocale = keyof typeof catalogues;
type CatalogueLoader = () => Promise<{ default: Record<string, string> }>;
const moduleCatalogues: ReadonlyArray<Record<TranslationLocale, CatalogueLoader>> = [
  {
    'pt-AO': () => import('../../modules/employees/i18n/messages.pt-AO.json'),
    es: () => import('../../modules/employees/i18n/messages.es.json'),
    'zh-Hans': () => import('../../modules/employees/i18n/messages.zh-Hans.json'),
  },
  {
    'pt-AO': () => import('../../modules/contracts/i18n/messages.pt-AO.json'),
    es: () => import('../../modules/contracts/i18n/messages.es.json'),
    'zh-Hans': () => import('../../modules/contracts/i18n/messages.zh-Hans.json'),
  },
  {
    'pt-AO': () => import('../../modules/organization/i18n/messages.pt-AO.json'),
    es: () => import('../../modules/organization/i18n/messages.es.json'),
    'zh-Hans': () => import('../../modules/organization/i18n/messages.zh-Hans.json'),
  },
];
const localeParameter = 'language';

function supportedLocale(value: string | null): Locale | undefined {
  return LANGUAGES.find(language => language.id === value)?.id;
}

export function activeLocale(): Locale {
  return supportedLocale(document.documentElement.lang) ?? defaultLocale;
}

export async function initializeLocale(): Promise<void> {
  const url = new URL(window.location.href);
  const requested = supportedLocale(url.searchParams.get(localeParameter));
  let saved: Locale | undefined;
  try {
    if (requested) localStorage.setItem(storageKey, requested);
    saved = supportedLocale(localStorage.getItem(storageKey));
    if (requested) {
      url.searchParams.delete(localeParameter);
      history.replaceState(history.state, '', url);
    }
  } catch {
    // The URL still preserves the explicit selection if storage is unavailable.
  }
  const locale = requested ?? saved ?? defaultLocale;
  registerLocaleData(portuguese, 'pt-AO');
  registerLocaleData(spanish);
  registerLocaleData(chinese, 'zh-Hans');
  if (locale !== 'en') {
    const selected = await Promise.all([catalogues, ...moduleCatalogues].map(catalogue => catalogue[locale]()));
    loadTranslations(Object.assign({}, ...selected.map(catalogue => catalogue.default)));
  }
  document.documentElement.lang = locale;
  document.title = $localize`:@@platform-administration:Platform administration` + ' | PRONTOEQUIPAS';
}

export function selectLocale(value: string): void {
  const locale = supportedLocale(value);
  if (!locale || activeLocale() === locale) return;
  const url = new URL(window.location.href);
  url.searchParams.set(localeParameter, locale);
  window.location.assign(url);
}
