-- One-time setup: flatten per-question answers into one wide view.
-- After running, open Table Editor -> public.survey_wide.

create or replace view public.survey_wide as
with t1 as (select * from public.survey_responses where stage='test1'),
     t2 as (select * from public.survey_responses where stage='test2')
select
  p.code            as code,
  p.created_at      as test1_at,
  p.test2_at        as test2_at,
  t1.payload->>'typeName' as type_name,
  (t1.payload->'dims'->>'L')::numeric as L,
  (t1.payload->'dims'->>'N')::numeric as N,
  (t1.payload->'dims'->>'V')::numeric as V,
  t1.payload->'answersA'->>'A01' as A01,
  t1.payload->'answersA'->>'A02' as A02,
  t1.payload->'answersA'->>'A03' as A03,
  t1.payload->'answersA'->>'A04' as A04,
  t1.payload->'answersA'->>'A05' as A05,
  t1.payload->'answersA'->>'A06' as A06,
  t1.payload->'answersA'->>'A07' as A07,
  t1.payload->'answersA'->>'A08' as A08,
  t1.payload->'answersA'->>'A09' as A09,
  t1.payload->'answersA'->>'A10' as A10,
  t1.payload->'answersA'->>'A11' as A11,
  t1.payload->'answersA'->>'A12' as A12,
  t1.payload->'answersB'->>'B01' as B01,
  t1.payload->'answersB'->>'B02' as B02,
  t1.payload->'answersB'->>'B03' as B03,
  t1.payload->'answersB'->>'B04' as B04,
  t1.payload->'answersB'->>'B05' as B05,
  t1.payload->'answersB'->>'B06' as B06,
  t1.payload->'answersB'->>'B07' as B07,
  t1.payload->'answersB'->>'B08' as B08,
  t1.payload->'answersB'->>'B09' as B09,
  t1.payload->'answersB'->>'B10' as B10,
  t2.payload->'answersC'->>'C01' as C01,
  t2.payload->'answersC'->>'C02' as C02,
  t2.payload->'answersC'->>'C03' as C03,
  t2.payload->'answersC'->>'C04' as C04,
  t2.payload->'answersC'->>'C05' as C05,
  t2.payload->'answersC'->>'C06' as C06,
  t2.payload->'answersC'->>'C07' as C07,
  t2.payload->'answersC'->>'C08' as C08
from public.participants p
left join t1 on t1.code = p.code
left join t2 on t2.code = p.code
order by p.created_at;