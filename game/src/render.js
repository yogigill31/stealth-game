// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. Night yard: dark floor tiles, walls with lit tops,
// crates, bushes as shadow blobs, glowing exit, and each guard's vision cone drawn
// ray by ray so walls and crates cut it short — what you see is what the guard sees.
import { FIELD, FONT, GUARD, LIVES, PALETTE, PLAYER } from './config.js';
import { ALERT_CALM, ALERT_CHASE, ALERT_SUSPICIOUS } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';
export const SCREEN_LEVEL = 'level';

const PANEL = { width: 640, top: 132, line: 32, bottom: 72 };
const CONE_RAYS = 26;

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas, world) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const lootLabel = cachedLabel('LOOT ');
  const levelLabel = cachedLabel('LEVEL ');
  const timeLabel = cachedLabel('TIME ');
  const finalLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function drawFloor() {
    context.fillStyle = PALETTE.floorA;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.floorB;
    const tile = 80;
    for (let y = 0; y < FIELD.height; y += tile) {
      for (let x = 0; x < FIELD.width; x += tile) {
        if (((x + y) / tile) % 2 === 0) context.fillRect(x, y, tile, tile);
      }
    }
    context.strokeStyle = PALETTE.floorLine;
    context.lineWidth = 1;
    for (let x = 0; x <= FIELD.width; x += tile) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, FIELD.height);
      context.stroke();
    }
    for (let y = 0; y <= FIELD.height; y += tile) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
      context.stroke();
    }
  }

  function drawWalls(state) {
    for (const wall of state.walls) {
      context.fillStyle = PALETTE.wall;
      context.fillRect(wall.x, wall.y, wall.w, wall.h);
      context.fillStyle = PALETTE.wallTop;
      context.fillRect(wall.x, wall.y, wall.w, 4);
    }
    if (state.level.door && !state.doorOpen) {
      const door = state.level.door;
      context.fillStyle = '#7a5c1e';
      context.fillRect(door.x, door.y, door.w, door.h);
      context.fillStyle = PALETTE.key;
      context.beginPath();
      context.arc(door.x + door.w / 2, door.y + door.h / 2, 6, 0, Math.PI * 2);
      context.fill();
    }
    for (const crate of state.crates) {
      context.fillStyle = PALETTE.crate;
      context.fillRect(crate.x, crate.y, crate.w, crate.h);
      context.fillStyle = PALETTE.crateTop;
      context.fillRect(crate.x, crate.y, crate.w, 5);
      context.fillRect(crate.x, crate.y, 5, crate.h);
      context.strokeStyle = 'rgba(0,0,0,0.35)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(crate.x, crate.y);
      context.lineTo(crate.x + crate.w, crate.y + crate.h);
      context.moveTo(crate.x + crate.w, crate.y);
      context.lineTo(crate.x, crate.y + crate.h);
      context.stroke();
    }
  }

  function drawBushes(state) {
    for (const bush of state.bushes) {
      context.fillStyle = PALETTE.bush;
      context.beginPath();
      context.ellipse(bush.x + bush.w / 2, bush.y + bush.h / 2, bush.w / 2, bush.h / 2, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.bushLeaf;
      const cx = bush.x + bush.w / 2;
      const cy = bush.y + bush.h / 2;
      for (const [ox, oy, r] of [[-28, -12, 16], [0, -18, 18], [28, -10, 15], [-18, 14, 15], [20, 14, 16], [0, 4, 14]]) {
        context.beginPath();
        context.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawExit(state) {
    const exit = state.exit;
    const pulse = 0.6 + 0.4 * Math.sin(state.elapsed * 3);
    context.fillStyle = `rgba(57, 217, 138, ${0.25 + 0.25 * pulse})`;
    context.fillRect(exit.x - 8, exit.y - 8, exit.w + 16, exit.h + 16);
    context.fillStyle = PALETTE.exit;
    context.fillRect(exit.x, exit.y, exit.w, exit.h);
    context.fillStyle = '#0a2016';
    text('EXIT', exit.x + exit.w / 2, exit.y + exit.h / 2 + 7, 20, '#0a2016', 'center');
    if (state.level.door && !state.doorOpen) {
      context.fillStyle = PALETTE.warn;
      text('LOCKED', exit.x + exit.w / 2, exit.y - 10, 15, PALETTE.warn, 'center');
    }
  }

  function drawPickups(state) {
    for (const item of state.loot) {
      if (item.taken) continue;
      const bob = Math.sin(item.bob) * 3;
      context.save();
      context.translate(item.x, item.y + bob);
      context.rotate(Math.PI / 4);
      context.fillStyle = PALETTE.loot;
      context.fillRect(-8, -8, 16, 16);
      context.fillStyle = 'rgba(255,255,255,0.55)';
      context.fillRect(-8, -8, 16, 5);
      context.restore();
    }
    if (state.key && !state.key.taken) {
      const glow = 0.5 + 0.5 * Math.sin(state.elapsed * 5);
      context.fillStyle = `rgba(255, 217, 77, ${0.25 + 0.2 * glow})`;
      context.beginPath();
      context.arc(state.key.x, state.key.y, 26, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.key;
      context.beginPath();
      context.arc(state.key.x - 4, state.key.y, 7, 0, Math.PI * 2);
      context.fill();
      context.fillRect(state.key.x + 2, state.key.y - 2, 16, 4);
      context.fillRect(state.key.x + 12, state.key.y + 2, 4, 7);
      context.fillRect(state.key.x + 18, state.key.y + 2, 4, 7);
    }
  }

  function drawCone(guard) {
    const color = guard.state === 'chase'
      ? PALETTE.coneChase
      : guard.state === 'suspicious' ? PALETTE.coneSuspicious : PALETTE.conePatrol;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(guard.x, guard.y);
    for (let i = 0; i <= CONE_RAYS; i += 1) {
      const angle = guard.angle - GUARD.coneHalfAngle + (2 * GUARD.coneHalfAngle * i) / CONE_RAYS;
      const dist = world.castRay(guard.x, guard.y, angle, GUARD.coneRange);
      context.lineTo(guard.x + Math.cos(angle) * dist, guard.y + Math.sin(angle) * dist);
    }
    context.closePath();
    context.fill();
    context.strokeStyle = guard.state === 'chase' ? 'rgba(255,70,60,0.7)' : PALETTE.coneEdge;
    context.lineWidth = 1.5;
    context.stroke();
  }

  function drawGuards(state) {
    for (const guard of state.guards) drawCone(guard);
    for (const guard of state.guards) {
      // Body: a watchman with a torch, facing `angle`.
      context.fillStyle = PALETTE.guardDark;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius - 3, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffd9a0';
      context.beginPath();
      context.arc(guard.x + Math.cos(guard.angle) * 8, guard.y + Math.sin(guard.angle) * 8, 4, 0, Math.PI * 2);
      context.fill();
      // Suspicion meter above the head.
      if (guard.suspicion > 0.05) {
        const w = 34;
        context.fillStyle = 'rgba(0,0,0,0.6)';
        context.fillRect(guard.x - w / 2, guard.y - GUARD.radius - 14, w, 6);
        context.fillStyle = guard.suspicion >= 1 ? PALETTE.danger : guard.suspicion >= GUARD.suspiciousAt ? PALETTE.warn : '#f2c94c';
        context.fillRect(guard.x - w / 2, guard.y - GUARD.radius - 14, w * guard.suspicion, 6);
      }
      if (guard.state === 'chase') {
        text('!', guard.x, guard.y - GUARD.radius - 20, 22, PALETTE.danger, 'center');
      } else if (guard.state === 'suspicious') {
        text('?', guard.x, guard.y - GUARD.radius - 20, 22, PALETTE.warn, 'center');
      }
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.hidden) {
      // Hidden in shadow: only a faint outline shows.
      context.strokeStyle = 'rgba(79, 195, 247, 0.5)';
      context.lineWidth = 2;
      context.setLineDash([4, 4]);
      context.beginPath();
      context.arc(player.x, player.y, PLAYER.radius, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
      return;
    }
    context.fillStyle = PLAYER.playerCloak;
    context.beginPath();
    context.moveTo(player.x + Math.cos(player.angle) * (PLAYER.radius + 4), player.y + Math.sin(player.angle) * (PLAYER.radius + 4));
    context.lineTo(player.x + Math.cos(player.angle + 2.4) * PLAYER.radius, player.y + Math.sin(player.angle + 2.4) * PLAYER.radius);
    context.lineTo(player.x + Math.cos(player.angle - 2.4) * PLAYER.radius, player.y + Math.sin(player.angle - 2.4) * PLAYER.radius);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y, PLAYER.radius - 2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#0b2a3d';
    context.beginPath();
    context.arc(player.x + Math.cos(player.angle) * 5, player.y + Math.sin(player.angle) * 5, 4, 0, Math.PI * 2);
    context.fill();
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.max);
      context.fillStyle = p.color;
      context.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    context.globalAlpha = 1;
  }

  function drawMinimap(state) {
    const mw = 170;
    const mh = 96;
    const mx = FIELD.width - mw - 16;
    const my = 56;
    const sx = mw / FIELD.width;
    const sy = mh / FIELD.height;
    context.fillStyle = PALETTE.minimapBg;
    context.fillRect(mx - 6, my - 6, mw + 12, mh + 12);
    context.fillStyle = '#0d1322';
    context.fillRect(mx, my, mw, mh);
    for (const wall of state.walls) context.fillRect(mx + wall.x * sx, my + wall.y * sy, Math.max(1, wall.w * sx), Math.max(1, wall.h * sy));
    for (const crate of state.crates) context.fillRect(mx + crate.x * sx, my + crate.y * sy, Math.max(2, crate.w * sx), Math.max(2, crate.h * sy));
    context.fillStyle = PALETTE.exit;
    context.fillRect(mx + state.exit.x * sx - 2, my + state.exit.y * sy - 2, 6, 6);
    for (const guard of state.guards) {
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(mx + guard.x * sx, my + guard.y * sy, 3.5, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(mx + state.player.x * sx, my + state.player.y * sy, 3.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.muted;
    text('MAP', mx + mw / 2, my + mh + 18, 11, PALETTE.muted, 'center');
  }

  function drawHud(state, muted) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 26, PALETTE.text, 'left');
    text(lootLabel(`${state.lootLevel}/${state.lootTotal}`), 200, 18, 26, PALETTE.loot, 'left');
    const minutes = Math.floor(state.elapsed / 60);
    const seconds = Math.floor(state.elapsed % 60);
    text(timeLabel(`${minutes}:${String(seconds).padStart(2, '0')}`), 380, 18, 26, PALETTE.text, 'left');
    text(levelLabel(`${state.levelIndex + 1}/3`), 560, 18, 26, PALETTE.text, 'left');
    const alertText = state.alert === ALERT_CHASE ? '!! SPOTTED !!' : state.alert === ALERT_SUSPICIOUS ? 'SUSPICIOUS…' : state.player.hidden ? 'HIDDEN' : 'UNSEEN';
    const alertColor = state.alert === ALERT_CHASE ? PALETTE.danger : state.alert === ALERT_SUSPICIOUS ? PALETTE.warn : state.player.hidden ? PALETTE.safe : PALETTE.muted;
    text(alertText, FIELD.width / 2 + 120, 18, 26, alertColor, 'center');
    const firstLife = FIELD.width - 200;
    text('LIVES', firstLife - 14, 18, 26, PALETTE.text, 'right');
    for (let life = 0; life < LIVES; life += 1) {
      context.fillStyle = life < state.lives ? PALETTE.player : '#2a3040';
      context.beginPath();
      context.arc(firstLife + 12 + life * 26, 30, 9, 0, Math.PI * 2);
      context.fill();
    }
    text(muted ? 'MUTED [M]' : 'SOUND [M]', 24, FIELD.height - 22, 13, PALETTE.muted, 'left');
    drawMinimap(state);
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 76, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.loot, 'center');
  }

  const TITLE_LINES = [
    'A night courier. A guarded freight yard. One way out.',
    'Sneak past the guards — stay out of their yellow cones.',
    'Crates block sight. Bushes hide you. Grab the loot, find the key,',
    'reach the green EXIT unseen. Shift = sneak slow and quiet.',
    'Move with WASD or arrows. P = pause. M = mute.',
    '',
  ];
  const PAUSED_LINES = ['The guards will wait for you.'];
  const LEVEL_LINES = ['', ''];

  /** Paint one frame: the yard, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, muted) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 18 : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 18 : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawFloor();
    drawBushes(state);
    drawExit(state);
    drawPickups(state);
    drawWalls(state);
    drawGuards(state);
    drawPlayer(state);
    drawParticles(state);
    if (state.alertFlash > 0) {
      context.fillStyle = `rgba(255, 60, 50, ${state.alertFlash * 0.12})`;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[5] = bestLabel(best);
      drawPanel('SHADOWLINE', TITLE_LINES, 'Press Space or click to start');
      return;
    }
    drawHud(state, muted);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_LEVEL) {
      LEVEL_LINES[0] = state.level.name;
      LEVEL_LINES[1] = state.level.hint;
      drawPanel('Yard cleared', LEVEL_LINES, 'Press Space for the next yard');
    } else if (screen === SCREEN_WIN) {
      drawPanel('Clean getaway', [finalLabel(state.score), bestLabel(best), `Loot ${state.lootCollected}/${state.lootTotalAll} · ${Math.floor(state.elapsed / 60)}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')}`], 'Press Space to play again');
    } else if (screen === SCREEN_OVER) {
      drawPanel('Caught in the yard', [finalLabel(state.score), bestLabel(best), `Reached ${state.level.name}`], 'Press Space to try again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
