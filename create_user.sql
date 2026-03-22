-- Criar usuário nikolasgian10@gmail.com com senha 'senha123'
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  uuid_generate_v4(),
  'authenticated',
  'authenticated',
  'nikolasgian10@gmail.com',
  crypt('senha123', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Nikolas"}',
  NOW(),
  NOW()
);

-- Criar perfil na tabela users
INSERT INTO users (id, email, name, role, sector)
SELECT
  id,
  email,
  raw_user_meta_data->>'name',
  'Gestor',
  'Administração'
FROM auth.users
WHERE email = 'nikolasgian10@gmail.com';