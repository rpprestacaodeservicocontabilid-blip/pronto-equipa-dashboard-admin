import { clearTranslations, loadTranslations } from '@angular/localize';
import portuguese from '../i18n/messages.pt-AO.json';
import spanish from '../i18n/messages.es.json';
import chinese from '../i18n/messages.zh-Hans.json';
import { previewEmployees } from '../domain/employee-registration';
import { employeeDocumentStatus, employeeImportError, employeeProfileOption } from './employee-display';

describe('Employee localization', () => {
  afterEach(() => clearTranslations());

  it('localizes labels and API messages in all four languages', () => {
    expect(employeeProfileOption('PASSPORT')).toBe('Passport');
    loadTranslations(portuguese);
    expect(employeeProfileOption('PASSPORT')).toBe('Passaporte');
    expect(employeeImportError('Employee number already exists in this company.'))
      .toBe('Já existe um trabalhador com esse número na empresa.');
    loadTranslations(spanish);
    expect(employeeProfileOption('PASSPORT')).toBe('Pasaporte');
    loadTranslations(chinese);
    expect(employeeProfileOption('PASSPORT')).toBe('护照');
    expect(employeeDocumentStatus('ACTIVE')).toBe('有效');
  });

  it('keeps canonical import headers and localizes validation for invalid CSV records', () => {
    loadTranslations(portuguese);
    const preview = previewEmployees('employeeNumber,firstName,lastName,admissionDate\nN1,Ana,Silva,2026-11-25\nN1,João,Silva,2026-11-25');
    expect(preview.employees.map(row => row.employeeNumber)).toEqual(['N1']);
    expect(preview.errors).toEqual([{ record: 2, message: 'Número de trabalhador duplicado neste ficheiro.' }]);
    expect(() => previewEmployees('employeeNumber,firstName,lastName,admissionDate\n"open'))
      .toThrowError('O CSV contém um campo com aspas por fechar.');
  });
});
