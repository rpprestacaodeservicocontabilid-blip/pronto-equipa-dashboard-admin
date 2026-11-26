import { EmployeeRegistration } from './employee.models';

export type ProfileSection = 'identification' | 'address' | 'tax' | 'emergency' | 'qualifications';
export type ProfileFields = Record<string, string>;
export type ProfileContent = ProfileFields | { entries: ProfileFields[] };
export interface ProfileVersion { version: number; content: ProfileContent }
export type RegistrationStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
export interface RegistrationSummary {
  id: string;
  status: RegistrationStatus;
  version: number;
  createdBy: number;
  employeeNumber?: string;
  firstName?: string;
  lastName?: string;
  employeeId: string | null;
  decisionReason: string | null;
  updatedAt: string;
}
export interface RegistrationDetails extends RegistrationSummary { content: Partial<EmployeeRegistration> }
export interface RegistrationsPage { items: RegistrationSummary[]; page: number; limit: number; total: number }

interface Field {
  key: string;
  label: string;
  max?: number;
  required?: boolean;
  type?: 'date' | 'email' | 'tel';
  options?: readonly string[];
}
interface Section {
  title: string;
  fields: Field[];
  multiple?: boolean;
  read: string;
  manage: string;
}
const personal = { read: 'employees.personal.read', manage: 'employees.personal.manage' };
export const employeeProfileSections: Record<ProfileSection, Section> = {
  identification: {
    title: $localize`:@@employees-identification:Identification`, multiple: true, read: 'employees.identifications.read', manage: 'employees.identifications.manage',
    fields: [
      { key: 'type', label: $localize`:@@employees-document-type:Document type`, options: ['BI', 'PASSPORT', 'RESIDENCE_PERMIT', 'OTHER'], required: true },
      { key: 'number', label: $localize`:@@employees-document-number:Document number`, max: 60, required: true },
      { key: 'issuedOn', label: $localize`:@@employees-issue-date:Issue date`, type: 'date' },
      { key: 'expiresOn', label: $localize`:@@employees-expiry-date:Expiry date`, type: 'date' },
    ],
  },
  address: {
    title: $localize`:@@employees-address-and-contacts:Address and contacts`, ...personal,
    fields: [
      { key: 'country', label: $localize`:@@employees-country:Country`, max: 80 }, { key: 'province', label: $localize`:@@employees-province:Province`, max: 100 },
      { key: 'municipality', label: $localize`:@@employees-municipality:Municipality`, max: 100 }, { key: 'district', label: $localize`:@@employees-district-or-commune:District or commune`, max: 100 },
      { key: 'neighbourhood', label: $localize`:@@employees-neighbourhood:Neighbourhood`, max: 100 }, { key: 'streetAddress', label: $localize`:@@employees-street-address:Street address`, max: 250 },
      { key: 'alternatePhone', label: $localize`:@@employees-alternate-telephone:Alternate telephone`, type: 'tel', max: 40 },
      { key: 'workEmail', label: $localize`:@@employees-work-email:Work email`, type: 'email', max: 255 },
    ],
  },
  tax: {
    title: $localize`:@@employees-tax-and-social-security:Tax and social security`, read: 'employees.tax.read', manage: 'employees.tax.manage',
    fields: [
      { key: 'nif', label: 'NIF', max: 30 }, { key: 'socialSecurityNumber', label: $localize`:@@employees-inss-number:INSS number`, max: 40 },
      { key: 'taxResidence', label: $localize`:@@employees-tax-residence:Tax residence`, max: 100 }, { key: 'taxRegime', label: $localize`:@@employees-tax-regime:Tax regime`, max: 100 },
      { key: 'contributionStatus', label: $localize`:@@employees-contribution-status:Contribution status`, max: 100 },
    ],
  },
  emergency: {
    title: $localize`:@@employees-emergency-contacts:Emergency contacts`, multiple: true, ...personal,
    fields: [
      { key: 'name', label: $localize`:@@employees-name:Name`, max: 160, required: true }, { key: 'relationship', label: $localize`:@@employees-relationship:Relationship`, max: 80, required: true },
      { key: 'phone', label: $localize`:@@employees-telephone:Telephone`, type: 'tel', max: 40, required: true },
      { key: 'alternatePhone', label: $localize`:@@employees-alternate-telephone:Alternate telephone`, type: 'tel', max: 40 },
    ],
  },
  qualifications: {
    title: $localize`:@@employees-education-and-qualifications:Education and qualifications`, multiple: true, ...personal,
    fields: [
      { key: 'title', label: $localize`:@@employees-title:Title`, max: 160, required: true }, { key: 'institution', label: $localize`:@@employees-institution:Institution`, max: 160 },
      { key: 'kind', label: $localize`:@@employees-type:Type`, options: ['EDUCATION', 'TRAINING', 'CERTIFICATION'], required: true },
      { key: 'completedOn', label: $localize`:@@employees-completion-date:Completion date`, type: 'date' }, { key: 'expiresOn', label: $localize`:@@employees-expiry-date:Expiry date`, type: 'date' },
    ],
  },
};
