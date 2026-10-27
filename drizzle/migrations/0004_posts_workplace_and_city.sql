-- Adicionar campos de posto de trabalho (local) e cidade na tabela posts
ALTER TABLE public.posts 
  ADD COLUMN IF NOT EXISTS workplace text,
  ADD COLUMN IF NOT EXISTS city text;

-- Adicionar campo opcional de cidade padrão no contrato (para herança se aplicável)
ALTER TABLE public.contracts 
  ADD COLUMN IF NOT EXISTS city text;

-- Atualizar os registros existentes de teste (CT-001 / P01 a P30) com os dados de exemplo
UPDATE public.contracts 
SET name = 'PGE', 
    city = 'Florianópolis'
WHERE code = 'CT-001';

UPDATE public.posts
SET workplace = 'Escola Serafim',
    city = 'Florianópolis'
WHERE contract_id = (SELECT id FROM public.contracts WHERE code = 'CT-001');
