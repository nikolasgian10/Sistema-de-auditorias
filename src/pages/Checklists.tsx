import { useState, useMemo } from 'react';
import { store, Checklist, ChecklistItem } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Pencil, Eye, Search, Printer, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function Checklists() {
  const navigate = useNavigate();
  const [checklists, setChecklists] = useState<Checklist[]>(store.getChecklists());
  const [viewChecklist, setViewChecklist] = useState<Checklist | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const { getEffectiveMinifabrica } = useAuth();
  const effectiveSector = getEffectiveMinifabrica();

  const machinesScoped = useMemo(() => {
    const allMachines = store.getMachines();
    return effectiveSector ? allMachines.filter(m => m.sector === effectiveSector) : allMachines;
  }, [effectiveSector]);

  const usedChecklistIds = useMemo(() => {
    const schedule = store.getSchedule();
    const audits = store.getAudits();
    const machineIds = new Set(machinesScoped.map(m => m.id));

    const ids = new Set<string>();
    schedule.forEach(s => { if (machineIds.has(s.machineId)) ids.add(s.checklistId); });
    audits.forEach(a => { if (machineIds.has(a.machineId)) ids.add(a.checklistId); });
    return ids;
  }, [machinesScoped]);

  const checklistsInScope = useMemo(() => {
    // When viewing "Toda a Fábrica", keep the full checklist list.
    if (!effectiveSector) return checklists;
    if (usedChecklistIds.size === 0) return checklists;
    return checklists.filter(c => usedChecklistIds.has(c.id));
  }, [checklists, usedChecklistIds, effectiveSector]);

  const categories = useMemo(() => [...new Set(checklistsInScope.map(c => c.category).filter(Boolean))], [checklistsInScope]);

  const filteredChecklists = useMemo(() => {
    let result = checklists;
    result = checklistsInScope;
    if (filterCategory !== 'all') result = result.filter(c => c.category === filterCategory);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(term) || c.category.toLowerCase().includes(term));
    }
    return result;
  }, [checklistsInScope, searchTerm, filterCategory]);

  const handleEdit = (c: Checklist) => { navigate(`/checklist-template?id=${c.id}`); };
  const handleDelete = (id: string) => { store.deleteChecklist(id); setChecklists(store.getChecklists()); toast.success('Checklist removido'); };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const renderChecklist = (ck: Checklist) => {
      const title = escapeHtml(ck.name);
      const category = escapeHtml(ck.category);

      const frontRows = ck.items.map((item, idx) => {
        return `<div class="row" style="grid-template-columns:50px 1fr 1fr"><div class="cell" style="text-align:center">${idx + 1}</div><div class="cell">${escapeHtml(item.question)}</div><div class="cell">${escapeHtml(item.explanation || '')}</div></div>`;
      }).join('');

      const backRows = ck.items.map((item, idx) => {
        return `<div class="row status-row"><div class="cell" style="text-align:center">${idx + 1}</div><div class="cell status-cell"></div><div class="cell"></div><div class="cell"></div></div>`;
      }).join('');

      return `
        <div class="checklist">
          <div class="title-bar">${title}</div>
          <div class="subtitle">${category}</div>

          <div class="section">
            <div class="section-title">Frente</div>
            <div class="table">
              <div class="thead" style="grid-template-columns:50px 1fr 1fr">
                <div class="cell" style="text-align:center">ITEM</div>
                <div class="cell" style="text-align:center">PERGUNTAS</div>
                <div class="cell" style="text-align:center">EXPLICAÇÃO</div>
              </div>
              ${frontRows}
            </div>
          </div>

          <div class="section">
            <div class="section-title">Verso</div>
            <div class="table">
              <div class="thead" style="grid-template-columns:50px 50px 1fr 1fr">
                <div class="cell" style="text-align:center">ITEM</div>
                <div class="cell" style="text-align:center">STATUS</div>
                <div class="cell" style="text-align:center">AÇÃO SE REPROVADO</div>
                <div class="cell" style="text-align:center">AÇÃO / RESPONSÁVEL</div>
              </div>
              ${backRows}
            </div>
          </div>

          <div class="legend">Utilizar na coluna status: R. (reprovado); A. (aprovado); NA (não aplicável).</div>
        </div>
      `;
    };

    win.document.write(`<html><head><title>Checklists LPA</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:12mm}
      @page{size:A4 landscape;margin:10mm}
      .checklist{border:1px solid #222;margin-bottom:16px;padding:10px;page-break-inside:avoid}
      .title-bar{font-weight:bold;font-size:16px;margin-bottom:4px}
      .subtitle{font-size:12px;color:#555;margin-bottom:8px}
      .section{margin-bottom:10px}
      .section-title{font-weight:bold;font-size:12px;margin-bottom:4px}
      .table{border:1px solid #aaa;border-collapse:collapse;width:100%}
      .thead{display:grid;background:#e8e8e8;font-weight:bold;font-size:10px}
      .cell{border-right:1px solid #aaa;padding:4px}
      .cell:last-child{border-right:none}
      .row{display:grid;border-top:1px solid #ddd;min-height:28px;font-size:10px}
      .row.status-row{grid-template-columns:50px 50px 1fr 1fr}
      .row.status-row .cell{padding:4px}
      .status-cell{display:flex;align-items:center;justify-content:center}
      .legend{font-size:9px;color:#555;margin-top:10px}
    </style></head><body>`);

    filteredChecklists.forEach(ck => win.document.write(renderChecklist(ck)));

    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Checklists</h1>
          <p className="text-sm text-muted-foreground">Gerencie os checklists de auditoria · {checklistsInScope.length} registros</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
          <Button size="sm" onClick={() => navigate('/checklist-template')}>Novo Checklist</Button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Buscar checklist..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44"><Filter className="mr-2 h-4 w-4" /><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Categorias</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredChecklists.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum checklist encontrado</TableCell></TableRow>
              ) : filteredChecklists.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell><Badge variant="outline">{c.category}</Badge></TableCell>
                  <TableCell>{c.items.length} perguntas</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewChecklist(c)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!viewChecklist} onOpenChange={() => setViewChecklist(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{viewChecklist?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {viewChecklist?.items.map((item, i) => (
              <div key={item.id} className="flex items-center gap-3 rounded-md border p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{i + 1}</span>
                <div>
                  <p className="text-sm">{item.question}</p>
                  {item.explanation && <p className="text-xs text-muted-foreground mt-0.5">{item.explanation}</p>}
                  <p className="text-xs text-muted-foreground capitalize">{item.type.replace('_', '/')}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
