<script>
  import { onMount } from 'svelte';
  import StationMap from '$lib/StationMap.svelte';
  import Clocks from '$lib/Clocks.svelte';

  let freshnessAt = $state(0); // ms when data was last fetched successfully

  // Freshness: amber when data is >60s old.
  // tick read here so these recompute every second without {#key} DOM remounts.
  const isStale   = $derived(tick >= 0 && freshnessAt > 0 && Date.now() - freshnessAt > 60_000);
  const hasData   = $derived(freshnessAt > 0);
  const staleSecs = $derived(tick >= 0 ? Math.round((Date.now() - freshnessAt) / 1000) : 0);

  // Clock string for header
  let clockStr = $state('');

  // Pixel-shift: slow drift to prevent burn-in on static screens
  let shiftX = $state(0);
  let shiftY = $state(0);

  // Overnight dim: dim between 23:00 and 06:00
  let isDim = $state(false);

  // Force stale re-derive every second
  let tick = $state(0);

  onMount(() => {
    // 1s clock + stale check + dim update
    const clockTick = setInterval(() => {
      const now = new Date();
      clockStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      const h = now.getHours();
      isDim = h >= 23 || h < 6;
      tick++;
    }, 1_000);

    // Pixel-shift: drift ±4px over ~60s in a Lissajous pattern
    const shiftTick = setInterval(() => {
      const t = Date.now() / 1000;
      shiftX = Math.round(Math.sin(t / 17) * 4);
      shiftY = Math.round(Math.cos(t / 23) * 4);
    }, 5_000);

    // Wake Lock
    let wakeLock = null;
    async function acquireWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (_) { /* silently ignored on non-supporting browsers */ }
    }
    acquireWakeLock();
    // Re-acquire after page visibility change (Wake Lock releases on tab hide)
    const onVisible = () => { if (document.visibilityState === 'visible') acquireWakeLock(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
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
  class:dim={isDim}
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

  <!-- Split layout: map left, clocks right -->
  <main>
    <div class="panel map-panel">
      <StationMap />
    </div>
    <div class="panel clock-panel">
      <Clocks onFreshness={(t) => { freshnessAt = t; }} />
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
    transition: opacity 1s;
  }

  .shell.dim {
    opacity: 0.35;
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
