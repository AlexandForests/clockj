<script>
  import { onMount, onDestroy } from 'svelte';
  import { STATIONS, DESTINATIONS, LINES } from './stations.js';

  /** @type {(freshAt: number) => void} */
  let { onFreshness } = $props();

  /**
   * Raw API response: stopId → [{line, color, minutes, destination}, ...]
   * minutes here are the server-computed values at fetch time.
   * @type {Record<string, Array<{line: string, color: string, minutes: number, destination: string}>>}
   */
  let raw = $state({});
  let fetchedAt = $state(0); // ms since epoch when raw was last fetched

  /** Live minutes derived from raw + elapsed time since fetch.
   *  tick is read here so $derived recomputes every second. */
  const platforms = $derived.by(() => {
    void tick; // reactive dependency — recomputes every second
    if (!fetchedAt) return {};
    const elapsedMin = (Date.now() - fetchedAt) / 60_000;
    /** @type {typeof raw} */
    const out = {};
    for (const [stopId, arrivals] of Object.entries(raw)) {
      out[stopId] = arrivals
        .map(a => ({ ...a, minutes: a.minutes - elapsedMin }))
        .filter(a => a.minutes >= -0.5); // show 0 until train departs
    }
    return out;
  });

  let tick = $state(0); // incremented every second to force $derived recompute

  async function fetchTrains() {
    try {
      const res = await fetch('/api/trains');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      raw = await res.json();
      fetchedAt = Date.now();
      onFreshness(fetchedAt);
    } catch (e) {
      console.error('[clockj] fetch trains failed:', e);
      // keep stale data; onFreshness not called → parent sees age
    }
  }

  let pollInterval = /** @type {ReturnType<typeof setInterval>|null} */ (null);
  let tickInterval = /** @type {ReturnType<typeof setInterval>|null} */ (null);

  onMount(() => {
    fetchTrains();
    pollInterval = setInterval(fetchTrains, 30_000);
    tickInterval = setInterval(() => { tick++; }, 1_000);
    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (tickInterval) clearInterval(tickInterval);
    };
  });

  /** Format minutes to display string */
  function fmt(min) {
    if (min <= 0.5) return 'now';
    const m = Math.ceil(min);
    return m < 60 ? String(m) : `${Math.floor(m / 60)}h ${m % 60}m`;
  }
</script>

<div class="clocks">
  {#each Object.values(STATIONS) as station}
    <section class="station">
      <h2 class="station-name">{station.name}</h2>
      {#each Object.entries(station.platforms) as [stopId, platform]}
        {@const arrivals = platforms[stopId] ?? []}
        <div class="platform">
          <div class="platform-dir">{platform.label}</div>
          <div class="rows">
            {#each arrivals.slice(0, 3) as arrival}
              <div class="row">
                <span class="bullet" style="background:{arrival.color}">{arrival.line}</span>
                <span class="dest">{arrival.destination}</span>
                <span class="mins">{fmt(arrival.minutes)}<span class="min-label"> min</span></span>
              </div>
            {/each}
            {#if arrivals.length === 0}
              <div class="row empty">
                <span class="bullet-empty">—</span>
                <span class="dest dim">No trains</span>
                <span class="mins dim">—</span>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </section>
  {/each}
</div>

<style>
  .clocks {
    display: flex;
    flex-direction: column;
    gap: 28px;
    padding: 28px 24px;
    height: 100%;
    overflow: hidden;
  }

  .station {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .station-name {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.35);
    margin: 0;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .platform {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .platform-dir {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.28);
    margin-bottom: 4px;
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 6px;
  }

  .row.empty {
    opacity: 0.4;
  }

  .bullet {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 800;
    color: #fff;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }

  .bullet-empty {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    color: rgba(255, 255, 255, 0.2);
    flex-shrink: 0;
  }

  .dest {
    flex: 1;
    font-size: 15px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.75);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dest.dim { color: rgba(255, 255, 255, 0.25); }

  .mins {
    font-size: 28px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: rgba(255, 255, 255, 0.92);
    letter-spacing: -0.02em;
    flex-shrink: 0;
    text-align: right;
    min-width: 52px;
  }

  .mins.dim { color: rgba(255, 255, 255, 0.2); font-size: 20px; }

  .min-label {
    font-size: 11px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.35);
    letter-spacing: 0.04em;
    margin-left: 2px;
  }
</style>
