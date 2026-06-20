# clockj — Hewes St + Broadway live subway display

## Context

Alex wants a web app that runs **24/7 on a static screen** (iPad or a monitor) showing live
NYC subway departures for the corner of **Hewes St & Broadway** in Williamsburg, Brooklyn.
The screen is split: a **live neighborhood map on the left**, **NYC-subway-style countdown
clocks on the right**. The build reuses what worked in the existing `bart-tracker` project and
fixes its one relevant gap (no always-on/burn-in handling).

This corner is actually **two stations / three lines**:

| Station | Stop ID | Platforms | Lines | Feed(s) |
|---|---|---|---|---|
| **Hewes St** | `M14` | `M14N` (Manhattan-bound), `M14S` (outbound) | J, M | JZ feed (J) **+** BDFM feed (M) |
| **Broadway** | `G30` | `G30N` (Court Sq), `G30S` (Church Av) | G | G feed |

Key nuance: **the M rides with B/D/F in the feeds, not with J/Z** — so even though J and M
share the Hewes St platform, they arrive from different feeds. The proxy polls **3 feeds**.

## Decisions (locked with user)

- **Name:** `clockj` (folder / GitHub repo / Vercel project).
- **Layout:** Map (left) + countdown clocks (right).
- **Hosting:** Deploy to Vercel (free Hobby tier; edge cache keeps function invocations tiny).
- **Stack:** SvelteKit + `@sveltejs/adapter-auto` — mirrors `bart-tracker`, zero-config Vercel deploy.

## Data source — MTA GTFS-Realtime (no API key)

Protocol-Buffers feeds, **no key/registration required** (MTA retired the keyed `datamine`
feeds). Decoded server-side with `gtfs-realtime-bindings`, exactly like `bart-tracker`.

```
JZ   https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz
BDFM https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm
G    https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g
```

**MTA line colors:** J → brown `#996633` · M → orange `#FF6319` · G → light green `#6CBE45`.

**Destination labels** (static per line+direction; reliable for a fixed 2-station display —
prefer the RT trip headsign when present, fall back to these):

- Hewes `M14N`: J → "Manhattan · Broad St" · M → "Manhattan · Forest Hills"
- Hewes `M14S`: J → "Jamaica Center" · M → "Metropolitan Av"
- Broadway `G30N`: G → "Court Sq" · Broadway `G30S`: G → "Church Av"

## Architecture (proxy pattern, carried from bart-tracker)

```
[MTA: 3 GTFS-RT feeds] --(server fetch + protobuf decode + filter)--> /api/trains (JSON)
        ^ s-maxage=15, stale-while-revalidate=30 (Vercel edge cache)
                                   |
                          client polls every 30s  --> Map + Clocks UI
                                                       (local 1s tick decrements countdowns)
```

- Browser **cannot** fetch the feeds directly (no CORS headers + binary protobuf) → server route is required.
- **Edge cache via HTTP headers** instead of bart-tracker's in-memory cache — this fixes the
  documented bart-tracker limitation ("in-memory cache doesn't work across serverless instances")
  and keeps Vercel invocations near-constant regardless of poll rate.
- **int64 guard:** GTFS-RT timestamps can decode as `Long` objects (`.low`) — port bart-tracker's guard.

## Lessons reused from bart-tracker

- Server `/api/trains` proxy route (decode off the client). — `bart-tracker/src/routes/api/trains/+server.js`
- Two-tier refresh: server cache + 30s client poll + 1s local countdown tick. — `bart-tracker/src/lib/BartMap.svelte`
- Static constants module for stations/lines/colors. — `bart-tracker/src/lib/bart-routes.js`
- Freshness indicator (pulse dot → amber when data >60s stale). — `bart-tracker/src/routes/+page.svelte`
- **Gap we add (bart-tracker has none):** always-on / burn-in handling — the whole point of this screen.

## Phased build (step → verify)

**Phase 0 — Scaffold & deploy skeleton**
Init SvelteKit (`adapter-auto`), git, create GitHub repo, link Vercel, deploy a placeholder page.
→ *Verify:* live Vercel URL loads on the target device.

