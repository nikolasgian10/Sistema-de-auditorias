import { useState, useRef, useMemo, useCallback } from 'react';
import ReactDOMServer from 'react-dom/server';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { store, Machine } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, QrCode, Pencil, Upload, Download, Search, Tag, History, FileSpreadsheet } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';

function exportToCSV(machines: Machine[]) {
  const header = ['Nome', 'Código', 'Setor', 'Descrição', 'Criado em'];
  const rows = machines.map(m => [m.name, m.code, m.sector, m.description, m.createdAt]);
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'maquinas.csv'; a.click();
  URL.revokeObjectURL(url);
}

function exportToPDF(machines: Machine[]) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<html><head><title>Lista de Máquinas</title>
    <style>body{font-family:sans-serif;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:12px}th{background:#f0f0f0;font-weight:bold}h1{font-size:18px}</style></head>
    <body><h1>Lista de Máquinas (${machines.length})</h1><table><tr><th>Nome</th><th>Código</th><th>Setor</th><th>Descrição</th></tr>`);
  machines.forEach(m => win.document.write(`<tr><td>${m.name}</td><td>${m.code}</td><td>${m.sector}</td><td>${m.description}</td></tr>`));
  win.document.write('</table></body></html>');
  win.document.close();
  win.print();
}

export default function Machines() {
  const { getEffectiveMinifabrica } = useAuth();
  const effectiveSector = getEffectiveMinifabrica();

  const [machines, setMachines] = useState<Machine[]>(store.getMachines());
  const [editing, setEditing] = useState<Machine | null>(null);
  const [qrMachine, setQrMachine] = useState<Machine | null>(null);
  const [historyMachine, setHistoryMachine] = useState<Machine | null>(null);
  const [labelMachines, setLabelMachines] = useState<Machine[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', sector: effectiveSector || '', description: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const qrRef = useRef<HTMLDivElement>(null);

  const audits = store.getAudits();

  const machinesScoped = useMemo(
    () => (effectiveSector ? machines.filter(m => m.sector === effectiveSector) : machines),
    [machines, effectiveSector]
  );

  const filteredMachines = useMemo(() => {
    if (!searchTerm) return machinesScoped;
    const term = searchTerm.toLowerCase();
    return machinesScoped.filter(m =>
      m.name.toLowerCase().includes(term) ||
      m.code.toLowerCase().includes(term) ||
      m.sector.toLowerCase().includes(term) ||
      m.description.toLowerCase().includes(term)
    );
  }, [machinesScoped, searchTerm]);

  const machineHistory = useMemo(() => {
    if (!historyMachine) return [];
    return audits.filter(a => a.machineId === historyMachine.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [historyMachine, audits]);

  const resetForm = () => setForm({ name: '', code: '', sector: effectiveSector || '', description: '' });

  const handleSave = () => {
    if (!form.name || !form.code) { toast.error('Nome e código são obrigatórios'); return; }
    if (editing) { store.updateMachine(editing.id, form); toast.success('Máquina atualizada'); }
    else { store.addMachine(form); toast.success('Máquina cadastrada'); }
    setMachines(store.getMachines());
    setFormOpen(false); setEditing(null); resetForm();
  };

  const handleDelete = (id: string) => { store.deleteMachine(id); setMachines(store.getMachines()); toast.success('Máquina removida'); };

  const handleEdit = (m: Machine) => {
    setEditing(m); setForm({ name: m.name, code: m.code, sector: m.sector, description: m.description }); setFormOpen(true);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      let count = 0;
      lines.slice(1).forEach(line => {
        const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
        if (cols[0] && cols[1]) {
          store.addMachine({ name: cols[0], code: cols[1], sector: cols[2] || '', description: cols[3] || '' });
          count++;
        }
      });
      setMachines(store.getMachines());
      setImportOpen(false);
      toast.success(`${count} máquina(s) importada(s)`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const printQR = () => {
    if (!qrRef.current) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>QR Code - ${qrMachine?.name}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;}h2{margin-bottom:10px;}p{color:#666;}</style></head>
      <body>${qrRef.current.innerHTML}<h2>${qrMachine?.name}</h2><p>${qrMachine?.code}</p></body></html>`);
    win.document.close(); win.print();
  };

  const printLabels = useCallback(async (machs: Machine[]) => {
    const stage = document.createElement('div');
    stage.style.position = 'fixed';
    stage.style.left = '-9999px';
    stage.style.top = '0';
    stage.style.background = '#ffffff';
    stage.style.padding = '0';
    stage.style.margin = '0';
    document.body.appendChild(stage);

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const margin = 10;
      const gapX = 6;
      const gapY = 6;
      const labelWidthMm = 92;
      const labelHeightMm = 30;

      let x = margin;
      let y = margin;

      for (let i = 0; i < machs.length; i++) {
        const m = machs[i];
        const qrSvg = ReactDOMServer.renderToStaticMarkup(
          <QRCodeSVG value={`lpa-audit:machine:${m.id}`} size={90} level="M" />
        );

        const labelText = `${m.code} - ${m.name} - ${m.sector}`;

        const label = document.createElement('div');
        label.style.cssText = `
          width:660px;height:210px;
          display:flex;align-items:center;gap:18px;
          padding:20px 24px;
          border:2px solid #9e9e9e;
          border-radius:10px;
          box-sizing:border-box;
          background:linear-gradient(to right,#f4f4f4,#e6e6e6);
          font-family:Arial, Helvetica, sans-serif;
        `;

        label.innerHTML = `
          <div style="font-weight:900;font-size:42px;color:#1a237e;letter-spacing:3px;line-height:1;flex-shrink:0;">MAHLE</div>
          <div style="width:2px;height:78%;background:#9e9e9e;flex-shrink:0;"></div>
          <div style="flex:1;display:flex;align-items:center;justify-content:center;text-align:center;font-size:24px;font-weight:700;color:#1f1f1f;line-height:1.3;word-break:break-word;">
            ${labelText}
          </div>
          <div style="flex-shrink:0;width:96px;height:96px;display:flex;align-items:center;justify-content:center;">
            ${qrSvg}
          </div>
        `;

        stage.appendChild(label);

        // força render antes da captura
        await new Promise(requestAnimationFrame);

        const canvas = await html2canvas(label, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
        });

        const imgData = canvas.toDataURL('image/png');

        if (x + labelWidthMm > pageWidth - margin + 0.01) {
          x = margin;
          y += labelHeightMm + gapY;
        }

        if (y + labelHeightMm > pageHeight - margin + 0.01) {
          pdf.addPage();
          x = margin;
          y = margin;
        }

        pdf.addImage(imgData, 'PNG', x, y, labelWidthMm, labelHeightMm);
        x += labelWidthMm + gapX;

        stage.removeChild(label);
      }

      pdf.save(`etiquetas-${machs.length}.pdf`);
      toast.success('PDF gerado com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      toast.error('Erro ao gerar PDF');
    } finally {
      document.body.removeChild(stage);
    }
  }, []);

  const employees = store.getEmployees();
  const checklists = store.getChecklists();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Máquinas</h1>
          <p className="text-sm text-muted-foreground">Cadastro e gestão de máquinas · {machinesScoped.length} registros</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Upload className="mr-2 h-4 w-4" />Importar</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Importar Máquinas (CSV)</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground mb-2">Formato: Nome, Código, Setor, Descrição (1ª linha = cabeçalho)</p>
              <Input type="file" accept=".csv,.txt" onChange={handleImportCSV} />
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={() => exportToCSV(machinesScoped)}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
          <Button variant="outline" size="sm" onClick={() => exportToPDF(machinesScoped)}><Download className="mr-2 h-4 w-4" />PDF</Button>
          <Button variant="outline" size="sm" onClick={() => { setLabelMachines(filteredMachines); printLabels(filteredMachines); }}>
            <Tag className="mr-2 h-4 w-4" />Gerar Etiquetas
          </Button>
          <Dialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) { setEditing(null); resetForm(); } }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" />Nova Máquina</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? 'Editar Máquina' : 'Nova Máquina'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><Label>Código</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} /></div>
                <div><Label>Setor</Label><Input value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))} /></div>
                <div><Label>Descrição</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <Button className="w-full" onClick={handleSave}>{editing ? 'Salvar Alterações' : 'Cadastrar'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search / Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar por nome, código, setor ou tipo..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMachines.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma máquina encontrada</TableCell></TableRow>
              ) : filteredMachines.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{m.code}</code></TableCell>
                  <TableCell><Badge variant="outline">{m.sector}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="QR Code" onClick={() => setQrMachine(m)}><QrCode className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Histórico" onClick={() => setHistoryMachine(m)}><History className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Etiqueta" onClick={() => printLabels([m])}><Tag className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Editar" onClick={() => handleEdit(m)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Excluir" onClick={() => handleDelete(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* QR Dialog */}
      <Dialog open={!!qrMachine} onOpenChange={() => setQrMachine(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>QR Code - {qrMachine?.name}</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-4" ref={qrRef}>
            {qrMachine && <QRCodeSVG value={`lpa-audit:machine:${qrMachine.id}`} size={200} />}
          </div>
          <p className="text-center text-sm text-muted-foreground">{qrMachine?.code} · {qrMachine?.sector}</p>
          <Button onClick={printQR} className="w-full">Imprimir QR Code</Button>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!historyMachine} onOpenChange={() => setHistoryMachine(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Histórico - {historyMachine?.name}</DialogTitle></DialogHeader>
          {machineHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Nenhuma auditoria registrada para esta máquina.</p>
          ) : (
            <div className="space-y-3">
              {machineHistory.map(audit => {
                const emp = employees.find(e => e.id === audit.employeeId);
                const ck = checklists.find(c => c.id === audit.checklistId);
                const statusColor = audit.status === 'conforme' ? 'bg-green-500/20 text-green-700' : audit.status === 'nao_conforme' ? 'bg-red-500/20 text-red-700' : 'bg-yellow-500/20 text-yellow-700';
                const statusLabel = audit.status === 'conforme' ? 'Conforme' : audit.status === 'nao_conforme' ? 'Não Conforme' : 'Parcial';
                return (
                  <div key={audit.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{new Date(audit.createdAt).toLocaleDateString('pt-BR')}</p>
                      <p className="text-xs text-muted-foreground">{emp?.name} · {ck?.name}</p>
                      {audit.observations && <p className="text-xs text-muted-foreground mt-1 italic">"{audit.observations}"</p>}
                    </div>
                    <Badge className={statusColor}>{statusLabel}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
