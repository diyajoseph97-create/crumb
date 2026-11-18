-- Crumb: view-only sharing. Paste all of this into Supabase → SQL Editor and click Run.
-- Safe to run more than once.

create table if not exists public.shares (
  token text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  recipe_id text,
  title text not null default 'Crumb''s Cookbook',
  created_at timestamptz not null default now()
);

alter table public.shares enable row level security;

drop policy if exists "Only my shares" on public.shares;
create policy "Only my shares" on public.shares for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, delete on public.shares to authenticated;

create or replace function public.shared_cookbook(share_token text)
returns json
language sql
stable
security definer
set search_path = public
as $body$
  select json_build_object(
    'title', s.title,
    'recipe_id', s.recipe_id,
    'recipes', coalesce(
      (select json_agg(r.data order by r.updated_at desc)
         from public.recipes r
        where r.user_id = s.user_id
          and not r.deleted
          and (s.recipe_id is null or r.id = s.recipe_id)),
      '[]'::json)
  )
  from public.shares s
  where s.token = share_token
    and length(share_token) >= 20;
$body$;

revoke all on function public.shared_cookbook(text) from public;
grant execute on function public.shared_cookbook(text) to anon, authenticated;