**Phase 1 — Constants + feed proxy**
`src/lib/stations.js` (stations, stop IDs, platforms, lines, colors, destinations, feed map).
`src/routes/api/trains/+server.js`: fetch 3 feeds, decode, filter `stop_time_update` to
`{M14N,M14S,G30N,G30S}`, compute minutes-away, drop past/negatives, set cache headers, int64 guard.
→ *Verify:* `curl /api/trains` returns sane JSON; times match realtimerail.nyc / MyMTA for M14 & G30 within ~1 min.

**Phase 2 — Countdown clocks (right panel)** — `src/lib/Clocks.svelte`
Per station → per line+direction rows → next 2–3 times. Poll every 30s; 1s local tick decrements.
MTA aesthetic: dark background, official-color line bullets, large tabular numerals, Helvetica.
→ *Verify:* real times render, tick down smoothly, refresh without flicker; cross-check live data.

**Phase 3 — Neighborhood map (left panel)** — `src/lib/StationMap.svelte`
Curated **SVG schematic** (hand-placed geometry — per bart-tracker's "schematic needs manual
curation" lesson): J/M corridor + G corridor, both station markers, line colors, labels. No map
tiles/keys. (Live moving train dots = optional later, see Out of scope.)
→ *Verify:* map reads clearly at target screen size; lines/stations correctly colored + labeled.

**Phase 4 — Always-on / kiosk hardening**
Screen Wake Lock API; subtle slow pixel-shift of the whole layout; freshness pulse (amber >60s);
optional overnight dim; graceful states (feed down → show last-good + stale flag; no trains → "—").
→ *Verify:* run 30+ min — screen stays awake, stale handling works when feeds blocked, no static bright regions.

**Phase 5 — Polish & responsive sizing**
Tune type scale/spacing for the real device (iPad landscape / monitor res), fullscreen, title, favicon.
→ *Verify:* looks intentional and is legible across a room on the actual display.

**Phase 6 — Deploy & display setup**
Final Vercel production deploy; document kiosk setup (iPad Guided Access / fullscreen browser on a mini-PC).
→ *Verify:* production URL on the real device, running 24/7, times accurate.

## Critical files (project: `~/Desktop/claude/clockj`)

- `src/lib/stations.js` — stations/lines/colors/destinations/feed map (the single source of truth)
- `src/routes/api/trains/+server.js` — 3-feed proxy, decode, filter, cache headers, int64 guard
- `src/lib/Clocks.svelte` — countdown board (poll + local tick)
- `src/lib/StationMap.svelte` — curated SVG schematic
- `src/routes/+page.svelte` — split layout (map | clocks), freshness state
- `src/routes/+layout.svelte` / `src/app.css` — theme, fonts, pixel-shift
- `svelte.config.js` — `adapter-auto`; `package.json` — add `gtfs-realtime-bindings`

## End-to-end verification

1. `npm run dev`; `curl localhost:5173/api/trains` → JSON with J/M @ M14 and G @ G30, both directions.
2. Compare 4–5 arrivals against **realtimerail.nyc** / **MyMTA** for the same stations (±1 min).
3. Leave the page running ~30 min → countdowns advance, screen stays awake (wake lock), freshness stays green.
4. Block network / point proxy at a bad URL → UI shows last-good data + amber stale indicator (no crash).
5. `vercel --prod`, open the URL on the iPad/monitor → accurate, fullscreen, stable.

## Assumptions / Out of scope (v1)

- **Map = static SVG schematic** (no live train dots, no map tiles). Live dots can be added later.
- Show **both directions** for all lines, **next 2–3** trains each.
- Destination labels: static per line+direction, overridden by RT headsign when available.
- **Out of scope:** service-alert banners, walk-time "leave now," multiple neighborhoods, settings UI, live train animation.
- Vercel **free Hobby** tier is sufficient; GitHub Student benefits not needed for v1 (revisit only for a custom domain).
