import { useState, useEffect } from 'react';
import { useAuth, UserType, ALL_PAGES } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { store, Employee } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Save, Target, Users, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

function getEmployeeUserType(emp: Employee): UserType {
  const role = emp.role.toLowerCase();
  if (role === 'gestor') return 'gestor';
  if (role === 'diretor') return 'diretor';
  return 'administrativo';
}

interface Goal {
  id: string;
  name: string;
  target: number;
  unit: string;
  period: string;
  // null/undefined = meta global. Caso contrário, meta específica por setor.
  sectorId?: string | null;
}

const ROLES = ['Gestor', 'Diretor', 'Administrativo'];
const SECTORS = ['Produção', 'Manutenção', 'Qualidade', 'Estamparia', 'Fundição', 'Usinagem', 'Acabamento'];

const TYPE_COLORS: Record<UserType, string> = {
  gestor: 'bg-primary text-primary-foreground',
  diretor: 'bg-accent text-accent-foreground',
  administrativo: 'bg-secondary text-secondary-foreground',
};

function loadGoals(): Goal[] {
  try {
    const raw = localStorage.getItem('lpa_goals');
    return raw ? JSON.parse(raw) : defaultGoals;
  } catch { return defaultGoals; }
}
function saveGoals(goals: Goal[]) {
  localStorage.setItem('lpa_goals', JSON.stringify(goals));
}

const defaultGoals: Goal[] = [
  { id: '1', name: 'Taxa de Conformidade', target: 90, unit: '%', period: 'Mensal', sectorId: null },
  { id: '2', name: 'Auditorias por Semana', target: 15, unit: 'auditorias', period: 'Semanal', sectorId: null },
  { id: '3', name: 'Máx. NOK por Máquina', target: 3, unit: 'ocorrências', period: 'Mensal', sectorId: null },
  { id: '4', name: 'Cobertura de Máquinas', target: 100, unit: '%', period: 'Mensal', sectorId: null },
];

