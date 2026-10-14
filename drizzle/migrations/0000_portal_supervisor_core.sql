
-- ROLES
create type public.app_role as enum ('admin','supervisor','conferente','financeiro');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_staff_all(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _uid and role in ('admin','conferente','financeiro'))
$$;

create policy "own profile or staff" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff_all(auth.uid()));
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid());
create policy "admin update profiles" on public.profiles for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "read own roles or admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin insert roles" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin delete roles" on public.user_roles for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email)
  on conflict (id) do nothing;
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- CADASTROS
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  client text not null,
  start_date date not null,
  end_date date,
  supervisor_id uuid,
  supervisor_name text,
  required_headcount int not null default 0,
  discount_rule text not null default 'hora' check (discount_rule in ('hora','diaria','turno')),
  operating_weekdays int[] not null default '{1,2,3,4,5}',
  active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.can_access_contract(_contract uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff_all(auth.uid())
    or exists (select 1 from public.contracts c where c.id = _contract and c.supervisor_id = auth.uid()
               and public.has_role(auth.uid(),'supervisor'))
$$;
create or replace function public.can_write_ops(_contract uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'conferente')
    or exists (select 1 from public.contracts c where c.id = _contract and c.supervisor_id = auth.uid()
               and public.has_role(auth.uid(),'supervisor'))
$$;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id),
  code text not null,
  role_name text not null,
  shift text not null default 'Diurno',
  start_time time not null default '08:00',
  end_time time not null default '17:00',
  break_start time default '12:00',
  break_end time default '13:00',
  required_qty int not null default 1,
  day_value numeric(12,2) not null default 0,
  hour_value numeric(12,2) not null default 0,
  valid_from date,
  valid_to date,
  active boolean not null default true,
  is_demo boolean not null default false,
  unique (contract_id, code)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  registration text not null unique,
  name text not null,
  role_name text not null,
  status text not null default 'ativo' check (status in ('ativo','inativo','afastado')),
  admission_date date,
  is_demo boolean not null default false
);

create table public.employee_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  contract_id uuid not null references public.contracts(id),
  post_id uuid references public.posts(id),
  start_date date not null,
  end_date date,
  unique (employee_id, contract_id, start_date)
);

create table public.day_workers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  phone text,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  availability text,
  day_rate numeric(12,2) not null default 0,
  hour_rate numeric(12,2) not null default 0,
  is_demo boolean not null default false
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  contract_id uuid not null references public.contracts(id),
  post_id uuid not null references public.posts(id),
  work_date date not null,
  start_time time not null,
  end_time time not null,
  break_start time,
  break_end time,
  unique (employee_id, work_date, start_time)
);
create index on public.schedules (contract_id, work_date);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null unique references public.schedules(id),
  contract_id uuid not null references public.contracts(id),
  work_date date not null,
  status text not null check (status in ('presente','falta_integral','falta_parcial','folga','ferias','afastamento')),
  absent_intervals jsonb not null default '[]',
  justification_status text not null default 'nao_apresentada' check (justification_status in ('nao_apresentada','pendente','aprovada','rejeitada')),
  justification_doc text,
  notes text,
  review_status text not null default 'pendente' check (review_status in ('pendente','aprovado','corrigido')),
  hour_value numeric(12,2),
  updated_by uuid,
  updated_at timestamptz not null default now()
);
create index on public.attendance (contract_id, work_date);

create table public.coverages (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id),
  post_id uuid not null references public.posts(id),
  attendance_id uuid references public.attendance(id),
  work_date date not null,
  coverer_type text not null check (coverer_type in ('diarista','funcionario')),
  day_worker_id uuid references public.day_workers(id),
  employee_id uuid references public.employees(id),
  start_time time not null,
  end_time time not null,
  break_start time,
  break_end time,
  agreed_value numeric(12,2) not null default 0,
  status text not null default 'planejada' check (status in ('planejada','confirmada','realizada','cancelada')),
  payment_status text not null default 'pendente' check (payment_status in ('pendente','pago')),
  notes text,
  seed_key text unique,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  check ((coverer_type='diarista' and day_worker_id is not null) or (coverer_type='funcionario' and employee_id is not null))
);

create table public.timesheet_docs (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id),
  period_start date not null,
  period_end date not null,
  file_name text not null,
  file_path text,
  file_hash text,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now(),
  status text not null default 'enviado' check (status in ('enviado','processado','conferencia_manual','erro','duplicado')),
  extraction jsonb,
  errors text,
  is_demo boolean not null default false,
  seed_key text unique
);

