# clockj

A 24/7 kiosk display for the **Hewes St (J/M) + Broadway (G)** corner in Williamsburg,
Brooklyn — live NYC subway arrivals as an animated neighborhood map on the left and
NYC-style countdown clocks on the right.

**Live:** [clockj.vercel.app](https://clockj.vercel.app)

One corner, two stations, three lines:

| Station | Platforms | Lines | Feed(s) |
|---|---|---|---|
| **Hewes St** | Manhattan-bound, Outbound | J, M | JZ (J) + BDFM (M) |
| **Broadway** | Court Sq, Church Av | G | G |

> The M rides with B/D/F in the GTFS feeds, not with J/Z — so even though J and M share
> the Hewes St platform, they arrive from different feeds. The proxy polls all three.

## How it works

```
[MTA: 3 GTFS-RT feeds] --(server fetch + protobuf decode + filter)--> /api/trains (JSON)
        ^ s-maxage=15, stale-while-revalidate=30 (Vercel edge cache)
                                   |
                          client polls every 30s --> Map + Clocks UI
                                                     (local 1s tick decrements countdowns)
```

- **`/api/trains`** ([src/routes/api/trains/+server.js](src/routes/api/trains/+server.js)) fetches the
  three [MTA GTFS-Realtime](https://api.mta.info/) feeds (no API key required), decodes the
  protobuf with `gtfs-realtime-bindings`, filters to the four target platforms, and edge-caches
  the result. The browser can't fetch the feeds directly (no CORS + binary protobuf), so the
  server route is required.
- **[Clocks.svelte](src/lib/Clocks.svelte)** renders per-platform countdowns; **[StationMap.svelte](src/lib/StationMap.svelte)**
  draws the Mini-Motorways-style schematic with live train cars that glide along the ribbons,
  ride their correct lane, and depart past the station. Hovering a car highlights its clock row
  and vice-versa, via a shared train identity ([train-key.js](src/lib/train-key.js)).
- **Kiosk hardening:** Screen Wake Lock, slow anti-burn-in pixel-shift, and a freshness indicator
  that turns amber when data is stale.

## Stack

SvelteKit (Svelte 5 runes) · `@sveltejs/adapter-auto` · `gtfs-realtime-bindings` · deployed on Vercel.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run check    # svelte-check (type/lint health)
npm run build    # production build
```

## Data & attribution

Real-time data from the [MTA GTFS-Realtime feeds](https://api.mta.info/). This is an
unofficial display and is not affiliated with or endorsed by the MTA.

## Project docs

Build plan and design history live in [`docs/`](docs/).
