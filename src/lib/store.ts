// LPA Audit System - In-memory store with localStorage persistence

export interface Machine {
  id: string;
  name: string;
  code: string;
  sector: string;
  description: string;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  question: string;
  explanation?: string;
  type: 'ok_nok' | 'text' | 'number';
}

export interface Checklist {
  id: string;
  name: string;
  category: string;
  items: ChecklistItem[];
  createdAt: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  sector: string;
}

export interface ScheduleEntry {
  id: string;
  weekNumber: number;
  dayOfWeek: number; // 0-6
  month: number;
  year: number;
  employeeId: string;
  machineId: string;
  sectorId?: string; // Optional sector reference (used for schedule grouping)
  checklistId: string;
  status: 'pending' | 'completed' | 'missed';
}

export interface Sector {
  id: string;
  name: string;
}

export interface AuditAnswer {
  checklistItemId: string;
  answer: string;
  conformity: 'ok' | 'nok' | 'na';
}

export interface ScheduleModelEntry {
  id: string;
  weekIndex: number; // 1..5
  dayOfWeek: number; // 1..6
  sectorId: string;
  employeeId: string;
}

export interface AuditRecord {
  id: string;
  scheduleEntryId: string;
  employeeId: string;
  machineId: string;
  checklistId: string;
  date: string;
  answers: AuditAnswer[];
  observations: string;
  photos: string[]; // base64
  status: 'conforme' | 'nao_conforme' | 'parcial';
  auditedName?: string;
  auditedRe?: string;
  shift?: string;
  createdAt: string;
}

// --- Helper ---
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

// --- Default Data ---
const defaultEmployees: Employee[] = [];

const defaultMachines: Machine[] = [];

const defaultChecklists: Checklist[] = [];

// --- Mock Audit Data Generator ---
function generateMockData() {
  const employees = defaultEmployees;
  const machines = defaultMachines;
  const checklists = defaultChecklists;

  const scheduleEntries: ScheduleEntry[] = [];
  const auditRecords: AuditRecord[] = [];

  return { scheduleEntries, auditRecords };
}

// Seed mock data on first load
function seedIfEmpty() {
  // Removed seeding of mock data
}

seedIfEmpty();