create table public.punches (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.timesheet_docs(id) on delete cascade,
  contract_id uuid not null references public.contracts(id),
  employee_id uuid references public.employees(id),
  registration text,
  name text,
  work_date date,
  marks text[] not null default '{}',
  page int,
  match_confidence text not null default 'matricula' check (match_confidence in ('matricula','nome_incerto','desconhecido')),
  seed_key text unique
);

create table public.divergences (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id),
  work_date date,
  employee_id uuid references public.employees(id),
  schedule_id uuid references public.schedules(id),
  doc_id uuid references public.timesheet_docs(id) on delete set null,
  page int,
  kind text not null,
  reason text not null,
  affects_calc boolean not null default true,
  status text not null default 'aberta' check (status in ('aberta','resolvida')),
  resolution text,
  resolved_by uuid,
  resolved_at timestamptz,
  is_demo boolean not null default false,
  excluded_from_totals boolean not null default false,
  seed_key text unique,
  created_at timestamptz not null default now()
);

create table public.closings (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id),
  period_start date not null,
  period_end date not null,
  status text not null default 'aberto' check (status in ('aberto','fechado')),
  predicted_discount numeric(12,2),
  coverage_cost numeric(12,2),
  revised_discount numeric(12,2),
  applied_discount numeric(12,2),
  difference_reason text,
  support_doc text,
  snapshot jsonb,
  closed_by uuid,
  closed_at timestamptz,
  reopen_reason text,
  seed_key text unique,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid,
  contract_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  reason text,
  user_id uuid,
  created_at timestamptz not null default now()
);

-- GRANTS
grant select, insert, update on public.contracts, public.posts, public.employees, public.employee_assignments,
  public.day_workers, public.schedules, public.attendance, public.coverages, public.timesheet_docs,
  public.punches, public.divergences, public.closings to authenticated;
grant delete on public.schedules, public.punches to authenticated;
grant select on public.audit_log to authenticated;
grant all on public.contracts, public.posts, public.employees, public.employee_assignments, public.day_workers,
  public.schedules, public.attendance, public.coverages, public.timesheet_docs, public.punches,
  public.divergences, public.closings, public.audit_log to service_role;

alter table public.contracts enable row level security;
alter table public.posts enable row level security;
alter table public.employees enable row level security;
alter table public.employee_assignments enable row level security;
alter table public.day_workers enable row level security;
alter table public.schedules enable row level security;
alter table public.attendance enable row level security;
alter table public.coverages enable row level security;
alter table public.timesheet_docs enable row level security;
alter table public.punches enable row level security;
alter table public.divergences enable row level security;
alter table public.closings enable row level security;
alter table public.audit_log enable row level security;

-- POLICIES
create policy "read contracts" on public.contracts for select to authenticated using (public.can_access_contract(id));
create policy "admin write contracts" on public.contracts for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin update contracts" on public.contracts for update to authenticated using (public.has_role(auth.uid(),'admin'));

create policy "read posts" on public.posts for select to authenticated using (public.can_access_contract(contract_id));
create policy "admin ins posts" on public.posts for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin upd posts" on public.posts for update to authenticated using (public.has_role(auth.uid(),'admin'));

create policy "read employees" on public.employees for select to authenticated using (
  public.is_staff_all(auth.uid()) or exists (select 1 from public.employee_assignments a where a.employee_id = employees.id and public.can_access_contract(a.contract_id)));
create policy "admin ins employees" on public.employees for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin upd employees" on public.employees for update to authenticated using (public.has_role(auth.uid(),'admin'));

create policy "read assignments" on public.employee_assignments for select to authenticated using (public.can_access_contract(contract_id));
create policy "admin ins assignments" on public.employee_assignments for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin upd assignments" on public.employee_assignments for update to authenticated using (public.has_role(auth.uid(),'admin'));

create policy "read day workers" on public.day_workers for select to authenticated using (true);
create policy "admin ins dw" on public.day_workers for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin upd dw" on public.day_workers for update to authenticated using (public.has_role(auth.uid(),'admin'));

create policy "read schedules" on public.schedules for select to authenticated using (public.can_access_contract(contract_id));
create policy "ops ins schedules" on public.schedules for insert to authenticated with check (public.can_write_ops(contract_id));
create policy "ops upd schedules" on public.schedules for update to authenticated using (public.can_write_ops(contract_id));
create policy "ops del schedules" on public.schedules for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create policy "read attendance" on public.attendance for select to authenticated using (public.can_access_contract(contract_id));
create policy "ops ins attendance" on public.attendance for insert to authenticated with check (public.can_write_ops(contract_id));
create policy "ops upd attendance" on public.attendance for update to authenticated using (public.can_write_ops(contract_id));

