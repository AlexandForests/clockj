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

/** Fetch + decode one GTFS-RT feed. Returns [] on any error. */
async function fetchFeed(feedKey, url) {
  let buf;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    buf = new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    console.error(`[clockj] fetch ${feedKey} failed:`, e);
    return [];
  }
  try {
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buf);
    return feed.entity ?? [];
  } catch (e) {
    console.error(`[clockj] decode ${feedKey} failed:`, e);
    return [];
  }
}

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function GET() {
  const now = Math.floor(Date.now() / 1000);

  // Fetch all 3 feeds in parallel
  const [jzEntities, bdfmEntities, gEntities] = await Promise.all([
    fetchFeed('JZ',   FEED_URLS.JZ),
    fetchFeed('BDFM', FEED_URLS.BDFM),
    fetchFeed('G',    FEED_URLS.G),
  ]);

  /** @type {Record<string, Array<{line: string, color: string, minutes: number, destination: string}>>} */
  const result = { M14N: [], M14S: [], G30N: [], G30S: [] };

  /** @param {any[]} entities  @param {Set<string>} allowedLines */
  function processEntities(entities, allowedLines) {
    for (const entity of entities) {
      const tu = entity.tripUpdate;
      if (!tu?.stopTimeUpdate?.length) continue;

      const routeId = String(tu.trip?.routeId ?? '').toUpperCase();
      if (!allowedLines.has(routeId)) continue;

      const lineInfo = LINES[routeId];
      if (!lineInfo) continue;

      const headsign = String(tu.trip?.tripHeadsign ?? '');

      for (const stu of tu.stopTimeUpdate) {
        const stopId = String(stu.stopId ?? '');
        if (!TARGET_STOPS.has(stopId)) continue;

        const dep = toNumber(stu.departure?.time) ?? toNumber(stu.arrival?.time);
        if (dep == null) continue;

        const minutes = Math.round((dep - now) / 60);
        if (minutes < 0) continue; // already departed

        const destination = headsign || DESTINATIONS[stopId]?.[routeId] || '';

        result[stopId].push({
          line: routeId,
          color: lineInfo.color,
          minutes,
          destination,
        });
      }
    }
  }

  processEntities(jzEntities,   FEED_LINES.JZ);
  processEntities(bdfmEntities, FEED_LINES.BDFM);
  processEntities(gEntities,    FEED_LINES.G);

  // Sort each platform's arrivals by minutes, dedupe exact duplicates
  for (const stopId of Object.keys(result)) {
    result[stopId].sort((a, b) => a.minutes - b.minutes);
  }

  return json(result, {
    headers: {
      'Cache-Control': 's-maxage=15, stale-while-revalidate=30',
    },
  });
}
