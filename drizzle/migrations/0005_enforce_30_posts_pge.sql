-- Garante que o contrato CT-001 (PGE) possui exatamente 30 postos (P01 a P30) e required_headcount = 30
UPDATE public.contracts 
SET required_headcount = 30,
    name = COALESCE(NULLIF(name, ''), 'PGE'),
    city = COALESCE(NULLIF(city, ''), 'Florianópolis')
WHERE code = 'CT-001';

-- Remover quaisquer postos sobressalentes que não pertençam ao range oficial P01-P30 do contrato PGE
DELETE FROM public.posts
WHERE contract_id = (SELECT id FROM public.contracts WHERE code = 'CT-001')
  AND code NOT IN (
    'P01','P02','P03','P04','P05','P06','P07','P08','P09','P10',
    'P11','P12','P13','P14','P15','P16','P17','P18','P19','P20',
    'P21','P22','P23','P24','P25','P26','P27','P28','P29','P30'
  );

-- Garantir que os 30 postos oficiais P01 a P30 existem e estão ativos com 1 vaga cada
DO $$
DECLARE
  c_id uuid;
  i int;
  p_code text;
BEGIN
  SELECT id INTO c_id FROM public.contracts WHERE code = 'CT-001';
  IF c_id IS NOT NULL THEN
    FOR i IN 1..30 LOOP
      p_code := 'P' || lpad(i::text, 2, '0');
      INSERT INTO public.posts (
        contract_id, code, workplace, city, role_name, shift,
        start_time, end_time, break_start, break_end, required_qty,
        day_value, hour_value, active, is_demo
      )
      VALUES (
        c_id, p_code, 'Escola Serafim', 'Florianópolis', 'Servente de Limpeza', 'Diurno',
        '08:00', '17:00', '12:00', '13:00', 1,
        180.00, 22.50, true, true
      )
      ON CONFLICT (contract_id, code) DO UPDATE
      SET city = COALESCE(public.posts.city, 'Florianópolis'),
          workplace = COALESCE(public.posts.workplace, 'Escola Serafim'),
          required_qty = 1,
          active = true;
    END LOOP;
  END IF;
END $$;
