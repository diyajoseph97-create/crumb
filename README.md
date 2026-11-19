# Crumb

Crumb's Cookbook: a little home for all your saved recipes. Add an Instagram Reel or a YouTube video and Crumb turns it into a tidy, searchable recipe.

**Open it:** https://diyajoseph97-create.github.io/crumb/

## How it works
- **Hosting:** GitHub Pages (this repo, built into `docs/`). This repo holds code only.
- **Your recipes:** saved in your browser (IndexedDB), photos included. Works offline once opened.
- **Reading recipes:** Gemini reads the video (what's said and shown), plus any screenshots or caption. YouTube videos are read straight from their link; Instagram Reels need the downloaded video.

## Setup (once)
Open Crumb and paste a free **Gemini API key** from **aistudio.google.com/apikey** (keys start with `AQ.` or `AIza`). You can also skip it and type recipes in yourself.

## Adding a recipe
- **YouTube:** paste the link and click **Save to Crumb**.
- **Instagram:** download the Reel, drop it in, and add its link and caption (the caption usually has the amounts).
- It's added in the background: an "Adding recipe…" card appears and becomes the recipe when ready.
- **On Android:** install Crumb from Chrome (⋮ → Install app) and share Reels, videos or YouTube links to it.
- **On iPhone:** make an Apple Shortcut that opens `https://diyajoseph97-create.github.io/crumb/?add=` + the shared link (steps in **Settings → Phone app**).
- Ingredients, amounts and steps are never guessed. Anything missing is marked **Needs details**.

## Cooking
- **Start cooking**: big-text checklist, then one step at a time; keeps the screen awake.
- **Add to list**: builds one shopping list across recipes (copy or share it).
- Switch amounts between as written, grams & ml, or cups & oz.
- Mark **I made this**, rate it, add **My notes** (private, never shared) and put recipes in **Collections**.

## Backups (important)
Recipes live only in this browser. **Settings → Backup → Download a backup** saves everything as one file; **Restore from backup** brings it back in any browser.

## Sync across devices (optional, Supabase)
Recipes stay on each device; Supabase keeps your devices in step. If the free project pauses after a quiet week, Crumb keeps working and catches up once you restore the project on supabase.com.

1. Create a Supabase project.
2. In **SQL Editor**, run:
```sql
create table if not exists public.recipes (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  data jsonb not null default '{}',
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.recipes enable row level security;
create policy "Only my recipes" on public.recipes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.recipes to authenticated;
create or replace function public.recipes_touch() returns trigger
  language plpgsql as $$ begin new.synced_at := clock_timestamp(); return new; end $$;
create trigger recipes_touch before insert or update on public.recipes
  for each row execute function public.recipes_touch();
create index if not exists recipes_sync_idx on public.recipes (user_id, synced_at);
```
3. **Authentication → URL Configuration:** Site URL and Redirect URL = `https://diyajoseph97-create.github.io/crumb/`.
4. In Crumb: **Settings → Sync & sharing**, paste the Project URL and the **publishable** key (never the secret key), then sign in with your email. On other devices use **Set up another device**, then sign in with the same email.

5. Run `supabase/update-2.sql` too (lets your Gemini key follow you to other devices and keeps My notes out of shared links).

Sign-in is by email link: open the email on the same device and tap Sign in. (Supabase only lets you edit the email to add a 6-digit code after setting up custom SMTP; Crumb accepts a code if one is there.)

To skip pasting the Project URL on every device, put the URL and **publishable** key in `lib/cloud-config.ts` (both are safe to be public; never the secret key).

## View-only sharing (needs sync)
Open `supabase/sharing.sql`, copy all of it into Supabase's **SQL Editor** and click **Run** (safe to run again).
Then **Settings → Sync & sharing → Share your cookbook** (or **Share** on a recipe) makes a link. People who open it can browse but not change anything. **Stop sharing** turns a link off.

## Changing the code
```
npm install
npm run build     # writes docs/ (index.html, sw.js, fonts, icons)
npm run check     # type check
```
Commit and push to publish.

- UI: Preact (React-compatible, aliased in `scripts/build.mjs`).
- Gemini calls: `lib/gemini-api.ts` (plain fetch, no SDK). Recipe reading: `lib/gemini.ts`. Background adding: `lib/importer.ts`.
- Offline copy, share menu: `public/sw.js`.
- Sync: `lib/cloud.ts` (Supabase auth + table via fetch) and `lib/sync.ts` (push/pull, first-time merge).
