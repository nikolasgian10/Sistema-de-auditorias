-- Verificar estado do usuário nikolasgian10@gmail.com

-- 1. Verificar se existe em auth.users
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email = 'nikolasgian10@gmail.com';

-- 2. Verificar se existe perfil em users
SELECT id, email, name, role, sector, created_at
FROM users
WHERE email = 'nikolasgian10@gmail.com';

-- 3. Se não existir perfil, criar manualmente
-- (substitua o UUID abaixo pelo ID retornado na query 1)
-- INSERT INTO users (id, email, name, role, sector)
-- VALUES ('UUID-AQUI', 'nikolasgian10@gmail.com', 'Nikolas', 'Gestor', 'Administração');

-- 4. Verificar se RLS está habilitado
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'users';

-- 5. Verificar políticas RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users';