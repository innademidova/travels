# My travels — project context for Claude

A personal travel PWA for one user (the owner, not a developer): real trips and travel dreams in one place, so
inspiration (saved Instagram posts) turns into plans. Claude does all technical work; the owner writes in
Russian/Ukrainian and decides on features and design.

Local: `~/projects/travels`. Sister projects with the same stack: `~/projects/capsule`, `~/projects/perfume-diary`.

## Hard rules from the owner

- Everything in the repo is English (code, comments, docs, commits). **No Cyrillic in code.** Ukrainian text lives only
  in `src/locales/uk.json`. Never Russian anywhere. Chat replies to the owner: her language, plain and non-technical.
- UI languages: Ukrainian (default) and English, via `t('key')` from `src/i18n.ts` (same module as Capsule). Every new
  text goes into BOTH locale files.
- Hosting must stay free (GitHub Pages + Supabase free tier). Ask before anything that costs money.
- She is often on limited mobile internet: `npm install --prefer-offline`, warn before big downloads.

## Data (Supabase project "Style", ref `ajbdkvpyhoyzzzlrlttk`, shared with Capsule)

The free plan allows only 2 projects (Style, Perfumes), so the travel tables live in Style next to Capsule's tables.
Same login as Capsule (signups disabled). `supabase/schema.sql` = full travel schema; `node scripts/sql.mjs "<sql>"`.

- `trips`: kind `trip|dream`, title, destination, start_date, end_date, cover_path, hotel_url, notes, why (dream
  reason), rating 1–5, impression, photos[]. "Turn into a trip" = set kind 'trip' + dates (places stay attached).
- `trip_places`: trip_id, name, category `see|do|eat`, url, note, status `want|been`, day (1-based, null = not
  planned; a day beyond the trip length counts as not planned), sort (float, order inside a day), rating, impression, photos[].
- Storage bucket `travel` (private, signed URLs): `<uid>/<uuid>.webp` + thumbnail `<uuid>_t.webp` (`thumbOf`).

## Code

React 19 + Vite + TS, `vite-plugin-pwa`, hash routes (`#/`, `#/dreams`, `#/new/trip|dream`, `#/t/<id>[/plan|/memories|/edit]`).
`src/lib.ts` client, types, dates, link helpers (`guessName` reads the name from Google Maps place links), photo upload.
`src/store.tsx` data context. `src/Trip.tsx` trip/dream page, memories, convert, form. `src/Places.tsx` quick add,
list, place sheet. `src/Plan.tsx` day plan with pointer-event drag and drop (mouse drag; touch: long press or the grip
handle; tap an unplanned place = day picker). `src/ui.tsx` icons, Sheet, photos, stars.

## Deploy

`npm run build`, then `npm run deploy` (force-pushes `dist` to `gh-pages` of github.com/innademidova/travels through
`gh auth git-credential`; don't touch global git config). Then commit + push `main`.
