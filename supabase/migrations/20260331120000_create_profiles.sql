create table if not exists public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	username text not null,
	username_normalized text not null unique,
	first_name text not null,
	last_name text not null,
	country text not null,
	state text not null,
	city text not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,24}$'),
	constraint profiles_username_normalized_matches check (username_normalized = lower(username))
);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
