import { useState, useEffect, useCallback } from 'react';
import { store } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface LPAItem {
  id: string;
  area: string;
  question: string;
  explanation: string;
  status: 'pending' | 'conforme' | 'nao_conforme' | 'na';
  responsible: string;
  actionImmediate: boolean;
  escalate: boolean;
}

const AREAS = ['MÁQUINA', 'PROCESSO', 'PRODUTO', 'QMS', 'SEGURANÇA', '5S'];

const defaultItems: LPAItem[] = [
  { id: '1', area: 'MÁQUINA', question: 'Existe alguma adaptação feita na operação que pode gerar risco de segurança ao operador?', explanation: 'Verificar se na operação existem adaptações não oficiais na máquina (Arames, amarrações, panos de contenção...)', status: 'pending', responsible: '', actionImmediate: false, escalate: false },
  { id: '2', area: 'MÁQUINA', question: 'Existe algum problema de máquina ao qual a manutenção ainda não foi acionada?', explanation: 'Verificar se existe algum problema com a máquina o qual não foi aberta nota de manutenção', status: 'pending', responsible: '', actionImmediate: false, escalate: false },
  { id: '3', area: 'MÁQUINA', question: 'O sistema hidráulico e pneumático possui vazamento visível ou audível?', explanation: 'Verificar se há algum vazamento perceptível. Verificar se o manômetro e/ou barômetros estão registrando conforme a especificação do processo.', status: 'pending', responsible: '', actionImmediate: false, escalate: false },
  { id: '4', area: 'MÁQUINA', question: 'A manutenção preventiva foi realizada conforme o cronograma (quando aplicável)?', explanation: 'Verificar se o cronograma de manutenção está sendo seguido.', status: 'pending', responsible: '', actionImmediate: false, escalate: false },
];