create policy "read coverages" on public.coverages for select to authenticated using (public.can_access_contract(contract_id));
create policy "ops ins coverages" on public.coverages for insert to authenticated with check (public.can_write_ops(contract_id));
create policy "ops upd coverages" on public.coverages for update to authenticated using (public.can_write_ops(contract_id) or public.has_role(auth.uid(),'financeiro'));

create policy "read docs" on public.timesheet_docs for select to authenticated using (public.can_access_contract(contract_id));
create policy "ops ins docs" on public.timesheet_docs for insert to authenticated with check (public.can_write_ops(contract_id));
create policy "ops upd docs" on public.timesheet_docs for update to authenticated using (public.can_write_ops(contract_id));

create policy "read punches" on public.punches for select to authenticated using (public.can_access_contract(contract_id));
create policy "ops ins punches" on public.punches for insert to authenticated with check (public.can_write_ops(contract_id));
create policy "ops upd punches" on public.punches for update to authenticated using (public.can_write_ops(contract_id));
create policy "ops del punches" on public.punches for delete to authenticated using (public.can_write_ops(contract_id));

create policy "read div" on public.divergences for select to authenticated using (public.can_access_contract(contract_id));
create policy "ops ins div" on public.divergences for insert to authenticated with check (public.can_write_ops(contract_id));
create policy "review upd div" on public.divergences for update to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'conferente'));

create policy "read closings" on public.closings for select to authenticated using (public.can_access_contract(contract_id));
create policy "fin ins closings" on public.closings for insert to authenticated with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'financeiro'));
create policy "fin upd closings" on public.closings for update to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'financeiro'));

create policy "read audit" on public.audit_log for select to authenticated using (
  public.is_staff_all(auth.uid()) or (contract_id is not null and public.can_access_contract(contract_id)));

-- TRIGGERS: closed period lock
create or replace function public.is_period_closed(_contract uuid, _d date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.closings where contract_id = _contract and status = 'fechado'
                 and _d between period_start and period_end)
$$;

create or replace function public.enforce_period_lock()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if public.is_period_closed(r.contract_id, r.work_date)
     or (tg_op = 'UPDATE' and public.is_period_closed(old.contract_id, old.work_date)) then
    raise exception 'Período fechado: alterações bloqueadas. Solicite a reabertura ao financeiro/administrador.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger lock_attendance before insert or update or delete on public.attendance for each row execute function public.enforce_period_lock();
create trigger lock_coverages before insert or update or delete on public.coverages for each row execute function public.enforce_period_lock();
create trigger lock_schedules before insert or update or delete on public.schedules for each row execute function public.enforce_period_lock();

-- attendance snapshot hour value + validation
create or replace function public.attendance_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select sc.*, p.hour_value as hv into s from public.schedules sc join public.posts p on p.id = sc.post_id where sc.id = new.schedule_id;
  if s is null then raise exception 'Escala não encontrada'; end if;
  new.contract_id := s.contract_id;
  new.work_date := s.work_date;
  if tg_op = 'INSERT' and new.hour_value is null then new.hour_value := s.hv; end if;
  if new.status = 'falta_parcial' and jsonb_array_length(new.absent_intervals) = 0 then
    raise exception 'Falta parcial exige ao menos um intervalo não trabalhado';
  end if;
  if new.status <> 'falta_parcial' then new.absent_intervals := '[]'; end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.updated_at := now();
  return new;
end $$;
create trigger attendance_before_trg before insert or update on public.attendance for each row execute function public.attendance_before();

-- coverage conflict
create or replace function public.coverage_conflict()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelada' then return new; end if;
  if exists (
    select 1 from public.coverages c where c.id <> new.id and c.work_date = new.work_date and c.status <> 'cancelada'
      and ((new.day_worker_id is not null and c.day_worker_id = new.day_worker_id)
        or (new.employee_id is not null and c.employee_id = new.employee_id))
      and c.start_time < new.end_time and new.start_time < c.end_time) then
    raise exception 'Conflito de horário: esta pessoa já possui cobertura sobreposta nesta data.';
  end if;
  if new.employee_id is not null and exists (
    select 1 from public.schedules s left join public.attendance a on a.schedule_id = s.id
    where s.employee_id = new.employee_id and s.work_date = new.work_date
      and s.start_time < new.end_time and new.start_time < s.end_time
      and coalesce(a.status,'presente') = 'presente') then
    raise exception 'Conflito: o funcionário está escalado no próprio posto neste horário. Registre a ausência no posto de origem antes.';
  end if;
  return new;
