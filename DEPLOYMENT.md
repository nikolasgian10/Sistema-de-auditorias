# 🚀 Guia Completo: Sistema de Auditoria Mahle

## 📋 Visão Geral

Este documento explica como configurar e implantar o Sistema de Auditoria Mahle usando Supabase como backend e Vercel para hospedagem.

## 🛠️ 1. Configuração do Supabase

### 1.1 Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Clique em "Start your project"
3. Faça login/cadastro
4. Clique em "New project"
5. Preencha:
   - **Name**: `audit-guardian-mahle`
   - **Database Password**: Escolha uma senha forte
   - **Region**: Escolha a mais próxima (ex: São Paulo)
6. Clique em "Create new project"

### 1.2 Configurar Autenticação

1. No painel lateral, vá para **Authentication > Settings**
2. Em "Site URL", coloque: `http://localhost:5173` (para desenvolvimento)
3. Em "Redirect URLs", adicione:
   - `http://localhost:5173`
   - `https://sua-app.vercel.app` (será atualizado depois)

### 1.3 Executar SQLs no Database

Vá para **SQL Editor** no painel lateral e execute os seguintes scripts em ordem:

#### Script 1: Criar Tabelas Principais
```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (linked to Supabase Auth)
CREATE TABLE users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Gestor', 'Diretor', 'Administrativo')),
  sector TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Machines table
CREATE TABLE machines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  sector TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Checklists table
CREATE TABLE checklists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  items JSONB NOT NULL, -- Array of checklist items
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Schedule entries table
CREATE TABLE schedule_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  week_number INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  employee_id UUID REFERENCES users(id) NOT NULL,
  machine_id UUID REFERENCES machines(id) NOT NULL,
  sector_id TEXT,
  checklist_id UUID REFERENCES checklists(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'missed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Audit records table
CREATE TABLE audit_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  schedule_entry_id UUID REFERENCES schedule_entries(id) NOT NULL,
  employee_id UUID REFERENCES users(id) NOT NULL,
  machine_id UUID REFERENCES machines(id) NOT NULL,
  checklist_id UUID REFERENCES checklists(id) NOT NULL,
  date DATE NOT NULL,
  answers JSONB NOT NULL,
  observations TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('conforme', 'nao_conforme', 'parcial')),
  audited_name TEXT,
  audited_re TEXT,
  shift TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Permissions table (for admin users)
CREATE TABLE user_permissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) NOT NULL,
  pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id)
);

-- Auditor order table (for scheduling)
CREATE TABLE auditor_order (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sector TEXT NOT NULL,
  employee_order JSONB NOT NULL, -- Array of user IDs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(sector)
);

-- Machine rotation pointers
CREATE TABLE machine_rotation (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sector TEXT NOT NULL,
  rotation_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(sector)
);

-- Checklist rotation pointers
CREATE TABLE checklist_rotation (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sector TEXT NOT NULL,
  rotation_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(sector)
);

-- Schedule model (predefined weekly schedule)
CREATE TABLE schedule_model (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  week_index INTEGER NOT NULL CHECK (week_index BETWEEN 1 AND 5),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  sector_id TEXT NOT NULL,
  employee_id UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(week_index, day_of_week, sector_id)
);
```

#### Script 2: Criar Funções e Triggers
```sql
-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, sector)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'Usuário'),
    'Administrativo',
    'Geral'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to all tables
CREATE TRIGGER handle_updated_at_users
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER handle_updated_at_machines
  BEFORE UPDATE ON machines
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER handle_updated_at_checklists
  BEFORE UPDATE ON checklists
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER handle_updated_at_user_permissions
  BEFORE UPDATE ON user_permissions
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER handle_updated_at_auditor_order
  BEFORE UPDATE ON auditor_order
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER handle_updated_at_machine_rotation
  BEFORE UPDATE ON machine_rotation
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER handle_updated_at_checklist_rotation
  BEFORE UPDATE ON checklist_rotation
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
```

#### Script 3: Políticas RLS (Row Level Security)
```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditor_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_rotation ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_rotation ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_model ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Gestor and Diretor can view all users
CREATE POLICY "Gestor and Diretor can view all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('Gestor', 'Diretor')
    )
  );

-- Gestor can update all users
CREATE POLICY "Gestor can update all users" ON users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'Gestor'
    )
  );

-- Everyone can read machines
CREATE POLICY "Everyone can read machines" ON machines
  FOR SELECT TO authenticated USING (true);

-- Gestor and Diretor can manage machines
CREATE POLICY "Gestor and Diretor can manage machines" ON machines
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('Gestor', 'Diretor')
    )
  );

-- Everyone can read checklists
CREATE POLICY "Everyone can read checklists" ON checklists
  FOR SELECT TO authenticated USING (true);

-- Gestor and Diretor can manage checklists
CREATE POLICY "Gestor and Diretor can manage checklists" ON checklists
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('Gestor', 'Diretor')
    )
  );

-- Users can view schedule entries for their sector or all (gestor)
CREATE POLICY "Users can view relevant schedule entries" ON schedule_entries
  FOR SELECT TO authenticated USING (
    employee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (u.role = 'Gestor' OR u.sector = schedule_entries.sector_id)
    )
  );

-- Users can update their own schedule entries
CREATE POLICY "Users can update own schedule entries" ON schedule_entries
  FOR UPDATE TO authenticated USING (employee_id = auth.uid());

-- Gestor and Diretor can manage all schedule entries
CREATE POLICY "Gestor and Diretor can manage schedule entries" ON schedule_entries
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('Gestor', 'Diretor')
    )
  );

-- Similar policies for audit_records, user_permissions, etc.
-- (Add based on your security requirements)
```

