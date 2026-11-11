CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
SET search_path = public, extensions;
CREATE TABLE public.day_control_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code text NOT NULL UNIQUE,
 contract_id uuid NOT NULL REFERENCES public.contracts(id),
 absent_name text NOT NULL CHECK (length(btrim(absent_name)) > 0),
 absent_cpf text NOT NULL,
 worker_name text NOT NULL CHECK (length(btrim(worker_name)) > 0),
 worker_cpf text NOT NULL,
 work_date date NOT NULL,
 shift text NOT NULL CHECK (shift IN ('integral','manha','tarde')),
 daily_value numeric(12,2) NOT NULL CHECK (daily_value >= 0),
 fare_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (fare_value >= 0),
 fare_quantity integer NOT NULL DEFAULT 0 CHECK (fare_quantity >= 0 AND fare_quantity <= 100),
 total_value numeric(14,2) GENERATED ALWAYS AS (daily_value + fare_value * fare_quantity) STORED,
 shift_range int4range GENERATED ALWAYS AS (CASE shift WHEN 'manha' THEN int4range(0,1,'[)') WHEN 'tarde' THEN int4range(1,2,'[)') ELSE int4range(0,2,'[)') END) STORED,
 active boolean NOT NULL DEFAULT true,
 created_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid DEFAULT auth.uid(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT day_control_worker_overlap EXCLUDE USING gist (worker_cpf WITH =, work_date WITH =, shift_range WITH &&) WHERE (active),
 CONSTRAINT day_control_absent_overlap EXCLUDE USING gist (absent_cpf WITH =, work_date WITH =, shift_range WITH &&) WHERE (active)
);
GRANT SELECT, INSERT, UPDATE ON public.day_control_entries TO authenticated;
GRANT ALL ON public.day_control_entries TO service_role;
ALTER TABLE public.day_control_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY day_control_read ON public.day_control_entries FOR SELECT TO authenticated USING (public.can_access_contract(contract_id));
CREATE POLICY day_control_insert ON public.day_control_entries FOR INSERT TO authenticated WITH CHECK (public.can_write_ops(contract_id));
CREATE POLICY day_control_update ON public.day_control_entries FOR UPDATE TO authenticated USING (public.can_write_ops(contract_id)) WITH CHECK (public.can_write_ops(contract_id));
CREATE SEQUENCE public.day_control_code_seq;
CREATE FUNCTION public.day_control_cpf_valid(cpf text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE n integer; i integer; s integer; digit integer;
BEGIN
 IF cpf IS NULL OR cpf !~ '^[0-9]{11}$' OR cpf = repeat(substr(cpf,1,1),11) THEN RETURN false; END IF;
 FOR n IN 9..10 LOOP
  s := 0;
  FOR i IN 1..n LOOP s := s + substr(cpf,i,1)::integer * (n+2-i); END LOOP;
  digit := ((s*10)%11)%10;
  IF digit <> substr(cpf,n+1,1)::integer THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;
CREATE FUNCTION public.day_control_before() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 NEW.absent_cpf := regexp_replace(NEW.absent_cpf,'[^0-9]','','g');
 NEW.worker_cpf := regexp_replace(NEW.worker_cpf,'[^0-9]','','g');
 NEW.absent_name := btrim(NEW.absent_name); NEW.worker_name := btrim(NEW.worker_name);
 IF NOT public.day_control_cpf_valid(NEW.absent_cpf) OR NOT public.day_control_cpf_valid(NEW.worker_cpf) THEN RAISE EXCEPTION 'Informe CPF válido da faltante e da diarista.'; END IF;
 IF NEW.absent_cpf = NEW.worker_cpf THEN RAISE EXCEPTION 'A faltante e a diarista devem ter CPFs diferentes.'; END IF;
 IF TG_OP = 'INSERT' THEN
  NEW.code := 'DIA-' || lpad(nextval('public.day_control_code_seq')::text,8,'0');
  NEW.created_by := auth.uid(); NEW.created_at := now();
 ELSE
  NEW.code := OLD.code; NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
 END IF;
 NEW.updated_by := auth.uid(); NEW.updated_at := now();
 RETURN NEW;
END $$;
CREATE TRIGGER day_control_validate BEFORE INSERT OR UPDATE ON public.day_control_entries FOR EACH ROW EXECUTE FUNCTION public.day_control_before();
CREATE TRIGGER day_control_period_lock BEFORE INSERT OR UPDATE ON public.day_control_entries FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock();
CREATE TRIGGER audit_day_control AFTER INSERT OR UPDATE ON public.day_control_entries FOR EACH ROW EXECUTE FUNCTION public.audit_trg();