import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Cog,
  Settings,
  ClipboardCheck,
  CalendarDays,
  Smartphone,
  FileText,
  BarChart3,
  Menu,
  Shield,
  LogOut,
  User,
  Factory,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { store } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/machines', label: 'Máquinas', icon: Cog },
  { path: '/checklists', label: 'Checklists', icon: ClipboardCheck },
  { path: '/checklist-template', label: 'Modelo LPA', icon: FileText },
  { path: '/schedule', label: 'Cronograma', icon: CalendarDays },
  { path: '/my-audits', label: 'Minhas Auditorias', icon: ClipboardCheck },
  { path: '/mobile-audit', label: 'Auditoria Mobile', icon: Smartphone },
  { path: '/reports', label: 'Relatórios', icon: FileText },
  { path: '/analytics', label: 'Análise Gráfica', icon: BarChart3 },
  { path: '/settings', label: 'Configurações', icon: Settings },
];

const TYPE_LABELS: Record<string, string> = {
  gestor: 'Gestor',
  diretor: 'Diretor',
  administrativo: 'Administrativo',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentUser, userType, logout, canAccessPage, selectedMinifabrica, setSelectedMinifabrica } = useAuth();

  const filteredNav = navItems.filter(item => canAccessPage(item.path));

  // Get unique sectors from machines for the minifábrica filter
  const machines = store.getMachines();
  const sectors = [...new Set(machines.map(m => m.sector))].sort();

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0 no-print',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-20 items-center gap-3 border-b border-sidebar-border px-6">
          <Shield className="h-8 w-8 text-sidebar-primary" />
          <div>
            <h1 className="text-2xl font-bold text-sidebar-primary">LPA Audit</h1>
            <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">SISTEMA DE AUDITORIA</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {filteredNav.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {currentUser && userType && (
          <div className="border-t border-sidebar-border px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-sidebar-foreground/60" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{currentUser.name}</p>
                <p className="text-[10px] text-sidebar-foreground/50">{currentUser.sector}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px] border-sidebar-border text-sidebar-foreground/70">
                {TYPE_LABELS[userType]}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                onClick={logout}
              >
                <LogOut className="h-3.5 w-3.5 mr-1" />
                Sair
              </Button>
            </div>
            <div className="pt-3 text-[10px] text-sidebar-foreground/60 border-t border-sidebar-border">
              LPA Audit system v2.0
            </div>
          </div>
        )}
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-card px-4 lg:px-6 no-print">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>

          {/* Minifábrica filter for Gestor — hide on universal pages like Modelo LPA */}
          {userType === 'gestor' && location.pathname !== '/checklist-template' && (
            <div className="flex items-center gap-2">
              <Factory className="h-4 w-4 text-muted-foreground" />
              <Select
                value={selectedMinifabrica || '__all__'}
                onValueChange={v => setSelectedMinifabrica(v === '__all__' ? null : v)}
              >
                <SelectTrigger className="w-[180px] h-9 text-sm">
                  <SelectValue placeholder="Toda a Fábrica" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Toda a Fábrica</SelectItem>
                  {sectors.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Show locked sector for Diretor */}
          {userType === 'diretor' && (
            <div className="flex items-center gap-2">
              <Factory className="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary" className="text-xs">
                Minifábrica: {currentUser?.sector}
              </Badge>
            </div>
          )}

          <div className="flex-1" />
          {currentUser && userType && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{TYPE_LABELS[userType]}</Badge>
              <span className="text-sm text-muted-foreground">{currentUser.name}</span>
            </div>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
