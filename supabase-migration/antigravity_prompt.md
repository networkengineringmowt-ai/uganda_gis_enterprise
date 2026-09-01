# Prompt for Antigravity — wire the Uganda Roads GIS sites to ONE shared live Supabase database

Paste everything below this line into Antigravity. It's written to be self-contained — you're starting with no memory of a prior conversation, so it includes all the context you need.

---

## Platform-wide decision (2026-09-01) — read this before starting

The user's standing requirement, confirmed explicitly: **"all my sites should have an active sql database and server connection."** She has multiple GIS sites today (`uganda_gis_enterprise`, `uganda_npms`, `uganda_nrms`, `uganda_ntis`, `uganda_ducar`, `uganda_nbms` under the `networkengineeringmowt-ai` org, plus a separate, more mature site `uganda-roads` / NRMS v4.0 under her `priscananjehe1996` account) and, when asked, chose **one shared Supabase project across all of them** over a separate database per site — simpler to secure, back up, and keep consistent. She picked the `uganda_gis_enterprise` 41-table schema (`supabase_schema.sql`, described below) as the base to build out from, since it's the most complete schema and already has verified ETL scripts written against real source data — not the `uganda-roads` schema, even though that project is the one that's actually provisioned today.

That means your job is bigger than the original single-site scope this prompt was first written for. Two things need real on-the-ground judgment with actual credentials, which is exactly why this is going to Antigravity and not staying in a credential-free cloud session:

1. **Which physical Supabase project instance becomes "the one."** `uganda-roads` already has a live, provisioned Supabase Postgres project (42 tables, real Express server built around it, Docker/K8s manifests). `uganda_gis_enterprise` only has a *target* schema file, never applied anywhere. Check both: does the `uganda-roads` project's `information_schema.tables` already have real data worth preserving? If so, the pragmatic path is probably to extend *that* project with the `uganda_gis_enterprise` schema (add its 41 tables, reconciling any name/column overlaps) rather than standing up a third empty project and migrating data into it. If `uganda-roads`'s tables turn out to be empty or stale, provisioning fresh against the `uganda_gis_enterprise` schema and treating that as canonical is simpler. Use your judgment once you can actually see both databases — this prompt can't decide it for you sight-unseen.
2. **Reconciling the two schemas.** `uganda-roads`'s schema (pull it live from that project via `information_schema`, don't trust a summary) and `uganda_gis_enterprise`'s `supabase_schema.sql` were designed independently and will have overlapping concepts (both cover road links, bridges/structures, pavement condition, traffic) under possibly different table/column names. Don't just concatenate them — map overlapping concepts to one table each, keep whichever version has richer/more real columns, and document the mapping so nothing silently duplicates.

