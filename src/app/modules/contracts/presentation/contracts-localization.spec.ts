import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { clearTranslations, loadTranslations } from '@angular/localize';
import { of } from 'rxjs';
import portuguese from '../i18n/messages.pt-AO.json';
import spanish from '../i18n/messages.es.json';
import chinese from '../i18n/messages.zh-Hans.json';
import { ContractsApi } from '../infrastructure/contracts-api.service';
import { contractErrorMessage, isContractVersionConflict } from './contract-errors';
import { contractAmount, contractSalaryPattern, formatContractDate, normalizeContractSalary } from './format-contract';
import { ContractTypesComponent } from './types/contract-types.component';

describe('Contracts localization', () => {
  const originalLanguage = document.documentElement.lang;

  afterEach(() => {
    clearTranslations();
    document.documentElement.lang = originalLanguage;
  });

  it('renders translated labels and interpolations while preserving company-defined type names', () => {
    loadTranslations(portuguese);
    TestBed.configureTestingModule({
      providers: [{
        provide: ContractsApi,
        useValue: { types: () => of([{
          id: 1, companyId: 1, code: 'FIXED', name: 'Tipo interno',
          requiresEndDate: true, maxRenewals: 2, legalRuleVersionId: 'V1', active: true,
        }]) },
      }],
    });
    const fixture = TestBed.createComponent(ContractTypesComponent);
    fixture.componentRef.setInput('context', {
      company: { id: 1, name: 'Empresa', status: 'ACTIVE' }, permissions: ['contracts.types.manage'],
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Tipos de contrato');
    expect(text).toContain('Tipo interno');
    expect(text).toContain('Máximo de renovações: 2');
    expect(text).toContain('Versão da regra legal V1');
  });

  it('preserves version conflict detection when the error is translated', () => {
    const error = new HttpErrorResponse({
      status: 409, error: { error: { message: 'Contract was changed by another operation.' } },
    });
    expect(isContractVersionConflict(error)).toBeTrue();
    loadTranslations(spanish);
    expect(contractErrorMessage(error)).toContain('Otra operación modificó el contrato.');
    loadTranslations(chinese);
    expect(contractErrorMessage(error)).toBe('合同已被其他操作修改，请重新加载后重试。');
    clearTranslations();
    expect(contractErrorMessage(error)).toContain('Reload it and try again.');
  });

  it('formats AOA in the active locale and normalizes decimal salary input for the API', () => {
    document.documentElement.lang = 'pt-AO';
    expect(formatContractDate('2026-11-25')).toBe(
      new Intl.DateTimeFormat('pt-AO', { timeZone: 'UTC' }).format(new Date('2026-11-25')),
    );
    expect(contractAmount('1234,50', 'AOA')).toBe(
      new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', currencyDisplay: 'code' }).format(1234.5),
    );
    expect(contractSalaryPattern.test('1234,50')).toBeTrue();
    expect(contractSalaryPattern.test('1234,500')).toBeFalse();
    expect(normalizeContractSalary('1234,50')).toBe('1234.50');
  });
});
