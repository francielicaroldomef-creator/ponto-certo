CREATE OR REPLACE FUNCTION public.guard_absence_treatment_overlap() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  is_coverage boolean := TG_TABLE_NAME='coverages';
  cid uuid; pid uuid; day date; aid uuid; old_cid uuid; old_pid uuid; old_day date;
  lock_key bigint; occurrence record; conflict record;
  candidate_start time; candidate_end time; candidate_bs time; candidate_be time;
BEGIN
  IF is_coverage THEN
    IF NEW.status='cancelada' THEN RETURN NEW; END IF;
    cid:=NEW.contract_id; pid:=NEW.post_id; day:=NEW.work_date; aid:=NEW.attendance_id;
    candidate_bs:=NEW.break_start; candidate_be:=NEW.break_end;
    IF TG_OP='UPDATE' THEN old_cid:=OLD.contract_id; old_pid:=OLD.post_id; old_day:=OLD.work_date; END IF;
  ELSE
    IF NOT NEW.active THEN RETURN NEW; END IF;
    SELECT a.contract_id,s.post_id,a.work_date INTO cid,pid,day FROM public.attendance a JOIN public.schedules s ON s.id=a.schedule_id WHERE a.id=NEW.attendance_id;
    aid:=NEW.attendance_id;
    IF TG_OP='UPDATE' THEN SELECT a.contract_id,s.post_id,a.work_date INTO old_cid,old_pid,old_day FROM public.attendance a JOIN public.schedules s ON s.id=a.schedule_id WHERE a.id=OLD.attendance_id; END IF;
  END IF;
  candidate_start:=NEW.start_time; candidate_end:=NEW.end_time;
  FOR lock_key IN SELECT DISTINCT k FROM (VALUES (hashtextextended('absence-overlap:'||cid::text||':'||pid::text||':'||day::text,0)),(hashtextextended('absence-overlap:'||old_cid::text||':'||old_pid::text||':'||old_day::text,0))) keys(k) WHERE k IS NOT NULL ORDER BY k LOOP
    PERFORM pg_advisory_xact_lock(lock_key);
  END LOOP;
  FOR occurrence IN SELECT a.id,a.status,a.absent_intervals,s.start_time,s.end_time,s.break_start,s.break_end FROM public.attendance a JOIN public.schedules s ON s.id=a.schedule_id WHERE a.contract_id=cid AND s.post_id=pid AND a.work_date=day AND (aid IS NULL OR a.id=aid) AND a.status IN ('falta_integral','falta_parcial','ferias','afastamento') LOOP
    SELECT r.* INTO conflict FROM (
      SELECT c.id,'cobertura'::text label,c.start_time,c.end_time,c.break_start,c.break_end FROM public.coverages c WHERE c.contract_id=cid AND c.post_id=pid AND c.work_date=day AND (c.attendance_id IS NULL OR c.attendance_id=occurrence.id) AND c.status<>'cancelada' AND (NOT is_coverage OR c.id<>NEW.id)
      UNION ALL
      SELECT t.id,CASE WHEN t.kind='dispensa' THEN 'dispensa sem desconto' ELSE 'Sem cobertura, com desconto' END,t.start_time,t.end_time,NULL::time,NULL::time FROM public.absence_treatments t WHERE t.attendance_id=occurrence.id AND t.active AND (is_coverage OR t.id<>NEW.id)
    ) r WHERE EXISTS (
      SELECT 1 FROM generate_series(0,1439) minute CROSS JOIN LATERAL (SELECT (time '00:00'+minute*interval '1 minute')::time AS tm) tick
      WHERE tm>=candidate_start AND tm<candidate_end AND NOT coalesce(tm>=candidate_bs AND tm<candidate_be,false)
        AND tm>=r.start_time AND tm<r.end_time AND NOT coalesce(tm>=r.break_start AND tm<r.break_end,false)
        AND tm>=occurrence.start_time AND tm<occurrence.end_time AND NOT coalesce(tm>=occurrence.break_start AND tm<occurrence.break_end,false)
        AND (occurrence.status<>'falta_parcial' OR EXISTS (SELECT 1 FROM jsonb_array_elements(occurrence.absent_intervals) i WHERE tm>=(i->>'start')::time AND tm<(i->>'end')::time))
    ) LIMIT 1;
    IF FOUND THEN RAISE EXCEPTION 'Conflito com % (%–%) da mesma ausência. Edite ou cancele/remova o tratamento anterior antes de salvar este período.',conflict.label,to_char(conflict.start_time,'HH24:MI'),to_char(conflict.end_time,'HH24:MI') USING ERRCODE='23514'; END IF;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_absence_treatment_overlap() FROM PUBLIC;
CREATE TRIGGER a_absence_overlap_guard BEFORE INSERT OR UPDATE ON public.coverages FOR EACH ROW EXECUTE FUNCTION public.guard_absence_treatment_overlap();
CREATE TRIGGER b_absence_overlap_guard BEFORE INSERT OR UPDATE ON public.absence_treatments FOR EACH ROW EXECUTE FUNCTION public.guard_absence_treatment_overlap();
COMMENT ON FUNCTION public.guard_absence_treatment_overlap() IS 'Write-only non-destructive guard across active absence decisions and non-cancelled coverages; shared post/day locking, self exclusion, shift breaks and partial absence intersection. Existing rows are not rewritten.';