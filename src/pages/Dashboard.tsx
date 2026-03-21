import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { store } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { ClipboardCheck, Cog, CalendarDays, AlertTriangle, CheckCircle2, Clock, TrendingUp, TrendingDown, Target, ShieldAlert, Wrench, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area, Legend } from 'recharts';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05 } }),
};

const COLORS = ['hsl(152, 60%, 40%)', 'hsl(0, 72%, 51%)', 'hsl(38, 92%, 50%)', 'hsl(200, 80%, 50%)', 'hsl(270, 60%, 50%)', 'hsl(330, 60%, 50%)'];

export default function Dashboard() {
  const { getEffectiveMinifabrica } = useAuth();
  const effectiveSector = getEffectiveMinifabrica();

  const machinesAll = store.getMachines();
  const checklists = store.getChecklists();
  const scheduleAll = store.getSchedule();
  const auditsAll = store.getAudits();
  const employeesAll = store.getEmployees();

  const machines = effectiveSector ? machinesAll.filter(m => m.sector === effectiveSector) : machinesAll;
  const employees = effectiveSector ? employeesAll.filter(e => e.sector === effectiveSector) : employeesAll;

  const machineIds = new Set(machines.map(m => m.id));
  const audits = effectiveSector ? auditsAll.filter(a => machineIds.has(a.machineId)) : auditsAll;

  const getEntrySector = (entry: (typeof scheduleAll)[number]) => entry.sectorId || machinesAll.find(m => m.id === entry.machineId)?.sector || '';
  const schedule = effectiveSector ? scheduleAll.filter(e => getEntrySector(e) === effectiveSector) : scheduleAll;

  const stats = useMemo(() => {
    const pending = schedule.filter(s => s.status === 'pending').length;
    const completed = schedule.filter(s => s.status === 'completed').length;
    const conformeCount = audits.filter(a => a.status === 'conforme').length;
    const naoConformeCount = audits.filter(a => a.status === 'nao_conforme').length;
    const parcialCount = audits.filter(a => a.status === 'parcial').length;
    const conformityRate = audits.length > 0 ? Math.round((conformeCount / audits.length) * 100) : 0;
    return { pending, completed, conformeCount, naoConformeCount, parcialCount, conformityRate };
  }, [schedule, audits]);

  // Machine with most problems
  const worstMachine = useMemo(() => {
    if (audits.length === 0) return null;
    const counts: Record<string, number> = {};
    audits.filter(a => a.status === 'nao_conforme').forEach(a => {
      counts[a.machineId] = (counts[a.machineId] || 0) + 1;
    });
    const worstId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!worstId) return null;
    const machine = machines.find(m => m.id === worstId[0]);
    return machine ? { name: machine.name, count: worstId[1] } : null;
  }, [audits, machines]);

  // Most common problem (checklist item with most NOKs)
  const worstQuestion = useMemo(() => {
    if (audits.length === 0) return null;
    const counts: Record<string, number> = {};
    audits.forEach(a => {
      a.answers.filter(ans => ans.conformity === 'nok').forEach(ans => {
        counts[ans.checklistItemId] = (counts[ans.checklistItemId] || 0) + 1;
      });
    });
    const worstId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!worstId) return null;
    let question = worstId[0];
    checklists.forEach(ck => {
      const item = ck.items.find(i => i.id === worstId[0]);
      if (item) question = item.question;
    });
    return { question: question.length > 40 ? question.substring(0, 40) + '...' : question, count: worstId[1] };
  }, [audits, checklists]);

  // Best employee (highest conformity)
  const bestEmployee = useMemo(() => {
    if (audits.length === 0) return null;
    let best = { name: '', rate: 0 };
    employees.forEach(emp => {
      const empAudits = audits.filter(a => a.employeeId === emp.id);
      if (empAudits.length >= 3) {
        const rate = Math.round((empAudits.filter(a => a.status === 'conforme').length / empAudits.length) * 100);
        if (rate > best.rate) best = { name: emp.name, rate };
      }
    });
    return best.name ? best : null;
  }, [audits, employees]);

  // Worst sector
  const worstSector = useMemo(() => {
    if (audits.length === 0) return null;
    const sectors: Record<string, { total: number; nok: number }> = {};
    audits.forEach(a => {
      const m = machines.find(x => x.id === a.machineId);
      if (m) {
        if (!sectors[m.sector]) sectors[m.sector] = { total: 0, nok: 0 };
        sectors[m.sector].total++;
        if (a.status === 'nao_conforme') sectors[m.sector].nok++;
      }
    });
    const worst = Object.entries(sectors).sort((a, b) => (b[1].nok / b[1].total) - (a[1].nok / a[1].total))[0];
    return worst ? { name: worst[0], rate: Math.round((worst[1].nok / worst[1].total) * 100) } : null;
  }, [audits, machines]);

  // Status distribution for pie chart
  const statusPieData = useMemo(() => [
    { name: 'Conforme', value: stats.conformeCount },
    { name: 'Não Conforme', value: stats.naoConformeCount },
    { name: 'Parcial', value: stats.parcialCount },
  ], [stats]);

  // NOK per machine for bar chart
  const machineNokData = useMemo(() => {
    return machines.map(m => {
      const machAudits = audits.filter(a => a.machineId === m.id);
      return {
        name: m.name.length > 12 ? m.name.substring(0, 12) + '…' : m.name,
        nok: machAudits.filter(a => a.status === 'nao_conforme').length,
        ok: machAudits.filter(a => a.status === 'conforme').length,
      };
    }).sort((a, b) => b.nok - a.nok);
  }, [audits, machines]);

  // Category radar data
  const categoryRadarData = useMemo(() => {
    return checklists.map(ck => {
      const ckAudits = audits.filter(a => a.checklistId === ck.id);
      const rate = ckAudits.length > 0 ? Math.round((ckAudits.filter(a => a.status === 'conforme').length / ckAudits.length) * 100) : 0;
      return { category: ck.category, conformidade: rate, fullMark: 100 };
    });
  }, [audits, checklists]);

  // Weekly trend for current month
  const weeklyTrend = useMemo(() => {
    const now = new Date();
    const currentMonthAudits = audits.filter(a => {
      const d = new Date(a.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const weeks: Record<number, { sem: string; total: number; conforme: number; naoConforme: number }> = {};
    currentMonthAudits.forEach(a => {
      const d = new Date(a.createdAt);
      const w = Math.ceil(d.getDate() / 7);
      if (!weeks[w]) weeks[w] = { sem: `Sem ${w}`, total: 0, conforme: 0, naoConforme: 0 };
      weeks[w].total++;
      if (a.status === 'conforme') weeks[w].conforme++;
      if (a.status === 'nao_conforme') weeks[w].naoConforme++;
    });
    return Object.values(weeks).sort((a, b) => a.sem.localeCompare(b.sem));
  }, [audits]);

  const cards = [
    { title: 'Máquinas', value: machines.length, icon: Cog, color: 'text-accent' },
    { title: 'Checklists', value: checklists.length, icon: ClipboardCheck, color: 'text-blue-500' },
    { title: 'Pendentes', value: stats.pending, icon: Clock, color: 'text-yellow-500' },
    { title: 'Realizadas', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-500' },
    { title: 'Taxa Conformidade', value: `${stats.conformityRate}%`, icon: Target, color: 'text-emerald-500' },
    { title: 'Não Conformes', value: stats.naoConformeCount, icon: AlertTriangle, color: 'text-destructive' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do sistema de auditoria LPA</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card, i) => (
          <motion.div key={card.title} custom={i} variants={fadeIn} initial="hidden" animate="visible">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">{card.title}</CardTitle>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{card.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Insights Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {worstMachine && (
          <motion.div custom={6} variants={fadeIn} initial="hidden" animate="visible">
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <Wrench className="h-4 w-4" /> Máquina Crítica
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{worstMachine.name}</p>
                <p className="text-xs text-muted-foreground">{worstMachine.count} não conformidades</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
        {worstQuestion && (
          <motion.div custom={7} variants={fadeIn} initial="hidden" animate="visible">
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-yellow-600">
                  <ShieldAlert className="h-4 w-4" /> Problema Mais Comum
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-bold leading-tight">{worstQuestion.question}</p>
                <p className="text-xs text-muted-foreground mt-1">{worstQuestion.count} ocorrências NOK</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
        {bestEmployee && (
          <motion.div custom={8} variants={fadeIn} initial="hidden" animate="visible">
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                  <TrendingUp className="h-4 w-4" /> Melhor Auditor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{bestEmployee.name}</p>
                <p className="text-xs text-muted-foreground">{bestEmployee.rate}% conformidade</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
        {worstSector && (
          <motion.div custom={9} variants={fadeIn} initial="hidden" animate="visible">
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-orange-600">
                  <TrendingDown className="h-4 w-4" /> Setor Crítico
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{worstSector.name}</p>
                <p className="text-xs text-muted-foreground">{worstSector.rate}% não conformidade</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Status das Auditorias</CardTitle></CardHeader>
          <CardContent>
            {audits.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart margin={{ top: 20, right: 10, left: 10, bottom: 40 }}>
                  <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {statusPieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground py-8 text-center">Sem dados</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Não Conformidades por Máquina</CardTitle></CardHeader>
          <CardContent>
            {machineNokData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={machineNokData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="nok" name="Não Conforme" fill={COLORS[1]} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="ok" name="Conforme" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground py-8 text-center">Sem dados</p>}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Conformidade por Categoria</CardTitle></CardHeader>
          <CardContent>
            {categoryRadarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={categoryRadarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="category" fontSize={12} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar name="% Conformidade" dataKey="conformidade" stroke={COLORS[3]} fill={COLORS[3]} fillOpacity={0.3} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground py-8 text-center">Sem dados</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Tendência Semanal (Mês Atual)</CardTitle></CardHeader>
          <CardContent>
            {weeklyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={weeklyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="sem" fontSize={12} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="conforme" name="Conformes" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.3} />
                  <Area type="monotone" dataKey="naoConforme" name="Não Conformes" stroke={COLORS[1]} fill={COLORS[1]} fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground py-8 text-center">Sem dados do mês atual</p>}
          </CardContent>
        </Card>
      </div>

      {/* Lists Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próximas Auditorias</CardTitle>
          </CardHeader>
          <CardContent>
            {schedule.filter(s => s.status === 'pending').slice(0, 5).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma auditoria pendente. Gere um cronograma.</p>
            ) : (
              <div className="space-y-3">
                {schedule.filter(s => s.status === 'pending').slice(0, 5).map(entry => {
                  const emp = employees.find(e => e.id === entry.employeeId);
                  const ck = checklists.find(c => c.id === entry.checklistId);
                  const sectorId = entry.sectorId || machinesAll.find(m => m.id === entry.machineId)?.sector || '';
                  const sector = store.getSectors().find(s => s.id === sectorId);
                  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                  return (
                    <div key={entry.id} className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <p className="text-sm font-medium">{emp?.name || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{sector?.name || 'Setor'} · {ck?.name}</p>
                      </div>
                      <span className="rounded bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                        Sem {entry.weekNumber} · {days[entry.dayOfWeek]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas Auditorias Realizadas</CardTitle>
          </CardHeader>
          <CardContent>
            {audits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma auditoria realizada ainda.</p>
            ) : (
              <div className="space-y-3">
                {audits.slice(-5).reverse().map(audit => {
                  const emp = employees.find(e => e.id === audit.employeeId);
                  const mach = machines.find(m => m.id === audit.machineId);
                  const statusColors = {
                    conforme: 'bg-emerald-500/10 text-emerald-600',
                    nao_conforme: 'bg-destructive/10 text-destructive',
                    parcial: 'bg-yellow-500/10 text-yellow-600',
                  };
                  const statusLabels = { conforme: 'Conforme', nao_conforme: 'Não Conforme', parcial: 'Parcial' };
                  return (
                    <div key={audit.id} className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <p className="text-sm font-medium">{emp?.name || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{mach?.name} · {new Date(audit.createdAt).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <span className={`rounded px-2 py-1 text-xs font-medium ${statusColors[audit.status]}`}>
                        {statusLabels[audit.status]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