// --- Store API ---
export const store = {
  // Employees
  getEmployees: (): Employee[] => load('lpa_employees', defaultEmployees),
  saveEmployees: (data: Employee[]) => save('lpa_employees', data),

  // Machines
  getMachines: (): Machine[] => load('lpa_machines', defaultMachines),
  saveMachines: (data: Machine[]) => save('lpa_machines', data),
  addMachine: (m: Omit<Machine, 'id' | 'createdAt'>): Machine => {
    const machines = store.getMachines();
    const newMachine: Machine = { ...m, id: generateId(), createdAt: new Date().toISOString().split('T')[0] };
    machines.push(newMachine);
    store.saveMachines(machines);
    return newMachine;
  },
  updateMachine: (id: string, m: Partial<Machine>) => {
    const machines = store.getMachines().map(x => x.id === id ? { ...x, ...m } : x);
    store.saveMachines(machines);
  },
  deleteMachine: (id: string) => {
    store.saveMachines(store.getMachines().filter(x => x.id !== id));
  },

  // Checklists
  getChecklists: (): Checklist[] => load('lpa_checklists', defaultChecklists),
  saveChecklists: (data: Checklist[]) => save('lpa_checklists', data),
  addChecklist: (c: Omit<Checklist, 'id' | 'createdAt'>): Checklist => {
    const checklists = store.getChecklists();
    const newChecklist: Checklist = { ...c, id: generateId(), createdAt: new Date().toISOString().split('T')[0] };
    checklists.push(newChecklist);
    store.saveChecklists(checklists);
    return newChecklist;
  },
  updateChecklist: (id: string, c: Partial<Checklist>) => {
    const checklists = store.getChecklists().map(x => x.id === id ? { ...x, ...c } : x);
    store.saveChecklists(checklists);
  },
  deleteChecklist: (id: string) => {
    store.saveChecklists(store.getChecklists().filter(x => x.id !== id));
  },

  // Auditor Order (per sector) — defines which employee is suggested for each weekday (Mon-Sat)
  getAuditorOrder: (sector: string): string[] => load(`lpa_auditor_order_${sector}`, []),
  setAuditorOrder: (sector: string, order: string[]) => save(`lpa_auditor_order_${sector}`, order),

  // Rotation pointers (per sector)
  getMachineRotation: (sector: string): number => load(`lpa_machine_rotation_${sector}`, 0),
  setMachineRotation: (sector: string, idx: number) => save(`lpa_machine_rotation_${sector}`, idx),
  getChecklistRotation: (sector: string): number => load(`lpa_checklist_rotation_${sector}`, 0),
  setChecklistRotation: (sector: string, idx: number) => save(`lpa_checklist_rotation_${sector}`, idx),

  // Sectors (derived from machines)
  getSectors: (): Sector[] => {
    const sectors = [...new Set(store.getMachines().map(m => m.sector))].sort();
    return sectors.map(s => ({ id: s, name: s }));
  },

  // Schedule
  getSchedule: (): ScheduleEntry[] => load('lpa_schedule', []),
  saveSchedule: (data: ScheduleEntry[]) => save('lpa_schedule', data),
  addScheduleEntry: (entry: Omit<ScheduleEntry, 'id'>): ScheduleEntry => {
    const schedule = store.getSchedule();
    const newEntry: ScheduleEntry = { ...entry, id: generateId() };
    store.saveSchedule([...schedule, newEntry]);
    return newEntry;
  },

  // Annual schedule model (predefined auditor positions)
  getScheduleModel: (): ScheduleModelEntry[] => load('lpa_schedule_model', []),
  saveScheduleModel: (data: ScheduleModelEntry[]) => save('lpa_schedule_model', data),

  generateSchedule: (month: number, year: number, firstWeekOrSector?: number | string, sectorOverride?: string): ScheduleEntry[] => {
    const allEmployees = store.getEmployees();
    const allMachines = store.getMachines();
    const checklists = store.getChecklists();

    if (allMachines.length === 0 || checklists.length === 0 || allEmployees.length === 0) return [];

    // Determine parameters (legacy support: third param may be sector string)
    const firstWeekNumber = typeof firstWeekOrSector === 'number' ? firstWeekOrSector : undefined;
    const sector = typeof firstWeekOrSector === 'string' ? firstWeekOrSector : sectorOverride;

    // If sector provided, schedule only that sector; otherwise schedule all sectors that have machines.
    const allSectorIds = [...new Set(allMachines.map(m => m.sector))].filter(Boolean).sort();
    const sectorIds = sector ? (allSectorIds.includes(sector) ? [sector] : []) : allSectorIds;
    if (sectorIds.length === 0) return [];

    const machinesBySector = new Map<string, Machine[]>();
    allMachines.forEach(m => {
      const list = machinesBySector.get(m.sector) ?? [];
      list.push(m);
      machinesBySector.set(m.sector, list);
    });

    // Load model template (if any) for predefined auditor positions.
    const modelEntries = store.getScheduleModel();
    const getModelAuditor = (weekIndex: number, dayOfWeek: number, sectorId: string) => {
      const entry = modelEntries.find(e => e.weekIndex === weekIndex && e.dayOfWeek === dayOfWeek && e.sectorId === sectorId);
      return entry ? entry.employeeId : undefined;
    };

    // Use ISO week numbers (1-53) so the schedule lines up with global week numbering.
    const weeksIso = getWeeksOfMonthISO(month, year);
    if (weeksIso.length === 0) return [];
    const weeks = firstWeekNumber !== undefined ? weeksIso.map((_, i) => firstWeekNumber + i) : weeksIso;

    // Load existing schedule entries for this month/year, but keep entries for other months untouched
    const existingAll = store.getSchedule();
    const existingThisMonth = existingAll.filter(e => e.month === month && e.year === year);
    const otherMonths = existingAll.filter(e => !(e.month === month && e.year === year));

    // Only keep existing entries that match the current week numbering (ISO weeks or override).
    const validWeekSet = new Set(weeks);

    // Map existing entries by unique cell (weekNumber + sector + day) to avoid duplicates and preserve edits
    const existingMap = new Map<string, ScheduleEntry>();
    existingThisMonth.forEach(entry => {
      if (!validWeekSet.has(entry.weekNumber)) return; // discard stale week numbering
      const sectorId = entry.sectorId || allMachines.find(m => m.id === entry.machineId)?.sector || '';
      if (!sectorId) return;
      const key = `${entry.weekNumber}-${sectorId}-${entry.dayOfWeek}`;
      if (!existingMap.has(key)) existingMap.set(key, entry);
    });

    // Track which checklist ids have been used by (employee, machine) pairs so we don't repeat checklists for same auditor+machine
    const usedChecklistByPair = new Map<string, Set<string>>();
    const markChecklistUsed = (employeeId: string, machineId: string, checklistId: string) => {
      const key = `${employeeId}:${machineId}`;
      const set = usedChecklistByPair.get(key) ?? new Set<string>();
      set.add(checklistId);
      usedChecklistByPair.set(key, set);
    };

    existingThisMonth.forEach(entry => {
      markChecklistUsed(entry.employeeId, entry.machineId, entry.checklistId);
    });

    const resultEntries: ScheduleEntry[] = [];

    weeks.forEach((weekNumber, weekIdx) => {
      const weekIndex = weekIdx + 1; // 1..5 (max weeks per month)
      sectorIds.forEach((sectorId, sectorIdx) => {
        const sectorMachines = machinesBySector.get(sectorId) ?? [];
        if (sectorMachines.length === 0) return;

        for (let dayOfWeek = 1; dayOfWeek <= 6; dayOfWeek++) {
          const key = `${weekNumber}-${sectorId}-${dayOfWeek}`;
          const existing = existingMap.get(key);
          if (existing) {
            resultEntries.push(existing);
            continue;
          }

          // Pick auditor (model first, then deterministic fallback)
          const modelAuditor = getModelAuditor(weekIndex, dayOfWeek, sectorId);
          const employee = modelAuditor ? allEmployees.find(e => e.id === modelAuditor) : undefined;
          const assignedEmployee =
            employee ||
            allEmployees[(weekIdx * sectorIds.length * 6 + sectorIdx * 6 + (dayOfWeek - 1)) % allEmployees.length];

          // Pick machine by sector rotation so entries cover machines over time
          const rotationKey = sector; // when generating only one sector, keep rotation within that sector
          const machineRotationKey = rotationKey || sectorId;
          const currentMachinePointer = store.getMachineRotation(machineRotationKey);
          const machinePointerNorm = ((currentMachinePointer % sectorMachines.length) + sectorMachines.length) % sectorMachines.length;
          const machine = sectorMachines[(machinePointerNorm + (weekIdx * 6 + (dayOfWeek - 1))) % sectorMachines.length];
          // advance machine rotation for subsequent generations
          store.setMachineRotation(machineRotationKey, machinePointerNorm + 1);

          // Rotate checklist per-sector (keeps variety without depending on machine count)
          const checklistRotationKey = sector || sectorId;
          const normalizePointer = (idx: number) => (idx % checklists.length + checklists.length) % checklists.length;
          let checklistPointer = normalizePointer(store.getChecklistRotation(checklistRotationKey));

          // Avoid reusing the same checklist for the same auditor+machine pair if possible
          const pairKey = `${assignedEmployee.id}:${machine.id}`;
          const usedChecklists = usedChecklistByPair.get(pairKey) ?? new Set<string>();

          let checklistId = checklists[checklistPointer].id;
          let attempts = 0;
          while (usedChecklists.has(checklistId) && attempts < checklists.length) {
            checklistPointer = normalizePointer(checklistPointer + 1);
            checklistId = checklists[checklistPointer].id;
            attempts += 1;
          }

          markChecklistUsed(assignedEmployee.id, machine.id, checklistId);
          store.setChecklistRotation(checklistRotationKey, checklistPointer + 1);

          resultEntries.push({
            id: generateId(),
            weekNumber,
            dayOfWeek,
            month,
            year,
            employeeId: assignedEmployee.id,
            machineId: machine.id,
            sectorId,
            checklistId,
            status: 'pending',
          });
        }
      });
    });

    const all = [...otherMonths, ...resultEntries];
    store.saveSchedule(all);
    return resultEntries;
  },

  updateScheduleEntry: (id: string, data: Partial<ScheduleEntry>) => {
    const schedule = store.getSchedule().map(e => e.id === id ? { ...e, ...data } : e);
    store.saveSchedule(schedule);
  },
  deleteScheduleEntry: (id: string) => {
    store.saveSchedule(store.getSchedule().filter(e => e.id !== id));
  },

  // Audits
  getAudits: (): AuditRecord[] => load('lpa_audits', []),
  saveAudits: (data: AuditRecord[]) => save('lpa_audits', data),
  addAudit: (a: Omit<AuditRecord, 'id' | 'createdAt'>): AuditRecord => {
    const audits = store.getAudits();
    const newAudit: AuditRecord = { ...a, id: generateId(), createdAt: new Date().toISOString() };
    audits.push(newAudit);
    store.saveAudits(audits);
    store.updateScheduleEntry(a.scheduleEntryId, { status: 'completed' });
    return newAudit;
  },

  // Reset mock data
  resetMockData: () => {
    localStorage.removeItem('lpa_audits');
    localStorage.removeItem('lpa_schedule');
    const mock = generateMockData();
    save('lpa_schedule', mock.scheduleEntries);
    save('lpa_audits', mock.auditRecords);
  },
};

function getWeekOfMonth(date: Date): number {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  return Math.ceil((date.getDate() + firstDay.getDay()) / 7);
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeeksOfMonthISO(month: number, year: number): number[] {
  // This returns ISO week numbers relevant for the given month.
  // A week is included only if it has at least 4 days inside the month (ISO-style month boundary).
  const daysPerWeek = new Map<number, number>();
  const d = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  while (d <= lastDay) {
    const w = getISOWeekNumber(d);
    daysPerWeek.set(w, (daysPerWeek.get(w) ?? 0) + 1);
    d.setDate(d.getDate() + 1);
  }

  const weeks = [...daysPerWeek.entries()]
    .filter(([, count]) => count >= 4)
    .map(([week]) => week)
    .sort((a, b) => a - b);

  // If no week qualifies (edge case), fall back to including all weeks present.
  if (weeks.length === 0) {
    return [...daysPerWeek.keys()].sort((a, b) => a - b);
  }

  return weeks;
}

export { getWeekOfMonth, getISOWeekNumber, getWeeksOfMonthISO };
