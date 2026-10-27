-- Tabela para credenciais de acesso rápido (clique triplo)
create table if not exists public.quick_access_credentials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  access_key text not null,
  role app_role not null default 'supervisor',
  allowed_contracts text[] not null default '{}',
  allowed_modules text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quick_access_credentials enable row level security;

grant all on public.quick_access_credentials to authenticated;
grant all on public.quick_access_credentials to service_role;
grant select on public.quick_access_credentials to anon;

-- Política de leitura: administradores ou usuários anônimos para validar chave ativa
create policy "admin full access quick_access_credentials"
  on public.quick_access_credentials
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "anon read active quick_access_credentials"
  on public.quick_access_credentials
  for select to anon
  using (active = true);
