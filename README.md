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
- Ingredients, amounts and steps are never guessed. Anything missing is marked **Needs details**.

## Backups (important)
Recipes live only in this browser. **Settings → Download a backup** saves everything as one file; **Restore from backup** brings it back in any browser.

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
