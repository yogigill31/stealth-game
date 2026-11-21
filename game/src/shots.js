// The screenshot scenes behind ?shot=start|play|alert|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what a short game really looks like and the same seed
// always gives the same frame.
//
// The autopilot plans a route with a breadth-first search over a coarse grid
// (walls and crates block cells, bushes do not), then walks it waypoint by
// waypoint. It waits when the next step would walk into a guard's cone and the
// player is safe where it stands, and flees to the least-seen direction when it
// is already seen. The play scene is a patient pilot; the alert scene is a
// reckless one that walks straight at a guard until it gives chase; the end scene
// is the patient pilot playing all three yards through to the win.
import { FIELD, GUARD, PLAYER, STEP } from './config.js';
import { ALERT_CALM, ALERT_CHASE, EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 34;
const ALERT_LIMIT_SECONDS = 90;
const END_LIMIT_SECONDS = 900;
const SAMPLE_DT = 1 / 12;
const CELL = 40;
const COLS = Math.ceil(FIELD.width / CELL);
const ROWS = Math.ceil(FIELD.height / CELL);
const DIRS = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** Where the pilot wants to go next: nearest loot, the key, or the exit. */
function objective(state) {
  let best = null;
  let bestDist = Infinity;
  for (const item of state.loot) {
    if (item.taken) continue;
    const d = Math.hypot(item.x - state.player.x, item.y - state.player.y);
    if (d < bestDist) {
      bestDist = d;
      best = { x: item.x, y: item.y };
    }
  }
  if (best) return best;
  if (state.key && !state.key.taken) return { x: state.key.x, y: state.key.y };
  return { x: state.exit.x + state.exit.w / 2, y: state.exit.y + state.exit.h / 2 };
}

/** How dangerous (x,y) is: 0 when no guard can see it, up to ~1000 when seen up close. */
function dangerAt(world, x, y) {
  const state = world.state;
  // Inside a bush the player cannot be seen at all, from any position.
  for (const bush of state.bushes) {
    if (x >= bush.x && x <= bush.x + bush.w && y >= bush.y && y <= bush.y + bush.h) return 0;
  }
  let danger = 0;
  for (const guard of state.guards) {
    const dx = x - guard.x;
    const dy = y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist > GUARD.coneRange + 40) continue;
    const inCone = dist < 42 || (Math.abs(((Math.atan2(dy, dx) - guard.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < GUARD.coneHalfAngle);
    if (inCone && world.clearSight(guard.x, guard.y, x, y)) {
      danger += 1000 * (1 - dist / (GUARD.coneRange + 40)) + 300;
    } else if (dist < 90) {
      danger += (90 - dist) * 2;
    }
  }
  return danger;
}

function cellBlocked(state, cx, cy) {
  const x = (cx + 0.5) * CELL;
  const y = (cy + 0.5) * CELL;
  for (const rect of state.solids) {
    const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
    const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
    const dx = x - nearestX;
    const dy = y - nearestY;
    if (dx * dx + dy * dy < (PLAYER.radius + 2) * (PLAYER.radius + 2)) return true;
  }
  return false;
}

/** Distance from (x,y) to the segment a-b. */
function distToSegment(x, y, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((x - a.x) * dx + (y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
}

/** True when (x,y) is close to a guard's patrol line: a route through it would
 * walk the player straight down the line a guard walks. */
function nearPatrol(state, x, y) {
  for (const guard of state.guards) {
    const wps = guard.waypoints;
    for (let i = 0; i < wps.length; i++) {
      if (distToSegment(x, y, wps[i], wps[(i + 1) % wps.length]) < 55) return true;
    }
  }
  return false;
}

/**
 * Breadth-first route from the player to (tx,ty), as cell-centre waypoints with
 * the exact target appended last. Empty when the target cannot be reached.
 */
function findPath(world, tx, ty, avoidPatrol) {
  const state = world.state;
  const startX = Math.min(COLS - 1, Math.max(0, Math.floor(state.player.x / CELL)));
  const startY = Math.min(ROWS - 1, Math.max(0, Math.floor(state.player.y / CELL)));
  const goalX = Math.min(COLS - 1, Math.max(0, Math.floor(tx / CELL)));
  const goalY = Math.min(ROWS - 1, Math.max(0, Math.floor(ty / CELL)));
  const key = (x, y) => y * COLS + x;
  const prev = new Map();
  const queue = [[startX, startY]];
  prev.set(key(startX, startY), null);
  let found = null;
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    // The route starts where the player actually stands, not the centre of its
    // cell: a thin wall can sit inside the player's own cell.
    const centreX = cx === startX && cy === startY ? state.player.x : (cx + 0.5) * CELL;
    const centreY = cx === startX && cy === startY ? state.player.y : (cy + 0.5) * CELL;
    if (Math.hypot(centreX - tx, centreY - ty) < CELL * 0.75) {
      found = [cx, cy];
      break;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (prev.has(key(nx, ny)) || cellBlocked(state, nx, ny)) continue;
      // The step between two cell centres must not cross a wall either: a thin
      // wall can sit inside one cell and still block the way to the next.
      if (!world.clearSight(centreX, centreY, (nx + 0.5) * CELL, (ny + 0.5) * CELL)) continue;
      // Prefer routes that do not walk down a guard's patrol line; the caller
      // retries without this when no such route exists.
      if (avoidPatrol && nearPatrol(state, (nx + 0.5) * CELL, (ny + 0.5) * CELL)) continue;
      prev.set(key(nx, ny), [cx, cy]);
      queue.push([nx, ny]);
    }
  }
  if (found === null) return [];
  const cells = [];
  let cell = found;
  while (cell !== null) {
    cells.push(cell);
    cell = prev.get(key(cell[0], cell[1]));
  }
  cells.reverse();
  const waypoints = cells.slice(1).map(([cx, cy]) => ({ x: (cx + 0.5) * CELL, y: (cy + 0.5) * CELL }));
  waypoints.push({ x: tx, y: ty });
  return waypoints;
}

/**
 * One step of the autopilot. `pilot` keeps the current route between calls.
 * Reckless mode routes straight at the nearest guard instead of the objective.
 */
function autopilot(world, pilot, reckless) {
  const state = world.state;
  // Chased, spotted, or a guard right on top of the player: run for the nearest
  // bush and hide in it until the guard gives up. Committing to the bush beats
  // a one-step dodge, which just oscillates on a patrol line.
  const guardClose = state.guards.some((g) => Math.hypot(g.x - state.player.x, g.y - state.player.y) < 60);
  if (pilot.hiding && state.player.hidden && state.alert === ALERT_CALM) pilot.hiding = false;
  if (state.alert === ALERT_CHASE || guardClose || state.guards.some((g) => g.suspicion > 0.7)) pilot.hiding = true;
  if (!reckless && pilot.hiding) {
    if (state.player.hidden) return { x: 0, y: 0 };
    let bush = null;
    let bushDist = Infinity;
    for (const b of state.bushes) {
      const bx = b.x + b.w / 2;
      const by = b.y + b.h / 2;
      const d = Math.hypot(bx - state.player.x, by - state.player.y);
      if (d < bushDist) {
        bushDist = d;
        bush = { x: bx, y: by };
      }
    }
    if (bush) {
      const targetKey = `bush,${Math.round(bush.x / CELL)},${Math.round(bush.y / CELL)},${state.levelIndex}`;
      if (pilot.targetKey !== targetKey || pilot.route.length === 0) {
        pilot.route = findPath(world, bush.x, bush.y, true);
        if (pilot.route.length === 0) pilot.route = findPath(world, bush.x, bush.y, false);
        pilot.targetKey = targetKey;
      }
      while (pilot.route.length > 0 && Math.hypot(pilot.route[0].x - state.player.x, pilot.route[0].y - state.player.y) < 18) pilot.route.shift();
      const waypoint = pilot.route.length > 0 ? pilot.route[0] : bush;
      const dx = waypoint.x - state.player.x;
      const dy = waypoint.y - state.player.y;
      const dist = Math.hypot(dx, dy) || 1;
      return { x: dx / dist, y: dy / dist };
    }
  }
  const target = reckless
    ? { x: state.guards[0].x, y: state.guards[0].y }
    : objective(state);
  const targetKey = `${Math.round(target.x / CELL)},${Math.round(target.y / CELL)},${state.levelIndex}`;
  if (pilot.targetKey !== targetKey || pilot.route.length === 0 || pilot.replanIn <= 0) {
    pilot.route = findPath(world, target.x, target.y, true);
    if (pilot.route.length === 0) pilot.route = findPath(world, target.x, target.y, false);
    pilot.targetKey = targetKey;
    pilot.replanIn = 45;
  }
  pilot.replanIn -= 1;

  // Drop waypoints already reached.
  while (pilot.route.length > 0) {
    const next = pilot.route[0];
    if (Math.hypot(next.x - state.player.x, next.y - state.player.y) < 18) pilot.route.shift();
    else break;
  }
  const waypoint = pilot.route.length > 0 ? pilot.route[0] : target;
  const dx = waypoint.x - state.player.x;
  const dy = waypoint.y - state.player.y;
  const dist = Math.hypot(dx, dy) || 1;
  const dir = { x: dx / dist, y: dy / dist };

  // Danger check: look along the next stretch of the route, not just the next
  // step — a cone sweeping onto the path a second from now is a reason to wait
  // here, where it is safe, rather than to walk into it.
  const stepLen = PLAYER.walkSpeed * SAMPLE_DT;
  let aheadDanger = 0;
  for (let d = 20; d <= 250; d += 20) {
    aheadDanger = Math.max(aheadDanger, dangerAt(world, state.player.x + dir.x * d, state.player.y + dir.y * d));
  }
  const hereDanger = dangerAt(world, state.player.x, state.player.y);
  if (!reckless && aheadDanger > 150 && hereDanger < 100) return { x: 0, y: 0, sneak: false };
  if (!reckless && hereDanger > 400) {
    // Already seen: flee to the least-seen direction.
    let best = dir;
    let bestDanger = aheadDanger;
    for (const [ox, oy] of DIRS) {
      const len = Math.hypot(ox, oy) || 1;
      const d = dangerAt(world, state.player.x + (ox / len) * stepLen, state.player.y + (oy / len) * stepLen);
      if (d < bestDanger) {
        bestDanger = d;
        best = { x: ox / len, y: oy / len };
      }
    }
    return { ...best, sneak: false };
  }
  // Creep when a guard is close: slower, quieter, and suspicion rises half as fast.
  // Any further away, run: crossing open ground slowly just gives patrols time
  // to sweep back onto the player.
  let nearestGuard = Infinity;
  for (const guard of state.guards) {
    nearestGuard = Math.min(nearestGuard, Math.hypot(guard.x - state.player.x, guard.y - state.player.y));
  }
  return { ...dir, sneak: !reckless && (hereDanger > 0 || nearestGuard < 150) };
}

/**
 * Set `world` to the named scene (start, play, alert or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.resetRun();
  if (name !== 'play' && name !== 'alert' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { x: 0, y: 0 }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const pilot = { route: [], targetKey: '', replanIn: 0 };
  if (name === 'alert') {
    for (let index = 0; index < ALERT_LIMIT_SECONDS / STEP; index += 1) {
      // Walk at the guard, but hold still once close: the guard's suspicion
      // then builds while the player stands in its cone, and the chase starts
      // with the guard still a lunge away — the shot, not a catch.
      const guard = world.state.guards[0];
      const near = Math.hypot(guard.x - world.state.player.x, guard.y - world.state.player.y) < 130;
      const move = near ? { x: 0, y: 0 } : autopilot(world, pilot, true);
      world.step(STEP, move, false);
      if (world.state.alert === ALERT_CHASE) break;
      if (world.state.lives <= 0) break;
    }
    return { screen: world.state.lives <= 0 ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  for (let index = 0; index < limit / STEP; index += 1) {
    const move = autopilot(world, pilot, false);
    const events = world.step(STEP, move, move.sneak === true);
    if (events & EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
    if (events & EVENT_OVER) return { screen: SCREEN_OVER, best: world.state.score };
  }
  return { screen: SCREEN_PLAY, best: world.state.score };
}
