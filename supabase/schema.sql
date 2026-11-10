-- ============================================================
-- 两次制问卷 · Supabase 初始化脚本
-- 在 Supabase 项目的 SQL Editor 里整段执行一次。
--
-- 设计要点：
--   1. 网页端（anon key）只能“提交”和“查状态”，读不到任何作答内容
--   2. 7 天等待用数据库服务器时间判断，改电脑时间没有用
--   3. 同一编号的每个阶段只能写一次，天然防重复提交
--   4. 数据表名用 participants / survey_responses，避免和旧版表冲突
--
-- 如果要改等待天数：本文件里有两处 interval '7 days'，
-- 同时改 assets/js/config.js 里的 test2DelayDays。
-- ============================================================

create table if not exists public.participants (
  code text primary key,
  created_at timestamptz not null default now(),
  test2_at timestamptz,
  constraint participants_code_format check (code ~ '^[A-HJ-NP-Z2-9]{16}$')
);

create table if not exists public.survey_responses (
  id bigint generated always as identity primary key,
  code text not null references public.participants(code) on delete cascade,
  stage text not null check (stage in ('test1', 'test2')),
  created_at timestamptz not null default now(),
  payload jsonb not null,
  unique (code, stage)
);

alter table public.participants enable row level security;
alter table public.survey_responses enable row level security;

-- 网页端不允许直接读写表，只能调用下面的函数
revoke all on table public.participants from anon, authenticated;
revoke all on table public.survey_responses from anon, authenticated;
grant usage on schema public to anon;

-- ------------------------------------------------------------
-- 一测提交：创建参与者 + 写入一测作答
-- 同一个 submissionId 重复提交视为成功（防止网络重试造成重复）
-- ------------------------------------------------------------
create or replace function public.submit_test1(p_code text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
  v_prev_sid text;
begin
  if p_code is null or p_code !~ '^[A-HJ-NP-Z2-9]{16}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  insert into participants(code) values (p_code) on conflict (code) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    select payload->>'submissionId' into v_prev_sid
    from survey_responses
    where code = p_code and stage = 'test1';

    if v_prev_sid is not null and v_prev_sid = (p_payload->>'submissionId') then
      return jsonb_build_object('ok', true, 'duplicate', true);
    end if;

    return jsonb_build_object('ok', false, 'reason', 'code_exists');
  end if;

  insert into survey_responses(code, stage, payload)
  values (p_code, 'test1', p_payload);

  return jsonb_build_object('ok', true, 'created_at', now());
end;
$$;

-- ------------------------------------------------------------
-- 二测进入前检查：编号是否存在、是否已做完、是否满 7 天
-- ------------------------------------------------------------
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

  -- 画像「都不满足」未入组者不参加第二次
  select payload->>'eligible' into v_eligible
  from survey_responses
  where code = p_code and stage = 'test1';

  if v_eligible = 'false' then
    return jsonb_build_object('ok', false, 'reason', 'not_eligible');
  end if;

  if v_test2 is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_done');
  end if;

  v_wait := ceil(extract(epoch from (v_created + interval '7 days' - now())));

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

-- ------------------------------------------------------------
-- 二测提交：再次校验 7 天，写入作答并标记完成
-- ------------------------------------------------------------
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

  v_wait := ceil(extract(epoch from (v_created + interval '7 days' - now())));
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

-- ------------------------------------------------------------
-- 只把这三个函数的执行权开放给网页端
-- ------------------------------------------------------------
revoke all on function public.submit_test1(text, jsonb) from public;
revoke all on function public.check_test2(text) from public;
revoke all on function public.submit_test2(text, jsonb) from public;

grant execute on function public.submit_test1(text, jsonb) to anon;
grant execute on function public.check_test2(text) to anon;
grant execute on function public.submit_test2(text, jsonb) to anon;

-- ------------------------------------------------------------
-- 旧版表（codes / responses）如果没用过，可以手动执行下面两行清理：
-- drop table if exists public.responses;
-- drop table if exists public.codes;
-- ------------------------------------------------------------
