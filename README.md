# Crumb

A personal digital cookbook. Drop in a downloaded Instagram Reel and Crumb turns it into a tidy, searchable recipe card.

**Open it:** https://diyajoseph97-create.github.io/crumb/

## How it works
- **Hosting:** GitHub Pages (this repo, built into `docs/`). This repo holds code only.
- **Your recipes:** saved in your browser on your laptop (IndexedDB), photos included. Nothing is uploaded except the video you ask Gemini to read.
- **AI:** Gemini reads the video (what's said and on-screen text), plus any screenshots or caption, and fills in the recipe.

## Setup (once)
Open Crumb and paste a free **Gemini API key**: go to **aistudio.google.com/apikey**, sign in, then **Create API key**. New keys start with `AQ.` (older ones with `AIza`); both work. You can also skip it and type recipes in yourself.

On the free tier, Google may use requests to improve its products.

## Adding a recipe
1. Download the Reel to your laptop.
2. In Crumb, click **Add recipe** and drop the video in.
3. Optional: paste the Reel's link (for "Watch original video" and duplicate warnings) and its caption.
4. Click **Read recipe**.

- Ingredients, amounts and steps are never guessed. Anything missing stays blank and the recipe is marked **Needs details**.
- Times and servings are used if stated; otherwise they're estimated and shown as **~ estimated**.
- The photo is a frame of the finished dish taken from the video. You can replace it.
- No time? Paste just the link and click **Save for later**. It waits at the top of your cookbook.

## Backups (important)
Recipes live only in this browser. Clearing browsing data, using a private window, or switching browsers means you won't see them.
- **Settings → Download a backup** saves everything (photos included) as one file. Keep it in iCloud Drive / Google Drive.
- **Settings → Restore from backup** brings them back, in any browser.

## Changing the code
```
npm install
npm run build     # writes docs/index.html
npm run check     # type check
```
Commit and push `docs/` to publish.

```
components/   the interface (Home, RecipeDetail, RecipeEditor, AddRecipeModal, Setup…)
lib/          scaling, filters, synonyms, categories, local storage, Gemini reading
src/main.tsx  start-up
styles/       colours, type, layout
```
