# clockj — Map Redesign & AM/PM Time

**Date:** 2026-06-15  
**Scope:** Redesign `StationMap.svelte` with Mini Motorways aesthetic + fix AM/PM time + add live train dots as final phase.

---

## Decisions

- J (brown) and M (orange) shown as **separate parallel ribbons** along the shared elevated corridor
- Background: **faint city block grid** (dark rectangles on near-black)
- **Diagonal geometry preserved** (geographically honest ~43° NE↗ corridor)
- Live train dots: **included as final phase** (Phase D)
- Layout approach: **tight motorway zoom** — cropped to the intersection zone, ribbons dominate the canvas

---

## Section 1: Canvas & Background

- SVG viewBox: `500 × 600`, background `#0a0a0a`
- **City blocks:** 8–12 hand-placed dark rounded rectangles (`fill: #181818`, `rx: 4`) scattered around the two corridors to suggest Williamsburg block density
- Gaps between blocks imply streets — no explicit street labels
- No decorative street lines; blocks do the contextual work

---

## Section 2: Line Ribbons

| Property | Value |
|---|---|
| `stroke-width` | `14` SVG units |
| `stroke-linecap` | `round` |
| `stroke-linejoin` | `round` |

**J/M corridor (diagonal, NE↗):**
- Two parallel ribbons offset ~10 SVG units perpendicular to the corridor direction
- J ribbon: `#996633` (brown), offset to one side
- M ribbon: `#FF6319` (orange), offset to the other side
- Visual gap between them: ~4px

**G corridor (vertical):**
- Single ribbon: `#6CBE45` (green)
- Crosses the J/M corridor

---

## Section 3: Station Markers

Mini Motorways-style rounded rect pills (`rx: 8`, ~80 × 32 SVG units):

| Station | Style | Label |
|---|---|---|
| Hewes St | Pill split half brown / half orange | `HEWES ST` with J · M circle bullets |
| Broadway | Solid green pill | `BROADWAY` with G circle bullet |

Pills float above the ribbon at the station anchor point, white text.

---

## Section 4: Endpoint Labels

Tiny all-caps text at each ribbon terminus, no border:

| Ribbon | NE / N end | SW / S end |
|---|---|---|
| J | `BROAD ST` | `JAMAICA` |
| M | `FOREST HILLS` | `METROPOLITAN AV` |
| G | `COURT SQ` | `CHURCH AV` |

---

## Section 5: AM/PM Time Fix

One-line change in `+page.svelte` `clockStr` formatter:
- Remove `hour12: false`
- Add `hour12: true`
- Result: `9:42 AM` format (no leading zero, space before AM/PM)

---

## Section 6: Live Train Dots

Each incoming train rendered as a filled circle on its ribbon, positioned between terminus and station marker proportional to minutes away.

**Data source:** same `/api/trains` JSON already fetched by `Clocks.svelte`. `StationMap.svelte` will accept a `trains` prop (the raw API result) passed down from `+page.svelte`.

**Position mapping:**
- `0 min` = at the station marker
- `25 min` = at the terminus end of the ribbon
- Trains beyond 25 min: not rendered
- Both directions render simultaneously on their respective ribbon half

**Dot style:**

| Property | Value |
|---|---|
| Radius | `7` SVG units |
| Fill | Line color (brown / orange / green) |
| Stroke | `white`, width `2` |

**Animation:** positions computed from `minutes - elapsedMin` using the same `tick` state already in the app — dots glide smoothly between 30s server polls with no extra fetch.

---

## Implementation Phases

| Phase | Work |
|---|---|
| A | AM/PM time fix (1-line change) |
| B | SVG canvas + block grid + ribbon geometry (J, M offset parallel + G) |
| C | Station marker pills + endpoint labels |
| D | Live train dots (prop wiring + position math + animated circles) |

---

## Out of Scope

- Service alert banners
- Train route history / dwell time
- Map tiles or satellite imagery
- Anything beyond the two target stations
