-- Migração consolidada para Lovable / Supabase
-- 1. Adicionar colunas workplace e city na tabela posts
ALTER TABLE public.posts 
  ADD COLUMN IF NOT EXISTS workplace text,
  ADD COLUMN IF NOT EXISTS city text;

-- 2. Adicionar colunas city e required_posts na tabela contracts
ALTER TABLE public.contracts 
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS required_posts int;

-- 3. Atualizar dados oficiais do contrato CT-001 (PGE) para 30 postos e Erechim
UPDATE public.contracts 
SET name = 'PGE', 
    city = 'Erechim',
    required_headcount = 30,
    required_posts = 30
WHERE code = 'CT-001';

UPDATE public.posts
SET workplace = 'Escola Serafim',
    city = 'Erechim'
WHERE contract_id = (SELECT id FROM public.contracts WHERE code = 'CT-001');

-- 4. Criar tabela quick_access_credentials se não existir
CREATE TABLE IF NOT EXISTS public.quick_access_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pin_hash text NOT NULL,
  role text NOT NULL DEFAULT 'supervisor',
  modules text[] NOT NULL DEFAULT ARRAY['divergencias', 'coberturas'],
  contract_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quick_access_credentials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'quick_access_credentials' AND policyname = 'quick_access_credentials_all'
  ) THEN
    CREATE POLICY quick_access_credentials_all ON public.quick_access_credentials
      FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.quick_access_credentials TO anon, authenticated, service_role;

-- 5. Notificar PostgREST para recarregar o cache de schema imediatamente
NOTIFY pgrst, 'reload schema';
