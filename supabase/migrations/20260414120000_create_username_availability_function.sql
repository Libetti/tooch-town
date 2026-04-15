create or replace function public.is_username_available(username_input text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
	select not exists (
		select 1
		from public.profiles
		where username_normalized = lower(trim(username_input))
	);
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;
