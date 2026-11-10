-- Remove the probe participant created to test the ineligible guard
delete from public.participants where code = 'CJE92PUK6LX9J85S';

-- Should return only the participants you want to keep
select code, created_at, test2_at from public.participants order by created_at;
