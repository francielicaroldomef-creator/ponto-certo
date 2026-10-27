-- Adicionar campo required_posts na tabela contracts
ALTER TABLE public.contracts 
  ADD COLUMN IF NOT EXISTS required_posts int NOT NULL DEFAULT 0;

-- Sincronizar contratos existentes: se required_posts for 0, espelha required_headcount ou define 30 para CT-001
UPDATE public.contracts 
SET required_posts = CASE 
  WHEN code = 'CT-001' THEN 30
  WHEN required_headcount > 0 THEN required_headcount 
  ELSE 30 
END
WHERE required_posts = 0 OR code = 'CT-001';

UPDATE public.contracts 
SET required_headcount = 30
WHERE code = 'CT-001';
