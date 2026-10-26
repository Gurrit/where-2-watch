# where-2-watch — Spec (draft v0.1)

## 1. Purpose
Upload a Letterboxd watchlist export and see, for a chosen country, which streaming services (and rent/buy options) offer each film.

## 2. Decisions so far
| Area | Decision |
|---|---|
| Form factor | Public, server-hosted website |
| Stack | TypeScript end to end. React (Vite SPA) frontend, Node API (serves built static assets) |
| Input (v1) | Letterboxd `watchlist.csv` export upload |
| Input (later) | IMDb CSV export. Not in v1, but the input layer must be pluggable (see §5) |
| Scope | Movies only |
| Availability data | TMDB watch providers (JustWatch data), per country |
| Region | Single country per run, user-selectable |
| State | Stateless server. No accounts, no stored user data. Prefs (country, owned services) live in browser `localStorage` |
| Monetization | Free, no ads. Complies with TMDB non-commercial terms |
| Progress | Server streams results as they resolve (SSE or NDJSON) |
| Cache | Server-side cache of TMDB lookups only (no user data): in-memory + SQLite/file, ~24h TTL for providers |
| Hosting | Self-managed VPS (Node process behind a reverse proxy). SQLite file cache is fine; rate limiting can be in-process per IP |
| Default country | Chosen explicitly by the user, persisted in localStorage. No IP/language detection |
| Default view | Dense table (no poster grid in v1) |
| Free/ad-supported | `ads`/`free` tiers are ignored. Only `flatrate`, `rent`, `buy` are captured |
| Language | English only |
| Fuzzy matching | Year tolerance ±1; no further fuzzy title matching in v1 |
| Testing | Unit tests for parser and matcher using recorded TMDB responses as fixtures; CI runs them |
| Deployment | Docker image(s) on the VPS. Reverse proxy and process manager deferred (container restart policy only) |
| Bad matches | Shown in an "unmatched / ambiguous" section with best guess; user can pick the right candidate (session only) |

## 3. Functional requirements
### 3.1 Upload & parse
- Accept a Letterboxd `watchlist.csv` (columns: `Date, Name, Year, Letterboxd URI`).
- Validate file type/size, reject malformed CSV with a clear error.
- Parsed rows are held only for the duration of the request/session.

### 3.2 Matching
- For each row, search TMDB movies by title + year (year ±1 tolerance as fallback).
- Classify each result: `matched` (single confident hit), `ambiguous` (multiple plausible candidates), `unmatched` (none).
- Ambiguous/unmatched surface in the UI with candidates for manual selection. Choosing a candidate triggers a provider lookup for that film.

### 3.3 Availability
- For each matched film, fetch TMDB `/movie/{id}/watch/providers` and take the selected country's entry.
- Capture three categories: `flatrate` (streaming), `rent`, `buy`. Ignore `ads`/`free` tiers.
- Show TMDB/JustWatch attribution wherever availability is displayed.

### 3.4 Results view
- Live-filling table/grid with a progress bar as results stream in.
- Country selector (persisted in localStorage). Changing country re-queries availability for already-matched films without re-uploading, as long as the session still holds the matched IDs in the client.
- "My services" selector: pick subscriptions; filter to films streamable on them (flatrate by default).
- Toggle to include rent/buy.
- Group-by-service view with per-service film counts (which service covers most of the list).
- Sort/filter by year, runtime, rating (TMDB metadata: year, runtime, vote average).

## 4. Non-functional requirements
- **Privacy:** uploaded data is not persisted or logged. Server logs must not contain film titles from uploads. Short privacy note in the UI.
- **Public hosting:** per-IP rate limiting, upload size cap (e.g. 1 MB / ~5k rows), cap on concurrent jobs, global TMDB request throttle with backoff.
- **Scale:** a 2000-film list must complete in a reasonable time via bounded concurrency; cache hits make repeat runs fast.
- **Resilience:** TMDB errors are retried with backoff. Per-film failures are reported without failing the whole run.
- **Attribution/legal:** TMDB logo + notice ("This product uses the TMDB API but is not endorsed or certified by TMDB") and JustWatch credit for watch-provider data.

## 5. Architecture sketch
```
Browser (React SPA)
  ├─ upload CSV  ───────────►  POST /api/watchlist   (CSV as a `text/csv` body)
  │                              ├─ parser (pluggable: letterboxd | imdb*)
  │                              ├─ matcher  ── TMDB search
  │                              ├─ availability ── TMDB watch/providers
  │                              └─ cache (memory + SQLite)
  ◄── streamed events (SSE/NDJSON): progress, film result, done
  └─ localStorage: country, owned services
```
- **Parser interface:** `parse(file) → { title, year?, externalIds? }[]`, so an IMDb parser (using tconst → TMDB `/find`) can be added without touching matcher or availability.
- **Secrets:** TMDB API key server-side only (env var).
- Providers list per country (`/watch/providers/movie`) is fetched and cached to populate the "my services" picker.

## 6. API (initial)
- `POST /api/watchlist?country=SE[&source=letterboxd]` — body: CSV (`text/csv`, read client-side from the chosen file; no multipart). Response: NDJSON stream of `{type: "start", total}`, `{type: "film", ...}` per film as it resolves (completion order; `index` correlates), then `{type: "done"}`.
- `GET /api/providers?country=SE` — services available in a country.
- `GET /api/availability?ids=1,2,3&country=SE` — re-query availability for known TMDB IDs (country switch, manual picks).
- `GET /api/search?q=...&year=...` — candidates for manual correction.

## 7. Out of scope (v1)
IMDb input, TV series, accounts, shareable result links, notifications when availability changes, ads/monetization, Letterboxd/IMDb scraping by username.

## 8. Open questions
None at the moment.
