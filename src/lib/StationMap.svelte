<script>
  // Curated SVG schematic — hand-placed geometry for the Hewes St / Broadway corner.
  // Virtual canvas: 400 × 500
  //
  // Geography summary:
  //   The J/M elevated line runs roughly NE→SW along Broadway (the El).
  //   Hewes St station is on this line (~mid-canvas).
  //   The G runs underground N→S. Broadway (G) station is ~1 block south of Hewes.
  //   The two lines form a loose cross in this neighborhood.

  const W = 400, H = 500;

  // Station anchor points
  const HEWES  = { x: 200, y: 210 };
  const BWAY_G = { x: 240, y: 310 };

  // J/M line runs diagonally NE↗ to SW↙ through Hewes
  const JM_LINE = [
    { x:  60, y: 360 }, // SW end (Jamaica direction)
    HEWES,              // Hewes St station
    { x: 360, y:  80 }, // NE end (Manhattan direction)
  ];

  // G line runs vertically through Broadway station
  const G_LINE = [
    { x: 240, y:  50 }, // N end (Court Sq direction)
    BWAY_G,             // Broadway station
    { x: 240, y: 460 }, // S end (Church Av direction)
  ];

  /** Build SVG polyline points string from array of {x,y} */
  function pts(arr) {
    return arr.map(p => `${p.x},${p.y}`).join(' ');
  }

  // Street grid — faint reference lines for context
  const STREETS = [
    // Broadway (diagonal)
    { x1: 50, y1: 380, x2: 370, y2: 60, label: 'Broadway', lx: 90, ly: 350 },
    // Hewes St (horizontal cross-street at Hewes station)
    { x1: 60, y1: 210, x2: 340, y2: 210, label: 'Hewes St', lx: 64, ly: 204 },
    // Marcy Ave (vertical reference)
    { x1: 155, y1: 50, x2: 155, y2: 460, label: 'Marcy Ave', lx: 158, ly: 58 },
  ];
</script>

<div class="map-wrap">
  <svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Neighborhood schematic map showing Hewes St and Broadway subway stations">

    <!-- Street grid -->
    {#each STREETS as s}
      <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            stroke="rgba(255,255,255,0.07)" stroke-width="1" />
      <text x={s.lx} y={s.ly} class="street-label">{s.label}</text>
    {/each}

    <!-- J/M line (diagonal brown/orange El) -->
    <polyline points={pts(JM_LINE)}
      fill="none" stroke="#996633" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
    <!-- M overlay (offset slightly so both colors show) -->
    <polyline points={pts([JM_LINE[0], HEWES])}
      fill="none" stroke="#996633" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.6" />

    <!-- G line (vertical green underground) -->
    <polyline points={pts(G_LINE)}
      fill="none" stroke="#6CBE45" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Direction labels -->
    <!-- J/M NE end → Manhattan -->
    <text x="348" y="74" class="dir-label" text-anchor="end">Manhattan ↗</text>
    <!-- J/M SW end → Jamaica / Metropolitan Av -->
    <text x="52" y="372" class="dir-label" text-anchor="start">Jamaica ↙</text>
    <!-- G N end → Court Sq -->
    <text x="240" y="42" class="dir-label" text-anchor="middle">Court Sq ↑</text>
    <!-- G S end → Church Av -->
    <text x="240" y="478" class="dir-label" text-anchor="middle">↓ Church Av</text>

    <!-- Hewes St station marker -->
    <circle cx={HEWES.x} cy={HEWES.y} r="10" fill="#0a0a0a" stroke="#996633" stroke-width="3" />
    <circle cx={HEWES.x} cy={HEWES.y} r="4" fill="#996633" />

    <!-- Hewes St label -->
    <text x={HEWES.x - 14} y={HEWES.y - 18} class="station-label" text-anchor="middle">Hewes St</text>
    <text x={HEWES.x - 14} y={HEWES.y - 5} class="line-tag" text-anchor="middle">J M</text>

    <!-- Broadway (G) station marker -->
    <circle cx={BWAY_G.x} cy={BWAY_G.y} r="10" fill="#0a0a0a" stroke="#6CBE45" stroke-width="3" />
    <circle cx={BWAY_G.x} cy={BWAY_G.y} r="4" fill="#6CBE45" />

    <!-- Broadway label -->
    <text x={BWAY_G.x + 18} y={BWAY_G.y - 6} class="station-label" text-anchor="start">Broadway</text>
    <text x={BWAY_G.x + 18} y={BWAY_G.y + 8} class="line-tag" text-anchor="start">G</text>

    <!-- "YOU ARE HERE" compass rose -->
    <text x="20" y="490" class="compass">↑ N</text>
  </svg>
</div>

<style>
  .map-wrap {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  svg {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
  }

  .street-label {
    font-family: Helvetica Neue, Helvetica, Arial, sans-serif;
    font-size: 9px;
    fill: rgba(255, 255, 255, 0.18);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .dir-label {
    font-family: Helvetica Neue, Helvetica, Arial, sans-serif;
    font-size: 10px;
    fill: rgba(255, 255, 255, 0.3);
    letter-spacing: 0.05em;
  }

  .station-label {
    font-family: Helvetica Neue, Helvetica, Arial, sans-serif;
    font-size: 13px;
    font-weight: 700;
    fill: rgba(255, 255, 255, 0.88);
    letter-spacing: 0.04em;
  }

  .line-tag {
    font-family: Helvetica Neue, Helvetica, Arial, sans-serif;
    font-size: 10px;
    font-weight: 600;
    fill: rgba(255, 255, 255, 0.45);
    letter-spacing: 0.12em;
  }

  .compass {
    font-family: Helvetica Neue, Helvetica, Arial, sans-serif;
    font-size: 10px;
    fill: rgba(255, 255, 255, 0.2);
    letter-spacing: 0.08em;
  }
</style>
