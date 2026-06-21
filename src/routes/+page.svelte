<script>
  import { dev } from '$app/environment';
  import { onMount } from 'svelte';
  import StationMap from '$lib/StationMap.svelte';
  import Clocks from '$lib/Clocks.svelte';
  import { LINES } from '$lib/stations.js';

  /** @typedef {{line: string, color: string, minutes: number, arrivalTime?: number, tripId?: string, destination: string}} TrainArrival */

  // Trains data — single source, shared by Clocks and StationMap
  /** @type {Record<string, TrainArrival[]>} */
  let trains     = $state({});
  /** @type {Record<string, boolean>} */
  let feedHealth = $state({});
  let freshnessAt = $state(0);
  let clockStr = $state('');
  let shiftX   = $state(0);
  let shiftY   = $state(0);
  let tick     = $state(0);
  let hoveredTrainId = $state(/** @type {string | null} */ (null));

  /** @typedef {{id: string, type: string, severity: number, status: string, routes: string[], header: string, period: string, updatedAt: number | null, startsAt: number | null}} Alert */
  /** @type {Alert[]} */
  let alerts      = $state([]);
  let alertsTotal = $state(0);

  /** @param {string} line */
  function lineColor(line) {
    return LINES[/** @type {keyof typeof LINES} */ (line)]?.color ?? '#888';
  }

  const isStale   = $derived(tick >= 0 && freshnessAt > 0 && Date.now() - freshnessAt > 60_000);
  const hasData   = $derived(freshnessAt > 0);
  const staleSecs = $derived(tick >= 0 ? Math.round((Date.now() - freshnessAt) / 1000) : 0);

  // Overnight dim (00:30–05:30 America/New_York) — cuts glare + burn-in on the kiosk.
  const nightDim = $derived.by(() => {
    void tick; // re-evaluate on the 1s tick
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date());
    const h = (+(parts.find(p => p.type === 'hour')?.value ?? 0)) % 24;
    const m = +(parts.find(p => p.type === 'minute')?.value ?? 0);
    const mins = h * 60 + m;
    return mins >= 30 && mins < 330;
  });

  /** @param {string | null} id */
  function setHoveredTrain(id) {
    hoveredTrainId = id;
  }

  function useHoverFixture() {
    if (!dev || typeof window === 'undefined') return false;
    if (new URLSearchParams(window.location.search).get('fixture') !== 'hover') return false;

    const now = Date.now();
    trains = {
      M14N: [
        { line: 'J', color: '#996633', minutes: 7, arrivalTime: now + 7 * 60_000, tripId: 'fixture-j-manhattan', destination: 'Broad St' },
        { line: 'M', color: '#FF6319', minutes: 12, arrivalTime: now + 12 * 60_000, tripId: 'fixture-m-manhattan', destination: 'Forest Hills' },
      ],
      M14S: [
        { line: 'J', color: '#996633', minutes: 5, arrivalTime: now + 5 * 60_000, tripId: 'fixture-j-outbound', destination: 'Jamaica Center' },
        { line: 'M', color: '#FF6319', minutes: 10, arrivalTime: now + 10 * 60_000, tripId: 'fixture-m-outbound', destination: 'Metropolitan Av' },
      ],
      G30N: [
        { line: 'G', color: '#6CBE45', minutes: 4, arrivalTime: now + 4 * 60_000, tripId: 'fixture-g-court', destination: 'Court Sq' },
      ],
      G30S: [
        { line: 'G', color: '#6CBE45', minutes: 9, arrivalTime: now + 9 * 60_000, tripId: 'fixture-g-church', destination: 'Church Av' },
      ],
    };
    freshnessAt = now;
    return true;
  }

  async function fetchTrains() {
    if (useHoverFixture()) return;

    try {
      const res = await fetch('/api/trains');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      trains = data.platforms ?? data;
      feedHealth = data.meta?.feeds ?? {};
      freshnessAt = Date.now();
    } catch (e) {
      console.error('[clockj] fetch trains failed:', e);
    }
  }

  async function fetchAlerts() {
    try {
      const res = await fetch('/api/alerts');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      alerts = data.alerts ?? [];
      alertsTotal = data.total ?? alerts.length;
    } catch (e) {
      console.error('[clockj] fetch alerts failed:', e);
    }
  }

  onMount(() => {
    fetchTrains();
    fetchAlerts();
    const pollInterval = setInterval(fetchTrains, 30_000);
    const alertInterval = setInterval(fetchAlerts, 60_000);

    const clockTick = setInterval(() => {
      const now = new Date();
      clockStr = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/New_York',
      });
      tick++;
    }, 1_000);

    const shiftTick = setInterval(() => {
      const t = Date.now() / 1000;
      shiftX = Math.round(Math.sin(t / 17) * 4);
      shiftY = Math.round(Math.cos(t / 23) * 4);
    }, 5_000);

    /** @type {WakeLockSentinel | null} */
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
      clearInterval(alertInterval);
      clearInterval(clockTick);
      clearInterval(shiftTick);
      document.removeEventListener('visibilitychange', onVisible);
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  });
</script>

<svelte:head>
  <title>clockj — Hewes &amp; Broadway</title>
</svelte:head>

<div
  class="shell"
  class:night={nightDim}
  style="transform: translate({shiftX}px, {shiftY}px)"
