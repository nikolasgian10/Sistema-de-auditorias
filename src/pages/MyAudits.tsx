import { useState, useMemo } from 'react';
import { store, ScheduleEntry, AuditRecord, getISOWeekNumber, getWeeksOfMonthISO } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, Clock, AlertTriangle, Eye, ClipboardCheck, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function MyAudits() {
  const navigate = useNavigate();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth()));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [detailAudit, setDetailAudit] = useState<AuditRecord | null>(null);

  const employees = store.getEmployees();
  const machines = store.getMachines();
  const checklists = store.getChecklists();
  const schedule = store.getSchedule();
  const audits = store.getAudits();

  const month = Number(selectedMonth);
  const year = Number(selectedYear);

  const weeksOfMonth = useMemo(() => getWeeksOfMonthISO(month, year), [month, year]);

  // Filter schedule entries for the selected period
  const filteredSchedule = useMemo(() => {
    let entries = schedule.filter(s => s.month === month && s.year === year);
    if (selectedWeek !== 'all') entries = entries.filter(s => s.weekNumber === Number(selectedWeek));
    if (selectedEmployee !== 'all') entries = entries.filter(s => s.employeeId === selectedEmployee);
    return entries;
  }, [schedule, month, year, selectedWeek, selectedEmployee]);

  const pendingEntries = useMemo(() => filteredSchedule.filter(s => s.status === 'pending'), [filteredSchedule]);
  const completedEntries = useMemo(() => filteredSchedule.filter(s => s.status === 'completed'), [filteredSchedule]);
  const missedEntries = useMemo(() => filteredSchedule.filter(s => s.status === 'missed'), [filteredSchedule]);

  const getAuditForEntry = (entryId: string) => audits.find(a => a.scheduleEntryId === entryId);

  const statusBadge = (status: string) => {
    if (status === 'conforme') return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Conforme</Badge>;
    if (status === 'nao_conforme') return <Badge className="bg-destructive/10 text-destructive border-destructive/30">Não Conforme</Badge>;
    if (status === 'parcial') return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Parcial</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  const renderEntryRow = (entry: ScheduleEntry, showActions: boolean) => {
    const emp = employees.find(e => e.id === entry.employeeId);
    const mach = machines.find(m => m.id === entry.machineId);
    const ck = checklists.find(c => c.id === entry.checklistId);
    const audit = getAuditForEntry(entry.id);
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    return (
      <TableRow key={entry.id}>
        <TableCell className="text-xs font-medium">{emp?.name || 'N/A'}</TableCell>
        <TableCell className="text-xs">{mach?.name || 'N/A'}</TableCell>
        <TableCell className="text-xs">{ck?.name || 'N/A'}</TableCell>
        <TableCell className="text-xs text-center">Sem {entry.weekNumber}</TableCell>
        <TableCell className="text-xs text-center">{days[entry.dayOfWeek] || '–'}</TableCell>
        <TableCell className="text-xs text-center">
          {entry.status === 'pending' && <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>}
          {entry.status === 'completed' && audit && statusBadge(audit.status)}
          {entry.status === 'missed' && <Badge className="bg-destructive/10 text-destructive border-destructive/30"><AlertTriangle className="h-3 w-3 mr-1" />Atrasada</Badge>}
        </TableCell>
        <TableCell className="text-xs text-center">
          {showActions && entry.status === 'pending' && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate('/mobile-audit')}>
              <ClipboardCheck className="h-3 w-3 mr-1" />Fazer
            </Button>
          )}
          {entry.status === 'completed' && audit && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDetailAudit(audit)}>
              <Eye className="h-3 w-3 mr-1" />Ver
            </Button>
          )}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Minhas Auditorias</h1>
        <p className="text-sm text-muted-foreground">Acompanhe suas auditorias pendentes, concluídas e atrasadas</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Auditor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos auditores</SelectItem>
            {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>{[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={selectedWeek} onValueChange={setSelectedWeek}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Semana" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas semanas</SelectItem>
            {weeksOfMonth.map(w => <SelectItem key={w} value={String(w)}>Semana {w}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{pendingEntries.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">Concluídas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{completedEntries.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">Atrasadas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{missedEntries.length}</p></CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending"><Clock className="mr-1.5 h-4 w-4" />Pendentes ({pendingEntries.length})</TabsTrigger>
          <TabsTrigger value="completed"><CheckCircle2 className="mr-1.5 h-4 w-4" />Concluídas ({completedEntries.length})</TabsTrigger>
          <TabsTrigger value="missed"><AlertTriangle className="mr-1.5 h-4 w-4" />Atrasadas ({missedEntries.length})</TabsTrigger>
        </TabsList>

        {[
          { key: 'pending', entries: pendingEntries, empty: 'Nenhuma auditoria pendente para este período.', actions: true },
          { key: 'completed', entries: completedEntries, empty: 'Nenhuma auditoria concluída neste período.', actions: false },
          { key: 'missed', entries: missedEntries, empty: 'Nenhuma auditoria atrasada neste período.', actions: false },
        ].map(tab => (
          <TabsContent key={tab.key} value={tab.key}>
            {tab.entries.length === 0 ? (
              <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">{tab.empty}</p></CardContent></Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Auditor</TableHead>
                        <TableHead className="text-xs">Máquina</TableHead>
                        <TableHead className="text-xs">Checklist</TableHead>
                        <TableHead className="text-xs text-center">Semana</TableHead>
                        <TableHead className="text-xs text-center">Dia</TableHead>
                        <TableHead className="text-xs text-center">Status</TableHead>
                        <TableHead className="text-xs text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tab.entries.map(e => renderEntryRow(e, tab.actions))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Audit Detail Dialog */}
      <Dialog open={!!detailAudit} onOpenChange={() => setDetailAudit(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {detailAudit && (() => {
            const emp = employees.find(e => e.id === detailAudit.employeeId);
            const mach = machines.find(m => m.id === detailAudit.machineId);
            const ck = checklists.find(c => c.id === detailAudit.checklistId);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    Resultado da Auditoria
                    {statusBadge(detailAudit.status)}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Auditor:</span> <strong>{emp?.name}</strong></div>
                    <div><span className="text-muted-foreground">Máquina:</span> <strong>{mach?.name}</strong></div>
                    <div><span className="text-muted-foreground">Checklist:</span> <strong>{ck?.name}</strong></div>
                    <div><span className="text-muted-foreground">Data:</span> <strong>{new Date(detailAudit.createdAt).toLocaleDateString('pt-BR')}</strong></div>
                    {(detailAudit.auditedName || detailAudit.auditedRe) && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Auditado:</span>{' '}
                        <strong>{detailAudit.auditedName || '—'}</strong>
                        {detailAudit.auditedRe ? <span className="text-muted-foreground"> · RE </span> : null}
                        {detailAudit.auditedRe ? <strong>{detailAudit.auditedRe}</strong> : null}
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-2">Respostas</h4>
                    <div className="space-y-2">
                      {detailAudit.answers.map((ans, i) => {
                        const item = ck?.items.find(it => it.id === ans.checklistItemId);
                        return (
                          <div key={i} className="flex items-center justify-between rounded-md border p-2">
                            <span className="text-sm flex-1">{item?.question || ans.checklistItemId}</span>
                            {ans.conformity === 'ok' ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 ml-2"><CheckCircle2 className="h-3 w-3 mr-1" />OK</Badge>
                            ) : ans.conformity === 'nok' ? (
                              <Badge className="bg-destructive/10 text-destructive border-destructive/30 ml-2"><XCircle className="h-3 w-3 mr-1" />NOK</Badge>
                            ) : (
                              <Badge variant="secondary" className="ml-2">NA</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {detailAudit.observations && (
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Observações</h4>
                      <p className="text-sm text-muted-foreground bg-muted/50 rounded p-2">{detailAudit.observations}</p>
                    </div>
                  )}

                  {detailAudit.photos.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Fotos</h4>
                      <div className="flex gap-2 flex-wrap">
                        {detailAudit.photos.map((p, i) => <img key={i} src={p} alt={`Foto ${i + 1}`} className="h-20 w-20 rounded-lg object-cover border" />)}
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
