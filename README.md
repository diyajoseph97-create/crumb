# Crumb

A personal digital cookbook. It turns saved Instagram Reels into tidy, searchable recipe cards.

- **App:** hosted on GitHub Pages (this repo, built into `docs/`).
- **Your recipes:** saved as files in a separate **private** repo (`crumb-data`). Nothing is stored in this public repo.
- **AI:** Gemini reads a screen recording, screenshots and/or the caption, and fills in the recipe.

## Connecting a device (once per phone or laptop)

You need two things, pasted into Crumb's setup screen. They're stored only on that device.

### 1. A GitHub access token (lets Crumb save to `crumb-data`)
1. Go to **github.com → your photo → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Name:** `crumb`. **Expiration:** 1 year (or "No expiration").
3. **Repository access:** *Only select repositories* → `crumb-data`.
4. **Permissions → Repository permissions → Contents:** *Read and write*.
5. Click **Generate token**, then copy it (it starts with `github_pat_`).

You can use the same token on all your devices, or make one per device.

### 2. A Gemini API key (lets Crumb read Reels)
1. Go to **aistudio.google.com** → **Get API key → Create API key**.
2. Copy it (it starts with `AIza`).

The free tier is plenty for personal use. On the free tier, Google may use requests to improve its products.

## Adding a recipe
1. In Instagram, tap **Share → Copy link** on the Reel and paste it into Crumb. It's kept for "Watch original video" and for spotting duplicates.
2. Add a **screen recording** of the Reel (best: Crumb listens to what's said and reads on-screen text), and/or **screenshots**, and/or the **copied caption**.
3. Tap **Read recipe**.

- Ingredients, amounts and steps are never guessed. Anything missing stays blank and the recipe is marked **Needs details**.
- Times and servings are used if stated; otherwise they're estimated and shown as **~ estimated**.
- In a hurry? Paste just the link and tap **Save link for later**, then fill it in from the recipe page.

## Backups
**Settings → Download a backup** saves every recipe as one JSON file. The `crumb-data` repo also keeps the full history of every change.

## Security notes
- This repo is public only because free GitHub Pages requires it. It contains code, no recipes or keys.
- The token can only touch `crumb-data`. If a device is lost, delete the token on GitHub (Settings → Fine-grained tokens) and make a new one.

## Changing the code
```
npm install
npm run build     # writes docs/index.html
npm run check     # type check
```
Commit and push `docs/` to publish.

```
components/   the interface (Home, RecipeDetail, RecipeEditor, AddRecipeModal, Setup…)
lib/          scaling, filters, synonyms, categories, GitHub storage, Gemini reading
src/main.tsx  start-up: setup screen, or your cookbook
styles/       colours, type, layout
```
