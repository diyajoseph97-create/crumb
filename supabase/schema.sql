-- Crumb database setup. Paste this whole file into Supabase → SQL Editor → New query → Run.

-- One row per recipe. The full recipe lives in "data" (JSON), which keeps
-- the structure flexible and makes exporting easy.
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  source_shortcode text unique,          -- Instagram shortcode, prevents duplicate imports
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recipes_created_at_idx on public.recipes (created_at desc);

-- Lock the table: Row Level Security ON with no policies means the public
-- (anon) key can't read or write anything. Only Crumb's server, using the
-- secret service_role key, can access it.
alter table public.recipes enable row level security;

-- Image storage: a bucket for recipe photos. Files get long random names.
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;