end $$;
create trigger coverage_conflict_trg before insert or update on public.coverages for each row execute function public.coverage_conflict();

-- closings rules
create or replace function public.closing_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare missing int; opendiv int;
begin
  if new.status = 'fechado' and (tg_op = 'INSERT' or old.status <> 'fechado') then
    select count(*) into missing from public.schedules s left join public.attendance a on a.schedule_id = s.id
      where s.contract_id = new.contract_id and s.work_date between new.period_start and new.period_end and a.id is null;
    select count(*) into opendiv from public.divergences d
      where d.contract_id = new.contract_id and d.status = 'aberta' and d.affects_calc and not d.excluded_from_totals
        and (d.work_date is null or d.work_date between new.period_start and new.period_end);
    if missing > 0 then raise exception 'Fechamento bloqueado: % registro(s) não informado(s) no período.', missing; end if;
    if opendiv > 0 then raise exception 'Fechamento bloqueado: % divergência(s) aberta(s) que afetam o cálculo.', opendiv; end if;
    new.closed_by := coalesce(auth.uid(), new.closed_by);
    new.closed_at := now();
  end if;
  if tg_op = 'UPDATE' and old.status = 'fechado' then
    if new.status = 'fechado' and (new.predicted_discount is distinct from old.predicted_discount
        or new.coverage_cost is distinct from old.coverage_cost or new.period_start <> old.period_start or new.period_end <> old.period_end) then
      raise exception 'Fechamento concluído: reabra o período para alterar valores calculados.';
    end if;
    if new.status = 'aberto' then
      if coalesce(trim(new.reopen_reason),'') = '' then raise exception 'Informe o motivo da reabertura.'; end if;
      if auth.uid() is not null and not (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'financeiro')) then
        raise exception 'Sem permissão para reabrir.';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger closing_rules_trg before insert or update on public.closings for each row execute function public.closing_rules();

-- audit
create or replace function public.audit_trg()
returns trigger language plpgsql security definer set search_path = public as $$
declare cid uuid; rid uuid; reason text;
begin
  if tg_op = 'DELETE' then rid := old.id; else rid := new.id; end if;
  begin
    if tg_op = 'DELETE' then cid := (to_jsonb(old)->>'contract_id')::uuid; else cid := (to_jsonb(new)->>'contract_id')::uuid; end if;
  exception when others then cid := null; end;
  if tg_table_name = 'contracts' then cid := rid; end if;
  if tg_op <> 'DELETE' then reason := coalesce(to_jsonb(new)->>'reopen_reason', to_jsonb(new)->>'resolution'); end if;
  insert into public.audit_log(table_name, record_id, contract_id, action, old_data, new_data, reason, user_id)
  values (tg_table_name, rid, cid, tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end, reason, auth.uid());
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger audit_attendance after insert or update or delete on public.attendance for each row execute function public.audit_trg();
create trigger audit_coverages after insert or update or delete on public.coverages for each row execute function public.audit_trg();
create trigger audit_closings after insert or update on public.closings for each row execute function public.audit_trg();
create trigger audit_divergences after update on public.divergences for each row execute function public.audit_trg();
create trigger audit_contracts after update on public.contracts for each row execute function public.audit_trg();
create trigger audit_posts after update on public.posts for each row execute function public.audit_trg();

-- schedule generation
create or replace function public.generate_schedules(_contract uuid, _from date, _to date)
returns int language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if not public.can_write_ops(_contract) then raise exception 'Sem permissão'; end if;
  insert into public.schedules(employee_id, contract_id, post_id, work_date, start_time, end_time, break_start, break_end)
  select a.employee_id, a.contract_id, a.post_id, d::date, p.start_time, p.end_time, p.break_start, p.break_end
  from public.employee_assignments a
  join public.posts p on p.id = a.post_id and p.active
  join public.employees e on e.id = a.employee_id and e.status = 'ativo'
  join public.contracts c on c.id = a.contract_id
  cross join generate_series(_from, _to, interval '1 day') d
  where a.contract_id = _contract
    and extract(isodow from d)::int = any(c.operating_weekdays)
    and d::date >= a.start_date and (a.end_date is null or d::date <= a.end_date)
  on conflict (employee_id, work_date, start_time) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.generate_schedules(uuid, date, date) to authenticated;

