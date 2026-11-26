import { HttpErrorResponse } from '@angular/common/http';
import { clearTranslations, loadTranslations } from '@angular/localize';
import portuguese from '../i18n/messages.pt-AO.json';
import spanish from '../i18n/messages.es.json';
import chinese from '../i18n/messages.zh-Hans.json';
import { organizationAuditAction, organizationAuditResource } from './organization-api-labels';
import { organizationErrorMessage } from './organization-display';

describe('Organization localization', () => {
  const originalLanguage = document.documentElement.lang;

  afterEach(() => {
    clearTranslations();
    document.documentElement.lang = originalLanguage;
  });

  it('provides the same Organization messages for every translated locale', () => {
    expect(Object.keys(spanish).sort()).toEqual(Object.keys(portuguese).sort());
    expect(Object.keys(chinese).sort()).toEqual(Object.keys(portuguese).sort());
    expect(Object.keys(portuguese).every(id => id.startsWith('organization-'))).toBeTrue();
  });

  it('localizes audit records returned by the API in all four languages', () => {
    const action = 'organization.department.moved';
    expect(organizationAuditAction(action)).toBe('Department · Move in hierarchy');
    loadTranslations(portuguese);
    expect(organizationAuditAction(action)).toBe('Departamento · Mudança na hierarquia');
    loadTranslations(spanish);
    expect(organizationAuditAction(action)).toBe('Departamento · Traslado en la jerarquía');
    loadTranslations(chinese);
    expect(organizationAuditAction(action)).toBe('部门 · 层级移动');
    expect(organizationAuditResource('cost_allocation_batch')).toBe('成本分摊');
    expect(organizationAuditAction('organization.department.unknown')).toBe('organization.department.unknown');
  });

  it('keeps the remedy of a known validation error when translated', () => {
    document.documentElement.lang = 'pt-AO';
    loadTranslations(portuguese);
    const error = new HttpErrorResponse({
      status: 409,
      error: { error: { message: 'Code already exists for this organizational resource.' } },
    });
    expect(organizationErrorMessage(error)).toBe('O código já está em uso neste tipo de registo.');
  });
});
