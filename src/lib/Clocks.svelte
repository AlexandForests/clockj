<script>
  import { STATIONS, PLATFORM_FEED, WALK_MINUTES } from './stations.js';
  import { trainKey } from './train-key.js';

  /**
   * @typedef {{line: string, color: string, minutes: number, arrivalTime?: number, tripId?: string, destination: string}} TrainArrival
   * @typedef {{trains?: Record<string, TrainArrival[]>, feedHealth?: Record<string, boolean>, fetchedAt?: number, tick?: number, activeTrainId?: string | null, onTrainHover?: (id: string | null) => void}} ClocksProps
   */

  /** @type {ClocksProps} */
  let {
    trains = {},
    feedHealth = {},
    fetchedAt = 0,
    tick = 0,
    activeTrainId = null,
    onTrainHover = () => {},
  } = $props();

  /** A platform's data is unavailable (vs. genuinely empty) when one of its feeds failed.
   * @param {string} stopId */
  function feedDown(stopId) {
    return (PLATFORM_FEED[/** @type {keyof typeof PLATFORM_FEED} */ (stopId)] ?? [])
      .some(f => feedHealth[f] === false);
  }

  const platforms = $derived.by(() => {
    void tick; // reactive dependency — recomputes every second
    if (!fetchedAt) return {};
    const elapsedMin = (Date.now() - fetchedAt) / 60_000;
    /** @type {Record<string, TrainArrival[]>} */
    const out = {};
    for (const [stopId, arrivals] of Object.entries(trains)) {
      out[stopId] = arrivals
        .map(a => ({
          ...a,
          minutes: a.arrivalTime ? (a.arrivalTime - Date.now()) / 60_000 : a.minutes - elapsedMin,
        }))
        .filter(a => a.minutes >= -0.5);
    }
    return out;
  });

  /** @param {number} min */
  function fmt(min) {
    if (min <= 0.5) return 'now';
    const m = Math.ceil(min);
    return m < 60 ? String(m) : `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  const LEAVE_WINDOW = 15; // only surface the cue when you'd leave within this many minutes

  /** When to leave to catch the soonest train you can still make on foot.
   * @param {TrainArrival[]} arrivals @param {number} walkMin
   * @returns {{now: boolean, mins: number} | null} */
  function leaveCue(arrivals, walkMin) {
    const t = arrivals.find(a => a.minutes >= walkMin - 0.5);
    if (!t) return null;
    const leaveIn = t.minutes - walkMin;
    if (leaveIn <= 0.5) return { now: true, mins: 0 };
    if (leaveIn > LEAVE_WINDOW) return null;
    return { now: false, mins: Math.max(1, Math.round(leaveIn)) };
  }
</script>

<div class="clocks">
  {#each Object.entries(STATIONS) as [stationKey, station]}
    {@const walkMin = WALK_MINUTES[/** @type {keyof typeof WALK_MINUTES} */ (stationKey)] ?? 5}
    <section class="station">
      <h2 class="station-name">{station.name}</h2>
      {#each Object.entries(station.platforms) as [stopId, platform]}
        {@const arrivals = platforms[stopId] ?? []}
        {@const cue = leaveCue(arrivals, walkMin)}
        <div class="platform">
          <div class="platform-dir">
            <span>{platform.label}</span>
            {#if cue}
              <span class="leave" class:now={cue.now}>
                {cue.now ? 'Leave now' : `Leave in ${cue.mins}`}
              </span>
            {/if}
          </div>
          <div class="rows">
            {#each arrivals.slice(0, 3) as arrival, i (trainKey(stopId, arrival, i))}
              {@const id = trainKey(stopId, arrival, i)}
              <button
                type="button"
                class="row"
                class:active={id === activeTrainId}
                class:imminent={arrival.minutes <= 2}
                data-train-id={id}
                style={`--line-color: ${arrival.color}`}
                onpointerenter={() => onTrainHover(id)}
                onpointerleave={() => onTrainHover(null)}
                onfocus={() => onTrainHover(id)}
                onblur={() => onTrainHover(null)}
              >
                <span class="bullet" style="background:{arrival.color}">{arrival.line}</span>
                <span class="dest">{arrival.destination}</span>
                <span class="mins">{fmt(arrival.minutes)}<span class="min-label"> min</span></span>
              </button>
            {/each}
            {#if arrivals.length === 0}
              <div class="row empty">
                <span class="bullet-empty">—</span>
                <span class="dest dim">{feedDown(stopId) ? 'Service info unavailable' : 'No trains'}</span>
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
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.28);
    margin-bottom: 4px;
  }

  .leave {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.45);
    white-space: nowrap;
  }
  .leave.now {
    color: #6cbe45;
    animation: leave-pulse 1.6s ease-in-out infinite;
  }
  @keyframes leave-pulse {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.45; }
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .row {
    appearance: none;
    border: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.04);
    border-left: 3px solid transparent;
    border-radius: 6px;
    color: inherit;
    font: inherit;
    text-align: left;
    transition: background 0.16s ease, border-color 0.16s ease;
  }

  .row:hover,
  .row:focus-visible,
  .row.active {
    background: rgba(255, 255, 255, 0.085);
    border-left-color: var(--line-color);
  }

  .row:focus-visible {
    outline: 1px solid rgba(255, 255, 255, 0.45);
    outline-offset: 2px;
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

  /* Train arriving within ~2 min — its bullet pulses in the line color. */
  .row.imminent .bullet {
    animation: bullet-pulse 1.4s ease-in-out infinite;
  }
  @keyframes bullet-pulse {
    0%, 100% { box-shadow: 0 0 0 0 transparent; }
    50%      { box-shadow: 0 0 9px 1px var(--line-color); }
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
