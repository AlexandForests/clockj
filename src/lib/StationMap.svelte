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
