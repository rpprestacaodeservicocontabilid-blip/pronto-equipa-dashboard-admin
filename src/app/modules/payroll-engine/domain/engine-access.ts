export const ENGINE_SIMULATION = 'simulation';
export const ENGINE_TRACES = 'traces';

export const ENGINE_SECTIONS = [
  { id: ENGINE_SIMULATION, title: 'Simulation', permission: 'payroll:runs:create' },
  { id: ENGINE_TRACES, title: 'Calculation traces', permission: 'payroll:results:read-sensitive' },
] as const;

export function canOpenEngineSection(section: typeof ENGINE_SECTIONS[number], permissions: string[]) {
  return permissions.includes('payroll:read') && permissions.includes(section.permission);
}
