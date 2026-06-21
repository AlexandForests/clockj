import { json } from '@sveltejs/kit';

// MTA service alerts — GTFS-RT in JSON form, no API key (same source the MTA's own
// apps + third parties use). Alerts reference PARENT stop ids (M14, G30), not the
// N/S platform ids the train feeds use.
const ALERTS_URL =
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts.json';

const OUR_STOPS = new Set(['M14', 'G30']);        // Hewes St, Broadway
const OUR_ROUTES = new Set(['J', 'M', 'G', 'Z']); // lines at this corner (Z = rush J variant)
const MERCURY = 'transit_realtime.mercury_alert';
const MAX_ALERTS = 4;

// Higher = more disruptive. Drives sort order and banner color tier.
// 2 = unplanned/severe (red), 1 = planned work / reroute (amber), 0 = informational (blue).
// "Planned -" takes precedence: scheduled work reads amber even when it suspends service.
/** @param {string} type */
function severityOf(type) {
  const t = (type || '').toLowerCase();
  if (t.startsWith('planned')) return 1;
  if (t.includes('suspended') || t.includes('no scheduled') || t.includes('severe') || t.includes('delay'))
    return 2;
  if (t.includes('reroute') || t.includes('reduced')) return 1;
  return 0;
}

/** Pull the plain-English string out of a GTFS translated-text object.
 * @param {any} t */
function enText(t) {
  const tr = t?.translation;
  if (!Array.isArray(tr)) return '';
  return (tr.find((/** @type {any} */ x) => x.language === 'en')?.text ?? tr[0]?.text ?? '');
}

/** Strip MTA placeholder tokens: "[shuttle bus icon]" → "", "[G]" → "G".
 * @param {string} s */
function clean(s) {
  return (s || '')
    .replace(/\[[^\]]*icon[^\]]*\]/gi, '')
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** human_readable_active_period may be a string or a translated-text object.
 * @param {any} v */
function readHRAP(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return enText(v);
}

/** @param {any} raw */
function num(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object' && 'low' in raw) return raw.low;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const ET = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
/** Fallback period string when the feed omits human_readable_active_period.
 * @param {Array<{start?: number, end?: number}>} windows @param {number} nowSec */
function fmtPeriod(windows, nowSec) {
  const w = windows.find((x) => (x.end ?? Infinity) >= nowSec) ?? windows[0];
  if (!w) return '';
  const start = w.start ? ET.format(w.start * 1000) : '';
  const end = w.end ? ET.format(w.end * 1000) : '';
  return end ? `${start} – ${end}` : start;
}

/**
 * Decide whether an alert should be visible now, and whether it's active or upcoming.
 * @param {Array<{start?: number, end?: number}>} windows
 * @param {number} leadSec  how far ahead of start to begin showing (MTA's display_before_active)
 * @param {number} nowSec
 * @returns {{status: 'active' | 'upcoming', startsAt: number | null} | null}
 */
function windowStatus(windows, leadSec, nowSec) {
  let upcomingStart = Infinity;
  for (const w of windows) {
    const start = w.start ?? -Infinity;
    const end = w.end ?? Infinity;
    if (start <= nowSec && nowSec <= end) return { status: 'active', startsAt: null };
    if (nowSec < start && nowSec >= start - leadSec) upcomingStart = Math.min(upcomingStart, start);
  }
  if (upcomingStart !== Infinity) return { status: 'upcoming', startsAt: upcomingStart };
  return null;
}

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function GET() {
  const nowSec = Math.floor(Date.now() / 1000);

  /** @type {any} */
  let feed;
  try {
    const res = await fetch(ALERTS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    feed = await res.json();
  } catch (e) {
    console.error('[clockj] fetch alerts failed:', e);
    return json({ alerts: [], ok: false }, { headers: { 'Cache-Control': 'no-store' } });
  }

  /** @type {Array<{id: string, type: string, severity: number, status: string, routes: string[], header: string, period: string, updatedAt: number | null, startsAt: number | null}>} */
  const alerts = [];

  for (const entity of feed.entity ?? []) {
    const a = entity.alert;
    if (!a) continue;
    const informed = a.informed_entity ?? [];

    // Relevant if it names one of our stations, or is a line-wide alert on our routes.
    let relevant = false;
    let routeWide = false;
    /** @type {Set<string>} */
    const routes = new Set();
    for (const ie of informed) {
      if (ie.route_id && OUR_ROUTES.has(ie.route_id)) {
        routes.add(ie.route_id);
        if (!ie.stop_id) routeWide = true;
      }
      if (ie.stop_id && OUR_STOPS.has(ie.stop_id)) relevant = true;
    }
    if (!relevant && !(routeWide && routes.size)) continue;
    if (routes.size === 0) continue;

    const merc = a[MERCURY] ?? {};
    const lead = num(merc.display_before_active) ?? 0;
    const when = windowStatus(a.active_period ?? [], lead, nowSec);
    if (!when) continue;

    const type = merc.alert_type ?? 'Service Change';
    alerts.push({
      id: String(entity.id ?? ''),
      type,
      severity: severityOf(type),
      status: when.status,
      routes: [...routes].sort(),
      header: clean(enText(a.header_text)),
      period: readHRAP(merc.human_readable_active_period) || fmtPeriod(a.active_period ?? [], nowSec),
      updatedAt: num(merc.updated_at),
      startsAt: when.startsAt ? when.startsAt * 1000 : null,
    });
  }

  // Active before upcoming; then most disruptive first; then soonest upcoming.
  alerts.sort((x, y) => {
    if (x.status !== y.status) return x.status === 'active' ? -1 : 1;
    if (x.severity !== y.severity) return y.severity - x.severity;
    return (x.startsAt ?? 0) - (y.startsAt ?? 0);
  });

  return json(
    { alerts: alerts.slice(0, MAX_ALERTS), total: alerts.length, ok: true },
    { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' } }
  );
}