#### Script 4: Inserir Dados Iniciais
```sql
-- Insert sample machines
INSERT INTO machines (name, code, sector, description) VALUES
('Centrifugadora de Bronzinas #01', 'CFB-001', 'Fundição', 'Centrifugadora para fundição de bronzinas bimetálicas'),
('Forno de Fusão #01', 'FFU-001', 'Fundição', 'Forno elétrico para fusão de ligas de cobre e estanho'),
('Torno CNC Bronzinas #01', 'TCB-001', 'Usinagem', 'Torno CNC para usinagem de acabamento em bronzinas'),
('Mandrilhadora #01', 'MND-001', 'Usinagem', 'Mandrilhadora para ajuste de diâmetro interno das bronzinas'),
('Retífica Cilíndrica #01', 'RTC-001', 'Acabamento', 'Retífica para acabamento superficial de bronzinas'),
('Prensa de Conformação #01', 'PCF-001', 'Estamparia', 'Prensa para conformação e estampagem de bronzinas'),
('Máquina de Ensaio #01', 'MEN-001', 'Qualidade', 'Máquina de ensaio de dureza e dimensional para bronzinas'),
('Furadeira Radial #01', 'FRD-001', 'Usinagem', 'Furadeira radial para furos de lubrificação em bronzinas');

-- Insert sample checklists
INSERT INTO checklists (name, category, items) VALUES
('Segurança da Máquina', 'Segurança', '[
  {"id": "ci1", "question": "Proteções de segurança estão instaladas?", "type": "ok_nok"},
  {"id": "ci2", "question": "Botão de emergência está funcional?", "type": "ok_nok"},
  {"id": "ci3", "question": "EPIs estão sendo utilizados?", "type": "ok_nok"},
  {"id": "ci4", "question": "Observações adicionais", "type": "text"}
]'),
('5S - Organização', '5S', '[
  {"id": "ci5", "question": "Área de trabalho está limpa?", "type": "ok_nok"},
  {"id": "ci6", "question": "Ferramentas estão organizadas?", "type": "ok_nok"},
  {"id": "ci7", "question": "Materiais identificados corretamente?", "type": "ok_nok"}
]'),
('Qualidade do Processo', 'Qualidade', '[
  {"id": "ci8", "question": "Parâmetros de processo estão corretos?", "type": "ok_nok"},
  {"id": "ci9", "question": "Peça conforme especificação?", "type": "ok_nok"},
  {"id": "ci10", "question": "Registro de controle atualizado?", "type": "ok_nok"},
  {"id": "ci11", "question": "Temperatura do processo (°C)", "type": "number"}
]'),
('Manutenção Preventiva', 'Manutenção', '[
  {"id": "ci12", "question": "Lubrificação em dia?", "type": "ok_nok"},
  {"id": "ci13", "question": "Ruídos anormais detectados?", "type": "ok_nok"},
  {"id": "ci14", "question": "Nível de óleo adequado?", "type": "ok_nok"},
  {"id": "ci15", "question": "Filtros limpos?", "type": "ok_nok"}
]');
```

### 1.4 Obter Chaves da API

1. Vá para **Settings > API** no painel lateral
2. Copie:
   - **Project URL**: Para `VITE_SUPABASE_URL`
   - **anon public**: Para `VITE_SUPABASE_ANON_KEY`

## 👥 2. Criando Usuários

### 2.1 Método 1: Via Interface do Supabase

1. Vá para **Authentication > Users**
2. Clique em "Add user"
3. Preencha email e senha
4. Marque "Auto confirm user" (para desenvolvimento)
5. Clique em "Add user"

### 2.2 Método 2: Via SQL (Recomendado)

Execute no SQL Editor:

```sql
-- Criar usuário administrador
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', uuid_generate_v4(), 'authenticated', 'authenticated', 'admin@mahle.com', crypt('senha123', gen_salt('bf')), NOW(), NULL, '', NULL, '', NULL, '', '', NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{"name": "Administrador"}', FALSE, NOW(), NOW(), NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL);

-- Depois de criado, atualize o perfil na tabela users
UPDATE users SET
  name = 'Administrador do Sistema',
  role = 'Gestor',
  sector = 'Administração'
WHERE email = 'admin@mahle.com';
```

