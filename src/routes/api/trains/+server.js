import { json } from '@sveltejs/kit';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { FEED_URLS, TARGET_STOPS, DESTINATIONS, LINES, FEED_LINES } from '$lib/stations.js';

const FEEDS = Object.entries(FEED_URLS); // [['JZ', url], ['BDFM', url], ['G', url]]

/** @param {any} raw  int64 guard — GTFS-RT timestamps can decode as Long objects */
function toNumber(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object' && 'low' in raw) return raw.low;
  return Number(raw);
}

/**
 * Fetch + decode one GTFS-RT feed. `ok` is false on any fetch/decode error so the
 * UI can tell "feed unavailable" apart from "genuinely no trains".
 * @param {string} feedKey
 * @param {string} url
 * @returns {Promise<{ok: boolean, entities: any[]}>}
 */
async function fetchFeed(feedKey, url) {
  let buf;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    buf = new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    console.error(`[clockj] fetch ${feedKey} failed:`, e);
    return { ok: false, entities: [] };
  }
  try {
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buf);
    return { ok: true, entities: feed.entity ?? [] };
  } catch (e) {
    console.error(`[clockj] decode ${feedKey} failed:`, e);
    return { ok: false, entities: [] };
  }
}

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function GET() {
  const now = Math.floor(Date.now() / 1000);

  // Fetch all 3 feeds in parallel
  const [jz, bdfm, g] = await Promise.all([
    fetchFeed('JZ',   FEED_URLS.JZ),
    fetchFeed('BDFM', FEED_URLS.BDFM),
    fetchFeed('G',    FEED_URLS.G),
  ]);

  /** @type {Record<string, Array<{line: string, color: string, minutes: number, arrivalTime: number, tripId: string, stopSequence: number | null, destination: string}>>} */
  const result = { M14N: [], M14S: [], G30N: [], G30S: [] };

  /** @param {any[]} entities  @param {Set<string>} allowedLines */
  function processEntities(entities, allowedLines) {
    for (const entity of entities) {
      const tu = entity.tripUpdate;
      if (!tu?.stopTimeUpdate?.length) continue;

      const routeId = String(tu.trip?.routeId ?? '').toUpperCase();
      if (!allowedLines.has(routeId)) continue;

      const lineInfo = LINES[/** @type {keyof typeof LINES} */ (routeId)];
      if (!lineInfo) continue;

      const headsign = String(tu.trip?.tripHeadsign ?? '');
      const tripId = String(tu.trip?.tripId ?? entity.id ?? '');

      for (const stu of tu.stopTimeUpdate) {
        const stopId = String(stu.stopId ?? '');
        if (!TARGET_STOPS.has(stopId)) continue;

        const dep = toNumber(stu.departure?.time) ?? toNumber(stu.arrival?.time);
        if (dep == null) continue;

        const minutes = Math.round((dep - now) / 60);
        if (minutes < 0) continue; // already departed

        const stopDestinations = DESTINATIONS[/** @type {keyof typeof DESTINATIONS} */ (stopId)];
        const destination = headsign || stopDestinations?.[/** @type {keyof typeof stopDestinations} */ (routeId)] || '';

        result[stopId].push({
          line: routeId,
          color: lineInfo.color,
          minutes,
          arrivalTime: dep * 1000,
          tripId,
          stopSequence: toNumber(stu.stopSequence),
          destination,
        });
      }
    }
  }

  processEntities(jz.entities,   FEED_LINES.JZ);
  processEntities(bdfm.entities, FEED_LINES.BDFM);
  processEntities(g.entities,    FEED_LINES.G);

  // Sort each platform's arrivals soonest-first
  for (const stopId of Object.keys(result)) {
    result[stopId].sort((a, b) => a.minutes - b.minutes);
  }

  return json(
    { platforms: result, meta: { feeds: { JZ: jz.ok, BDFM: bdfm.ok, G: g.ok } } },
    {
      headers: {
        'Cache-Control': 's-maxage=15, stale-while-revalidate=30',
      },
    }
  );
}
