// SHADOWLINE — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size. A night freight yard seen
// from above: dark floor, lit cones, crates for cover, bushes as shadow.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 205,
  sneakSpeed: 95,
  /** How close a guard must be to hear a running (not sneaking) player. */
  noiseRadius: 150,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 78,
  chaseSpeed: 235,
  /** Vision cone: how far a guard sees, and its half-angle in radians. */
  coneRange: 235,
  coneHalfAngle: 0.62,
  /** Suspicion per second while the player stands in the cone, in clear sight. */
  suspicionRate: 1.05,
  /** Suspicion per second from hearing a running player nearby. */
  noiseRate: 0.35,
  suspicionDecay: 0.45,
  /** At this suspicion the guard stops and stares; at 1 it gives chase. */
  suspiciousAt: 0.55,
  /** Seconds of lost sight before a chasing guard gives up. */
  chaseGiveUp: 3.0,
  /** Caught when a chasing guard gets this close. */
  catchDistance: 27,
  /** Seconds a guard waits at each patrol waypoint. */
  waypointPause: 0.9,
};

export const LIVES = 3;

export const LOOT_POINTS = 100;
export const TIME_BONUS_PER_SECOND = 5;

export const PALETTE = {
  backdrop: '#070a12',
  floorA: '#141a26',
  floorB: '#111623',
  floorLine: '#1c2436',
  wall: '#2e3a52',
  wallTop: '#46587c',
  crate: '#6b4f2a',
  crateTop: '#8a6a3c',
  bush: '#14301f',
  bushLeaf: '#1e4d2c',
  exit: '#39d98a',
  exitGlow: '#39d98a',
  key: '#ffd94d',
  loot: '#ffd94d',
  player: '#4fc3f7',
  playerCloak: '#1b6f9e',
  guard: '#ff5a4e',
  guardDark: '#a83228',
  conePatrol: 'rgba(242, 201, 76, 0.20)',
  coneSuspicious: 'rgba(255, 150, 40, 0.32)',
  coneChase: 'rgba(255, 70, 60, 0.38)',
  coneEdge: 'rgba(242, 201, 76, 0.55)',
  text: '#eef1f5',
  muted: '#8b93a3',
  panel: '#171d2b',
  panelEdge: '#2c3750',
  danger: '#ff5a4e',
  warn: '#ffb02e',
  safe: '#39d98a',
  minimapBg: 'rgba(10, 14, 24, 0.82)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'shadowline.best';