export default function Settings() {
  const { userType, currentUser, getUserPermissions, setUserPermissions } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>(loadGoals());

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const { data, error } = await supabase.from('users').select('*');
        if (error) throw error;
        setEmployees(data || []);
      } catch (error) {
        console.error('Error fetching employees:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  const [empDialog, setEmpDialog] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState({ name: '', role: '', sector: '' });

  const [goalDialog, setGoalDialog] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalForm, setGoalForm] = useState({ name: '', target: '', unit: '', period: 'Mensal', scope: 'global' as 'global' | 'sector', sectorId: '' });

  // Permissions dialog
  const [permDialog, setPermDialog] = useState(false);
  const [permEmp, setPermEmp] = useState<Employee | null>(null);
  const [permPages, setPermPages] = useState<string[]>([]);

  // Filter employees for diretor - only their sector
  const visibleEmployees = userType === 'diretor' && currentUser
    ? employees.filter(e => e.sector === currentUser.sector)
    : employees;

  const openNewEmp = () => {
    setEditingEmp(null);
    setEmpForm({ name: '', role: '', sector: currentUser?.sector || '' });
    setEmpDialog(true);
  };
  const openEditEmp = (emp: Employee) => {
    setEditingEmp(emp);
    setEmpForm({ name: emp.name, role: emp.role, sector: emp.sector });
    setEmpDialog(true);
  };
  const saveEmp = () => {
    if (!empForm.name || !empForm.role || !empForm.sector) {
      toast.error('Preencha todos os campos');
      return;
    }
    // Diretor can only create administrativo in their sector
    if (userType === 'diretor') {
      if (empForm.role !== 'Administrativo') {
        toast.error('Diretores só podem criar usuários Administrativos');
        return;
      }
      empForm.sector = currentUser!.sector;
    }
    let updated: Employee[];
    if (editingEmp) {
      updated = employees.map(e => e.id === editingEmp.id ? { ...e, ...empForm } : e);
    } else {
      const newEmp: Employee = { id: Math.random().toString(36).substring(2, 11), ...empForm };
      updated = [...employees, newEmp];
    }
    store.saveEmployees(updated);
    setEmployees(updated);
    setEmpDialog(false);
    toast.success(editingEmp ? 'Usuário atualizado' : 'Usuário adicionado');
  };
  const deleteEmp = (id: string) => {
    const updated = employees.filter(e => e.id !== id);
    store.saveEmployees(updated);
    setEmployees(updated);
    toast.success('Usuário removido');
  };

  const openPermissions = (emp: Employee) => {
    setPermEmp(emp);
    setPermPages(getUserPermissions(emp.id));
    setPermDialog(true);
  };
  const savePerms = () => {
    if (permEmp) {
      setUserPermissions(permEmp.id, permPages);
      toast.success(`Permissões de ${permEmp.name} atualizadas`);
      setPermDialog(false);
    }
  };
  const togglePage = (path: string) => {
    setPermPages(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  // Goal handlers
  const openNewGoal = () => {
    setEditingGoal(null);
    setGoalForm({ name: '', target: '', unit: '', period: 'Mensal', scope: 'global', sectorId: '' });
    setGoalDialog(true);
  };
  const openEditGoal = (g: Goal) => {
    setEditingGoal(g);
    setGoalForm({
      name: g.name,
      target: String(g.target),
      unit: g.unit,
      period: g.period,
      scope: g.sectorId ? 'sector' : 'global',
      sectorId: g.sectorId || '',
    });
    setGoalDialog(true);
  };
  const saveGoal = () => {
    if (!goalForm.name || !goalForm.target || !goalForm.unit) {
      toast.error('Preencha todos os campos');
      return;
    }

    const sectorId = goalForm.scope === 'sector' ? (goalForm.sectorId || null) : null;
    let updated: Goal[];
    if (editingGoal) {
      updated = goals.map(g => g.id === editingGoal.id ? { ...g, name: goalForm.name, target: Number(goalForm.target), unit: goalForm.unit, period: goalForm.period, sectorId } : g);
    } else {
      updated = [...goals, { id: Math.random().toString(36).substring(2, 11), name: goalForm.name, target: Number(goalForm.target), unit: goalForm.unit, period: goalForm.period, sectorId }];
    }
    saveGoals(updated);
    setGoals(updated);
    setGoalDialog(false);
    toast.success(editingGoal ? 'Meta atualizada' : 'Meta adicionada');
  };
  const deleteGoal = (id: string) => {
    const updated = goals.filter(g => g.id !== id);
    saveGoals(updated);
    setGoals(updated);
    toast.success('Meta removida');
  };

  // Available roles for dropdown
  const availableRoles = userType === 'diretor' ? ['Administrativo'] : ROLES;
  const availableSectors = userType === 'diretor' && currentUser ? [currentUser.sector] : SECTORS;

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando configurações...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><SettingsIcon className="h-6 w-6" /> Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie metas e usuários do sistema</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          {userType === 'gestor' && (
            <TabsTrigger value="goals" className="gap-2"><Target className="h-4 w-4" />Metas</TabsTrigger>
          )}
          <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" />Usuários</TabsTrigger>
        </TabsList>

        {/* METAS - only gestor */}
        {userType === 'gestor' && (
          <TabsContent value="goals" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Metas de Auditoria</h2>
              <Button onClick={openNewGoal}><Plus className="mr-2 h-4 w-4" />Nova Meta</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {goals.map(g => (
                <Card key={g.id}>
                  <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base">{g.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{g.period}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditGoal(g)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteGoal(g.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-primary">{g.target} <span className="text-sm font-normal text-muted-foreground">{g.unit}</span></p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        )}

        {/* USUÁRIOS */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">
              {userType === 'diretor' ? `Usuários - ${currentUser?.sector}` : 'Todos os Usuários'}
            </h2>
            <Button onClick={openNewEmp}><Plus className="mr-2 h-4 w-4" />Novo Usuário</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleEmployees.map(emp => {
                    const empType = getEmployeeUserType(emp);
                    return (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell>
                          <Badge className={TYPE_COLORS[empType]}>{emp.role}</Badge>
                        </TableCell>
                        <TableCell>{emp.sector}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {empType === 'administrativo' && (userType === 'gestor' || userType === 'diretor') && (
                              <Button variant="ghost" size="icon" onClick={() => openPermissions(emp)} title="Permissões">
                                <ShieldCheck className="h-4 w-4 text-accent" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => openEditEmp(emp)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteEmp(emp.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Employee Dialog */}
      <Dialog open={empDialog} onOpenChange={setEmpDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingEmp ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={empForm.name} onChange={e => setEmpForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div>
              <Label>Tipo de Usuário</Label>
              <Select value={empForm.role} onValueChange={v => setEmpForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{availableRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Setor / Minifábrica</Label>
              <Select value={empForm.sector} onValueChange={v => setEmpForm(f => ({ ...f, sector: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{availableSectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={saveEmp}><Save className="mr-2 h-4 w-4" />Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Goal Dialog */}
      <Dialog open={goalDialog} onOpenChange={setGoalDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingGoal ? 'Editar Meta' : 'Nova Meta'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome da Meta</Label><Input value={goalForm.name} onChange={e => setGoalForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Valor Alvo</Label><Input type="number" value={goalForm.target} onChange={e => setGoalForm(f => ({ ...f, target: e.target.value }))} /></div>
            <div><Label>Unidade</Label><Input value={goalForm.unit} onChange={e => setGoalForm(f => ({ ...f, unit: e.target.value }))} placeholder="%, auditorias, ocorrências" /></div>
            <div>
              <Label>Período</Label>
              <Select value={goalForm.period} onValueChange={v => setGoalForm(f => ({ ...f, period: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Semanal">Semanal</SelectItem>
                  <SelectItem value="Mensal">Mensal</SelectItem>
                  <SelectItem value="Trimestral">Trimestral</SelectItem>
                  <SelectItem value="Anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Escopo</Label>
              <Select value={goalForm.scope} onValueChange={v => setGoalForm(f => ({ ...f, scope: v as 'global' | 'sector' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (toda a fábrica)</SelectItem>
                  <SelectItem value="sector">Por Setor</SelectItem>
                </SelectContent>
              </Select>
              {goalForm.scope === 'sector' && (
                <Select value={goalForm.sectorId} onValueChange={v => setGoalForm(f => ({ ...f, sectorId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                  <SelectContent>
                    {availableSectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button className="w-full" onClick={saveGoal}><Save className="mr-2 h-4 w-4" />Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={permDialog} onOpenChange={setPermDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Permissões - {permEmp?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Selecione as páginas que este usuário pode acessar:</p>
            {ALL_PAGES.filter(p => p.path !== '/settings').map(page => (
              <label key={page.path} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                <Checkbox
                  checked={permPages.includes(page.path)}
                  onCheckedChange={() => togglePage(page.path)}
                />
                <span className="text-sm font-medium">{page.label}</span>
              </label>
            ))}
            <Button className="w-full" onClick={savePerms}>
              <Save className="mr-2 h-4 w-4" />Salvar Permissões
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
