import { useState, useEffect, useMemo, useCallback } from 'react';
import { store, ScheduleEntry, ScheduleModelEntry, AuditRecord, getWeeksOfMonthISO } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wand2, Printer, Pencil, Trash2, Save, History, AlertTriangle, UserX, Cpu } from 'lucide-react';
import { toast } from 'sonner';

// week numbers are now global; month names no longer needed for filtering
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEK_DAYS = [
  { key: 1, label: 'Segunda' },
  { key: 2, label: 'Terça' },
  { key: 3, label: 'Quarta' },
  { key: 4, label: 'Quinta' },
  { key: 5, label: 'Sexta' },
  { key: 6, label: 'Sábado' },
];

function getStatusColor(entry: ScheduleEntry, audits: AuditRecord[]): string {
  if (entry.status === 'missed') return 'bg-red-200 border border-red-500 text-red-900';
  if (entry.status === 'pending') return 'bg-red-200 border border-red-500 text-red-900';
  const audit = audits.find(a => a.scheduleEntryId === entry.id);
  if (!audit) return 'bg-emerald-200 border border-emerald-500 text-emerald-900';
  if (audit.status === 'conforme') return 'bg-emerald-200 border border-emerald-500 text-emerald-900';
  if (audit.status === 'nao_conforme') return 'bg-yellow-200 border border-yellow-500 text-yellow-900';
  return 'bg-amber-200 border border-amber-500 text-amber-900';
}

function getStatusLabel(entry: ScheduleEntry, audits: AuditRecord[]): string {
  if (entry.status === 'missed') return 'Não realizada';
  if (entry.status === 'pending') return 'Pendente';
  const audit = audits.find(a => a.scheduleEntryId === entry.id);
  if (!audit) return 'Realizada';
  if (audit.status === 'conforme') return 'Conforme';
  if (audit.status === 'nao_conforme') return 'Não conforme';
  return 'Parcial';
}

