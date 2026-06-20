# clockj Map Visual Fixes — Continue Plan

**Date:** 2026-06-15  
**Status:** Map redesign complete. 4 visual bugs remain from user screenshot review.

---

## Current State

Mini Motorways-style SVG map is live in `src/lib/StationMap.svelte`:
- J (brown `#996633`) and M (orange `#FF6319`) as parallel diagonal ribbons, NE↗ corridor
- G (green `#6CBE45`) as vertical ribbon crossing at Broadway
- Station pills at Hewes St and Broadway with line bullets
- Live train dots interpolated along ribbons from trains API
- Terminus labels at ribbon ends (currently broken — see Bug 3)

Relevant files:
- `src/lib/StationMap.svelte` — SVG map, all geometry + live dots
- `src/app.css` — `--bg` token (currently `#0a0a0a`)
- `src/routes/+page.svelte` — passes `trains`, `fetchedAt`, `tick` props to StationMap

---

## Bug 1: Background Is Dark Gray, Not True Black

**Symptom:** Site looks flat dark gray.

**Root cause:** `--bg: #0a0a0a` and block fills `#181818` are too similar. Dense block coverage makes both look flat gray.

**Fix:**

`src/app.css`:
```
--bg: #000000;
```

`src/lib/StationMap.svelte` — find the SVG background `<rect>` and update:
- If `fill="#0a0a0a"` → change to `fill="#000000"`
- If `fill="var(--bg)"` → CSS change above propagates automatically

Optional: bump block fills from `#181818` → `#1c1c1c` for more contrast against true black.

---

## Bug 2: Ribbon Lines Should Extend Off-Screen

**Symptom:** J/M/G ribbons terminate visibly inside the canvas. Mini Motorways aesthetic requires roads to bleed off the edge.

**Root cause:** Corridor anchor points sit within the SVG viewBox (0–500 × 0–600). SVG clips to viewBox automatically, so pushing anchors past those bounds makes them disappear at the edge.

**Fix in `src/lib/StationMap.svelte` (JS constants near top of script):**

```js
// Change these four values:
const JM_SW = { x: -60, y: 660 };   // was { x: 45, y: 530 }
const JM_NE = { x: 560, y: -55 };   // was { x: 460, y: 65 }
const G_N   = { x: 290, y: -25 };   // was { x: 290, y: 15 }
const G_S   = { x: 290, y: 640 };   // was { x: 290, y: 585 }
```

`HEWES_C` and `BWAY` stay unchanged — only the far ends move.

---

## Bug 3: Terminus Labels Unreadable

**Symptom:** BROAD ST, FOREST HILLS (top-right), JAMAICA, MET AVE (bottom-left) are 8px, 35% opacity, clipped at canvas edge — effectively invisible.

**Fix:** Remove all 6 terminus label groups from the SVG markup. With lines going off-screen (Bug 2), the labels have no visible anchor point anyway. Mini Motorways uses no terminus text.

Remove these elements from `src/lib/StationMap.svelte`:
- JAMAICA — circle at `(14, 510)` + text at `(24, 514)`
- MET AVE — circle at `(14, 550)` + text at `(24, 554)`
- BROAD ST — circle at `(486, 56)` + text at `(476, 51)`
- FOREST HILLS — circle at `(486, 70)` + text at `(476, 65)`
- COURT SQ — circle at `(290, 26)` + text at `(300, 30)`
- CHURCH AV — circle at `(290, 574)` + text at `(300, 578)`

Also remove the `.terminus-label` CSS class if nothing else uses it.

---

## Bug 4: Train Dots Not Centered / Not Visually Prominent

**Two sub-issues:**

### 4a: Hewes pill M bullet is off-center

The Hewes St pill is 132px wide centered at `HEWES_MID.x`. J bullet is at `-46` (20px from left edge). M bullet is at `+58` (only 8px from right edge) — visually lopsided.

**Fix:** Move M bullet from `HEWES_MID.x + 58` → `HEWES_MID.x + 46` (symmetric with J):

```svelte
<!-- Find this line: -->
<circle r="8" fill="#FF6319" cx={HEWES_MID.x + 58} cy={HEWES_MID.y - 29}/>

<!-- Change to: -->
<circle r="8" fill="#FF6319" cx={HEWES_MID.x + 46} cy={HEWES_MID.y - 29}/>
```

### 4b: Live train dots not prominent enough

Dots are `r="7"` with a `stroke="white" stroke-width="2"` ring. They can look hollow or small at map scale.

**Fix:** Increase radius to `r="8"` and add a drop-shadow filter.

Add inside `<svg>` near the top:
```svelte
<defs>
  <filter id="dot-glow">
    <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="rgba(255,255,255,0.5)"/>
  </filter>
</defs>
```

Add `filter="url(#dot-glow)"` to live dot circles and bump radius:
```svelte
{#each liveDots as dot}
  <circle cx={dot.x.toFixed(1)} cy={dot.y.toFixed(1)} r="8"
          fill={dot.color} stroke="white" stroke-width="2"
          filter="url(#dot-glow)"/>
{/each}
```

---

## Execution Order

1. `src/app.css` — `--bg: #000000`
2. `src/lib/StationMap.svelte` — extend anchor coords off-canvas
3. `src/lib/StationMap.svelte` — remove all 6 terminus label elements
4. `src/lib/StationMap.svelte` — fix M bullet x-offset (`+58` → `+46`)
5. `src/lib/StationMap.svelte` — add `<defs>` filter, bump dot `r` to 8, add filter attr
6. Verify with `npm run dev`, then `vercel --prod`

---

## Quick Reference: Key Geometry

```
ViewBox: 500 × 600

JM corridor (diagonal NE↗):
  HEWES_C = { x: 210, y: 290 }   ← station anchor (unchanged)
  PX = -JM_UY, PY = JM_UX        ← perp unit vector
  OFF = 9                          ← ribbon separation
  J ribbon: HEWES_C offset by -perp (NW side)
  M ribbon: HEWES_C offset by +perp (SE side)

G corridor (vertical):
  BWAY = { x: 290, y: 390 }      ← station anchor (unchanged)
```
