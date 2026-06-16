# Map Redesign — Mini Motorways Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the left map panel with a Mini Motorways aesthetic (thick parallel J/M ribbons, G ribbon, dark block grid), fix AM/PM time, and add live train dot animation.

**Architecture:** `+page.svelte` lifts the `/api/trains` fetch (currently owned by `Clocks.svelte`) and passes `trains`, `fetchedAt`, and `tick` down as props to both `Clocks.svelte` and `StationMap.svelte`. `StationMap.svelte` is a full rewrite: SVG with hand-placed geometry constants, derived live dot positions. No new dependencies.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, SVG, existing `gtfs-realtime-bindings` feed at `/api/trains`.

---

## File Map

| File | Change |
|---|---|
| `src/routes/+page.svelte` | Task A (AM/PM), Task D1 (lift fetch, add props to both children) |
| `src/lib/StationMap.svelte` | Tasks B + C: full rewrite. Task D2: add `trains`/`fetchedAt`/`tick` props + dot rendering |
| `src/lib/Clocks.svelte` | Task D1: remove self-fetch/tick, accept `trains`/`fetchedAt`/`tick` props |

---

## Task A: AM/PM time fix

**Files:**
- Modify: `src/routes/+page.svelte:31`

- [ ] **Step 1: Change the clockStr formatter**

In `src/routes/+page.svelte`, inside the `setInterval` callback, replace:

```javascript
clockStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
```

with:

```javascript
clockStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
```

`hour: 'numeric'` removes the leading zero — gives `9:42 AM` not `09:42 AM`.

- [ ] **Step 2: Verify**

Run `npm run dev`. Header should show e.g. `9:42 AM`. Confirm no leading zero, correct AM/PM suffix.

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "fix: AM/PM time display in header"
```

---

## Task B: StationMap — canvas, block grid, ribbons

**Files:**
- Modify: `src/lib/StationMap.svelte` (full rewrite, keep filename)

This task replaces the entire file with a new SVG. No data props yet — static geometry only.

**Geometry reference:**

The J/M elevated corridor runs from SW `(45, 530)` to NE `(460, 65)` on a 500×600 viewBox. J and M are offset 9 SVG units perpendicular to the centerline (J = NW side, M = SE side). G runs vertically at `x=290`.

- [ ] **Step 1: Rewrite StationMap.svelte with geometry constants and block grid**

Replace the entire contents of `src/lib/StationMap.svelte` with:

```svelte
<script>
  const W = 500, H = 600;

  // J/M corridor centerline anchors
  const JM_SW   = { x: 45,  y: 530 };
  const HEWES_C = { x: 210, y: 290 };
  const JM_NE   = { x: 460, y: 65  };

  // Perpendicular offset so J and M run side-by-side
  const JM_LEN = Math.hypot(JM_NE.x - JM_SW.x, JM_NE.y - JM_SW.y);
  const JM_UX  = (JM_NE.x - JM_SW.x) / JM_LEN;
  const JM_UY  = (JM_NE.y - JM_SW.y) / JM_LEN;
  const PX = -JM_UY; // perpendicular unit (CCW 90°)
  const PY =  JM_UX;
  const OFF = 9;

  const JO = { dx: -PX * OFF, dy: -PY * OFF }; // J: NW side of corridor
  const MO = { dx:  PX * OFF, dy:  PY * OFF }; // M: SE side of corridor

  function sh(pt, o) { return { x: pt.x + o.dx, y: pt.y + o.dy }; }

  // J ribbon anchor points
  const J_SW = sh(JM_SW,   JO);
  const J_H  = sh(HEWES_C, JO);
  const J_NE = sh(JM_NE,   JO);

  // M ribbon anchor points
  const M_SW = sh(JM_SW,   MO);
  const M_H  = sh(HEWES_C, MO);
  const M_NE = sh(JM_NE,   MO);

  // G corridor (vertical)
  const G_N  = { x: 290, y: 15  };
  const BWAY = { x: 290, y: 390 };
  const G_S  = { x: 290, y: 585 };

  // Hewes label anchor (midpoint between J and M ribbons)
  const HEWES_MID = { x: (J_H.x + M_H.x) / 2, y: (J_H.y + M_H.y) / 2 };

  // City blocks — dark rectangles suggesting the Williamsburg block grid.
  // Placed to avoid overlapping the main corridor paths.
  const BLOCKS = [
    // NW quadrant (above J/M diagonal, left of G)
    { x: 15,  y: 15,  w: 155, h: 70  },
    { x: 15,  y: 105, w: 125, h: 80  },
    { x: 15,  y: 205, w: 85,  h: 65  },
    { x: 115, y: 185, w: 80,  h: 55  },
    // NE quadrant (above J/M, right of G)
    { x: 315, y: 15,  w: 165, h: 70  },
    { x: 340, y: 105, w: 140, h: 50  },
    // SW quadrant (below J/M, left of G)
    { x: 15,  y: 440, w: 150, h: 80  },
    { x: 15,  y: 540, w: 120, h: 42  },
    // SE quadrant (below J/M, right of G)
    { x: 315, y: 245, w: 165, h: 75  },
    { x: 315, y: 440, w: 165, h: 80  },
    { x: 315, y: 540, w: 165, h: 42  },
  ];

  function pts(arr) {
    return arr.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }
