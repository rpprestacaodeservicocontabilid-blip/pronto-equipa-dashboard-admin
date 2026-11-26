import { clearTranslations, loadTranslations } from '@angular/localize';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import portuguese from './messages.pt-AO.json';
import spanish from './messages.es.json';
import chinese from './messages.zh-Hans.json';
import { initializeLocale } from './locale';

@Component({
  template: '<p i18n="@@platform-administration">Platform administration</p>',
})
class TranslatedHeading {}

describe('Application translations', () => {
  afterEach(() => clearTranslations());

  it('renders an Angular template from the Portuguese catalogue', () => {
    loadTranslations(portuguese);
    const fixture = TestBed.createComponent(TranslatedHeading);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toBe('Administração da plataforma');
  });

  it('provides identical message IDs for all translated locales', () => {
    expect(Object.keys(spanish).sort()).toEqual(Object.keys(portuguese).sort());
    expect(Object.keys(chinese).sort()).toEqual(Object.keys(portuguese).sort());
  });

  it('loads the selected locale from the shared and feature catalogues at bootstrap', async () => {
    const originalUrl = location.href;
    const originalTitle = document.title;
    const originalLanguage = document.documentElement.lang;
    const storedLocale = localStorage.getItem('prontoequipas.locale');
    try {
      const url = new URL(originalUrl);
      url.searchParams.set('language', 'es');
      history.replaceState(history.state, '', url);
      await initializeLocale();

      expect(document.documentElement.lang).toBe('es');
      expect(document.title).toBe('Administración de la plataforma | PRONTOEQUIPAS');
      expect($localize`:@@contracts-contract-types:Contract types`).toBe('Tipos de contrato');
      expect($localize`:@@organization-organization-hierarchy:Organization hierarchy`).toBe('Jerarquía de la organización');
      expect($localize`:@@employees-registration-queue:Registration queue`).toBe('Cola de altas');
    } finally {
      history.replaceState(history.state, '', originalUrl);
      document.title = originalTitle;
      document.documentElement.lang = originalLanguage;
      if (storedLocale === null) localStorage.removeItem('prontoequipas.locale');
      else localStorage.setItem('prontoequipas.locale', storedLocale);
    }
  });

  it('renders runtime labels in Spanish, Mandarin and the English source', () => {
    const label = () => $localize`:@@platform-administration:Platform administration`;
    loadTranslations(spanish);
    expect(label()).toBe('Administración de la plataforma');
    loadTranslations(chinese);
    expect(label()).toBe('平台管理');
    clearTranslations();
    expect(label()).toBe('Platform administration');
  });
});