export default function ChecklistTemplate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [title, setTitle] = useState('LPA N1 – CHECK LIST MAN & M.C.');
  const [sideLabel, setSideLabel] = useState('MAN. & M.C');
  const [sideColor, setSideColor] = useState('#16a34a');
  const [auditorName, setAuditorName] = useState('');
  const [date, setDate] = useState('');
  const [local, setLocal] = useState('');
  const [turno, setTurno] = useState<string>('');
  const [formCode, setFormCode] = useState('FORM PD319.3 (v05)');
  const [items, setItems] = useState<LPAItem[]>(defaultItems);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [selectedChecklist, setSelectedChecklist] = useState('');

  const checklists = store.getChecklists();

  const loadFromChecklist = useCallback((ckId: string) => {
    const ck = checklists.find(c => c.id === ckId);
    if (!ck) return;
    setSelectedChecklist(ckId);
    setTitle(`LPA N1 – ${ck.name.toUpperCase()}`);
    setSideLabel(ck.category.toUpperCase());
    setItems(ck.items.map(item => ({
      id: item.id, area: ck.category.toUpperCase(), question: item.question, explanation: item.explanation || '',
      status: 'pending' as const, responsible: '', actionImmediate: false, escalate: false,
    })));
    toast.success(`Carregado: ${ck.name}`);
  }, [checklists]);

  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) return;
    if (selectedChecklist === id) return;
    loadFromChecklist(id);
  }, [searchParams, selectedChecklist, loadFromChecklist]);

  const updateItem = (id: string, field: keyof LPAItem, value: LPAItem[keyof LPAItem]) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      area: 'MÁQUINA', question: '', explanation: '',
      status: 'pending', responsible: '', actionImmediate: false, escalate: false,
    }]);
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(it => it.id !== id));

  const statusColor = (s: LPAItem['status']) => {
    if (s === 'conforme') return { bg: '#16a34a', text: 'white', label: 'A' };
    if (s === 'nao_conforme') return { bg: '#dc2626', text: 'white', label: 'R' };
    if (s === 'na') return { bg: '#a3a3a3', text: 'white', label: 'NA' };
    return { bg: '#e5e5e5', text: '#888', label: '–' };
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;

    const renderStatusBadge = (s: LPAItem['status']) => {
      const c = statusColor(s);
      return `<span style="display:inline-block;background:${c.bg};color:${c.text};padding:2px 8px;border-radius:3px;font-weight:bold;font-size:11px;">${c.label}</span>`;
    };

    const frontColor = '#16a34a';
    const backColor = '#dc2626';

    win.document.write(`<html><head><title>${title}</title><style>
      *{margin:0;padding:0;box-sizing:border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact}
      body{font-family:Arial,sans-serif;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      @page{size:A4 portrait;margin:7mm}
      .sheet{display:flex;gap:6px;justify-content:space-between;align-items:stretch;}
      .panel{flex:0 0 49%;min-width:0;border:2px solid #111;position:relative;padding:0;--panel-color:${frontColor};box-sizing:border-box;overflow:hidden;background:#fff}
      .panel.back{--panel-color:${backColor}}
      .side{position:absolute;right:0;top:0;bottom:0;width:36px;background:var(--panel-color);writing-mode:vertical-rl;text-orientation:mixed;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:13px;letter-spacing:2px}
      .title-bar{background:var(--panel-color);color:white;padding:7px 44px 7px 10px;font-size:15px;font-weight:bold;text-align:center}
      .hdr{padding:4px 44px 4px 10px;font-size:10px;border-bottom:1px solid #ccc}
      .col-hdr{display:grid;background:#e8e8e8;font-weight:bold;font-size:10px;border-bottom:2px solid #222}
      /* Smaller horizontal, more vertical: let items breathe */
      .item-row{display:grid;border-bottom:1px solid #bbb;min-height:88px}
      .item-area{border-right:1px solid #bbb;writing-mode:vertical-rl;text-orientation:mixed;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;background:#f5f5f5;padding:4px}
      .item-q{padding:8px;border-right:1px solid #bbb;display:flex;align-items:center}
      .item-e{padding:8px;color:#555;display:flex;align-items:center;font-size:11px}
      .footer{display:flex;justify-content:space-between;padding:5px 50px 5px 12px;background:#f0f0f0;font-size:10px;border-top:1px solid #ccc}
      .turno-box{display:inline-block;border:1.5px solid #222;width:22px;height:22px;text-align:center;line-height:22px;font-weight:bold;margin:0 2px}
      .turno-active{background:#222;color:white}
      .action-section{padding:4px 8px 4px 80px;font-size:10px;border-bottom:1px solid #ddd}
      .status-col{border-right:1px solid #bbb;display:flex;align-items:center;justify-content:center;padding:4px}
    </style></head><body>`);

    // === FRENTE + VERSO SIDE BY SIDE ===
    win.document.write(`<div class="sheet">`);

    win.document.write(`<div class="panel front"><div class="side">${sideLabel}</div>`);
    win.document.write(`<div class="title-bar">${title}</div>`);
    win.document.write(`<div class="hdr"><strong>NOME AUDITOR:</strong> ${auditorName || '_______________________'}</div>`);
    win.document.write(`<div class="hdr"><strong>DATA:</strong> ${date || '__/__/____'} &nbsp;&nbsp;&nbsp; <strong>LOCAL:</strong> ${local || '_______________________'}</div>`);
    win.document.write(`<div class="hdr"><strong>TURNO:</strong> <span class="turno-box ${turno === '1' ? 'turno-active' : ''}">1</span><span class="turno-box ${turno === '2' ? 'turno-active' : ''}">2</span><span class="turno-box ${turno === '3' ? 'turno-active' : ''}">3</span></div>`);
    win.document.write(`<div class="col-hdr" style="grid-template-columns:70px 1fr 1fr;padding-right:36px"><div style="padding:5px;border-right:1px solid #bbb;text-align:center">ITEM</div><div style="padding:5px;border-right:1px solid #bbb;text-align:center">PERGUNTAS</div><div style="padding:5px;text-align:center">EXPLICAÇÃO</div></div>`);

    items.forEach(item => {
      win.document.write(`<div class="item-row" style="grid-template-columns:70px 1fr 1fr;padding-right:36px"><div class="item-area">${item.area}</div><div class="item-q">${item.question}</div><div class="item-e">${item.explanation}</div></div>`);
    });

    win.document.write(`<div class="footer"><span>${sideLabel}</span><span>${formCode}</span></div></div>`);

    win.document.write(`<div class="panel back"><div class="side">${sideLabel}</div>`);
    win.document.write(`<div class="title-bar">${title}</div>`);
    win.document.write(`<div class="hdr"><strong>NOME AUDITOR:</strong> ${auditorName || '_______________________'} &nbsp;&nbsp; <strong>EP MÁQUINA:</strong> _______________________</div>`);
    win.document.write(`<div class="col-hdr" style="grid-template-columns:70px 50px 1fr;padding-right:36px"><div style="padding:4px;border-right:1px solid #bbb;text-align:center">ITEM</div><div style="padding:4px;border-right:1px solid #bbb;text-align:center">STATUS</div><div style="padding:4px;text-align:center">AÇÃO SE REPROVADO / RESPONSÁVEL</div></div>`);

    items.forEach(item => {
      win.document.write(`
        <div style="border-bottom:1px solid #bbb;padding-right:36px">
          <div style="display:grid;grid-template-columns:70px 50px 1fr">
            <div class="item-area">${item.area}</div>
            <div class="status-col">${renderStatusBadge(item.status)}</div>
            <div style="padding:6px;font-size:10px">
              <div><strong>Ação Imediata:</strong> ${item.actionImmediate ? '☑' : '☐'} Acionar mestre e instruir colaborador</div>
              <div><strong>Escalonar:</strong> ${item.escalate ? '☑' : '☐'} via SFM</div>
              <div style="margin-top:4px"><strong>Resp.:</strong> ${item.responsible || '________________________'}</div>
            </div>
          </div>
        </div>
      `);
    });

    win.document.write(`<div style="padding:4px 50px 4px 12px;font-size:9px;color:#666;border-bottom:1px solid #ccc">Utilizar na coluna status: R. (reprovado); A. (aprovado); NA (não aplicável).</div>`);
    win.document.write(`<div class="footer"><span>${sideLabel}</span><span>${formCode}</span></div></div>`);

    win.document.write(`</div>`);

    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  const StatusButton = ({ item }: { item: LPAItem }) => {
    const cycle = () => {
      const order: LPAItem['status'][] = ['pending', 'conforme', 'nao_conforme', 'na'];
      const next = order[(order.indexOf(item.status) + 1) % order.length];
      updateItem(item.id, 'status', next);
    };
    const c = statusColor(item.status);
    return (
      <button onClick={cycle} className="w-10 h-8 rounded font-bold text-xs border-2 transition-all hover:scale-110" style={{ background: c.bg, color: c.text, borderColor: c.bg === '#e5e5e5' ? '#bbb' : c.bg }}>
        {c.label}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold">Modelo de Checklist LPA</h1>
          <p className="text-sm text-muted-foreground">Edite diretamente no layout — clique nos campos para alterar</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedChecklist} onValueChange={loadFromChecklist}>
            <SelectTrigger className="w-52 h-8 text-xs"><SelectValue placeholder="Carregar checklist..." /></SelectTrigger>
            <SelectContent>
              {checklists.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={addItem}><Plus className="mr-1 h-3 w-3" />Item</Button>
          <Button size="sm" variant="default" onClick={() => {
            if (!title || items.length === 0) { toast.error('Título e pelo menos um item são obrigatórios'); return; }
            const payload = {
              name: title,
              category: sideLabel,
              items: items.map(it => ({
                id: it.id,
                question: it.question,
                explanation: it.explanation,
                type: 'ok_nok' as const,
              })),
            };
            if (selectedChecklist) {
              store.updateChecklist(selectedChecklist, payload);
              toast.success('Checklist atualizado com sucesso!');
            } else {
              store.addChecklist(payload);
              toast.success('Checklist salvo com sucesso!');
            }
            navigate('/checklists');
          }}><Save className="mr-1 h-3 w-3" />Salvar Checklist</Button>
          <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="mr-1 h-3 w-3" />Imprimir</Button>
        </div>
      </div>

      {/* ====== CHECKLIST LAYOUT - FRENTE ====== */}
      <div className="border-2 border-foreground/30 rounded-sm overflow-hidden relative max-w-5xl mx-auto bg-white text-black">
        {/* Side label */}
        <div className="absolute right-0 top-0 bottom-0 w-9 flex items-center justify-center font-bold text-xs text-white z-10"
          style={{ background: sideColor, writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: '2px' }}>
          <input
            className="bg-transparent text-white text-center font-bold text-xs w-full border-none outline-none"
            style={{ writingMode: 'vertical-rl' }}
            value={sideLabel}
            onChange={e => setSideLabel(e.target.value)}
          />
        </div>

        {/* Title bar */}
        <div className="pr-11 text-center py-2.5 font-bold text-base text-white" style={{ background: sideColor }}>
          <input className="bg-transparent text-white text-center font-bold text-base w-full border-none outline-none placeholder:text-white/60"
            value={title} onChange={e => setTitle(e.target.value)} />
        </div>

        {/* Header fields */}
        <div className="pr-11 px-3 py-1.5 text-xs border-b border-black/20">
          <div className="flex items-center gap-1 mb-1">
            <strong className="shrink-0">NOME AUDITOR:</strong>
            <input className="flex-1 border-b border-dashed border-black/40 bg-transparent outline-none text-xs px-1 py-0.5"
              value={auditorName} onChange={e => setAuditorName(e.target.value)} placeholder="___________________" />
          </div>
          <div className="flex items-center gap-4 mb-1">
            <div className="flex items-center gap-1">
              <strong className="shrink-0">DATA:</strong>
              <input type="date" className="border-b border-dashed border-black/40 bg-transparent outline-none text-xs px-1 py-0.5"
                value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="flex items-center gap-1 flex-1">
              <strong className="shrink-0">LOCAL:</strong>
              <input className="flex-1 border-b border-dashed border-black/40 bg-transparent outline-none text-xs px-1 py-0.5"
                value={local} onChange={e => setLocal(e.target.value)} placeholder="___________________" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <strong>TURNO:</strong>
            {['1', '2', '3'].map(t => (
              <button key={t} onClick={() => setTurno(turno === t ? '' : t)}
                className="w-7 h-7 border-2 border-black font-bold text-sm transition-all"
                style={{ background: turno === t ? '#222' : 'white', color: turno === t ? 'white' : '#222' }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Column headers */}
        <div className="grid pr-11 font-bold text-[11px] border-b-2 border-black/40 bg-neutral-200"
          style={{ gridTemplateColumns: '70px 1fr 1fr' }}>
          <div className="p-1.5 border-r border-black/30 text-center">ITEM</div>
          <div className="p-1.5 border-r border-black/30 text-center">PERGUNTAS</div>
          <div className="p-1.5 text-center">EXPLICAÇÃO</div>
        </div>

        {/* Items */}
        {items.map((item, idx) => (
          <div key={item.id} className="grid border-b border-black/20 group relative"
            style={{ gridTemplateColumns: '70px 1fr 1fr', paddingRight: '2.75rem', minHeight: '80px' }}>
            {/* Area */}
            <div className="border-r border-black/20 flex items-center justify-center font-bold text-[11px] bg-neutral-100"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
              <select className="bg-transparent font-bold text-[11px] text-center border-none outline-none cursor-pointer appearance-none"
                style={{ writingMode: 'horizontal-tb' }}
                value={item.area} onChange={e => updateItem(item.id, 'area', e.target.value)}>
                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Question */}
            <div className="border-r border-black/20 p-2">
              <textarea className="w-full h-full bg-transparent outline-none text-xs resize-none min-h-[60px]"
                value={item.question} onChange={e => updateItem(item.id, 'question', e.target.value)}
                placeholder="Pergunta da auditoria..." />
            </div>

            {/* Explanation */}
            <div className="p-2">
              <textarea className="w-full h-full bg-transparent outline-none text-xs resize-none min-h-[60px] text-neutral-600"
                value={item.explanation} onChange={e => updateItem(item.id, 'explanation', e.target.value)}
                placeholder="Explicação / orientação..." />
            </div>

            {/* Delete button */}
            <button onClick={() => removeItem(item.id)}
              className="absolute right-10 top-1 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 no-print">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {/* Footer */}
        <div className="flex justify-between pr-11 px-3 py-1.5 bg-neutral-200 text-[10px] font-medium">
          <span>{sideLabel}</span>
          <input className="bg-transparent text-right text-[10px] border-none outline-none"
            value={formCode} onChange={e => setFormCode(e.target.value)} />
        </div>
      </div>

      {/* ====== VERSO ====== */}
      <div className="border-2 border-foreground/30 rounded-sm overflow-hidden relative max-w-5xl mx-auto bg-white text-black mt-6">
        {/* Side label */}
        <div className="absolute right-0 top-0 bottom-0 w-9 flex items-center justify-center font-bold text-xs text-white z-10"
          style={{ background: sideColor, writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: '2px' }}>
          {sideLabel}
        </div>

        {/* Title */}
        <div className="pr-11 text-center py-2 font-bold text-sm text-white" style={{ background: sideColor }}>
          {title}
        </div>

        {/* Header */}
        <div className="pr-11 px-3 py-1 text-xs border-b border-black/20 flex gap-6">
          <span><strong>NOME (AUDITADO):</strong> {auditorName || '___________________'}</span>
          <span><strong>RE (AUDITADO):</strong> ___________________</span>
        </div>

        {/* Column headers */}
        <div className="grid pr-11 font-bold text-[10px] border-b-2 border-black/40 bg-neutral-200"
          style={{ gridTemplateColumns: '70px 50px 1fr 1fr' }}>
          <div className="p-1 border-r border-black/30 text-center">ITEM</div>
          <div className="p-1 border-r border-black/30 text-center">STATUS</div>
          <div className="p-1 border-r border-black/30 text-center">AÇÃO SE REPROVADO</div>
          <div className="p-1 text-center">AÇÃO / RESPONSÁVEL</div>
        </div>

        {/* Items verso */}
        {items.map(item => (
          <div key={`v-${item.id}`} className="grid border-b border-black/20"
            style={{ gridTemplateColumns: '70px 50px 1fr 1fr', paddingRight: '2.75rem' }}>
            {/* Area */}
            <div className="border-r border-black/20 flex items-center justify-center font-bold text-[10px] bg-neutral-100"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', minHeight: '90px' }}>
              {item.area}
            </div>

            {/* Status button */}
            <div className="border-r border-black/20 flex items-center justify-center p-1">
              <StatusButton item={item} />
            </div>

            {/* Actions */}
            <div className="border-r border-black/20 p-2 text-[10px] space-y-1">
              <div className="font-bold">Ação Imediata:</div>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={item.actionImmediate}
                  onChange={e => updateItem(item.id, 'actionImmediate', e.target.checked)}
                  className="w-3 h-3" />
                <span>Acionar mestre e instruir colaborador</span>
              </label>
              <div className="font-bold mt-1">Escalonar:</div>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={item.escalate}
                  onChange={e => updateItem(item.id, 'escalate', e.target.checked)}
                  className="w-3 h-3" />
                <span>via SFM</span>
              </label>
            </div>

            {/* Responsible */}
            <div className="p-2 text-[10px]">
              <div className="font-bold mb-1">Resp.:</div>
              <input className="w-full border-b border-dashed border-black/40 bg-transparent outline-none text-[10px] mb-2"
                value={item.responsible} onChange={e => updateItem(item.id, 'responsible', e.target.value)}
                placeholder="________________________" />
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="pr-11 px-3 py-1 text-[9px] text-neutral-500 border-b border-black/10">
          Utilizar na coluna status: R. (reprovado); A. (aprovado); NA (não aplicável).
        </div>

        {/* Footer */}
        <div className="flex justify-between pr-11 px-3 py-1.5 bg-neutral-200 text-[10px] font-medium">
          <span>{sideLabel}</span>
          <span>{formCode}</span>
        </div>
      </div>
    </div>
  );
}