### 2.3 Criar Usuários em Massa

```sql
-- Criar múltiplos usuários
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', uuid_generate_v4(), 'authenticated', 'authenticated', 'carlos.silva@mahle.com', crypt('senha123', gen_salt('bf')), NOW(), '{"provider": "email", "providers": ["email"]}', '{"name": "Carlos Silva"}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', uuid_generate_v4(), 'authenticated', 'authenticated', 'maria.santos@mahle.com', crypt('senha123', gen_salt('bf')), NOW(), '{"provider": "email", "providers": ["email"]}', '{"name": "Maria Santos"}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', uuid_generate_v4(), 'authenticated', 'authenticated', 'joao.oliveira@mahle.com', crypt('senha123', gen_salt('bf')), NOW(), '{"provider": "email", "providers": ["email"]}', '{"name": "João Oliveira"}', NOW(), NOW());

-- Atualizar perfis
UPDATE users SET role = 'Gestor', sector = 'Produção' WHERE email = 'carlos.silva@mahle.com';
UPDATE users SET role = 'Diretor', sector = 'Manutenção' WHERE email = 'maria.santos@mahle.com';
UPDATE users SET role = 'Administrativo', sector = 'Produção' WHERE email = 'joao.oliveira@mahle.com';
```

## 🖥️ 3. Configuração do Projeto Local

### 3.1 Clonar e Instalar

```bash
git clone <seu-repositorio>
cd audit-guardian-mahle
npm install
```

### 3.2 Configurar Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e preencha com suas chaves reais:

```bash
cp .env.example .env
```

Edite o `.env` com as chaves do Supabase:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3.3 Executar Localmente

```bash
npm run dev
```

Acesse `http://localhost:5173` e faça login com um dos usuários criados.

## 🚀 4. Implantação no Vercel

### 4.1 Preparar o Projeto

1. Commit suas mudanças:
```bash
git add .
git commit -m "Configuração completa com Supabase"
git push origin main
```

### 4.2 Conectar ao Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Clique em "New Project"
3. Importe seu repositório Git
4. O Vercel detectará automaticamente as configurações do `vercel.json`

**Environment Variables:**
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4.3 Atualizar URLs no Supabase

Após o deploy, copie a URL do Vercel e atualize no Supabase:

1. Vá para **Authentication > Settings**
2. Atualize "Site URL" com a URL do Vercel
3. Adicione a URL do Vercel em "Redirect URLs"

### 4.4 Deploy

Clique em "Deploy" no Vercel. O projeto será construído e implantado automaticamente.

## 🔧 5. Manutenção e Troubleshooting

### 5.1 Verificar Logs

- **Vercel**: Vá para o dashboard do projeto > Functions/Logs
- **Supabase**: Vá para **Reports > Logs**

### 5.2 Problemas Comuns com Usuários

#### Erro: "Database error creating new user"

**Possíveis causas e soluções:**

1. **Trigger não foi criado corretamente:**
   ```sql
   -- Verificar se o trigger existe
   SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

   -- Se não existir, recriar
   DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
   ```

2. **Problema com RLS:**
   ```sql
   -- Desabilitar RLS temporariamente para teste
   ALTER TABLE users DISABLE ROW LEVEL SECURITY;

   -- Depois de testar, reabilitar
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   ```

3. **Criar usuário manualmente:**
   ```sql
   -- Criar usuário diretamente na tabela users
   INSERT INTO users (id, email, name, role, sector)
   VALUES (
     'user-uuid-aqui',
     'email@exemplo.com',
     'Nome do Usuário',
     'Administrativo',
     'Geral'
   );
   ```

4. **Verificar função handle_new_user:**
   ```sql
   -- Testar a função
   SELECT handle_new_user();
   ```

### 5.3 Resetar Banco de Dados

Se precisar resetar tudo:

```sql
-- ⚠️ CUIDADO: Isso apaga tudo!
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;
```

Depois execute novamente os scripts SQL do passo 1.3.

### 5.4 Backup

- Vá para **Settings > Database > Backups**
- Configure backups automáticos

## 📞 6. Suporte

Para dúvidas ou problemas:
1. Verifique os logs no Vercel e Supabase
2. Teste localmente primeiro
3. Verifique se as variáveis de ambiente estão corretas
4. Certifique-se de que as políticas RLS estão configuradas

---

## 🎯 Usuários de Teste

Após executar os SQLs, você terá estes usuários disponíveis:

| Email | Senha | Função | Setor |
|-------|-------|--------|-------|
| admin@mahle.com | senha123 | Gestor | Administração |
| carlos.silva@mahle.com | senha123 | Gestor | Produção |
| maria.santos@mahle.com | senha123 | Diretor | Manutenção |
| joao.oliveira@mahle.com | senha123 | Administrativo | Produção |

**Nota**: Mude as senhas após o primeiro login em produção!