</script>

<div class="map-wrap">
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Neighborhood schematic map — Hewes St and Broadway stations">

    <!-- City block grid -->
    {#each BLOCKS as b}
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="4" fill="#181818"/>
    {/each}

    <!-- G ribbon (draw first so J/M cross on top) -->
    <polyline points={pts([G_N, BWAY, G_S])}
      fill="none" stroke="#6CBE45" stroke-width="14"
      stroke-linecap="round" stroke-linejoin="round"/>

    <!-- J ribbon -->
    <polyline points={pts([J_SW, J_H, J_NE])}
      fill="none" stroke="#996633" stroke-width="14"
      stroke-linecap="round" stroke-linejoin="round"/>

    <!-- M ribbon -->
    <polyline points={pts([M_SW, M_H, M_NE])}
      fill="none" stroke="#FF6319" stroke-width="14"
      stroke-linecap="round" stroke-linejoin="round"/>

  </svg>
</div>

<style>
  .map-wrap {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  svg {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
  }
</style>
```

- [ ] **Step 2: Verify**

Run `npm run dev`. The map panel should show:
- Dark near-black canvas with subtle dark grey block rectangles
- A green ribbon running vertically
- A brown ribbon and orange ribbon running diagonally side-by-side crossing the green one
- No labels yet

- [ ] **Step 3: Commit**

```bash
git add src/lib/StationMap.svelte
git commit -m "feat: StationMap Mini Motorways ribbons + block grid"
```

---

## Task C: Station marker pills + endpoint labels

**Files:**
- Modify: `src/lib/StationMap.svelte`

Add station labels and terminus text inside the existing SVG. All additions go inside the `<svg>` element, after the ribbon `<polyline>` elements.

- [ ] **Step 1: Add station pills, terminus labels, and styles**

In `src/lib/StationMap.svelte`, replace the closing `</svg>` and `<style>` with:

```svelte
    <!-- Hewes St station pill (spans both J and M ribbons) -->
    <rect
      x={HEWES_MID.x - 66} y={HEWES_MID.y - 44}
      width="132" height="30" rx="6"
      fill="rgba(12,12,12,0.95)" stroke="rgba(255,255,255,0.14)" stroke-width="1"
    />
    <circle cx={HEWES_MID.x - 46} cy={HEWES_MID.y - 29} r="8" fill="#996633"/>
    <text x={HEWES_MID.x - 46} y={HEWES_MID.y - 25} class="bullet-text">J</text>
    <text x={HEWES_MID.x - 28} y={HEWES_MID.y - 24} class="station-name">HEWES ST</text>
    <circle cx={HEWES_MID.x + 58} cy={HEWES_MID.y - 29} r="8" fill="#FF6319"/>
    <text x={HEWES_MID.x + 58} y={HEWES_MID.y - 25} class="bullet-text">M</text>

    <!-- Broadway station pill -->
    <rect
      x={BWAY.x - 58} y={BWAY.y - 44}
      width="116" height="30" rx="6"
      fill="rgba(12,12,12,0.95)" stroke="rgba(255,255,255,0.14)" stroke-width="1"
    />
    <circle cx={BWAY.x - 38} cy={BWAY.y - 29} r="8" fill="#6CBE45"/>
    <text x={BWAY.x - 38} y={BWAY.y - 25} class="bullet-text">G</text>
    <text x={BWAY.x - 20} y={BWAY.y - 24} class="station-name">BROADWAY</text>

    <!-- J/M terminus labels -->
    <circle cx="14" cy="510" r="5" fill="#996633"/>
    <text x="24" y="514" class="terminus-label">JAMAICA</text>

    <circle cx="14" cy="550" r="5" fill="#FF6319"/>
    <text x="24" y="554" class="terminus-label">MET AVE</text>

    <circle cx="486" cy="56" r="5" fill="#996633"/>
    <text x="476" y="51" class="terminus-label" text-anchor="end">BROAD ST</text>

    <circle cx="486" cy="70" r="5" fill="#FF6319"/>
    <text x="476" y="65" class="terminus-label" text-anchor="end">FOREST HILLS</text>

    <!-- G terminus labels -->
    <circle cx="290" cy="26" r="5" fill="#6CBE45"/>
    <text x="300" y="30" class="terminus-label">COURT SQ</text>

    <circle cx="290" cy="574" r="5" fill="#6CBE45"/>
    <text x="300" y="578" class="terminus-label">CHURCH AV</text>

  </svg>
</div>

<style>
  .map-wrap {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  svg {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
  }
  .bullet-text {
    font-family: Helvetica Neue, Helvetica, Arial, sans-serif;
    font-size: 9px;
    font-weight: 800;
    fill: #fff;
    text-anchor: middle;
    dominant-baseline: middle;
  }
  .station-name {
    font-family: Helvetica Neue, Helvetica, Arial, sans-serif;
    font-size: 9px;
    font-weight: 700;
    fill: rgba(255, 255, 255, 0.85);
    letter-spacing: 0.08em;
    dominant-baseline: middle;
  }
  .terminus-label {
    font-family: Helvetica Neue, Helvetica, Arial, sans-serif;
    font-size: 8px;
    font-weight: 600;
    fill: rgba(255, 255, 255, 0.35);
    letter-spacing: 0.08em;
    dominant-baseline: middle;
  }
</style>
```

- [ ] **Step 2: Verify**

Run `npm run dev`. Check:
- "HEWES ST" pill appears near the J/M ribbon intersection with J (brown) and M (orange) circle bullets
- "BROADWAY" pill appears on the G ribbon with G (green) bullet
- Six terminus labels visible at ribbon ends (JAMAICA, MET AVE, BROAD ST, FOREST HILLS, COURT SQ, CHURCH AV) with matching colored dot

- [ ] **Step 3: Commit**

```bash
git add src/lib/StationMap.svelte
git commit -m "feat: station pills and terminus labels on map"
```

---

## Task D1: Lift trains fetch to +page.svelte, refactor Clocks.svelte

**Files:**
- Modify: `src/routes/+page.svelte`
- Modify: `src/lib/Clocks.svelte`

Currently `Clocks.svelte` owns the `/api/trains` fetch and its own `tick`. This task lifts both to `+page.svelte` so all children share one data source.

- [ ] **Step 1: Rewrite the +page.svelte script block**

Replace the entire `<script>` block in `src/routes/+page.svelte` with:

```svelte
<script>
  import { onMount } from 'svelte';
  import StationMap from '$lib/StationMap.svelte';
  import Clocks from '$lib/Clocks.svelte';

  // Trains data — single source, shared by Clocks and StationMap
  /** @type {Record<string, Array<{line: string, color: string, minutes: number, destination: string}>>} */
  let trains     = $state({});
  let freshnessAt = $state(0);

  const isStale   = $derived(tick >= 0 && freshnessAt > 0 && Date.now() - freshnessAt > 60_000);
  const hasData   = $derived(freshnessAt > 0);
  const staleSecs = $derived(tick >= 0 ? Math.round((Date.now() - freshnessAt) / 1000) : 0);

  let clockStr = $state('');
  let shiftX   = $state(0);
  let shiftY   = $state(0);
  let isDim    = $state(false);
  let tick     = $state(0);

  async function fetchTrains() {
    try {
      const res = await fetch('/api/trains');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      trains = await res.json();
      freshnessAt = Date.now();
    } catch (e) {
      console.error('[clockj] fetch trains failed:', e);
    }
  }

  onMount(() => {
    fetchTrains();
    const pollInterval = setInterval(fetchTrains, 30_000);

    const clockTick = setInterval(() => {
      const now = new Date();
      clockStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const h = now.getHours();
      isDim = h >= 23 || h < 6;
      tick++;
    }, 1_000);

    const shiftTick = setInterval(() => {
      const t = Date.now() / 1000;
      shiftX = Math.round(Math.sin(t / 17) * 4);
      shiftY = Math.round(Math.cos(t / 23) * 4);
    }, 5_000);

    let wakeLock = null;
    async function acquireWakeLock() {
      try {
        if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
      } catch (_) {}
    }
    acquireWakeLock();
    const onVisible = () => { if (document.visibilityState === 'visible') acquireWakeLock(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(pollInterval);
      clearInterval(clockTick);
      clearInterval(shiftTick);
      document.removeEventListener('visibilitychange', onVisible);
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  });
</script>
```

- [ ] **Step 2: Update the template to pass new props and remove onFreshness**

In `src/routes/+page.svelte`, replace:

```svelte
    <div class="panel map-panel">
      <StationMap />
    </div>
    <div class="panel clock-panel">
      <Clocks onFreshness={(t) => { freshnessAt = t; }} />
    </div>
```

with:

```svelte
    <div class="panel map-panel">
      <StationMap trains={trains} fetchedAt={freshnessAt} tick={tick} />
    </div>
    <div class="panel clock-panel">
      <Clocks trains={trains} fetchedAt={freshnessAt} tick={tick} />
    </div>
```

- [ ] **Step 3: Rewrite Clocks.svelte to accept props instead of self-fetching**

Replace the entire `<script>` block in `src/lib/Clocks.svelte` with:

```svelte
<script>
  import { STATIONS, DESTINATIONS } from './stations.js';

  /** @type {Record<string, Array<{line: string, color: string, minutes: number, destination: string}>>} */
  let { trains = {}, fetchedAt = 0, tick = 0 } = $props();

  const platforms = $derived.by(() => {
    void tick; // reactive dependency — recomputes every second
    if (!fetchedAt) return {};
    const elapsedMin = (Date.now() - fetchedAt) / 60_000;
    /** @type {typeof trains} */
    const out = {};
    for (const [stopId, arrivals] of Object.entries(trains)) {
      out[stopId] = arrivals
        .map(a => ({ ...a, minutes: a.minutes - elapsedMin }))
        .filter(a => a.minutes >= -0.5);
    }
    return out;
  });

  function fmt(min) {
    if (min <= 0.5) return 'now';
    const m = Math.ceil(min);
    return m < 60 ? String(m) : `${Math.floor(m / 60)}h ${m % 60}m`;
  }
</script>
```

Also remove the `onMount`/`onDestroy` import from the top of the script block — they are no longer used. The `onMount` import was in the original; remove it.

- [ ] **Step 4: Verify**

Run `npm run dev`. Confirm:
- Clock panel still shows trains ticking down
- Header freshness dot still goes green when data arrives
- No console errors about undefined props or missing onFreshness

- [ ] **Step 5: Commit**

```bash
git add src/routes/+page.svelte src/lib/Clocks.svelte
git commit -m "refactor: lift trains fetch to +page.svelte, Clocks accepts props"
```

---

## Task D2: Live train dots on StationMap

**Files:**
- Modify: `src/lib/StationMap.svelte`

**Position logic:** Each train dot is placed on its ribbon at a fraction of the ribbon length proportional to `minutesAway / 25`. `t=0` is at the station marker, `t=1` is at the terminus end the train is approaching from.

**Direction mapping:**
| Platform | Line | Train approaches from | Terminus used |
|---|---|---|---|
| M14N | J | SW (Jamaica) | `J_SW` |
| M14N | M | SW (Met Ave) | `M_SW` |
| M14S | J | NE (Manhattan) | `J_NE` |
| M14S | M | NE (Forest Hills) | `M_NE` |
| G30N | G | S (Church Av) | `G_S` |
| G30S | G | N (Court Sq) | `G_N` |

- [ ] **Step 1: Add props and liveDots derived to StationMap.svelte script**

In `src/lib/StationMap.svelte`, add the following at the top of the `<script>` block (after the existing `const W = 500, H = 600;` line):

```javascript
  /** @type {Record<string, Array<{line: string, color: string, minutes: number}>>} */
  let { trains = {}, fetchedAt = 0, tick = 0 } = $props();

  function lerp(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  const MAX_MIN = 25;

  const liveDots = $derived.by(() => {
    void tick;
    if (!fetchedAt) return [];
    const elapsedMin = (Date.now() - fetchedAt) / 60_000;
    /** @type {Array<{x: number, y: number, color: string}>} */
    const dots = [];

    function addDots(arrivals, stationPt, terminusPt, color) {
      for (const a of arrivals ?? []) {
        const mins = a.minutes - elapsedMin;
        if (mins < 0 || mins > MAX_MIN) continue;
        const pos = lerp(stationPt, terminusPt, mins / MAX_MIN);
        dots.push({ x: pos.x, y: pos.y, color });
      }
    }

    // J and M are computed AFTER the ribbon anchors (J_SW, J_H etc.) are defined above,
    // so these references are valid — all consts are in the same script scope.
    addDots(trains.M14N?.filter(a => a.line === 'J'), J_H,  J_SW, '#996633');
    addDots(trains.M14N?.filter(a => a.line === 'M'), M_H,  M_SW, '#FF6319');
    addDots(trains.M14S?.filter(a => a.line === 'J'), J_H,  J_NE, '#996633');
    addDots(trains.M14S?.filter(a => a.line === 'M'), M_H,  M_NE, '#FF6319');
    addDots(trains.G30N?.filter(a => a.line === 'G'), BWAY, G_S,  '#6CBE45');
    addDots(trains.G30S?.filter(a => a.line === 'G'), BWAY, G_N,  '#6CBE45');

    return dots;
  });
```

Note: `$props()` must be the first statement in the script block. Move it before `const W = 500, H = 600;`.

- [ ] **Step 2: Render dots in the SVG**

In `src/lib/StationMap.svelte`, add the following inside the `<svg>` element, immediately **before** the station pill `<rect>` elements (so dots render below the labels):

```svelte
    <!-- Live train dots -->
    {#each liveDots as dot}
      <circle
        cx={dot.x.toFixed(1)} cy={dot.y.toFixed(1)}
        r="7" fill={dot.color} stroke="white" stroke-width="2"
      />
    {/each}
```

- [ ] **Step 3: Verify**

Run `npm run dev`. Open the app and watch the map panel for ~30 seconds. Confirm:
- Colored dots appear on the J (brown), M (orange), and G (green) ribbons
- Dots move smoothly toward the station markers every second
- Dots disappear when they reach the station (minutes < 0)
- Dots beyond 25 min don't appear
- Station pills render on top of the dots

Cross-check: compare the dot positions against the countdown numbers in the clock panel. A train showing `8 min` on the clock panel should appear roughly 8/25 = 32% of the way from the station toward the terminus end.

- [ ] **Step 4: Commit**

```bash
git add src/lib/StationMap.svelte
git commit -m "feat: live train dots on map ribbons"
```

---

## Task E: Deploy

- [ ] **Step 1: Build to confirm no errors**

```bash
npm run build
```

Expected: `✓ built in ...ms`, no errors.

- [ ] **Step 2: Push and deploy**

```bash
git push && vercel --prod
```

Expected: `▲ Aliased https://clockj.vercel.app`

- [ ] **Step 3: Verify production**

Open `https://clockj.vercel.app` on the target device. Confirm:
- Header shows AM/PM time
- Map shows brown + orange parallel ribbons (J/M) crossing a green ribbon (G)
- Dark city blocks visible in the negative space
- Station pills labeled HEWES ST and BROADWAY
- Train dots moving on the ribbons
