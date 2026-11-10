-- Patch: block T3 for ineligible participants (keep 0-day wait).
-- Paste into Supabase SQL Editor and Run.

create or replace function public.check_test2(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created timestamptz;
  v_test2 timestamptz;
  v_wait int;
  v_eligible text;
begin
  if p_code is null or p_code !~ '^[A-HJ-NP-Z2-9]{16}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  select created_at, test2_at into v_created, v_test2
  from participants
  where code = p_code;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select payload->>'eligible' into v_eligible
  from survey_responses
  where code = p_code and stage = 'test1';

  if v_eligible = 'false' then
    return jsonb_build_object('ok', false, 'reason', 'not_eligible');
  end if;

  if v_test2 is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_done');
  end if;

  v_wait := ceil(extract(epoch from (v_created + interval '0 days' - now())));

  if v_wait > 0 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'too_early',
      'wait_seconds', v_wait,
      'created_at', v_created
    );
  end if;

  return jsonb_build_object('ok', true, 'created_at', v_created);
end;
$$;

create or replace function public.submit_test2(p_code text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created timestamptz;
  v_test2 timestamptz;
  v_wait int;
  v_prev_sid text;
  v_eligible text;
begin
  if p_code is null or p_code !~ '^[A-HJ-NP-Z2-9]{16}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  select created_at, test2_at into v_created, v_test2
  from participants
  where code = p_code
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select payload->>'eligible' into v_eligible
  from survey_responses
  where code = p_code and stage = 'test1';

  if v_eligible = 'false' then
    return jsonb_build_object('ok', false, 'reason', 'not_eligible');
  end if;

  if v_test2 is not null then
    select payload->>'submissionId' into v_prev_sid
    from survey_responses
    where code = p_code and stage = 'test2';

    if v_prev_sid is not null and v_prev_sid = (p_payload->>'submissionId') then
      return jsonb_build_object('ok', true, 'duplicate', true);
    end if;

    return jsonb_build_object('ok', false, 'reason', 'already_done');
  end if;

  v_wait := ceil(extract(epoch from (v_created + interval '0 days' - now())));
  if v_wait > 0 then
    return jsonb_build_object('ok', false, 'reason', 'too_early', 'wait_seconds', v_wait, 'created_at', v_created);
  end if;

  insert into survey_responses(code, stage, payload)
  values (p_code, 'test2', p_payload);

  update participants set test2_at = now() where code = p_code;

  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'already_done');
end;
$$;

revoke all on function public.submit_test1(text, jsonb) from public;
revoke all on function public.check_test2(text) from public;
revoke all on function public.submit_test2(text, jsonb) from public;

grant execute on function public.submit_test1(text, jsonb) to anon;
grant execute on function public.check_test2(text) to anon;
grant execute on function public.submit_test2(text, jsonb) to anon;