>
  <!-- Minimal header bar -->
  <header>
    <span class="wordmark">CLOCKJ</span>
    <span class="location">Hewes St &amp; Broadway · Williamsburg</span>
    <div class="header-right">
      <span class="clock-str">{clockStr}</span>
      <span
        class="dot"
        class:fresh={hasData && !isStale}
        class:stale={isStale}
        title={hasData ? (isStale ? 'Stale data' : 'Live') : 'Loading…'}
      ></span>
    </div>
  </header>

  {#if alerts.length}
    <div class="alert-bar">
      {#each alerts as a (a.id)}
        <div class="alert sev{a.severity}">
          <span class="alert-type">{a.type}</span>
          <span class="alert-routes">
            {#each a.routes as r}
              <span class="alert-bullet" style="background:{lineColor(r)}">{r}</span>
            {/each}
          </span>
          <span class="alert-header">{a.header}</span>
          <span class="alert-when">
            {#if a.status === 'upcoming'}<span class="alert-soon">SOON</span>{/if}
            {a.period}
          </span>
        </div>
      {/each}
      {#if alertsTotal > alerts.length}
        <div class="alert-more">+{alertsTotal - alerts.length} more</div>
      {/if}
    </div>
  {/if}

  <!-- Split layout: map left, clocks right -->
  <main>
    <div class="panel map-panel">
      <StationMap
        trains={trains}
        fetchedAt={freshnessAt}
        tick={tick}
        night={nightDim}
        activeTrainId={hoveredTrainId}
        onTrainHover={setHoveredTrain}
      />
    </div>
    <div class="panel clock-panel">
      <Clocks
        trains={trains}
        feedHealth={feedHealth}
        fetchedAt={freshnessAt}
        tick={tick}
        activeTrainId={hoveredTrainId}
        onTrainHover={setHoveredTrain}
      />
    </div>
  </main>

  {#if isStale && hasData}
    <div class="stale-banner">Data may be delayed — last updated {staleSecs}s ago</div>
  {/if}
</div>

<style>
  .shell {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    color: var(--text-primary);
    overflow: hidden;
    /* pixel-shift is applied via inline transform */
    transition: filter 1.5s ease;
  }
  .shell.night {
    filter: brightness(0.5);
  }

  header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 20px;
    height: 44px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--border);
    background: rgba(10, 10, 10, 0.9);
    backdrop-filter: blur(8px);
    z-index: 5;
  }

  .wordmark {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.25em;
    color: rgba(255, 255, 255, 0.55);
  }

  .location {
    font-size: 11px;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.3);
    flex: 1;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .clock-str {
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: rgba(255, 255, 255, 0.45);
    letter-spacing: 0.06em;
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    transition: background 0.5s;
    flex-shrink: 0;
  }
  .dot.fresh {
    background: #6CBE45;
    box-shadow: 0 0 6px #6CBE45;
    animation: pulse 2.5s ease-in-out infinite;
  }
  .dot.stale { background: #E8A020; box-shadow: 0 0 6px #E8A020; }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.35; }
  }

  /* Service alerts — compact, glanceable rows below the header */
  .alert-bar {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    border-bottom: 1px solid var(--border);
    background: rgba(8, 8, 8, 0.9);
    z-index: 4;
  }

  .alert {
    --sev: #5a9fd4;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 16px;
    border-left: 3px solid var(--sev);
    background: color-mix(in srgb, var(--sev) 9%, transparent);
    font-size: 12px;
    line-height: 1.5;
    min-width: 0;
  }
  .alert + .alert { border-top: 1px solid rgba(255, 255, 255, 0.05); }
  .alert.sev2 { --sev: #e8483c; }
  .alert.sev1 { --sev: #e8a020; }
  .alert.sev0 { --sev: #5a9fd4; }

  .alert-type {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--sev);
    white-space: nowrap;
  }

  .alert-routes {
    display: flex;
    gap: 3px;
    flex-shrink: 0;
  }
  .alert-bullet {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 800;
    color: #fff;
    font-variant-numeric: tabular-nums;
  }

  .alert-header {
    flex: 1;
    min-width: 0;
    color: rgba(255, 255, 255, 0.86);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .alert-when {
    flex-shrink: 0;
    color: rgba(255, 255, 255, 0.4);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .alert-soon {
    font-weight: 800;
    color: var(--sev);
    letter-spacing: 0.08em;
    margin-right: 4px;
  }

  .alert-more {
    padding: 3px 16px;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.02);
  }

  main {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  .panel {
    height: 100%;
    overflow: hidden;
  }

  .map-panel {
    flex: 1;
    border-right: 1px solid var(--border);
  }

  .clock-panel {
    width: 420px;
    flex-shrink: 0;
    background: var(--panel-bg);
    overflow-y: auto;
  }

  .stale-banner {
    position: fixed;
    bottom: 14px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(232, 160, 32, 0.15);
    border: 1px solid rgba(232, 160, 32, 0.35);
    color: #E8A020;
    font-size: 11px;
    letter-spacing: 0.06em;
    padding: 6px 14px;
    border-radius: 20px;
    pointer-events: none;
  }

  /* Responsive: narrow screens stack vertically */
  @media (max-width: 640px) {
    main { flex-direction: column; }
    .map-panel { flex: 1; border-right: none; border-bottom: 1px solid var(--border); }
    .clock-panel { width: 100%; height: 55vh; flex-shrink: 0; }
  }
</style>
