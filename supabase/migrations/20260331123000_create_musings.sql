create table if not exists public.musings (
	id uuid primary key default gen_random_uuid(),
	author_id uuid not null references auth.users (id) on delete cascade,
	author_label text not null,
	title text,
	body text not null,
	created_at timestamptz not null default now(),
	constraint musings_author_label_present check (char_length(btrim(author_label)) > 0),
	constraint musings_title_length check (title is null or char_length(title) <= 80),
	constraint musings_body_present check (char_length(btrim(body)) > 0),
	constraint musings_body_length check (char_length(body) <= 500)
);

create index if not exists musings_author_id_idx on public.musings (author_id);
create index if not exists musings_created_at_idx on public.musings (created_at desc);

alter table public.musings enable row level security;

drop policy if exists "Anyone can read musings" on public.musings;
drop policy if exists "Authenticated users can insert own musings" on public.musings;

create policy "Anyone can read musings"
on public.musings
for select
using (true);

create policy "Authenticated users can insert own musings"
on public.musings
for insert
to authenticated
with check (auth.uid() = author_id);
