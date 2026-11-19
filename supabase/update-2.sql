-- Crumb update 2: your Gemini key on all your devices, and private notes kept
-- off shared links. Paste all of this into Supabase → SQL Editor and click Run.
-- Safe to run more than once. Run sharing.sql first if you haven't.

create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  gemini_key text,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "Only my settings" on public.user_settings;
create policy "Only my settings" on public.user_settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.user_settings to authenticated;

-- Shared links: same as before, but your "My notes" never leave your account.
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
      (select json_agg(r.data - 'myNotes' order by r.updated_at desc)
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