export default function Schedule() {
  const now = new Date();
  const { userType, getEffectiveMinifabrica } = useAuth();
  const effectiveSector = getEffectiveMinifabrica();
  // When `effectiveSector` is null, we show the schedule for all sectors.
  const sectorFilter = effectiveSector;
  const isAdmin = userType === 'administrativo';

  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [histMonth, setHistMonth] = useState(now.getMonth() === 0 ? 11 : now.getMonth() - 1);
  const [histYear, setHistYear] = useState(now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(store.getSchedule());
  const [scheduleModel, setScheduleModel] = useState<ScheduleModelEntry[]>(store.getScheduleModel());
  const [editEntry, setEditEntry] = useState<ScheduleEntry | null>(null);
  const [editForm, setEditForm] = useState({ employeeId: '', machineId: '', checklistId: '', dayOfWeek: 1 });

  const employees = store.getEmployees();
  const sectors = store.getSectors();
  const machines = store.getMachines();
  const checklists = store.getChecklists();
  const audits = store.getAudits();

  const machinesFiltered = sectorFilter ? machines.filter(m => m.sector === sectorFilter) : machines;
  const employeesFiltered = sectorFilter ? employees.filter(e => e.sector === sectorFilter) : employees;

  const machineById = useMemo(() => new Map(machines.map(m => [m.id, m])), [machines]);
  const getEntrySector = useCallback((entry: ScheduleEntry) => entry.sectorId || machineById.get(entry.machineId)?.sector || '', [machineById]);

  const modelForSector = useMemo(() => {
    if (!sectorFilter) return scheduleModel;
    return scheduleModel.filter(m => m.sectorId === sectorFilter);
  }, [scheduleModel, sectorFilter]);

  const visibleSchedule = useMemo(() => {
    if (!sectorFilter) return schedule;
    return schedule.filter(entry => getEntrySector(entry) === sectorFilter);
  }, [schedule, sectorFilter, getEntrySector]);

  const filtered = useMemo(() =>
    visibleSchedule.filter(s => s.month === month && s.year === year).sort((a, b) => a.weekNumber - b.weekNumber || a.dayOfWeek - b.dayOfWeek),
    [visibleSchedule, month, year]
  );

  const histFiltered = useMemo(() =>
    visibleSchedule.filter(s => s.month === histMonth && s.year === histYear).sort((a, b) => a.weekNumber - b.weekNumber || a.dayOfWeek - b.dayOfWeek),
    [visibleSchedule, histMonth, histYear]
  );

  const missedAnalysis = useMemo(() => {
    const allMissed = visibleSchedule.filter(s => s.status === 'missed');
    const byAuditor = new Map<string, number>();
    allMissed.forEach(m => byAuditor.set(m.employeeId, (byAuditor.get(m.employeeId) || 0) + 1));
    const auditorRanking = [...byAuditor.entries()].map(([id, count]) => ({ employee: employees.find(e => e.id === id), count })).filter(r => r.employee).sort((a, b) => b.count - a.count);

    const bySector = new Map<string, number>();
    allMissed.forEach(m => bySector.set(m.sectorId || '', (bySector.get(m.sectorId || '') || 0) + 1));
    const sectorRanking = [...bySector.entries()].map(([id, count]) => ({ sector: sectors.find(s => s.id === id), count })).filter(r => r.sector).sort((a, b) => b.count - a.count);

    return { total: allMissed.length, allMissed, auditorRanking, sectorRanking };
  }, [visibleSchedule, employees, sectors]);

  // Auto-generate schedule when missing or incomplete for the selected month/year
  useEffect(() => {
    // Administrative users must not generate schedule; they only view what's already created by the director.
    if (isAdmin) return;
    if (sectors.length === 0 || checklists.length === 0 || employees.length === 0) return;

    const existingEntries = visibleSchedule.filter(s => s.month === month && s.year === year);
    const weeksIso = getWeeksOfMonthISO(month, year);

    // If we have stale week numbering (e.g., old 1..5 instead of ISO weeks), drop those entries and regenerate.
    const hasStaleWeeks = existingEntries.some(e => !weeksIso.includes(e.weekNumber));
    if (hasStaleWeeks) {
      const cleaned = schedule.filter(e => !(e.month === month && e.year === year && !weeksIso.includes(e.weekNumber)));
      store.saveSchedule(cleaned);
      store.generateSchedule(month, year, sectorFilter || undefined);
      setSchedule(store.getSchedule());
      return;
    }

    // Migration: older versions generated one entry per machine/day. The current model is one entry per sector/day.
    // If we detect duplicates for the same (week, sector, day) in this month, wipe this month and regenerate.
    const dupCounts = new Map<string, number>();
    const getEntrySectorId = (e: ScheduleEntry) => (e.sectorId || machineById.get(e.machineId)?.sector || '').trim();
    existingEntries.forEach(e => {
      const sectorId = getEntrySectorId(e);
      if (!sectorId) return;
      const k = `${e.weekNumber}-${sectorId}-${e.dayOfWeek}`;
      dupCounts.set(k, (dupCounts.get(k) ?? 0) + 1);
    });
    const hasSectorDayDuplicates = [...dupCounts.values()].some(v => v > 1);
    if (hasSectorDayDuplicates) {
      const cleaned = schedule.filter(e => !(e.month === month && e.year === year));
      store.saveSchedule(cleaned);
      store.generateSchedule(month, year, sectorFilter || undefined);
      setSchedule(store.getSchedule());
      return;
    }

    // We schedule one entry per sector per weekday (not per machine).
    const sectorIds = sectorFilter
      ? [sectorFilter]
      : [...new Set(machinesFiltered.map(m => m.sector))].filter(Boolean);

    const existingKeys = new Set(existingEntries.map(e => `${e.weekNumber}-${getEntrySectorId(e)}-${e.dayOfWeek}`));
    const missing = weeksIso.some(weekNumber =>
      sectorIds.some(sectorId =>
        WEEK_DAYS.some(day => !existingKeys.has(`${weekNumber}-${sectorId}-${day.key}`))
      )
    );

    if (missing) {
      store.generateSchedule(month, year, sectorFilter || undefined);
      setSchedule(store.getSchedule());
    }
  }, [month, year, schedule, machinesFiltered, checklists, employees, sectors, visibleSchedule, sectorFilter, isAdmin, machineById]);

  const handleGenerate = () => {
    if (isAdmin) { toast.error('Apenas diretores e gestores podem gerar o cronograma'); return; }
    if (sectors.length === 0 || checklists.length === 0 || employees.length === 0) { toast.error('Cadastre setores, checklists e funcionários antes de gerar'); return; }
    store.generateSchedule(month, year, sectorFilter || undefined);
    setSchedule(store.getSchedule());
    toast.success(`Cronograma de ${MONTHS[month]} gerado com sucesso!`);
  };

  const handleSaveModel = () => {
    store.saveScheduleModel(scheduleModel);
    toast.success('Modelo de cronograma salvo!');
  };

  const handleClearModel = () => {
    setScheduleModel(prev => prev.filter(m => m.sectorId !== sectorFilter));
    toast.success('Modelo de cronograma limpo para esta minifábrica.');
  };

  const handleModelChange = (weekIndex: number, dayOfWeek: number, employeeId: string) => {
    if (!sectorFilter) return;
    setScheduleModel(prev => {
      const existingIndex = prev.findIndex(m => m.weekIndex === weekIndex && m.dayOfWeek === dayOfWeek && m.sectorId === sectorFilter);
      if (!employeeId) {
        if (existingIndex === -1) return prev;
        return prev.filter((_, i) => i !== existingIndex);
      }
      if (existingIndex >= 0) {
        return prev.map((m, i) => i === existingIndex ? { ...m, employeeId } : m);
      }
      return [...prev, { id: Math.random().toString(36).substring(2, 11), weekIndex, dayOfWeek, sectorId: sectorFilter, employeeId }];
    });
  };


  const handleEditOpen = (entry: ScheduleEntry) => {
    if (isAdmin) return;
    setEditEntry(entry);
    setEditForm({ employeeId: entry.employeeId, machineId: entry.machineId, checklistId: entry.checklistId, dayOfWeek: entry.dayOfWeek });
  };

  const handleCreateOpen = (weekNumber: number, sectorId: string, dayOfWeek: number) => {
    if (isAdmin) return;
    const newEntry = {
      id: '',
      weekNumber,
      dayOfWeek,
      month,
      year,
      employeeId: '',
      machineId: '',
      sectorId,
      checklistId: '',
      status: 'pending' as const,
    } as ScheduleEntry;
    setEditEntry(newEntry);
    setEditForm({ employeeId: '', machineId: '', checklistId: '', dayOfWeek });
  };

  const handleEditSave = () => {
    if (!editEntry) return;
    if (!editEntry.id) {
      const created = store.addScheduleEntry({
        weekNumber: editEntry.weekNumber,
        dayOfWeek: editForm.dayOfWeek,
        month: editEntry.month ?? month,
        year: editEntry.year ?? year,
        employeeId: editForm.employeeId,
        machineId: editForm.machineId,
        sectorId: editEntry.sectorId,
        checklistId: editForm.checklistId,
        status: 'pending',
      });
      setSchedule(store.getSchedule());
      setEditEntry(null);
      toast.success('Entrada criada');
      return;
    }

    store.updateScheduleEntry(editEntry.id, {
      employeeId: editForm.employeeId,
      machineId: editForm.machineId,
      checklistId: editForm.checklistId,
      dayOfWeek: editForm.dayOfWeek,
    });
    setSchedule(store.getSchedule());
    setEditEntry(null);
    toast.success('Entrada atualizada');
  };

  const handleDelete = (id: string) => {
    if (isAdmin) return;
    store.deleteScheduleEntry(id);
    setSchedule(store.getSchedule());
    toast.success('Entrada removida');
  };

  const handlePrint = () => window.print();
  
  const printStyles = `
    .schedule-print-wrap.rotate-print { transform: rotate(-90deg) scale(0.9); transform-origin: top left; }

    @page { size: A3 landscape; margin: 8mm; }
    @media print {
      *, *::before, *::after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .no-print, .print-hide, aside, .sidebar { display: none !important; }
      body { margin: 0 !important; background: white !important; }
      html, body { width: 100% !important; overflow: visible !important; }

      body > * { visibility: hidden !important; }
      .schedule-print-wrap, .schedule-print-wrap * { visibility: visible !important; }
      .schedule-print-wrap { display: block !important; position: relative !important; top: 0 !important; left: 0 !important; width: 100% !important; overflow: visible !important; transform: scale(0.76) !important; transform-origin: top left !important; }

      .schedule-print-wrap table { width: 100% !important; min-width: 0 !important; font-size: 10px !important; table-layout: fixed !important; }
      .schedule-print-wrap th, .schedule-print-wrap td { padding: 2px 3px !important; white-space: normal !important; word-break: break-word !important; }
      .schedule-print-wrap th { font-size: 8px !important; }

      .schedule-print-wrap .group { min-height: 26px; }
      table { page-break-after: auto !important; }
      thead { display: table-header-group !important; }
      tfoot { display: table-footer-group !important; }
      tr { page-break-inside: avoid !important; }
      td, th { page-break-inside: avoid !important; }
    }
  `;

  // Group entries by week -> sector
  const groupByWeekSector = useCallback((entries: ScheduleEntry[]) => {
    const weeks = [...new Set(entries.map(e => e.weekNumber))].sort((a, b) => a - b);

    return weeks.map(weekNum => {
      const weekEntries = entries.filter(e => e.weekNumber === weekNum);
      const sectorIds = [...new Set(weekEntries.map(e => e.sectorId || ''))].filter(Boolean);
      const sectorRows = sectorIds.map(sectorId => {
        const sector = sectors.find(s => s.id === sectorId);
        const byDay: Record<number, ScheduleEntry | undefined> = {};
        WEEK_DAYS.forEach(d => {
          byDay[d.key] = weekEntries.find(e => (e.sectorId || '') === sectorId && e.dayOfWeek === d.key);
        });
        return { sectorId, sectorName: sector?.name || 'N/A', byDay };
      });
      return { weekNum, sectorRows };
    });
  }, [sectors]);

  const grouped = useMemo(() => groupByWeekSector(filtered), [filtered, groupByWeekSector]);
  const histGrouped = useMemo(() => groupByWeekSector(histFiltered), [histFiltered, groupByWeekSector]);

  const renderCell = (entry: ScheduleEntry | undefined, isHistory: boolean, weekNum?: number, sectorId?: string) => {
    if (!entry) {
      if (isHistory || isAdmin) return null;
      return (
        <div className="p-2 text-center">
          <button onClick={() => weekNum !== undefined && sectorId && handleCreateOpen(weekNum, sectorId, WEEK_DAYS[0].key)} className="text-xs text-blue-600 hover:underline">Adicionar</button>
        </div>
      );
    }

    const emp = employees.find(e => e.id === entry.employeeId);
    const ck = checklists.find(c => c.id === entry.checklistId);
    const empName = emp?.name || 'N/A';
    const checklistName = ck ? (ck.name) : '';

    const statusText = getStatusLabel(entry, audits);
    const cellBg = getStatusColor(entry, audits);

    return (
      <div className={`group relative px-1.5 py-1 ${cellBg} ${!isHistory ? 'hover:bg-accent/10' : ''}`}>
        <div className="flex items-baseline gap-1">
          <span className="text-[9px] text-muted-foreground/60 uppercase">Quem</span>
          <span className="font-bold text-[11px] leading-tight">{empName}</span>
        </div>
        <div className="text-[9px] text-muted-foreground leading-tight pl-0.5">{checklistName}</div>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-[9px] text-muted-foreground/60 uppercase">Status</span>
          <span className="text-[9px] text-muted-foreground">{statusText}</span>
        </div>
        {!isHistory && !isAdmin && (
          <div className="absolute top-0 right-0 hidden group-hover:flex gap-0.5 no-print">
            <button onClick={() => handleEditOpen(entry)} className="p-0.5 rounded hover:bg-accent/20"><Pencil className="h-2.5 w-2.5 text-muted-foreground" /></button>
            <button onClick={() => handleDelete(entry.id)} className="p-0.5 rounded hover:bg-destructive/20"><Trash2 className="h-2.5 w-2.5 text-destructive" /></button>
          </div>
        )}
      </div>
    );
  };

  const renderScheduleMatrix = (weekGroups: { weekNum: number; sectorRows: { sectorId: string; sectorName: string; byDay: Record<number, ScheduleEntry | undefined> }[] }[], isHistory: boolean) => {
    if (weekGroups.length === 0) return (
      <Card><CardContent className="py-12 text-center">
        <p className="text-muted-foreground">Nenhum cronograma para este período.</p>
        {!isHistory && !isAdmin && <Button className="mt-4" onClick={handleGenerate}><Wand2 className="mr-2 h-4 w-4" />Gerar Cronograma</Button>}
        {!isHistory && isAdmin && <p className="text-sm text-muted-foreground mt-4">Solicite ao diretor da sua minifábrica que gere o cronograma.</p>}
      </CardContent></Card>
    );

    return (
      <Card className="overflow-hidden schedule-print-wrap">
        {/* Blue title bar */}
        <div className="bg-blue-700 text-white text-center py-2 px-4">
          <h2 className="text-sm font-bold tracking-wide uppercase">Cronograma Auditoria Escalonada</h2>
        </div>
        {isHistory && (
          <div className="flex items-center gap-3 p-2 border-b flex-wrap bg-muted/30">
            <span className="text-xs font-medium text-muted-foreground">Legenda:</span>
            <span className="flex items-center gap-1.5 text-xs">
              <span className="inline-block w-3 h-3 rounded border border-emerald-500/50 bg-emerald-500/30" />
              Conforme
            </span>
            <span className="flex items-center gap-1.5 text-xs">
              <span className="inline-block w-3 h-3 rounded border border-yellow-500/50 bg-yellow-500/30" />
              Não Conforme
            </span>
            <span className="flex items-center gap-1.5 text-xs">
              <span className="inline-block w-3 h-3 rounded border border-red-500/50 bg-red-500/30" />
              Não Realizada
            </span>
          </div>
        )}
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-blue-800 text-white">
                <th className="border border-blue-600 px-2 py-1.5 text-[10px] font-bold text-center w-14">SEMANA</th>
                <th className="border border-blue-600 px-2 py-1.5 text-[10px] font-bold text-left min-w-[110px]">ONDE</th>
                {WEEK_DAYS.map(d => (
                  <th key={d.key} className="border border-blue-600 px-1 py-1.5 text-[10px] font-bold text-center min-w-[120px] uppercase">{d.label}</th>
                ))}
                <th className="border border-blue-600 px-1 py-1.5 text-[10px] font-bold text-center min-w-[100px]">NÍVEL 02<br/>SEMANAL</th>
                <th className="border border-blue-600 px-1 py-1.5 text-[10px] font-bold text-center min-w-[100px]">DEMAIS<br/>NÍVEIS</th>
              </tr>
            </thead>
            <tbody>
              {weekGroups.map(({ weekNum, sectorRows }) =>
                sectorRows.map((row, rIdx) => (
                  <tr key={`${weekNum}-${row.sectorId}`} className={`border-b ${rIdx === sectorRows.length - 1 ? 'border-b-2 border-foreground/20' : 'border-border'}`}>
                    {rIdx === 0 && (
                      <td rowSpan={sectorRows.length} className="border border-border px-2 py-1 text-center font-bold text-sm align-middle bg-muted/20">
                        {weekNum}
                      </td>
                    )}
                    <td className="border border-border px-2 py-1 font-semibold text-[11px] bg-muted/10 whitespace-nowrap">
                      {row.sectorName}
                    </td>
                    {WEEK_DAYS.map(day => (
                      <td key={day.key} className="border border-border p-0 align-top min-h-[40px]">
                        {renderCell(row.byDay[day.key], isHistory, weekNum, row.sectorId)}
                      </td>
                    ))}
                    {/* Nível 02 Semanal */}
                    <td className="border border-border p-0 align-top">
                      {rIdx === 0 && row.byDay[WEEK_DAYS[0].key] ? (() => {
                        const entry = row.byDay[WEEK_DAYS[0].key]!;
                        const emp = employees.find(e => e.id === entry.employeeId);
                        return (
                          <div className="px-1.5 py-1">
                            <div className="font-bold text-[11px]">{emp?.name || 'N/A'}</div>
                            <div className="text-[10px] text-muted-foreground">{emp?.sector || ''}</div>
                          </div>
                        );
                      })() : null}
                    </td>
                    {/* Demais Níveis */}
                    <td className="border border-border p-0 align-top">
                      {rIdx === 0 && row.byDay[WEEK_DAYS[5]?.key] ? (() => {
                        const entry = row.byDay[WEEK_DAYS[5].key]!;
                        const emp = employees.find(e => e.id === entry.employeeId);
                        return (
                          <div className="px-1.5 py-1">
                            <div className="font-bold text-[11px]">{emp?.name || 'N/A'}</div>
                            <div className="text-[10px] text-muted-foreground">{emp?.sector || ''}</div>
                          </div>
                        );
                      })() : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {/* Legend */}
          <div className="border-t p-3">
            <table className="text-[10px]">
              <tbody>
                <tr><td className="font-bold border border-border px-2 py-0.5 bg-muted/30">ONDE</td><td className="border border-border px-2 py-0.5">Local a ser auditado</td></tr>
                <tr><td className="font-bold border border-border px-2 py-0.5 bg-muted/30">MOTIVO</td><td className="border border-border px-2 py-0.5">Por que será auditado</td></tr>
                <tr><td className="font-bold border border-border px-2 py-0.5 bg-muted/30">QUEM</td><td className="border border-border px-2 py-0.5">Auditor responsável por realizar</td></tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 schedule-page">
      <style>{printStyles}</style>
      <div className="flex flex-wrap items-center justify-between gap-4 print-hide">
        <div>
          <h1 className="text-2xl font-bold">Cronograma de Auditorias</h1>
          <p className="text-sm text-muted-foreground">Planejamento, histórico e análise</p>
        </div>
      </div>

      <Tabs defaultValue="current" className="space-y-4">
        <TabsList className="print-hide">
          <TabsTrigger value="current">Cronograma Atual</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-1.5 h-4 w-4" />Histórico</TabsTrigger>
          <TabsTrigger value="missed"><AlertTriangle className="mr-1.5 h-4 w-4" />Não Realizadas</TabsTrigger>
          {userType === 'diretor' && <TabsTrigger value="model">Modelo</TabsTrigger>}
        </TabsList>

        <TabsContent value="current" className="space-y-4">
          <div className="flex flex-wrap gap-2 no-print">
            <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            {!isAdmin && <Button variant="outline" onClick={handleGenerate}><Wand2 className="mr-2 h-4 w-4" />Gerar Automático</Button>}
            <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
          </div>
          {renderScheduleMatrix(grouped, false)}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex flex-wrap gap-2 no-print">
            <Select value={String(histMonth)} onValueChange={v => setHistMonth(Number(v))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(histYear)} onValueChange={v => setHistYear(Number(v))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
          </div>
          {renderScheduleMatrix(histGrouped, true)}
        </TabsContent>

        <TabsContent value="missed" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Total Não Realizadas</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold text-destructive">{missedAnalysis.total}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><UserX className="h-4 w-4 text-destructive" /> Auditor com Mais Faltas</CardTitle></CardHeader>
              <CardContent>
                {missedAnalysis.auditorRanking[0] ? (<><p className="text-lg font-bold">{missedAnalysis.auditorRanking[0].employee?.name}</p><p className="text-sm text-muted-foreground">{missedAnalysis.auditorRanking[0].count} não realizada(s)</p></>) : <p className="text-muted-foreground">Nenhuma</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Cpu className="h-4 w-4 text-destructive" /> Setor Mais Afetado</CardTitle></CardHeader>
              <CardContent>
                {missedAnalysis.sectorRanking[0] ? (<><p className="text-lg font-bold">{missedAnalysis.sectorRanking[0].sector?.name}</p><p className="text-sm text-muted-foreground">{missedAnalysis.sectorRanking[0].count} perdida(s)</p></>) : <p className="text-muted-foreground">Nenhuma</p>}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Ranking Auditores — Não Realizadas</CardTitle></CardHeader>
              <CardContent>
                {missedAnalysis.auditorRanking.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados</p> : (
                  <Table>
                    <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Auditor</TableHead><TableHead>Setor</TableHead><TableHead className="text-right">Qtd</TableHead></TableRow></TableHeader>
                    <TableBody>{missedAnalysis.auditorRanking.map((r, i) => (
                      <TableRow key={r.employee!.id}><TableCell className="font-medium">{i + 1}</TableCell><TableCell>{r.employee!.name}</TableCell><TableCell className="text-muted-foreground">{r.employee!.sector}</TableCell><TableCell className="text-right"><Badge variant="destructive">{r.count}</Badge></TableCell></TableRow>
                    ))}</TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Ranking Setores — Perdidas</CardTitle></CardHeader>
              <CardContent>
                {missedAnalysis.sectorRanking.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados</p> : (
                  <Table>
                    <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Setor</TableHead><TableHead className="text-right">Qtd</TableHead></TableRow></TableHeader>
                    <TableBody>{missedAnalysis.sectorRanking.map((r, i) => (
                      <TableRow key={r.sector!.id}><TableCell className="font-medium">{i + 1}</TableCell><TableCell>{r.sector!.name}</TableCell><TableCell className="text-right"><Badge variant="destructive">{r.count}</Badge></TableCell></TableRow>
                    ))}</TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Lista Completa — Não Realizadas</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {missedAnalysis.allMissed.length === 0 ? <p className="p-6 text-center text-muted-foreground">Nenhuma auditoria não realizada.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Mês/Ano</TableHead><TableHead>Semana</TableHead><TableHead>Dia</TableHead><TableHead>Auditor</TableHead><TableHead>Setor</TableHead><TableHead>Checklist</TableHead></TableRow></TableHeader>
                  <TableBody>{missedAnalysis.allMissed.map(entry => {
                    const emp = employees.find(e => e.id === entry.employeeId);
                    const setor = sectors.find(s => s.id === (entry.sectorId || ''));
                    const ck = checklists.find(c => c.id === entry.checklistId);
                    return (<TableRow key={entry.id}><TableCell>{MONTHS[entry.month]} {entry.year}</TableCell><TableCell>{entry.weekNumber}</TableCell><TableCell>{WEEK_DAYS.find(d => d.key === entry.dayOfWeek)?.label || '—'}</TableCell><TableCell>{emp?.name || 'N/A'}</TableCell><TableCell>{setor?.name || 'N/A'}</TableCell><TableCell>{ck?.name || 'N/A'}</TableCell></TableRow>);
                  })}</TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {userType === 'diretor' && (
          <TabsContent value="model">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Modelo Anual de Cronograma</h2>
                  <p className="text-sm text-muted-foreground">Defina quais auditores ficam em cada posição (até 5 semanas) para sua minifábrica.</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClearModel}>Limpar Modelo</Button>
                  <Button onClick={handleSaveModel}><Save className="mr-2 h-4 w-4" />Salvar Modelo</Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-blue-800 text-white">
                      <th className="border border-blue-600 px-2 py-1.5 text-[10px] font-bold text-center">Semana</th>
                      {WEEK_DAYS.map(d => (
                        <th key={d.key} className="border border-blue-600 px-2 py-1.5 text-[10px] font-bold text-center">{d.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map(weekIndex => (
                      <tr key={weekIndex} className="border-b border-border">
                        <td className="border border-border px-2 py-1 text-center font-semibold">{weekIndex}</td>
                        {WEEK_DAYS.map(day => {
                          const modelEntry = modelForSector.find(m => m.weekIndex === weekIndex && m.dayOfWeek === day.key);
                          return (
                            <td key={day.key} className="border border-border p-1">
                              <Select value={modelEntry?.employeeId || ''} onValueChange={v => handleModelChange(weekIndex, day.key, v)}>
                                <SelectTrigger className="w-full"><SelectValue placeholder="(vazio)" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">(vazio)</SelectItem>
                                  {employeesFiltered.map(e => (
                                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-muted-foreground">Nota: ao gerar o cronograma, o sistema usará este modelo e ajustará o número de semanas conforme o mês selecionado (meses com 4 semanas ignoram a 5ª semana).</p>
            </div>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={!!editEntry} onOpenChange={() => setEditEntry(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Entrada</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Dia da Semana</Label>
              <Select value={String(editForm.dayOfWeek)} onValueChange={v => setEditForm(f => ({ ...f, dayOfWeek: Number(v) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{WEEK_DAYS.map(d => <SelectItem key={d.key} value={String(d.key)}>{d.label}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label>Funcionário</Label>
              <Select value={editForm.employeeId} onValueChange={v => setEditForm(f => ({ ...f, employeeId: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{employeesFiltered.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label>Máquina</Label>
              <Select value={editForm.machineId} onValueChange={v => setEditForm(f => ({ ...f, machineId: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{machinesFiltered.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label>Checklist</Label>
              <Select value={editForm.checklistId} onValueChange={v => setEditForm(f => ({ ...f, checklistId: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{checklists.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <Button className="w-full" onClick={handleEditSave}><Save className="mr-2 h-4 w-4" />Salvar Alterações</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
