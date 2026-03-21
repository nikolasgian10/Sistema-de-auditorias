import { useMemo, useRef, useCallback } from 'react';
import { store } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend, CartesianGrid, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area,
  ComposedChart, ReferenceLine,
} from 'recharts';

const COLORS = ['hsl(152, 60%, 40%)', 'hsl(0, 72%, 51%)', 'hsl(38, 92%, 50%)', 'hsl(200, 80%, 50%)', 'hsl(270, 60%, 50%)', 'hsl(330, 60%, 50%)'];

interface Goal { id: string; name: string; target: number; unit: string; period: string; sectorId?: string | null; }
function loadGoals(): Goal[] {
  try { const raw = localStorage.getItem('lpa_goals'); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

function printElement(el: HTMLElement | null, title: string) {
  if (!el) return;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { font-family: Arial, sans-serif; padding: 0; margin: 0; color: #111; }
          .page-title { font-size: 18px; font-weight: 700; margin: 0 0 10px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .chart-card { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; break-inside: avoid; background: #fff; }
          .chart-title { font-size: 13px; font-weight: 700; margin-bottom: 6px; }
          .chart-body svg { width: 100% !important; height: auto !important; max-height: 220px; }
          /* Recharts printing tweaks (legends often become too large) */
          .recharts-legend-wrapper text { font-size: 8px !important; }
          .recharts-default-legend text { font-size: 8px !important; }
          .recharts-legend-item-text { font-size: 8px !important; }
          .recharts-cartesian-axis-tick-value { font-size: 8px !important; }
          .recharts-cartesian-axis-tick text { font-size: 8px !important; }
          .recharts-tooltip-wrapper text { font-size: 8px !important; }
        </style>
      </head>
      <body>
        <h2 class="page-title">${title}</h2>
        <div id="content"></div>
      </body>
    </html>
  `);

  const target = win.document.getElementById('content');
  if (!target) return;

  const chartRoots = el.querySelectorAll('[id^="chart-"]');
  if (chartRoots.length > 0) {
    const grid = win.document.createElement('div');
    grid.className = 'grid';
    chartRoots.forEach((chartNode) => {
      const card = chartNode.closest('[class*="Card"], .card') || chartNode.parentElement;
      const titleNode = card?.querySelector('[class*="CardTitle"], .card-title, h3, h4') as HTMLElement | null;
      const block = win.document.createElement('div');
      block.className = 'chart-card';
      block.innerHTML = `
        <div class="chart-title">${titleNode?.textContent || 'Gráfico'}</div>
        <div class="chart-body">${(chartNode as HTMLElement).innerHTML}</div>
      `;
      grid.appendChild(block);
    });
    target.appendChild(grid);
  } else {
    target.innerHTML = `<div class="chart-card"><div class="chart-body">${el.innerHTML}</div></div>`;
  }

  win.document.close();
  win.focus();
  win.print();
}

function ChartCard({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => printElement(ref.current, title)} title="Imprimir gráfico"><Printer className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent ref={ref} id={id}>{children}</CardContent>
    </Card>
  );
}

export default function Analytics() {
  const allRef = useRef<HTMLDivElement>(null);
  const { getEffectiveMinifabrica } = useAuth();
  const effectiveSector = getEffectiveMinifabrica();
  
  const allMachines = store.getMachines();
  const machines = effectiveSector ? allMachines.filter(m => m.sector === effectiveSector) : allMachines;
  const machineIds = new Set(machines.map(m => m.id));
  
  const allAudits = store.getAudits();
  const audits = effectiveSector ? allAudits.filter(a => machineIds.has(a.machineId)) : allAudits;
  const allEmployees = store.getEmployees();
  const employees = effectiveSector ? allEmployees.filter(e => e.sector === effectiveSector) : allEmployees;
  const checklists = store.getChecklists();
  const goals = loadGoals();

  // Pick goals with priority:
  // - If we're on a specific sector: use sector goal if it exists, otherwise fallback to global.
  // - If we're on "toda a fábrica" (no sector filter): use only global goals.
  const sectorGoal = effectiveSector ? effectiveSector : null;
  const pickGoal = (match: (g: Goal) => boolean) => {
    const candidates = goals.filter(match);
    if (sectorGoal) {
      const sectorMatch = candidates.find(g => (g.sectorId || null) === sectorGoal);
      if (sectorMatch) return sectorMatch;
    }
    return candidates.find(g => !g.sectorId || g.sectorId === null) || candidates[0];
  };

  const conformityGoal = pickGoal(g => g.name.toLowerCase().includes('conformidade') && g.unit === '%');
  const weeklyAuditGoal = pickGoal(g => g.name.toLowerCase().includes('semana') && g.unit === 'auditorias');
  const maxNokGoal = pickGoal(g => g.name.toLowerCase().includes('nok'));
  const coverageGoal = pickGoal(g => g.name.toLowerCase().includes('cobertura'));

  const statusData = useMemo(() => [
    { name: 'Conforme', value: audits.filter(a => a.status === 'conforme').length },
    { name: 'Não Conforme', value: audits.filter(a => a.status === 'nao_conforme').length },
    { name: 'Parcial', value: audits.filter(a => a.status === 'parcial').length },
  ], [audits]);

  const machineData = useMemo(() => machines.map(m => {
    const ma = audits.filter(a => a.machineId === m.id);
    return { name: m.name.length > 18 ? m.name.substring(0, 18) + '…' : m.name, total: ma.length, conforme: ma.filter(a => a.status === 'conforme').length, naoConforme: ma.filter(a => a.status === 'nao_conforme').length, parcial: ma.filter(a => a.status === 'parcial').length };
  }), [audits, machines]);

  const employeeData = useMemo(() => employees.map(e => {
    const ea = audits.filter(a => a.employeeId === e.id);
    return { name: e.name.split(' ')[0], auditorias: ea.length, conformidade: ea.length > 0 ? Math.round((ea.filter(a => a.status === 'conforme').length / ea.length) * 100) : 0 };
  }), [audits, employees]);

  const auditorPerformance = useMemo(() => employees.map(e => {
    const ea = audits.filter(a => a.employeeId === e.id);
    const conforme = ea.filter(a => a.status === 'conforme').length;
    const naoConforme = ea.filter(a => a.status === 'nao_conforme').length;
    const parcial = ea.filter(a => a.status === 'parcial').length;
    const totalNok = ea.reduce((sum, a) => sum + a.answers.filter(ans => ans.conformity === 'nok').length, 0);
    return { name: e.name.split(' ').slice(0, 2).join(' '), conforme, naoConforme, parcial, total: ea.length, taxa: ea.length > 0 ? Math.round((conforme / ea.length) * 100) : 0, noks: totalNok };
  }).filter(e => e.total > 0).sort((a, b) => b.taxa - a.taxa), [audits, employees]);

  const monthlyData = useMemo(() => {
    const months: Record<string, { mes: string; total: number; conforme: number; naoConforme: number; parcial: number }> = {};
    audits.forEach(a => {
      const d = new Date(a.createdAt); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      if (!months[key]) months[key] = { mes: label, total: 0, conforme: 0, naoConforme: 0, parcial: 0 };
      months[key].total++; if (a.status === 'conforme') months[key].conforme++; if (a.status === 'nao_conforme') months[key].naoConforme++; if (a.status === 'parcial') months[key].parcial++;
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [audits]);

  const categoryData = useMemo(() => checklists.map(ck => {
    const ca = audits.filter(a => a.checklistId === ck.id);
    return { category: ck.category, conformidade: ca.length > 0 ? Math.round((ca.filter(a => a.status === 'conforme').length / ca.length) * 100) : 0, total: ca.length, fullMark: 100 };
  }), [audits, checklists]);

  const topNokQuestions = useMemo(() => {
    const counts: Record<string, { question: string; count: number }> = {};
    audits.forEach(a => { a.answers.filter(ans => ans.conformity === 'nok').forEach(ans => {
      if (!counts[ans.checklistItemId]) { let q = ans.checklistItemId; checklists.forEach(ck => { const it = ck.items.find(i => i.id === ans.checklistItemId); if (it) q = it.question; }); counts[ans.checklistItemId] = { question: q.length > 35 ? q.substring(0, 35) + '…' : q, count: 0 }; }
      counts[ans.checklistItemId].count++;
    }); });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [audits, checklists]);

  const sectorData = useMemo(() => {
    const sectors: Record<string, { setor: string; total: number; conforme: number; naoConforme: number }> = {};
    audits.forEach(a => { const m = machines.find(x => x.id === a.machineId); if (m) { if (!sectors[m.sector]) sectors[m.sector] = { setor: m.sector, total: 0, conforme: 0, naoConforme: 0 }; sectors[m.sector].total++; if (a.status === 'conforme') sectors[m.sector].conforme++; if (a.status === 'nao_conforme') sectors[m.sector].naoConforme++; } });
    return Object.values(sectors);
  }, [audits, machines]);

  const dayOfWeekData = useMemo(() => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const counts = days.map((d, i) => ({ dia: d, auditorias: 0, idx: i }));
    audits.forEach(a => { const d = new Date(a.createdAt).getDay(); counts[d].auditorias++; });
    return counts;
  }, [audits]);

  const conformityTrend = useMemo(() => monthlyData.map(m => ({
    ...m, taxa: m.total > 0 ? Math.round((m.conforme / m.total) * 100) : 0,
  })), [monthlyData]);

  // Goals vs Actual comparison data
  const goalsComparison = useMemo(() => {
    const totalAudits = audits.length;
    const conformeCount = audits.filter(a => a.status === 'conforme').length;
    const conformityRate = totalAudits > 0 ? Math.round((conformeCount / totalAudits) * 100) : 0;
    
    // Weekly average (based on data spread)
    const weeks = new Set<string>();
    audits.forEach(a => { const d = new Date(a.createdAt); weeks.add(`${d.getFullYear()}-W${Math.ceil(d.getDate() / 7)}-${d.getMonth()}`); });
    const avgPerWeek = weeks.size > 0 ? Math.round(totalAudits / weeks.size) : 0;

    // Max NOK per machine
    const nokByMachine: Record<string, number> = {};
    audits.forEach(a => { const noks = a.answers.filter(ans => ans.conformity === 'nok').length; nokByMachine[a.machineId] = (nokByMachine[a.machineId] || 0) + noks; });
    const maxNok = Object.values(nokByMachine).length > 0 ? Math.max(...Object.values(nokByMachine)) : 0;

    // Coverage
    const auditedMachines = new Set(audits.map(a => a.machineId));
    const coverage = machines.length > 0 ? Math.round((auditedMachines.size / machines.length) * 100) : 0;

    return [
      { meta: 'Taxa Conformidade', atual: conformityRate, alvo: conformityGoal?.target || 90, unit: '%' },
      { meta: 'Auditorias/Semana', atual: avgPerWeek, alvo: weeklyAuditGoal?.target || 15, unit: '' },
      { meta: 'Máx NOK/Máquina', atual: maxNok, alvo: maxNokGoal?.target || 3, unit: '', inverse: true },
      { meta: 'Cobertura Máquinas', atual: coverage, alvo: coverageGoal?.target || 100, unit: '%' },
    ];
  }, [audits, machines, conformityGoal, weeklyAuditGoal, maxNokGoal, coverageGoal]);

  const handlePrintAll = useCallback(() => { printElement(allRef.current, 'Análise Gráfica LPA - Todos os Gráficos'); }, []);
  const hasData = audits.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Análise Gráfica</h1>
          <p className="text-sm text-muted-foreground">Indicadores visuais das auditorias LPA — {audits.length} auditorias analisadas</p>
        </div>
        {hasData && <Button onClick={handlePrintAll} className="gap-2"><Printer className="h-4 w-4" />Imprimir Tudo</Button>}
      </div>

      {!hasData ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">Realize auditorias para visualizar os gráficos.</p></CardContent></Card>
      ) : (
        <div ref={allRef} className="grid gap-6 lg:grid-cols-2">
          {/* NEW: Goals vs Actual */}
          <ChartCard title="Metas vs Realizado" id="chart-goals">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={goalsComparison} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="meta" type="category" width={130} fontSize={11} />
                <Tooltip formatter={(value: number, name: string) => {
                  const item = goalsComparison.find(g => g.meta === name || name === 'Atual' || name === 'Meta');
                  return `${value}${item?.unit || ''}`;
                }} />
                <Legend />
                <Bar dataKey="atual" name="Atual" fill={COLORS[3]} radius={[0, 4, 4, 0]} />
                <Bar dataKey="alvo" name="Meta" fill={COLORS[0]} radius={[0, 4, 4, 0]} fillOpacity={0.5} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Goals KPI Cards */}
          <ChartCard title="Indicadores de Metas" id="chart-goals-kpi">
            <div className="grid grid-cols-2 gap-3">
              {goalsComparison.map((g, i) => {
                const achieved = g.inverse ? g.atual <= g.alvo : g.atual >= g.alvo;
                return (
                  <div key={i} className={`rounded-lg border p-3 ${achieved ? 'border-green-500/40 bg-green-500/10' : 'border-red-500/40 bg-red-500/10'}`}>
                    <p className="text-xs text-muted-foreground mb-1">{g.meta}</p>
                    <p className="text-xl font-bold">{g.atual}{g.unit}</p>
                    <p className="text-xs text-muted-foreground">Meta: {g.alvo}{g.unit}</p>
                    <p className={`text-xs font-medium mt-1 ${achieved ? 'text-green-600' : 'text-red-600'}`}>
                      {achieved ? '✓ Atingida' : '✗ Não atingida'}
                    </p>
                  </div>
                );
              })}
            </div>
          </ChartCard>

          {/* Status Pie */}
          <ChartCard title="Distribuição por Status" id="chart-status">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Machine Stacked Bar */}
          <ChartCard title="Auditorias por Máquina" id="chart-machines">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={machineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={10} angle={-25} textAnchor="end" height={70} />
                <YAxis /><Tooltip /><Legend />
                <Bar dataKey="conforme" name="Conforme" stackId="a" fill={COLORS[0]} />
                <Bar dataKey="naoConforme" name="Não Conforme" stackId="a" fill={COLORS[1]} />
                <Bar dataKey="parcial" name="Parcial" stackId="a" fill={COLORS[2]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Employee Composed */}
          <ChartCard title="Desempenho por Auditor (Resumo)" id="chart-auditor-summary">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={employeeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" />
                <Tooltip /><Legend />
                <Bar yAxisId="left" dataKey="auditorias" name="Total Auditorias" fill={COLORS[3]} radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="conformidade" name="% Conformidade" stroke={COLORS[0]} strokeWidth={2} dot={{ r: 4 }} />
                {conformityGoal && <ReferenceLine yAxisId="right" y={conformityGoal.target} stroke="red" strokeDasharray="5 5" label={{ value: `Meta ${conformityGoal.target}%`, position: 'insideTopRight', fill: 'red', fontSize: 10 }} />}
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Auditor Detailed */}
          <ChartCard title="Desempenho Detalhado por Auditor" id="chart-auditor-detail">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={auditorPerformance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" /><YAxis dataKey="name" type="category" width={110} fontSize={11} />
                <Tooltip /><Legend />
                <Bar dataKey="conforme" name="Conforme" stackId="a" fill={COLORS[0]} />
                <Bar dataKey="naoConforme" name="Não Conforme" stackId="a" fill={COLORS[1]} />
                <Bar dataKey="parcial" name="Parcial" stackId="a" fill={COLORS[2]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Ranking */}
          <ChartCard title="Ranking de Conformidade (%)" id="chart-auditor-ranking">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={auditorPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={10} angle={-20} textAnchor="end" height={60} />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip formatter={(value: number) => `${value}%`} />
                {conformityGoal && <ReferenceLine y={conformityGoal.target} stroke="red" strokeDasharray="5 5" label={{ value: `Meta`, fill: 'red', fontSize: 10 }} />}
                <Bar dataKey="taxa" name="% Conformidade" fill={COLORS[3]} radius={[4, 4, 0, 0]}>
                  {auditorPerformance.map((entry, i) => <Cell key={i} fill={entry.taxa >= (conformityGoal?.target || 70) ? COLORS[0] : entry.taxa >= 40 ? COLORS[2] : COLORS[1]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Monthly Trend */}
          <ChartCard title="Tendência Mensal" id="chart-monthly">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" fontSize={11} /><YAxis /><Tooltip /><Legend />
                <Area type="monotone" dataKey="conforme" name="Conformes" stackId="1" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.4} />
                <Area type="monotone" dataKey="naoConforme" name="Não Conformes" stackId="1" stroke={COLORS[1]} fill={COLORS[1]} fillOpacity={0.4} />
                <Area type="monotone" dataKey="parcial" name="Parciais" stackId="1" stroke={COLORS[2]} fill={COLORS[2]} fillOpacity={0.4} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Category Radar */}
          <ChartCard title="Conformidade por Categoria" id="chart-category">
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={categoryData}>
                <PolarGrid /><PolarAngleAxis dataKey="category" fontSize={12} /><PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar name="% Conformidade" dataKey="conformidade" stroke={COLORS[3]} fill={COLORS[3]} fillOpacity={0.3} />
                <Tooltip /><Legend />
              </RadarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Top NOK */}
          <ChartCard title="Problemas Mais Frequentes (NOK)" id="chart-nok">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topNokQuestions} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" /><YAxis dataKey="question" type="category" width={160} fontSize={10} />
                <Tooltip />
                {maxNokGoal && <ReferenceLine x={maxNokGoal.target} stroke="red" strokeDasharray="5 5" />}
                <Bar dataKey="count" name="Ocorrências NOK" fill={COLORS[1]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Sector */}
          <ChartCard title="Análise por Setor" id="chart-sector">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sectorData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="setor" fontSize={12} /><YAxis /><Tooltip /><Legend />
                <Bar dataKey="conforme" name="Conforme" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="naoConforme" name="Não Conforme" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Day of Week */}
          <ChartCard title="Auditorias por Dia da Semana" id="chart-dayweek">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dayOfWeekData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dia" fontSize={12} /><YAxis /><Tooltip />
                <Bar dataKey="auditorias" name="Auditorias" fill={COLORS[3]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Conformity Trend with Goal line */}
          <ChartCard title="Evolução Taxa de Conformidade (%)" id="chart-trend">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={conformityTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" fontSize={11} /><YAxis domain={[0, 100]} unit="%" />
                <Tooltip formatter={(value: number) => `${value}%`} /><Legend />
                <Line type="monotone" dataKey="taxa" name="Taxa de Conformidade" stroke={COLORS[0]} strokeWidth={3} dot={{ r: 5 }} />
                {conformityGoal && <ReferenceLine y={conformityGoal.target} stroke="red" strokeDasharray="5 5" label={{ value: `Meta ${conformityGoal.target}%`, position: 'insideTopRight', fill: 'red', fontSize: 10 }} />}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}
