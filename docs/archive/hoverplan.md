# clockj Hover Linking Plan

## Goal

Hovering a train dot on the map should highlight the matching countdown row on the right.
Hovering a countdown row should pulse/highlight the matching train dot on the map.

Scope for this pass: **hover only**. No tap-to-lock, no auto-scroll, no settings UI.

## Current State

- `src/routes/+page.svelte` owns shared train data and passes it to:
  - `src/lib/StationMap.svelte`
  - `src/lib/Clocks.svelte`
- `/api/trains` now returns stable timing metadata:
  - `tripId`
  - `arrivalTime`
  - `stopSequence`
  - `line`
  - `destination`
  - `color`
- `StationMap.svelte` already creates moving dots using a dot `id`.
- `Clocks.svelte` renders arrival rows, but rows are not keyed or interactive yet.

## Key Principle

Use one shared train identity across map dots and clock rows.

Do **not** match by `line + minutes`. That will break when two trains are close together.

Preferred key:

```js
tripId || `${stopId}:${line}:${arrivalTime}`
```

This should be centralized so both components use the exact same logic.

## Files To Change

### 1. `src/lib/train-key.js`

Create a small helper:

```js
export function trainKey(stopId, arrival, index = 0) {
  return arrival.tripId || `${stopId}:${arrival.line}:${arrival.arrivalTime ?? arrival.minutes}:${index}`;
}
```

Use this in both `StationMap.svelte` and `Clocks.svelte`.

### 2. `src/routes/+page.svelte`

Add shared hover state:

```js
let hoveredTrainId = $state(null);
```

Pass it into both children:

```svelte
<StationMap
  trains={trains}
  fetchedAt={freshnessAt}
  tick={tick}
  activeTrainId={hoveredTrainId}
  onTrainHover={(id) => hoveredTrainId = id}
/>

<Clocks
  trains={trains}
  fetchedAt={freshnessAt}
  tick={tick}
  activeTrainId={hoveredTrainId}
  onTrainHover={(id) => hoveredTrainId = id}
/>
```

Clear hover by passing `null` on pointer leave.

### 3. `src/lib/StationMap.svelte`

Add props:

```js
activeTrainId = null
onTrainHover = () => {}
```

Replace the local `dotKey()` helper with the shared `trainKey()`.

Train dot groups should get pointer handlers:

```svelte
onpointerenter={() => onTrainHover(dot.id)}
onpointerleave={() => onTrainHover(null)}
```

Active dot styling:

- Add class when `dot.id === activeTrainId`.
- Pulse an outer ring.
- Slightly increase visual emphasis without changing route color.

Suggested SVG structure:

```svelte
<g
  class:active-dot={dot.id === activeTrainId}
  onpointerenter={() => onTrainHover(dot.id)}
  onpointerleave={() => onTrainHover(null)}
>
  {#if dot.id === activeTrainId}
    <circle class="active-dot-ring" r="13" />
  {/if}
  <circle r="8" ... />
  <path class="train-chevron" ... />
</g>
```

CSS:

```css
.active-dot-ring {
  fill: none;
  stroke: rgba(255,255,255,0.85);
  stroke-width: 2;
  animation: train-pulse 1.1s ease-in-out infinite;
}

@keyframes train-pulse {
  0%, 100% { opacity: 0.35; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.12); }
}
```

SVG transform caveat: if CSS `transform` on SVG circles behaves inconsistently, use animated `r`
instead of `scale()`.

### 4. `src/lib/Clocks.svelte`

Add props:

```js
activeTrainId = null
onTrainHover = () => {}
```

When rendering rows, compute the same key:

```svelte
{@const id = trainKey(stopId, arrival, i)}
```

The `each` should expose the index:

```svelte
{#each arrivals.slice(0, 3) as arrival, i (trainKey(stopId, arrival, i))}
```

Add pointer handlers:

```svelte
onpointerenter={() => onTrainHover(id)}
onpointerleave={() => onTrainHover(null)}
```

Active row styling:

```svelte
class:active={id === activeTrainId}
style:--line-color={arrival.color}
```

CSS:

```css
.row {
  border-left: 3px solid transparent;
}

.row.active {
  background: rgba(255, 255, 255, 0.085);
  border-left-color: var(--line-color);
}
```

Keep it restrained. The row should feel selected, not radioactive.

## Interaction Details

- Hovering a dot highlights that dot and its row.
- Hovering a row highlights that row and its dot.
- Leaving either clears hover.
- If data refreshes and the active train disappears, the active ID can remain harmlessly unmatched.
  Optional cleanup can be added later, but it is not necessary for hover-only behavior.

## Risk Areas

- `tripId` may be missing for some feed entities.
  - Fallback key covers this.
- Duplicate fallback keys are possible if `arrivalTime` is absent.
  - Current API returns `arrivalTime`, so this is low risk.
- SVG CSS animation on transformed groups can be finicky.
  - Prefer pulsing ring opacity/radius if scale causes trouble.
- Dense overlapping dots near a station may make hover targeting hard.
  - Use `pointer-events: visiblePainted`; increase active ring only after hover.

## Verification

1. `npm run build`
2. Start dev server:

```bash
npm run dev -- --host 127.0.0.1
```

3. Browser checks:
   - Hover a countdown row.
   - Matching train dot pulses.
   - Hover a train dot.
   - Matching countdown row highlights.
   - Move pointer away.
   - Highlight clears.
   - Wait for `/api/trains` refresh.
   - Hover still works after data updates.

4. Regression checks:
   - Train dots still move smoothly.
   - G dots still render below J/M corridor.
   - Station anchors still render above tracks.
   - No browser console errors.

## Out Of Scope

- Tap-to-lock selection.
- Auto-scroll right panel to matching train.
- Showing popovers/tooltips.
- Persisting selection across refreshes intentionally.
- Keyboard navigation.

