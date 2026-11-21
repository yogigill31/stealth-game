// The rules of SHADOWLINE, with no drawing and no browser in it: the player, the
// patrolling guards and their vision cones, suspicion and chase, cover, loot, the
// locked door and the exit. step() advances one fixed step and returns what
// happened as bit flags, so the caller can react (sound, announcements) without
// the world knowing about screens. Vision is honest: a guard only sees the player
// inside its cone with a clear line of sight, and never inside a bush.
import { FIELD, GUARD, LIVES, LOOT_POINTS, PLAYER, TIME_BONUS_PER_SECOND } from './config.js';
import { LEVELS } from './levels.js';

export const EVENT_PICKUP = 1;
export const EVENT_KEY = 2;
export const EVENT_ALERT = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_LEVEL = 16;
export const EVENT_WIN = 32;
export const EVENT_OVER = 64;

export const ALERT_CALM = 0;
export const ALERT_SUSPICIOUS = 1;
export const ALERT_CHASE = 2;

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return Math.abs(d);
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

/** True when the segment (x1,y1)-(x2,y2) touches the rectangle (slab test). */
function segmentHitsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (dx === 0) {
    if (x1 < rect.x || x1 > rect.x + rect.w) return false;
  } else {
    let t1 = (rect.x - x1) / dx;
    let t2 = (rect.x + rect.w - x1) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (dy === 0) {
    if (y1 < rect.y || y1 > rect.y + rect.h) return false;
  } else {
    let t1 = (rect.y - y1) / dy;
    let t2 = (rect.y + rect.h - y1) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

/** Distance along a ray (x,y)+t*(cos,sin) to the rectangle, or Infinity. */
function rayRectDistance(x, y, cos, sin, rect) {
  let tmin = 0;
  let tmax = Infinity;
  if (cos === 0) {
    if (x < rect.x || x > rect.x + rect.w) return Infinity;
  } else {
    let t1 = (rect.x - x) / cos;
    let t2 = (rect.x + rect.w - x) / cos;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  if (sin === 0) {
    if (y < rect.y || y > rect.y + rect.h) return Infinity;
  } else {
    let t1 = (rect.y - y) / sin;
    let t2 = (rect.y + rect.h - y) / sin;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    level: LEVELS[0],
    player: { x: 0, y: 0, angle: 0, moving: false, sneaking: false, hidden: false },
    guards: [],
    loot: [],
    key: null,
    keyTaken: false,
    doorOpen: false,
    exit: null,
    walls: [],
    crates: [],
    bushes: [],
    solids: [],
    particles: [],
    collectedLoot: new Set(),
    keysKept: new Set(),
    score: 0,
    lootCollected: 0,
    lootLevel: 0,
    lootTotal: 0,
    lootTotalAll: 0,
    lives: LIVES,
    elapsed: 0,
    levelTime: 0,
    shake: 0,
    alert: ALERT_CALM,
    alertFlash: 0,
    won: false,
    levelComplete: false,
    stepCount: 0,
  };

  function loadLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    state.player.x = level.playerStart.x;
    state.player.y = level.playerStart.y;
    state.player.angle = -Math.PI / 2;
    state.player.hidden = false;
    state.exit = { ...level.exit };
    state.walls = level.walls.map((r) => ({ ...r }));
    state.crates = level.crates.map((r) => ({ ...r }));
    state.bushes = level.bushes.map((r) => ({ ...r }));
    state.loot = level.loot.map((p, i) => ({ x: p.x, y: p.y, taken: state.collectedLoot.has(`${index}:${i}`), bob: random() * TAU }));
    state.lootTotal = state.loot.length;
    // Loot already stolen in this run stays stolen across a death: count it, so
    // the HUD never shows 0/6 on a yard the player already cleared.
    state.lootLevel = state.loot.filter((item) => item.taken).length;
    state.key = level.key ? { ...level.key, taken: state.keysKept.has(index) } : null;
    state.keyTaken = state.key !== null && state.key.taken;
    state.doorOpen = state.keyTaken;
    state.guards = level.guards.map((g) => ({
      x: g.x,
      y: g.y,
      angle: 0,
      speed: g.speed,
      waypoints: g.waypoints.map((w) => ({ ...w })),
      waypointIndex: 1 % g.waypoints.length,
      pause: 0,
      state: 'patrol',
      suspicion: 0,
      lostSight: 0,
      lastSeenX: g.x,
      lastSeenY: g.y,
      returnRoute: [],
      returnIndex: 0,
      chaseX: g.x,
      chaseY: g.y,
    }));
    for (const guard of state.guards) {
      const next = guard.waypoints[guard.waypointIndex];
      guard.angle = Math.atan2(next.y - guard.y, next.x - guard.x);
    }
    rebuildSolids();
    state.levelTime = 0;
    state.alert = ALERT_CALM;
    state.levelComplete = false;
  }

  function rebuildSolids() {
    state.solids = [...state.walls, ...state.crates];
    if (state.level.door && !state.doorOpen) state.solids.push({ ...state.level.door });
  }

  function circleHitsSolid(x, y, radius) {
    for (const rect of state.solids) {
      const nearestX = clamp(x, rect.x, rect.x + rect.w);
      const nearestY = clamp(y, rect.y, rect.y + rect.h);
      const dx = x - nearestX;
      const dy = y - nearestY;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
    return false;
  }

  /** True when nothing solid stands between (x1,y1) and (x2,y2). */
  function clearSight(x1, y1, x2, y2) {
    for (const rect of state.solids) {
      if (segmentHitsRect(x1, y1, x2, y2, rect)) return false;
    }
    return true;
  }

  /** Distance from (x,y) along `angle` to the nearest solid, capped at maxDist. */
  function castRay(x, y, angle, maxDist) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let best = maxDist;
    for (const rect of state.solids) {
      const d = rayRectDistance(x, y, cos, sin, rect);
      if (d < best) best = d;
    }
    return best;
  }

  /** A route for a guard to walk back to its patrol: breadth-first over a coarse
   * grid, so a guard that chased around a wall does not get wedged against it
   * trying to walk straight home. Returns cell-centre waypoints, target last. */
  const ROUTE_CELL = 40;
  function findRoute(fromX, fromY, toX, toY, radius) {
    const cols = Math.ceil(FIELD.width / ROUTE_CELL);
    const rows = Math.ceil(FIELD.height / ROUTE_CELL);
    const startX = Math.min(cols - 1, Math.max(0, Math.floor(fromX / ROUTE_CELL)));
    const startY = Math.min(rows - 1, Math.max(0, Math.floor(fromY / ROUTE_CELL)));
    const key = (x, y) => y * cols + x;
    const cellBlocked = (cx, cy) => {
      const x = (cx + 0.5) * ROUTE_CELL;
      const y = (cy + 0.5) * ROUTE_CELL;
      for (const rect of state.solids) {
        const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
        const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
        const dx = x - nearestX;
        const dy = y - nearestY;
        if (dx * dx + dy * dy < (radius + 2) * (radius + 2)) return true;
      }
      return false;
    };
    const prev = new Map();
    const queue = [[startX, startY]];
    prev.set(key(startX, startY), null);
    let found = null;
    while (queue.length > 0) {
      const [cx, cy] = queue.shift();
      const centreX = cx === startX && cy === startY ? fromX : (cx + 0.5) * ROUTE_CELL;
      const centreY = cx === startX && cy === startY ? fromY : (cy + 0.5) * ROUTE_CELL;
      if (Math.hypot(centreX - toX, centreY - toY) < ROUTE_CELL * 0.75) {
        found = [cx, cy];
        break;
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        if (prev.has(key(nx, ny)) || cellBlocked(nx, ny)) continue;
        if (!clearSight(centreX, centreY, (nx + 0.5) * ROUTE_CELL, (ny + 0.5) * ROUTE_CELL)) continue;
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
    const waypoints = cells.slice(1).map(([cx, cy]) => ({ x: (cx + 0.5) * ROUTE_CELL, y: (cy + 0.5) * ROUTE_CELL }));
    waypoints.push({ x: toX, y: toY });
    return waypoints;
  }

  function playerInBush() {
    for (const bush of state.bushes) {
      if (pointInRect(state.player.x, state.player.y, bush)) return true;
    }
    return false;
  }

  /** Can this guard see the player right now? Returns 0 (no) or a 0..1 closeness. */
  function guardSees(guard) {
    const dx = state.player.x - guard.x;
    const dy = state.player.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist > GUARD.coneRange) return 0;
    // Bumping into a guard is seen, cone or not.
    if (dist < 42) return 1;
    const toPlayer = Math.atan2(dy, dx);
    if (angleDiff(toPlayer, guard.angle) > GUARD.coneHalfAngle) return 0;
    if (!clearSight(guard.x, guard.y, state.player.x, state.player.y)) return 0;
    return 1 - dist / GUARD.coneRange;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * TAU;
      const v = speed * (0.4 + random() * 0.8);
      state.particles.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, life: 0.5 + random() * 0.4, max: 0.9, color });
    }
  }

  function resetRun() {
    state.score = 0;
    state.lootCollected = 0;
    state.collectedLoot.clear();
    state.keysKept.clear();
    state.lootTotalAll = LEVELS.reduce((sum, level) => sum + level.loot.length, 0);
    state.lives = LIVES;
    state.elapsed = 0;
    state.won = false;
    state.particles.length = 0;
    loadLevel(0);
  }

  function respawnAfterCaught() {
    state.lives -= 1;
    state.shake = 1;
    burst(state.player.x, state.player.y, '#ff5a4e', 26, 260);
    if (state.lives <= 0) return EVENT_OVER;
    loadLevel(state.levelIndex);
    return EVENT_CAUGHT;
  }

  /**
   * One fixed step. `move` is {x, y} (unit-ish direction) and `sneak` is true while
   * the player creeps. Returns bit flags of what happened this step.
   */
  function step(dt, move, sneak) {
    let events = 0;
    state.stepCount += 1;
    state.elapsed += dt;
    state.levelTime += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.2);
    if (state.alertFlash > 0) state.alertFlash = Math.max(0, state.alertFlash - dt);

    // --- player movement, axis by axis so walls slide instead of snagging ---
    const speed = sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const len = Math.hypot(move.x, move.y);
    const nx = len > 0 ? move.x / len : 0;
    const ny = len > 0 ? move.y / len : 0;
    const player = state.player;
    player.moving = len > 0;
    player.sneaking = sneak && len > 0;
    if (len > 0) {
      player.angle = Math.atan2(ny, nx);
      const tryX = player.x + nx * speed * dt;
      if (!circleHitsSolid(tryX, player.y, PLAYER.radius)) player.x = tryX;
      const tryY = player.y + ny * speed * dt;
      if (!circleHitsSolid(player.x, tryY, PLAYER.radius)) player.y = tryY;
    }
    player.x = clamp(player.x, PLAYER.radius, FIELD.width - PLAYER.radius);
    player.y = clamp(player.y, PLAYER.radius, FIELD.height - PLAYER.radius);
    player.hidden = playerInBush();

    // --- loot, key, exit ---
    for (let index = 0; index < state.loot.length; index += 1) {
      const item = state.loot[index];
      if (item.taken) continue;
      item.bob += dt * 3;
      const dx = player.x - item.x;
      const dy = player.y - item.y;
      if (dx * dx + dy * dy < (PLAYER.radius + 16) * (PLAYER.radius + 16)) {
        item.taken = true;
        state.collectedLoot.add(`${state.levelIndex}:${index}`);
        state.lootCollected += 1;
        state.lootLevel += 1;
        state.score += LOOT_POINTS;
        burst(item.x, item.y, '#ffd94d', 14, 170);
        events |= EVENT_PICKUP;
      }
    }
    if (state.key && !state.key.taken) {
      const dx = player.x - state.key.x;
      const dy = player.y - state.key.y;
      if (dx * dx + dy * dy < (PLAYER.radius + 18) * (PLAYER.radius + 18)) {
        state.key.taken = true;
        state.keysKept.add(state.levelIndex);
        state.keyTaken = true;
        state.doorOpen = true;
        rebuildSolids();
        burst(state.key.x, state.key.y, '#ffd94d', 18, 200);
        events |= EVENT_KEY;
      }
    }
    if (pointInRect(player.x, player.y, state.exit) && (!state.level.door || state.doorOpen)) {
      state.score += Math.max(0, Math.round(120 - state.levelTime) * TIME_BONUS_PER_SECOND);
      state.levelComplete = true;
      if (state.levelIndex + 1 >= LEVELS.length) {
        state.won = true;
        return events | EVENT_WIN;
      }
      loadLevel(state.levelIndex + 1);
      return events | EVENT_LEVEL;
    }

    // --- guards: patrol, suspicion, chase ---
    let anyChase = false;
    let anySuspicious = false;
    for (const guard of state.guards) {
      const seen = player.hidden ? 0 : guardSees(guard);
      if (seen > 0) {
        guard.lastSeenX = player.x;
        guard.lastSeenY = player.y;
        const rate = GUARD.suspicionRate * (0.35 + 0.65 * seen) * (player.sneaking ? 0.55 : 1);
        guard.suspicion = Math.min(1, guard.suspicion + rate * dt);
        guard.lostSight = 0;
      } else {
        // A running player nearby is heard even out of sight.
        const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
        if (player.moving && !player.sneaking && dist < PLAYER.noiseRadius) {
          guard.suspicion = Math.min(1, guard.suspicion + GUARD.noiseRate * dt);
        } else {
          guard.suspicion = Math.max(0, guard.suspicion - GUARD.suspicionDecay * dt);
        }
        if (guard.state === 'chase') guard.lostSight += dt;
      }

      if (guard.state !== 'chase' && guard.suspicion >= 1) {
        guard.state = 'chase';
        guard.lostSight = 0;
        state.alertFlash = 1;
        events |= EVENT_ALERT;
      } else if (guard.state === 'patrol' && guard.suspicion >= GUARD.suspiciousAt) {
        guard.state = 'suspicious';
      } else if (guard.state === 'suspicious' && guard.suspicion < GUARD.suspiciousAt * 0.6) {
        guard.state = 'patrol';
      }

      if (guard.state === 'chase') {
        anyChase = true;
        // A chasing guard runs at where it last saw the player — never at a
        // player hidden in a bush, which it cannot see at all.
        const targetX = player.hidden ? guard.lastSeenX : player.x;
        const targetY = player.hidden ? guard.lastSeenY : player.y;
        const dx = targetX - guard.x;
        const dy = targetY - guard.y;
        const dist = Math.hypot(dx, dy);
        if (dist < GUARD.catchDistance && !player.hidden) {
          events |= respawnAfterCaught();
          if (events & EVENT_OVER) return events;
          break;
        }
        if (guard.lostSight > GUARD.chaseGiveUp) {
          // Walk home by a route, not a straight line: a straight line back
          // can run through the wall the chase just went around.
          let nearest = 0;
          let nearestDist = Infinity;
          for (let i = 0; i < guard.waypoints.length; i += 1) {
            const d = Math.hypot(guard.waypoints[i].x - guard.x, guard.waypoints[i].y - guard.y);
            if (d < nearestDist) {
              nearestDist = d;
              nearest = i;
            }
          }
          guard.returnRoute = findRoute(guard.x, guard.y, guard.waypoints[nearest].x, guard.waypoints[nearest].y, GUARD.radius);
          guard.returnIndex = nearest;
          guard.state = 'returning';
          guard.suspicion = 0.35;
        } else if (dist > 0.5) {
          // Axis by axis, like the player: slide along a wall while chasing
          // instead of stopping dead against it.
          const stepLen = Math.min(dist, GUARD.chaseSpeed * dt);
          const gx = guard.x + (dx / dist) * stepLen;
          if (!circleHitsSolid(gx, guard.y, GUARD.radius)) guard.x = gx;
          const gy = guard.y + (dy / dist) * stepLen;
          if (!circleHitsSolid(guard.x, gy, GUARD.radius)) guard.y = gy;
          guard.angle = Math.atan2(dy, dx);
        }
      } else if (guard.state === 'returning') {
        // Walk the route home; on arrival, resume the patrol from that waypoint.
        if (guard.returnRoute.length === 0) {
          guard.state = 'patrol';
          guard.waypointIndex = guard.returnIndex;
        } else {
          const target = guard.returnRoute[0];
          const dx = target.x - guard.x;
          const dy = target.y - guard.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 10) {
            guard.returnRoute.shift();
          } else {
            const stepLen = guard.speed * dt;
            const gx = guard.x + (dx / dist) * stepLen;
            if (!circleHitsSolid(gx, guard.y, GUARD.radius)) guard.x = gx;
            const gy = guard.y + (dy / dist) * stepLen;
            if (!circleHitsSolid(guard.x, gy, GUARD.radius)) guard.y = gy;
            guard.angle = Math.atan2(dy, dx);
          }
        }
      } else if (guard.state === 'suspicious') {
        anySuspicious = true;
        // Stare at where the player was last seen.
        guard.angle = Math.atan2(player.y - guard.y, player.x - guard.x);
      } else {
        // Patrol: walk to the waypoint, wait, walk to the next.
        if (guard.pause > 0) {
          guard.pause -= dt;
        } else {
          const target = guard.waypoints[guard.waypointIndex];
          const dx = target.x - guard.x;
          const dy = target.y - guard.y;
          const dist = Math.hypot(dx, dy);
          const stepLen = guard.speed * dt;
          if (dist <= Math.max(stepLen, 6)) {
            guard.x = target.x;
            guard.y = target.y;
            guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
            guard.pause = GUARD.waypointPause;
            const next = guard.waypoints[guard.waypointIndex];
            guard.angle = Math.atan2(next.y - guard.y, next.x - guard.x);
          } else {
            // Axis by axis, like the player: a guard slides along a wall instead
            // of phasing through it when a waypoint leg grazes a solid.
            const gx = guard.x + (dx / dist) * stepLen;
            if (!circleHitsSolid(gx, guard.y, GUARD.radius)) guard.x = gx;
            const gy = guard.y + (dy / dist) * stepLen;
            if (!circleHitsSolid(guard.x, gy, GUARD.radius)) guard.y = gy;
            guard.angle = Math.atan2(dy, dx);
          }
        }
      }
    }
    state.alert = anyChase ? ALERT_CHASE : anySuspicious ? ALERT_SUSPICIOUS : ALERT_CALM;

    // --- particles ---
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    return events;
  }

  resetRun();
  return { state, step, resetRun, loadLevel, castRay, clearSight, guardSees };
}
