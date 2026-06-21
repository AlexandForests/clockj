<script>
  import { onMount } from 'svelte';
  import { trainKey } from './train-key.js';

  /**
   * @typedef {{x: number, y: number}} Point
   * @typedef {{dx: number, dy: number}} Offset
   * @typedef {{line: string, color: string, minutes: number, arrivalTime?: number, tripId?: string}} TrainArrival
   * @typedef {{id: string, x: number, y: number, color: string, angle: number, passed: boolean, opacity: number, imminent: boolean}} TrainDot
   * @typedef {{trains?: Record<string, TrainArrival[]>, fetchedAt?: number, tick?: number, night?: boolean, activeTrainId?: string | null, onTrainHover?: (id: string | null) => void}} StationMapProps
   */

  /** @type {StationMapProps} */
  let {
    trains = {},
    fetchedAt = 0,
    tick = 0,
    night = false,
    activeTrainId = null,
    onTrainHover = () => {},
  } = $props();

  const W = 500, H = 600;

  // J/M corridor centerline anchors
  const JM_SW   = { x: -55, y: -40 };
  const HEWES_C = { x: 430, y: 510 };
  const JM_NE   = { x: 555, y: 655 };

  // Perpendicular offset so J and M run side-by-side
  const JM_LEN = Math.hypot(JM_NE.x - JM_SW.x, JM_NE.y - JM_SW.y);
  const JM_UX  = (JM_NE.x - JM_SW.x) / JM_LEN;
  const JM_UY  = (JM_NE.y - JM_SW.y) / JM_LEN;
  const PX = -JM_UY; // perpendicular unit (CCW 90°)
  const PY =  JM_UX;
  const OFF = 9;

  const JO = { dx: -PX * OFF, dy: -PY * OFF }; // J: NW side of corridor
  const MO = { dx:  PX * OFF, dy:  PY * OFF }; // M: SE side of corridor

  /** @param {Point} pt @param {Offset} o */
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
  const G_N  = { x: 160, y: -35 };
  const BWAY = { x: 160, y: 300 };
  const G_S  = { x: 160, y: 640 };

  // Hewes label anchor (midpoint between J and M ribbons)
  const HEWES_MID = { x: (J_H.x + M_H.x) / 2, y: (J_H.y + M_H.y) / 2 };

  // City blocks — dark rectangles suggesting the real Broadway / Hewes / New Montrose area.
  // Kept schematic so the station relationships stay legible at kiosk distance.
  const BLOCKS = [
    { x: 18,  y: 34,  w: 96,  h: 82,  fill: '#171717' },
    { x: 202, y: 26,  w: 120, h: 70,  fill: '#1c1c1c' },
    { x: 348, y: 28,  w: 118, h: 92,  fill: '#151515' },
    { x: 18,  y: 150, w: 98,  h: 86,  fill: '#1a1a1a' },
    { x: 205, y: 138, w: 170, h: 95,  fill: '#171717' },
    { x: 392, y: 155, w: 84,  h: 116, fill: '#1d1d1d' },
    { x: 22,  y: 280, w: 96,  h: 88,  fill: '#161616' },
    { x: 205, y: 286, w: 94,  h: 92,  fill: '#1b1b1b' },
    { x: 330, y: 310, w: 142, h: 80,  fill: '#181818' },
    { x: 22,  y: 418, w: 128, h: 74,  fill: '#1c1c1c' },
    { x: 302, y: 420, w: 82,  h: 70,  fill: '#151515' },
    { x: 392, y: 438, w: 82,  h: 82,  fill: '#1a1a1a' },
    { x: 30,  y: 532, w: 120, h: 52,  fill: '#171717' },
    { x: 188, y: 520, w: 126, h: 64,  fill: '#1c1c1c' },
    { x: 342, y: 550, w: 112, h: 44,  fill: '#161616' },
  ];

  const ROAD_HINTS = [
    { points: [{ x: -20, y: 128 }, { x: 520, y: 128 }], width: 6 },
    { points: [{ x: -20, y: 260 }, { x: 520, y: 260 }], width: 5 },
    { points: [{ x: -20, y: 408 }, { x: 520, y: 408 }], width: 6 },
    { points: [{ x: 132, y: -20 }, { x: 132, y: 620 }], width: 5 },
    { points: [{ x: 338, y: -20 }, { x: 338, y: 620 }], width: 4 },
    { points: [{ x: 70, y: 610 }, { x: 500, y: 130 }], width: 5 },
  ];

  const DIRECTION_LABELS = [
    { text: '< MANHATTAN-BOUND', x: 40, y: 122, rotate: 48 },
    { text: 'OUTBOUND >', x: 420, y: 555, rotate: 48 },
    { text: 'COURT SQ', x: 184, y: 112, rotate: -90 },
    { text: 'CHURCH AV', x: 182.2, y: 520, rotate: 90 },
  ];

  /** @param {Point[]} arr */
  function pts(arr) {
    return arr.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }

  /** @param {Point} a @param {Point} b @param {number} t */
  function lerp(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  /** @param {number} n @param {number} min @param {number} max */
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  /** Blend a #rrggbb hex toward white so a car reads as a lighter shade of its line.
   * @param {string} hex @param {number} amt 0..1 */
  function lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const mix = (/** @type {number} */ c) => Math.round(c + (255 - c) * amt);
    return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
  }

  const LOOKAHEAD_MS = 25 * 60_000;
  const STATION_HOLD_MS = 15_000;   // dwell at the station after arriving
  const OUTBOUND_MS = 90_000;       // depart past the station, then fade out
  const IMMINENT_MS = 120_000;      // arriving within 2 min → gentle pulse
  const DOT_SMOOTHING_MS = 450;

  // Train car geometry (local frame, +x = direction of travel)
  const CAR_LEN = 22;   // length along travel
  const CAR_W   = 11;   // width
  const CAR_RX  = 4;    // corner radius
  const LANE    = 4;    // perpendicular offset onto the right-hand lane (+y local)

  /** @type {TrainDot[]} */
  let liveDots = $state([]);
  /** @type {Map<string, Omit<TrainDot, 'id'>>} */
  const dotPositions = new Map();

  // Arrival flash: pulse a station anchor when a train we watched inbound reaches it.
  const seenInbound = new Set();
  const arrivedIds = new Set();
  let stationFlash = $state({ Hewes: 0, Broadway: 0 });
  const gDots = $derived(liveDots.filter(dot => dot.color === '#6CBE45'));
  const jmDots = $derived(liveDots.filter(dot => dot.color !== '#6CBE45'));

  /** @param {number} nowMs */
  function buildTargetDots(nowMs) {
    /** @type {TrainDot[]} */
    const dots = [];

    /**
     * @param {string} stopId
     * @param {TrainArrival[] | undefined} arrivals
     * @param {string} line
     * @param {Point} stationPt
     * @param {Point} terminusPt
     * @param {string} color
     */
    function addDots(stopId, arrivals, line, stationPt, terminusPt, color) {
      let index = 0;
      const angle = Math.atan2(stationPt.y - terminusPt.y, stationPt.x - terminusPt.x) * 180 / Math.PI;
      for (const a of arrivals ?? []) {
        if (a.line !== line) continue;
        const arrivalMs = a.arrivalTime ?? fetchedAt + a.minutes * 60_000;
        const remainingMs = arrivalMs - nowMs;
        if (remainingMs < -(STATION_HOLD_MS + OUTBOUND_MS) || remainingMs > LOOKAHEAD_MS) continue;

        // Inbound: terminus -> station (progress 1 -> 0). Dwell at the station for
        // STATION_HOLD_MS (progress 0). Then depart past the station along the same
        // heading (progress 0 -> -1, extrapolating the lerp) and fade out.
        const departMs = remainingMs + STATION_HOLD_MS; // <0 once the dwell ends
        const passed = departMs < 0;
        const progress = passed
          ? clamp(departMs / OUTBOUND_MS, -1, 0)
          : clamp(remainingMs / LOOKAHEAD_MS, 0, 1);
        const opacity = passed
          ? clamp((departMs + OUTBOUND_MS) / (0.4 * OUTBOUND_MS), 0, 1)
          : 1;
        const imminent = remainingMs > 0 && remainingMs <= IMMINENT_MS;
        const id = trainKey(stopId, a, index);

        // Flash the station the first time a train we watched approach reaches it.
        const station = /** @type {'Hewes' | 'Broadway'} */ (stopId[0] === 'G' ? 'Broadway' : 'Hewes');
        if (remainingMs > 0) seenInbound.add(id);
        else if (seenInbound.has(id) && !arrivedIds.has(id)) {
          arrivedIds.add(id);
          stationFlash[station] = nowMs;
        }

        const pos = lerp(stationPt, terminusPt, progress);
        dots.push({ id, x: pos.x, y: pos.y, color, angle, passed, opacity, imminent });
        index++;
      }
    }

    addDots('M14N', trains.M14N, 'J', J_H,  J_SW, '#996633');
    addDots('M14N', trains.M14N, 'M', M_H,  M_SW, '#FF6319');
    addDots('M14S', trains.M14S, 'J', J_H,  J_NE, '#996633');
    addDots('M14S', trains.M14S, 'M', M_H,  M_NE, '#FF6319');
    addDots('G30N', trains.G30N, 'G', BWAY, G_S,  '#6CBE45');
    addDots('G30S', trains.G30S, 'G', BWAY, G_N,  '#6CBE45');

    return dots;
  }

  /** @param {TrainDot[]} targets @param {number} alpha */
  function smoothDots(targets, alpha) {
    const activeIds = new Set(targets.map(dot => dot.id));
    for (const id of dotPositions.keys()) {
      if (!activeIds.has(id)) dotPositions.delete(id);
    }
    // Drop arrival-tracking ids for trains that have left the board.
    for (const id of seenInbound) if (!activeIds.has(id)) seenInbound.delete(id);
    for (const id of arrivedIds) if (!activeIds.has(id)) arrivedIds.delete(id);

    for (const target of targets) {
      const current = dotPositions.get(target.id);
      if (!current) {
        dotPositions.set(target.id, { ...target });
        continue;
      }

      current.x += (target.x - current.x) * alpha;
      current.y += (target.y - current.y) * alpha;
      current.color = target.color;
      current.angle = target.angle;
      current.passed = target.passed;
      current.opacity = target.opacity;
      current.imminent = target.imminent;
    }

    liveDots = Array.from(dotPositions, ([id, dot]) => ({ id, ...dot }));
  }

  onMount(() => {
    let lastFrameTs = 0;
    let rafId = 0;

    /** @param {number} ts */
    function frame(ts) {
      const dt = lastFrameTs ? ts - lastFrameTs : 16;
      lastFrameTs = ts;
      const alpha = 1 - Math.exp(-dt / DOT_SMOOTHING_MS);
      smoothDots(buildTargetDots(Date.now()), alpha);
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  });
</script>

{#snippet trainCar(/** @type {TrainDot} */ dot)}
  {#if dot.id === activeTrainId}
    <rect class="active-car-halo"
      x={-CAR_LEN / 2 - 2} y={LANE - CAR_W / 2 - 2}
      width={CAR_LEN + 4} height={CAR_W + 4} rx={CAR_RX + 2}/>
  {:else if dot.imminent}
    <rect class="imminent-car-halo"
      x={-CAR_LEN / 2 - 2} y={LANE - CAR_W / 2 - 2}
      width={CAR_LEN + 4} height={CAR_W + 4} rx={CAR_RX + 2}/>
  {/if}
  <rect class="train-car"
    x={-CAR_LEN / 2} y={LANE - CAR_W / 2}
    width={CAR_LEN} height={CAR_W} rx={CAR_RX}
    fill={lighten(dot.color, 0.42)}/>
  <rect class="train-headlight"
    x={CAR_LEN / 2 - 3} y={LANE - 3.5}
    width={3} height={7} rx={1.5}/>
{/snippet}

<div class="map-wrap" class:night>
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Neighborhood schematic map — Hewes St and Broadway stations">
    <defs>
      <filter id="dot-glow">
        <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="rgba(255,255,255,0.5)"/>
      </filter>
    </defs>

    <rect x="0" y="0" width={W} height={H} fill="#050505"/>

    <!-- Faint street structure; context only, not a map layer. -->
    {#each ROAD_HINTS as road}
      <polyline
        points={pts(road.points)}
        fill="none"
        stroke="rgba(255,255,255,0.035)"
        stroke-width={road.width}
        stroke-linecap="round"
      />
    {/each}

    <!-- City block grid -->
    {#each BLOCKS as b}
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="4" fill={b.fill}/>
    {/each}

    <!-- Direction cues -->
    {#each DIRECTION_LABELS as label}
      <text
        x={label.x} y={label.y}
        class="direction-label"
        transform="rotate({label.rotate} {label.x} {label.y})"
      >{label.text}</text>
    {/each}

    <!-- G ribbon (draw first so J/M cross on top) -->
    <polyline points={pts([G_N, BWAY, G_S])} class="ribbon" style="color:#6CBE45"
      fill="none" stroke="#6CBE45" stroke-width="14"
      stroke-linecap="round" stroke-linejoin="round"/>

    <circle class="station-anchor" cx={BWAY.x} cy={BWAY.y} r="9"/>

    <!-- G trains stay under the elevated J/M corridor at the crossing. -->
    {#each gDots as dot (dot.id)}
      <g
        class="train-dot"
        class:active-dot={dot.id === activeTrainId}
        class:passed={dot.passed}
        role="button"
        tabindex={dot.passed ? -1 : 0}
        aria-hidden={dot.passed}
        aria-label="Train approaching Broadway"
        data-train-id={dot.id}
        transform="translate({dot.x.toFixed(1)} {dot.y.toFixed(1)}) rotate({dot.angle.toFixed(1)})"
        opacity={dot.opacity}
        filter="url(#dot-glow)"
        onpointerenter={() => onTrainHover(dot.id)}
        onpointerleave={() => onTrainHover(null)}
        onfocus={() => onTrainHover(dot.id)}
        onblur={() => onTrainHover(null)}
      >
        {@render trainCar(dot)}
      </g>
    {/each}

    <!-- J ribbon -->
    <polyline points={pts([J_SW, J_H, J_NE])} class="ribbon" style="color:#996633"
      fill="none" stroke="#996633" stroke-width="14"
      stroke-linecap="round" stroke-linejoin="round"/>

    <!-- M ribbon -->
    <polyline points={pts([M_SW, M_H, M_NE])} class="ribbon" style="color:#FF6319"
      fill="none" stroke="#FF6319" stroke-width="14"
      stroke-linecap="round" stroke-linejoin="round"/>

    <rect
      class="station-anchor"
      x={HEWES_MID.x - 20}
      y={HEWES_MID.y - 7}
      width="40"
      height="14"
      rx="7"
      transform="rotate(48 {HEWES_MID.x} {HEWES_MID.y})"
    />

    <!-- J/M train dots sit on top of their route ribbons. -->
    {#each jmDots as dot (dot.id)}
      <g
        class="train-dot"
        class:active-dot={dot.id === activeTrainId}
        class:passed={dot.passed}
        role="button"
        tabindex={dot.passed ? -1 : 0}
        aria-hidden={dot.passed}
        aria-label="Train approaching Hewes St"
        data-train-id={dot.id}
        transform="translate({dot.x.toFixed(1)} {dot.y.toFixed(1)}) rotate({dot.angle.toFixed(1)})"
        opacity={dot.opacity}
        filter="url(#dot-glow)"
        onpointerenter={() => onTrainHover(dot.id)}
        onpointerleave={() => onTrainHover(null)}
        onfocus={() => onTrainHover(dot.id)}
        onblur={() => onTrainHover(null)}
      >
        {@render trainCar(dot)}
      </g>
    {/each}

    <!-- Arrival flashes — expanding ring when a train reaches its platform -->
    {#if stationFlash.Broadway}
      {#key stationFlash.Broadway}
        <circle class="arrival-flash" cx={BWAY.x} cy={BWAY.y} r="9"/>
      {/key}
    {/if}
    {#if stationFlash.Hewes}
      {#key stationFlash.Hewes}
        <circle class="arrival-flash" cx={HEWES_MID.x} cy={HEWES_MID.y} r="11"/>
      {/key}
    {/if}

    <!-- Hewes St station pill (spans both J and M ribbons) -->
    <rect
      x={HEWES_MID.x - 66} y={HEWES_MID.y - 46}
      width="132" height="30" rx="6"
      fill="rgba(12,12,12,0.95)" stroke="rgba(255,255,255,0.14)" stroke-width="1"
    />
    <circle cx={HEWES_MID.x - 39} cy={HEWES_MID.y - 31} r="8" fill="#996633"/>
    <text x={HEWES_MID.x - 39} y={HEWES_MID.y - 31} class="bullet-text">J</text>
    <circle cx={HEWES_MID.x - 19} cy={HEWES_MID.y - 31} r="8" fill="#FF6319"/>
    <text x={HEWES_MID.x - 19} y={HEWES_MID.y - 31} class="bullet-text">M</text>
    <text x={HEWES_MID.x + 22} y={HEWES_MID.y - 31} class="station-name" text-anchor="middle">HEWES ST</text>

    <!-- Broadway station pill -->
    <rect
      x={BWAY.x - 58} y={BWAY.y - 44}
      width="116" height="30" rx="6"
      fill="rgba(12,12,12,0.95)" stroke="rgba(255,255,255,0.14)" stroke-width="1"
    />
    <circle cx={BWAY.x - 31} cy={BWAY.y - 29} r="8" fill="#6CBE45"/>
    <text x={BWAY.x - 31} y={BWAY.y - 29} class="bullet-text">G</text>
    <text x={BWAY.x + 10} y={BWAY.y - 29} class="station-name" text-anchor="middle">BROADWAY</text>

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
  .station-anchor {
    fill: #8c8c8c;
    stroke: rgba(255, 255, 255, 0.72);
    stroke-width: 2;
    filter: url(#dot-glow);
  }
  .train-car {
    stroke: #fff;
    stroke-width: 1.5;
  }
  .train-headlight {
    fill: #fff7e0;
    opacity: 0.95;
    pointer-events: none;
  }
  .train-dot {
    pointer-events: visiblePainted;
    cursor: pointer;
  }
  .train-dot.passed {
    pointer-events: none;
  }
  .active-car-halo {
    fill: none;
    stroke: rgba(255, 255, 255, 0.86);
    stroke-width: 2;
    pointer-events: none;
    animation: train-pulse 1.1s ease-in-out infinite;
  }
  @keyframes train-pulse {
    0%, 100% { opacity: 0.35; }
    50% { opacity: 1; }
  }
  /* Gentler, slower pulse for a train arriving within ~2 min (not hover). */
  .imminent-car-halo {
    fill: none;
    stroke: rgba(255, 255, 255, 0.6);
    stroke-width: 1.5;
    pointer-events: none;
    animation: imminent-pulse 1.8s ease-in-out infinite;
  }
  @keyframes imminent-pulse {
    0%, 100% { opacity: 0.15; }
    50% { opacity: 0.55; }
  }
  /* At night the line ribbons glow in their own colour so the map stays vivid while dimmed. */
  .ribbon {
    transition: filter 1.5s ease;
  }
  .map-wrap.night .ribbon {
    filter: drop-shadow(0 0 2.5px currentColor);
  }

  .arrival-flash {
    fill: none;
    stroke: rgba(255, 255, 255, 0.9);
    stroke-width: 2;
    pointer-events: none;
    transform-box: fill-box;
    transform-origin: center;
    animation: arrival-flash 900ms ease-out 1 forwards;
  }
  @keyframes arrival-flash {
    0%   { opacity: 0.9; transform: scale(1); }
    100% { opacity: 0; transform: scale(2.8); }
  }

  .direction-label {
    font-family: Helvetica Neue, Helvetica, Arial, sans-serif;
    font-size: 9px;
    font-weight: 800;
    fill: rgba(255, 255, 255, 0.32);
    letter-spacing: 0.12em;
    text-anchor: middle;
    dominant-baseline: middle;
    paint-order: stroke;
    stroke: rgba(0, 0, 0, 0.65);
    stroke-width: 3px;
  }
</style>