Once the single backend is settled, the remaining sites (`uganda_npms`, `uganda_nrms`, `uganda_ntis`, `uganda_ducar`, `uganda_nbms`) each need their own wiring pass — same pattern as the `uganda_gis_enterprise` work below (find their real source JSON, map it to the shared schema, write an ETL script, wire the frontend query-by-query) but that mapping work hasn't been done yet for any of them. Do `uganda_gis_enterprise` first (fully scoped below, ready to execute) as the proof of pattern, then repeat for the others. Two of them have existing state worth knowing about first: `uganda_npms`'s live site currently reads a local `pms_backend.sqlite` produced by an earlier Antigravity run (3 tables confirmed real: `pavement_fwd_deflections`, `pavement_dcp_tests`, `traffic_axle_loads` — see the platform's `/areas/uganda-gis-enterprise-platform.md`-equivalent notes on which columns in those were found to be synthetic/constant and excluded from display) — migrate that real data into the shared Postgres backend rather than re-deriving it. `uganda_nrms` is an empty unbuilt scaffold — the user said she'll scope what belongs on it herself later, so don't start building its UI, but it can still be added to the shared backend's access list once she does.

## Background — the uganda_gis_enterprise piece (fully scoped, do this part first)

This is the Uganda National Roads Asset Management GIS platform — a React/Vite single-page app deployed as a static site on GitHub Pages at `https://networkengineringmowt-ai.github.io/uganda_gis_enterprise/`, repo `networkengineringmowt-ai/uganda_gis_enterprise`. Today it runs entirely on static JSON bundled into the build; the goal of this part of the task is to move it to live queries against the shared Supabase Postgres database (see decision above) for the tables that are ready, while leaving everything else untouched.

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

### 1. Confirm current state — including the platform-wide project decision
First, resolve the "which physical Supabase project" question from the section above: connect to both the `uganda-roads` project (ask the user for its ref/URL) and check whether `uganda_gis_enterprise` has ever had a project provisioned for it (ask the user; if none exists yet, you're provisioning fresh). Look at `information_schema.tables` and real row counts on `uganda-roads` — if it has genuine live data, that's your target project going forward for ALL sites, and you'll be adding `supabase_schema.sql`'s 41 tables into it (reconciling overlaps per the guidance above, not just appending). If it turns out empty/stale, provisioning against `supabase_schema.sql` fresh and treating that as canonical is simpler — your call once you can see both. Whichever you choose, do the rest of this task against that one project (never anything from a prior chat log for credentials).

Then, on the chosen project:
- Does `information_schema.tables` show all 41 tables from `supabase_schema.sql` (accounting for any you merged into existing `uganda-roads` tables during reconciliation)? If not, run `supabase_schema.sql` in full first (or the reconciled subset). **`supabase_schema.sql` is the authoritative target schema for this task — not `unified_enterprise_schema.sql`, a different 73-table file also sitting in the repository folder. That file is synthetic placeholder data (see Hard Constraints below) — do not run it, do not treat it as a schema option to choose between.**
- Is RLS enabled and is `anon` read-only? Run `supabase_secure_grants.sql` then `supabase_enable_rls.sql` if not (safe to re-run either way — both are idempotent). Note: `uganda-roads`'s own BUGS.md (2026-06-10) flagged the anon key previously had unrestricted INSERT/UPDATE on ~40 tables with RLS disabled, and flagged the service_role key as exposed in plaintext chat and needing rotation — if you're extending that project, confirm both were actually fixed/rotated, don't assume from the BUGS.md note alone.
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
Run the production build, verify it locally, then commit and push straight to `main` — confirmed (2026-08-31) that this repo serves GitHub Pages directly off `main`'s root: the built output (`index.html` + `assets/index-<hash>.js`/`.css`) is committed as static files, no `/docs` folder, no `package.json` at the repo root (the source project genuinely lives elsewhere — see Task 3). A push to `main` auto-triggers GitHub's own `pages-build-deployment` workflow, which publishes the live site within about a minute — no separate manual deploy step needed.

**Three other workflows already run on this repo — know about them, don't break them:** `.github/workflows/backup.yml` ("Backup on Deploy") snapshots every push to `main` onto a timestamped `backup/YYYY-MM-DD-HHMM` branch — harmless, no action needed. `.github/workflows/daily-audit.yml` ("Daily Site Audit") runs a Playwright-based QA script (`scripts/daily-audit/audit.mjs`) against the live site every day at 06:00 UTC and opens GitHub issues for anything it finds — don't duplicate this work, and check open issues it's already filed before starting. `.github/workflows/uptime.yml` ("Uptime Monitor") runs every few hours. All three were green on the last run checked.

Use your own git credentials for the push — a real `git push`, not a manual browser upload. After deploy, hard-reload the live URL and confirm the newly-wired sections actually show Supabase-sourced data (check the Network tab for real REST calls to the Supabase project, not just that the page renders).

### 7. Report back on uganda_gis_enterprise
When done, summarize: which physical Supabase project you standardized on and why, how the two schemas were reconciled (what got merged vs. added net-new), which of the 21 tables ended up wired into which UI sections, which are still on static JSON and why, current row counts per table, and anything in `NOT_YET_MAPPED.md` you were able to resolve (e.g. if you found and exported one of the `.tsx` component constants to a real data source).

### 8. Repeat the pattern for the other sites
Once `uganda_gis_enterprise` is live on the shared backend, work through the remaining sites the same way — find real source data, map it to the shared schema (extending it with new tables where a site's data genuinely doesn't fit anything that exists), write/extend an ETL script, wire the frontend, deploy, verify:
- **`uganda_npms`** — migrate the 3 confirmed-real tables out of its local `pms_backend.sqlite` (`pavement_fwd_deflections`, `pavement_dcp_tests` — note `cbr_subgrade`/`subbase`/`base` columns are constant/non-real and were excluded from the UI, keep them excluded — and `traffic_axle_loads` — note `avg_gvw_tonnes` is a single fixed value across all rows, not a real per-station measurement, keep it excluded from stats) into the shared Postgres backend instead of re-deriving them, then wire the frontend to query live instead of reading the sqlite file. `pavement_visual_condition` (10,558 rows) in that same sqlite is confirmed synthetic (templated names) — do not migrate it. `manual_policy_formulas` (5 rows) is unverified — ask the user before migrating.
- **`uganda_ntis`, `uganda_ducar`, `uganda_nbms`** — not yet audited for what real source data exists; start with the same kind of source inventory this prompt's author did for `uganda_gis_enterprise` (check `app_data/`-equivalent folders, verify against the platform's standing "never fabricate" rule) before writing any ETL.
- **`uganda_nrms`** — still an empty unbuilt scaffold; the user said she'll scope what it should contain herself before any UI work starts there. Don't build it out. It's fine to make sure it *can* reach the shared backend (env vars, client wrapper) once she gives the go-ahead, but no features yet.

Apply the same standing platform-wide rules to every site as you wire it (see Task 5 for the `uganda_gis_enterprise`-specific list, and the full standing-rules set in the user's own notes: always report km affected + surface-type breakdown for pavement data, all 6 regions/11+ vehicle classes for traffic data, bridges/culverts always reported separately, decoded labels never raw codes, no selective reporting anywhere).

## Hard constraints — do not violate these

- Never commit `.env`, the Supabase key, or any credential to the git repo, in any commit, ever — including in commit history that gets squashed later. Use `.gitignore`.
- Never touch `road_reserve_applicants` or `road_reserve_applications` in the frontend wiring — those stay backend-only regardless of what the RLS grants technically allow.
- Don't delete or overwrite anything in the Drive `app_data/` source files — they're the source of truth for the ETL.
- **Do not run `unified_enterprise_schema.sql` against Supabase, and do not use it as a source for anything.** It's a 35MB/21,300-line file sitting in the repository folder that looks like a real consolidated 73-table dataset (~19,769 rows) but is synthetic filler — its own header says "Automatically generated ... for exhaustive modeling," and the row contents confirm it (`admin_districts` = `District_Central_1`, `District_Central_2`, …; `core_road_links` = `Auto Link 1`, `Auto Link 2`, … at round 1.5/3.0/4.5 km increments). Running it would load fabricated placeholder rows into the same tables the real ETL populates. Flag it to the user and ask before deleting it from Drive — don't delete it yourself without asking, since its origin isn't confirmed.
