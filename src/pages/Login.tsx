import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, LogIn, ChevronRight, Factory, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const TYPE_LABELS: Record<UserType, string> = {
  gestor: 'Gestor',
  diretor: 'Diretor',
  administrativo: 'Administrativo',
};

const TYPE_COLORS: Record<UserType, string> = {
  gestor: 'bg-primary text-primary-foreground',
  diretor: 'bg-accent text-accent-foreground',
  administrativo: 'bg-secondary text-secondary-foreground',
};

const TYPE_ICONS: Record<UserType, string> = {
  gestor: '🏭',
  diretor: '📋',
  administrativo: '👤',
};

export default function Login({ onLogin }: { onLogin: () => void }) {
  const { login, currentUser, userType } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      onLogin();
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  if (currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(210,70%,25%)] p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p>Já logado como {currentUser.name}</p>
            <Button onClick={onLogin} className="mt-4">Continuar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(210,70%,25%)] p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />
      <div className="absolute top-1/4 right-1/4 w-48 h-48 bg-white/3 rounded-full blur-2xl" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg mb-5">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Sistema de Auditoria Mahle
          </h1>
          <div className="flex items-center justify-center gap-2 mt-1">
            <Factory className="h-4 w-4 text-white/80" />
            <span className="text-lg font-semibold text-white/90">Mahle</span>
          </div>
          <p className="text-sm text-white/60 mt-3">
            Entre com suas credenciais para acessar o sistema
          </p>
        </div>

        <Card className="border-border/50 shadow-xl shadow-primary/5 backdrop-blur-sm">
          <CardContent className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@empresa.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Senha</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  required
                />
              </div>
              <Button type="submit" className="w-full h-12" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
                <LogIn className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-white/40 mt-6">
          Sistema de Auditoria Mahle © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