-- DEMO SEED (idempotent)
create or replace function public.seed_demo()
returns text language plpgsql security definer set search_path = public as $$
declare c uuid; i int; d date; dws uuid[]; att uuid; doc uuid;
begin
  if auth.uid() is not null and not public.has_role(auth.uid(),'admin') then raise exception 'Somente administrador'; end if;

  insert into public.contracts(code, name, client, start_date, end_date, supervisor_name, required_headcount, discount_rule, is_demo)
  values ('CT-001','Contrato Teste','Tomador Fictício','2026-01-01','2026-12-31','Supervisor Teste',30,'hora',true)
  on conflict (code) do nothing;
  select id into c from public.contracts where code = 'CT-001';

  for i in 1..30 loop
    insert into public.posts(contract_id, code, role_name, shift, start_time, end_time, break_start, break_end, required_qty, day_value, hour_value, valid_from, is_demo)
    values (c, 'P'||lpad(i::text,2,'0'), 'Servente de limpeza', 'Diurno', '08:00','17:00','12:00','13:00',1,180.00,22.50,'2026-01-01',true)
    on conflict (contract_id, code) do nothing;
    insert into public.employees(registration, name, role_name, status, admission_date, is_demo)
    values ('ST'||lpad(i::text,3,'0'), 'Servente Teste '||lpad(i::text,2,'0'), 'Servente de limpeza','ativo','2026-01-01',true)
    on conflict (registration) do nothing;
    insert into public.employee_assignments(employee_id, contract_id, post_id, start_date)
    select e.id, c, p.id, '2026-01-01' from public.employees e, public.posts p
    where e.registration = 'ST'||lpad(i::text,3,'0') and p.contract_id = c and p.code = 'P'||lpad(i::text,2,'0')
    on conflict do nothing;
  end loop;

  for i in 1..5 loop
    insert into public.day_workers(code, name, status, availability, day_rate, hour_rate, is_demo)
    values ('DT'||lpad(i::text,2,'0'), 'Diarista Teste '||lpad(i::text,2,'0'), 'ativo', 'Seg a Sex', 130.00, 16.25, true)
    on conflict (code) do nothing;
  end loop;
  select array_agg(id order by code) into dws from public.day_workers where code like 'DT0%';

  -- schedules October 2026 Mon-Fri (skip days already closed)
  insert into public.schedules(employee_id, contract_id, post_id, work_date, start_time, end_time, break_start, break_end)
  select a.employee_id, c, a.post_id, g::date, '08:00','17:00','12:00','13:00'
  from public.employee_assignments a cross join generate_series('2026-10-01'::date,'2026-10-31'::date, interval '1 day') g
  where a.contract_id = c and extract(isodow from g) between 1 and 5 and not public.is_period_closed(c, g::date)
  on conflict (employee_id, work_date, start_time) do nothing;

  -- 01-02/10: all present, then closed (closing test)
  if not exists (select 1 from public.closings where seed_key = 'demo-closing-0102') then
    insert into public.attendance(schedule_id, contract_id, work_date, status, review_status)
    select s.id, c, s.work_date, 'presente', 'aprovado' from public.schedules s
    where s.contract_id = c and s.work_date in ('2026-10-01','2026-10-02')
    on conflict (schedule_id) do nothing;
    insert into public.closings(contract_id, period_start, period_end, status, predicted_discount, coverage_cost, revised_discount, seed_key)
    values (c, '2026-10-01','2026-10-02','fechado',0,0,0,'demo-closing-0102');
  end if;

  -- 05/10 scenarios
  d := '2026-10-05';
  if not public.is_period_closed(c, d) then
    insert into public.attendance(schedule_id, contract_id, work_date, status, justification_status, absent_intervals, notes)
    select s.id, c, d,
      case when e.registration in ('ST001','ST002','ST003','ST004') then 'falta_integral'
           when e.registration in ('ST005','ST006') then 'falta_parcial' else 'presente' end,
      case when e.registration in ('ST003','ST004') then 'aprovada' else 'nao_apresentada' end,
      case when e.registration in ('ST005','ST006') then '[{"start":"13:00","end":"17:00"}]'::jsonb else '[]'::jsonb end,
      'Dado fictício de demonstração'
    from public.schedules s join public.employees e on e.id = s.employee_id
    where s.contract_id = c and s.work_date = d
    on conflict (schedule_id) do nothing;

    insert into public.coverages(contract_id, post_id, attendance_id, work_date, coverer_type, day_worker_id, start_time, end_time, break_start, break_end, agreed_value, status, payment_status, notes, seed_key)
    select c, s.post_id, a.id, d, 'diarista', dws[x.dw], x.st::time, x.et::time, x.bs::time, x.be::time, x.val, 'realizada', 'pendente', 'Simulação', x.k
    from (values ('ST002',1,'08:00','17:00','12:00','13:00',130.00,'demo-cov-st002'),
                 ('ST004',2,'08:00','17:00','12:00','13:00',130.00,'demo-cov-st004'),
                 ('ST006',3,'13:00','15:00',null,null,32.50,'demo-cov-st006')) as x(reg, dw, st, et, bs, be, val, k)
    join public.employees e on e.registration = x.reg
    join public.schedules s on s.employee_id = e.id and s.work_date = d
    join public.attendance a on a.schedule_id = s.id
    on conflict (seed_key) do nothing;
  end if;

  -- simulated timesheet document (NOT a real PDF)
  insert into public.timesheet_docs(contract_id, period_start, period_end, file_name, status, extraction, errors, is_demo, seed_key)
  values (c, '2026-10-01','2026-10-31','SIMULACAO_ponto_outubro.pdf','conferencia_manual',
    '{"simulacao": true, "observacao": "Documento fictício. Nenhum PDF real foi lido."}'::jsonb, null, true, 'demo-doc-1')
  on conflict (seed_key) do nothing;
  select id into doc from public.timesheet_docs where seed_key = 'demo-doc-1';

  insert into public.punches(doc_id, contract_id, employee_id, registration, name, work_date, marks, page, seed_key)
  select doc, c, e.id, e.registration, e.name, d, x.m, x.pg, x.k
  from (values ('ST007', '{}'::text[], 1, 'demo-p-st007'), ('ST008', '{08:00,12:00}'::text[], 1, 'demo-p-st008')) x(reg, m, pg, k)
  join public.employees e on e.registration = x.reg
  on conflict (seed_key) do nothing;

  insert into public.divergences(contract_id, work_date, employee_id, schedule_id, doc_id, page, kind, reason, affects_calc, is_demo, excluded_from_totals, seed_key)
  select c, d, e.id, s.id, doc, 1, x.kind, x.reason, true, true, false, x.k
  from (values ('ST007','presenca_sem_marcacao','SIMULAÇÃO: presença registrada pelo supervisor, mas o ponto não tem marcações.','demo-div-st007'),
               ('ST008','jornada_incompleta','SIMULAÇÃO: presença registrada, marcações 08:00–12:00 (jornada incompleta).','demo-div-st008')) x(reg, kind, reason, k)
  join public.employees e on e.registration = x.reg
  join public.schedules s on s.employee_id = e.id and s.work_date = d
  on conflict (seed_key) do nothing;

  -- extra examples, separated from 05/10 totals (06/10)
  insert into public.divergences(contract_id, work_date, employee_id, doc_id, kind, reason, affects_calc, is_demo, excluded_from_totals, seed_key)
  select c, '2026-10-06', null, doc, x.kind, x.reason, false, true, true, x.k
  from (values ('pdf_duplicado','SIMULAÇÃO: arquivo com o mesmo conteúdo já enviado (hash idêntico).','demo-x-dup'),
               ('matricula_desconhecida','SIMULAÇÃO: matrícula ST999 encontrada no documento não existe no cadastro.','demo-x-unk')) x(kind, reason, k)
  on conflict (seed_key) do nothing;
  insert into public.divergences(contract_id, work_date, employee_id, kind, reason, affects_calc, is_demo, excluded_from_totals, seed_key)
  select c, '2026-10-06', e.id, 'sem_documento', 'SIMULAÇÃO: funcionário esperado na escala sem documento de ponto enviado.', false, true, true, 'demo-x-nodoc'
  from public.employees e where e.registration = 'ST010'
  on conflict (seed_key) do nothing;

  return 'ok';
end $$;
revoke all on function public.seed_demo() from public, anon;
grant execute on function public.seed_demo() to authenticated;

select public.seed_demo();

-- storage policies for private bucket 'timesheets' (bucket created separately); path: <contract_id>/<file>
create policy "read timesheet files" on storage.objects for select to authenticated
  using (bucket_id = 'timesheets' and public.can_access_contract(((storage.foldername(name))[1])::uuid));
create policy "upload timesheet files" on storage.objects for insert to authenticated
  with check (bucket_id = 'timesheets' and public.can_write_ops(((storage.foldername(name))[1])::uuid));
