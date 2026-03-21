# Sistema de Auditoria Mahle

Um sistema completo de auditoria para processos industriais, desenvolvido com React, TypeScript, Supabase e Vercel.

## 🚀 Deploy

Para instruções completas de configuração e deploy, consulte o [DEPLOYMENT.md](./DEPLOYMENT.md).

## 📋 Visão Geral

- **Frontend**: React + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL + Auth)
- **UI**: Tailwind CSS + Shadcn/ui
- **Deploy**: Vercel

## 🛠️ Configuração Rápida

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Execute os SQLs do [DEPLOYMENT.md](./DEPLOYMENT.md)
3. Copie as chaves para `.env`:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Executar

```bash
npm run dev
```

## 📦 Build

```bash
npm run build
```

## 👥 Usuários de Teste

| Email | Senha | Função |
|-------|-------|--------|
| admin@mahle.com | senha123 | Gestor |
| carlos.silva@mahle.com | senha123 | Gestor |
| maria.santos@mahle.com | senha123 | Diretor |

## 📚 Documentação

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Guia completo de deploy
- [Arquitetura](#) - Documentação técnica (em breve)
