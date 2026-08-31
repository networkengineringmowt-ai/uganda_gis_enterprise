# Prompt for Antigravity — wire the Uganda Roads GIS app to live Supabase data

Paste everything below this line into Antigravity. It's written to be self-contained — you're starting with no memory of a prior conversation, so it includes all the context you need.

---

## Background

This is the Uganda National Roads Asset Management GIS platform — a React/Vite single-page app deployed as a static site on GitHub Pages at `https://networkengineringmowt-ai.github.io/uganda_gis_enterprise/`, repo `networkengineringmowt-ai/uganda_gis_enterprise`. Today it runs entirely on static JSON bundled into the build; the goal of this task is to move it to live queries against a Supabase Postgres database for the tables that are ready, while leaving everything else untouched.

All of the groundwork already exists in the user's Google Drive, under `MOWT/Uganda National Road Network Repository/`:

- `supabase_schema.sql` — the target schema, 41 tables covering every module of the app (road network, bridges/structures, traffic, pavement management, budget, HDM-4, ROMDAS/ML, road reserve).
- `supabase_secure_grants.sql` and `supabase_enable_rls.sql` — a security migration that locks the `anon` role to read-only and enables Row-Level Security. **Both must be run, in addition to `supabase_schema.sql`** — the base schema file grants the anon role broad write access by default, which the two migration files are meant to lock down afterward.
- `upload_to_supabase.py` — an existing ETL script that already loads 5 tables (`traffic_count_stations`, `tis_counts`, `atc_monthly_summary`, `aadt_projections`, `drive_inventory`) from JSON in `app_data/`.
- `upload_to_supabase_extended.py` (new, attached alongside this prompt) — loads 16 more tables, each mapped against real source JSON, not guessed, including `structures` (964 bridges+culverts, with a documented fix for a real source data-quality issue — duplicate ids on 21 records — see the file's docstring). See the header comment in the file for the full table list.
- `NOT_YET_MAPPED.md` (attached alongside this prompt) — an honest accounting of the remaining tables: a handful keyed off `structure_id` that can now be tackled since `structures` is loaded, others that only exist today as constants inside React `.tsx` component files (not JSON) and need a one-time export, and two tables (`road_reserve_applicants`, `road_reserve_applications`) that must **never** be wired into the public app because they hold real applicant PII (names, TIN, phone, email, signatures).

Why you're doing this instead of another agent: the assistant that prepared all of the above was operating under a hard rule to never use any Supabase credential in a tool call, for the rest of that session, after a key was accidentally pasted into that chat. It could research, write code, and inspect files, but could not run the ETL, apply the SQL, or push credentialed changes. You're running locally with the user's own credentials, so you can actually execute the parts that were blocked.

## What's already been done (don't redo)

- The Supabase project's JWT signing key has been rotated (Settings → API → JWT Signing Keys), and the old Legacy HS256 shared secret should be revoked if it hasn't been already — check this first, and if it's still active, tell the user to revoke it before you use any key derived from it.
- `upload_to_supabase_extended.py` is already written and syntax-checked. Don't rewrite its table mappings from scratch — extend it if you find more verified source data, but trust what's there.

## Your tasks, in order

### 1. Confirm current state
Connect to the Supabase project (ask the user for the project ref/URL if you don't have it, and use your own credential-handling — never anything from a prior chat log). Check:
- Does `information_schema.tables` show all 41 tables from `supabase_schema.sql`? If not, run `supabase_schema.sql` in full first. **`supabase_schema.sql` is the authoritative target schema for this task — not `unified_enterprise_schema.sql`, a different 73-table file also sitting in the repository folder. That file is synthetic placeholder data (see Hard Constraints below) — do not run it, do not treat it as a schema option to choose between.**
- Is RLS enabled and is `anon` read-only? Run `supabase_secure_grants.sql` then `supabase_enable_rls.sql` if not (safe to re-run either way — both are idempotent).
- Which tables currently have rows? This tells you whether the ETL scripts have already run.

### 2. Run the ETL
From the `MOWT/Uganda National Road Network Repository/` folder (the JSON sources are in `app_data/` inside it):
```
export SUPABASE_URL="<project URL>"
export SUPABASE_KEY="<current anon key, post-rotation>"
python upload_to_supabase.py
python upload_to_supabase_extended.py --data-dir app_data
```
Confirm row counts afterward for each of the 21 tables now covered.

### 3. Locate the actual frontend source project
The Drive folder has several near-duplicate `deploy-*` folders (`deploy-nbms-new`, `deploy-npms-catalogue-final4`, `deploy-npms-fix`, `deploy-nrms-final`, `deploy-ntis-final`) that look like repeated deploy attempts, plus other candidate source trees (`gis-enterprise/`, `uganda-roads/`, `backend-gis/`, `enterprise_portal_ui/`). **Do not assume which one is authoritative** — check each for a `package.json`, confirm it's a Vite/React app, and cross-check its build output hash against the live bundle filename currently on GitHub Pages (`assets/index-CLBcCEYM.js` as of this writing — verify this is still current by checking the deployed page's HTML `<script>` tag, since it may have changed). The correct source tree is the one whose build actually reproduces (or is a clear ancestor of) what's live.

### 4. Wire Supabase into the frontend, table by table, only for what's populated
`supabaseClient.js` already exists in the Drive folder with an API wrapper pattern (`RoadsAPI.getStations()` etc.) — follow that pattern rather than inventing a new one. For each of the 21 tables now populated (5 from the original script + 16 from the extended one), find the component(s) currently reading the equivalent static JSON/GeoJSON and replace that fetch with a live Supabase query. Leave every other component on static JSON — don't break sections whose backing table isn't populated yet.

Install `@supabase/supabase-js`, and put the project URL + anon key in a `.env` file that's git-ignored, read via `import.meta.env` (Vite) — never commit them into a source file. The anon key ending up in the built JS bundle is expected and fine (that's how Supabase's public/anon key model works — security comes from RLS, not key secrecy), but the `.env` file itself should not be committed.

### 5. Preserve the app's existing standing constraints
Whoever touches this app's UI needs to keep following rules that have applied all along, so don't reintroduce violations while wiring the data layer:
- Sidebar navigation stays at exactly 10 top-level tabs — never add a new one; new content goes into existing tabs via sub-view button groups.
- Never display exact source file names, individual people's names, or other confidential information anywhere in the UI or data payloads. Company/funder names are fine.
- Coordinates (lat/lon) never appear in charts or tables — only on the National GIS Map tab.
- High-cardinality data (many districts/categories) gets a full table, not a bar-per-category chart.
- Use human-readable labels for everything; if a coded field has no available decoding manual, omit it rather than guess.

### 6. Build and deploy
Run the production build, verify it locally, then commit and push to the branch GitHub Pages actually serves from (check the repo's Pages settings — could be `gh-pages`, or `main` with a `/docs` folder, or a GitHub Actions workflow that builds on push to `main`). Use your own git credentials for this — a real `git push`, not a manual browser upload. After deploy, hard-reload the live URL and confirm the newly-wired sections actually show Supabase-sourced data (check the Network tab for real REST calls to the Supabase project, not just that the page renders).

### 7. Report back
When done, summarize: which of the 21 tables ended up wired into which UI sections, which are still on static JSON and why, current row counts per table, and anything in `NOT_YET_MAPPED.md` you were able to resolve (e.g. if you found and exported one of the `.tsx` component constants to a real data source).

## Hard constraints — do not violate these

- Never commit `.env`, the Supabase key, or any credential to the git repo, in any commit, ever — including in commit history that gets squashed later. Use `.gitignore`.
- Never touch `road_reserve_applicants` or `road_reserve_applications` in the frontend wiring — those stay backend-only regardless of what the RLS grants technically allow.
- Don't delete or overwrite anything in the Drive `app_data/` source files — they're the source of truth for the ETL.
- **Do not run `unified_enterprise_schema.sql` against Supabase, and do not use it as a source for anything.** It's a 35MB/21,300-line file sitting in the repository folder that looks like a real consolidated 73-table dataset (~19,769 rows) but is synthetic filler — its own header says "Automatically generated ... for exhaustive modeling," and the row contents confirm it (`admin_districts` = `District_Central_1`, `District_Central_2`, …; `core_road_links` = `Auto Link 1`, `Auto Link 2`, … at round 1.5/3.0/4.5 km increments). Running it would load fabricated placeholder rows into the same tables the real ETL populates. Flag it to the user and ask before deleting it from Drive — don't delete it yourself without asking, since its origin isn't confirmed.
