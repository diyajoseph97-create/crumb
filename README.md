# Crumb: setup guide

Crumb is your personal cookbook. This guide gets it online in about 30–45 minutes. You'll create four accounts and copy a few values between them. No terminal needed.

**What each service does**

| Service | Job | Cost |
|---|---|---|
| GitHub | Stores Crumb's code | Free |
| Supabase | Database + photo storage | Free tier |
| Anthropic | The AI that turns captions, videos and screenshots into tidy recipes | Pay per use (a few cents per import) |
| Google AI Studio (Gemini) | "Watches" Reels when the recipe is spoken or shown on screen, not written in the caption | Free tier, then pay per use (fractions of a cent per Reel) |
| Apify *(strongly recommended)* | Reliably fetches the Reel's caption and video. Instagram often blocks the free method from servers. | Pay per use, includes a free monthly credit |
| Vercel | Puts Crumb on the internet | Free (Hobby) |

Keep a notes file open while you work. You'll collect these values:
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `APIFY_TOKEN`, `CRUMB_PASSPHRASE`, `CRUMB_SESSION_SECRET`.

> ⚠️ Treat the keys like passwords. Never paste them into chats, screenshots or code files. They only go into Vercel's settings (Step 4).

---

## Step 1: Put the code on GitHub

1. Unzip `crumb.zip` on your computer.
2. Go to **github.com → + (top right) → New repository**.
3. Name it `crumb`, choose **Private**, and click **Create repository**.
4. On the empty repo page, click **uploading an existing file**.
5. Open the unzipped `crumb` folder, select **everything inside it** (not the folder itself), and drag it into the browser. Folders like `app`, `components` and `lib` must keep their structure.
   - On a Mac, press **Cmd + Shift + .** in Finder to show hidden files, so `.gitignore` and `.env.example` come along too. They're useful but not essential.
6. Click **Commit changes**.

## Step 2: Create the database (Supabase)

1. Go to **supabase.com** and sign up. Click **New project**.
2. Name it `crumb`, set a database password (save it in your notes) and pick the region closest to you, e.g. **Mumbai**. Click **Create**, then wait about 2 minutes.
3. In the left sidebar, open **SQL Editor → New query**.
4. Open the file `supabase/schema.sql` from the zip, copy **all** of it, paste it into the editor and click **Run**. You should see "Success. No rows returned".
5. Go to **Project Settings (gear icon) → API** (sometimes called **Data API** / **API Keys**):
   - Copy the **Project URL** → this is `SUPABASE_URL`
   - Copy the **service_role** secret key (click Reveal) → this is `SUPABASE_SERVICE_ROLE_KEY`

   Use **service_role**, not "anon". It stays on the server only.

## Step 3: Get an AI key (Anthropic)

1. Go to **console.anthropic.com** and sign up.
2. Under **Billing**, add a small amount of credit (e.g. $5 lasts a long time for personal use).
3. Go to **API Keys → Create Key**, name it `crumb`, and copy it → this is `ANTHROPIC_API_KEY`.

## Step 3b: Get a video-reading key (Google AI Studio)

1. Go to **aistudio.google.com** and sign in with a Google account.
2. Click **Get API key → Create API key**, then copy it → this is `GEMINI_API_KEY`.
3. *(Optional)* To move off the free tier later, set up billing in AI Studio. On the free tier, Google may use the requests to improve its products. These are public Reels, so that's usually fine for a personal cookbook.

## Step 3c: Get an Instagram fetcher token (Apify)

Without this, imports depend on Instagram letting a server read the page, which it often refuses.

1. Go to **apify.com** and sign up (the free plan includes monthly credit).
2. Open **Settings → API & Integrations** and copy your **Personal API token** → this is `APIFY_TOKEN`.

## Step 4: Put Crumb online (Vercel)

1. Go to **vercel.com** and sign up **with your GitHub account**.
2. Click **Add New… → Project**, find your `crumb` repo and click **Import**.
3. Before deploying, open **Environment Variables** and add each of these (name on the left, value on the right):

   | Name | Value |
   |---|---|
   | `CRUMB_PASSPHRASE` | A phrase only you know, e.g. `three green mangoes on tuesday`. You'll type it once per device. |
   | `CRUMB_SESSION_SECRET` | A long random string. Get one at **generate-secret.vercel.app/32** |
   | `SUPABASE_URL` | From Step 2 |
   | `SUPABASE_SERVICE_ROLE_KEY` | From Step 2 |
   | `ANTHROPIC_API_KEY` | From Step 3 |
   | `GEMINI_API_KEY` | From Step 3b |
   | `APIFY_TOKEN` | From Step 3c |

4. Click **Deploy** and wait about 2 minutes.
5. Click the preview to open your site. You'll get a link like `crumb-abc123.vercel.app`. Enter your passphrase, and you're in.

**Optional, a nicer link:** in Vercel → your project → **Settings → Domains**, you can rename the `*.vercel.app` address.

---

## Daily use

- **Add recipe → Instagram link:** paste a Reel link. Crumb works through these steps:
  1. Reads the caption.
  2. If the ingredients, quantities or steps aren't all there, it **watches the video**, listening to what's said and reading on-screen text.
  3. Combines both into ingredients, steps, cooking time and servings, and saves the recipe.
- **Times and servings:** if the Reel states them, Crumb uses them. If not, it estimates from the method and quantities and marks them **~ estimated**. Edit a value to replace the estimate.
- **Ingredients, quantities and steps are never guessed.** If something isn't said, shown or written, it stays blank and the recipe is marked **Needs details**. Open it and tap **Fill in from screenshots**.
- A small note on each imported recipe says where it was read from (caption, video or both). It's useful if something looks off.
- **Add recipe → Screenshots:** works for any source, not just Instagram.
- Nothing is ever guessed. Missing quantities stay missing until you add them.

## Backups

While unlocked, visit `your-crumb-link/api/export` to download every recipe as a JSON file. Supabase also keeps its own daily backups.

## Good to know

- **Free Supabase projects pause after about a week of no use.** If Crumb says it can't load recipes, open supabase.com and click **Restore project**.
- **Log out every device** (e.g. if you shared your passphrase by accident): change `CRUMB_SESSION_SECRET` in Vercel, then go to **Deployments → ⋯ → Redeploy**.
- **Changing the passphrase:** edit `CRUMB_PASSPHRASE` in Vercel and redeploy.
- **If imports keep saying "couldn't watch the video":** check that `GEMINI_API_KEY` and `APIFY_TOKEN` are set in Vercel, then redeploy (**Deployments → ⋯ → Redeploy**). Environment changes only apply after a redeploy.
- **Imports take 20–60 seconds** when Crumb has to watch the video. That's normal.
- **Private accounts' Reels can't be imported**, because nothing can read them without logging in. Use screenshots instead.

## Where things live (for future changes)

```
app/                 pages + server routes (api/…)
components/          the interface (Home, RecipeDetail, RecipeEditor, AddRecipeModal…)
lib/                 shared logic: scaling, filters, synonyms, categories
lib/server/          server-only: database, Instagram fetch, video reading, AI, passphrase check
supabase/schema.sql  database setup
demo/                the standalone demo build
```

- Categories and tag thresholds: `lib/constants.ts`
- Ingredient synonyms (e.g. dhania → coriander): `lib/synonyms.ts`
