# Food values

`foods.json` holds nutrition per 100 g for ~170 common home-cooking ingredients,
used by `lib/nutrition.ts` to work out a recipe's nutrition from its ingredients.

Each entry: `n` name, `a` other names, `v` per 100 g `[kcal, protein g, fat g, carbs g (total, incl. fibre), fibre g]`,
`g` grams per household measure (cup, tbsp, tsp, piece, clove, …), `s` the source row.

Sources:
- **IFCT 2017**: Indian Food Composition Tables, T. Longvah et al., National Institute of Nutrition (ICMR), Hyderabad,
  via the `@ifct2017/compositions` package (MIT). Used for Indian staples (dals, flours, vegetables, spices, paneer, ghee…).
- **USDA National Nutrient Database for Standard Reference** (public domain), via github.com/hadley/usdanutrients.
  Used for everything else, and for household weights (grams per cup/tbsp/piece).

Rebuild: `python3 -I scripts/build_foods.py <ifct index.csv> <usdanutrients/data>` (needs `pyreadr`).
