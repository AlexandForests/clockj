// Single source of truth for MTA stations near Hewes St & Broadway, Williamsburg.

export const FEED_URLS = {
  JZ:   'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz',
  BDFM: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm',
  G:    'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g',
};

// Which feed(s) each platform stop appears in
export const PLATFORM_FEED = {
  M14N: ['JZ', 'BDFM'], // J from JZ feed, M from BDFM feed
  M14S: ['JZ', 'BDFM'],
  G30N: ['G'],
  G30S: ['G'],
};

export const LINES = {
  J: { color: '#996633', label: 'J' },
  M: { color: '#FF6319', label: 'M' },
  G: { color: '#6CBE45', label: 'G' },
};

// Which lines serve each platform
export const PLATFORM_LINES = {
  M14N: ['J', 'M'],
  M14S: ['J', 'M'],
  G30N: ['G'],
  G30S: ['G'],
};

// Static destination labels per (platformId, line) — used when RT headsign is absent
export const DESTINATIONS = {
  M14N: { J: 'Manhattan · Broad St', M: 'Manhattan · Forest Hills' },
  M14S: { J: 'Jamaica Center',        M: 'Metropolitan Av' },
  G30N: { G: 'Court Sq' },
  G30S: { G: 'Church Av' },
};

export const STATIONS = {
  Hewes: {
    name: 'Hewes St',
    platforms: {
      M14N: { label: 'Manhattan-bound', stopId: 'M14N' },
      M14S: { label: 'Outbound',        stopId: 'M14S' },
    },
  },
  Broadway: {
    name: 'Broadway',
    platforms: {
      G30N: { label: 'Court Sq',   stopId: 'G30N' },
      G30S: { label: 'Church Av',  stopId: 'G30S' },
    },
  },
};

// Walking minutes from the display's location to each station entrance.
// Drives the "leave now / leave in N" cue. Keyed by STATIONS key.
export const WALK_MINUTES = { Hewes: 5, Broadway: 5 };

// All target stop IDs we care about
export const TARGET_STOPS = new Set(['M14N', 'M14S', 'G30N', 'G30S']);

// Which line IDs each feed produces (for filtering)
export const FEED_LINES = {
  JZ:   new Set(['J', 'Z']),
  BDFM: new Set(['B', 'D', 'F', 'M']),
  G:    new Set(['G']),
};
