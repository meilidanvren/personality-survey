-- Step 1: check what will be deleted
select code, created_at, test2_at
from public.participants
where code in ('3QRPLVDVB9FPCD4W', 'VGDXJTTK27HSCNJB');

-- Step 2: delete (survey_responses rows are removed automatically)
delete from public.participants
where code in ('3QRPLVDVB9FPCD4W', 'VGDXJTTK27HSCNJB');

-- Step 3: confirm nothing is left
select count(*) as remaining_participants from public.participants;
