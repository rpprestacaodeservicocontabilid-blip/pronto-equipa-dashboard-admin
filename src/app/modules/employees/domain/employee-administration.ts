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
    title: 'Identification', multiple: true, read: 'employees.identifications.read', manage: 'employees.identifications.manage',
    fields: [
      { key: 'type', label: 'Document type', options: ['BI', 'PASSPORT', 'RESIDENCE_PERMIT', 'OTHER'], required: true },
      { key: 'number', label: 'Document number', max: 60, required: true },
      { key: 'issuedOn', label: 'Issue date', type: 'date' },
      { key: 'expiresOn', label: 'Expiry date', type: 'date' },
    ],
  },
  address: {
    title: 'Address and contacts', ...personal,
    fields: [
      { key: 'country', label: 'Country', max: 80 }, { key: 'province', label: 'Province', max: 100 },
      { key: 'municipality', label: 'Municipality', max: 100 }, { key: 'district', label: 'District or commune', max: 100 },
      { key: 'neighbourhood', label: 'Neighbourhood', max: 100 }, { key: 'streetAddress', label: 'Street address', max: 250 },
      { key: 'alternatePhone', label: 'Alternate telephone', type: 'tel', max: 40 },
      { key: 'workEmail', label: 'Work email', type: 'email', max: 255 },
    ],
  },
  tax: {
    title: 'Tax and social security', read: 'employees.tax.read', manage: 'employees.tax.manage',
    fields: [
      { key: 'nif', label: 'NIF', max: 30 }, { key: 'socialSecurityNumber', label: 'INSS number', max: 40 },
      { key: 'taxResidence', label: 'Tax residence', max: 100 }, { key: 'taxRegime', label: 'Tax regime', max: 100 },
      { key: 'contributionStatus', label: 'Contribution status', max: 100 },
    ],
  },
  emergency: {
    title: 'Emergency contacts', multiple: true, ...personal,
    fields: [
      { key: 'name', label: 'Name', max: 160, required: true }, { key: 'relationship', label: 'Relationship', max: 80, required: true },
      { key: 'phone', label: 'Telephone', type: 'tel', max: 40, required: true },
      { key: 'alternatePhone', label: 'Alternate telephone', type: 'tel', max: 40 },
    ],
  },
  qualifications: {
    title: 'Education and qualifications', multiple: true, ...personal,
    fields: [
      { key: 'title', label: 'Title', max: 160, required: true }, { key: 'institution', label: 'Institution', max: 160 },
      { key: 'kind', label: 'Type', options: ['EDUCATION', 'TRAINING', 'CERTIFICATION'], required: true },
      { key: 'completedOn', label: 'Completion date', type: 'date' }, { key: 'expiresOn', label: 'Expiry date', type: 'date' },
    ],
  },
};
