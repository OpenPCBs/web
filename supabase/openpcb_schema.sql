create extension if not exists pgcrypto;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default auth.jwt()->>'sub',
  slug text not null unique,
  title text not null,
  author_name text not null,
  summary text not null,
  description text,
  tool text not null,
  license text not null,
  tags text[] not null default '{}',
  category text not null default 'General',
  difficulty text not null default 'Custom',
  stars integer not null default 0,
  forks integer not null default 0,
  parent_project_id uuid references public.projects(id) on delete set null,
  archive_path text,
  archive_name text,
  archive_size bigint,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_updated_at_idx on public.projects (updated_at desc);

alter table public.projects enable row level security;

create or replace trigger set_projects_updated_at
before update on public.projects
for each row
execute procedure public.set_current_timestamp_updated_at();

create policy "Public can read public projects and owners can read their own projects"
on public.projects
for select
to public
using (
  is_public = true
  or (auth.jwt()->>'sub') = user_id
);

create policy "Authenticated users can insert their own projects"
on public.projects
for insert
to authenticated
with check ((auth.jwt()->>'sub') = user_id);

create policy "Authenticated users can update their own projects"
on public.projects
for update
to authenticated
using ((auth.jwt()->>'sub') = user_id)
with check ((auth.jwt()->>'sub') = user_id);

create policy "Authenticated users can delete their own projects"
on public.projects
for delete
to authenticated
using ((auth.jwt()->>'sub') = user_id);

insert into storage.buckets (id, name, public)
values ('project-archives', 'project-archives', true)
on conflict (id) do nothing;

create policy "Public can read project archives"
on storage.objects
for select
to public
using (bucket_id = 'project-archives');

create policy "Authenticated users can upload their own project archives"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'project-archives'
  and split_part(name, '/', 1) = (auth.jwt()->>'sub')
);

create policy "Authenticated users can update their own project archives"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'project-archives'
  and split_part(name, '/', 1) = (auth.jwt()->>'sub')
)
with check (
  bucket_id = 'project-archives'
  and split_part(name, '/', 1) = (auth.jwt()->>'sub')
);

create policy "Authenticated users can delete their own project archives"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'project-archives'
  and split_part(name, '/', 1) = (auth.jwt()->>'sub')
);

-- Refresh PostgREST so the Data API can see new tables and policies immediately.
NOTIFY pgrst, 'reload schema';
