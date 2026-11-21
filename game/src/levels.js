// The three hand-designed levels of SHADOWLINE. Each level is a freight yard at
// night: `walls` and `crates` block movement and a guard's line of sight, `bushes`
// are shadow you can hide in (they block neither movement nor sight, but a player
// standing in one cannot be seen), `loot` is optional cargo to steal, `key` opens
// the `door` (a wall that swings away once the key is taken), and `exit` is the
// gate out. Guards walk `waypoints` and pause at each one. Coordinates are in the
// 1280x720 playfield; every level is beatable by waiting for patrol gaps and
// slipping between cover, never by fighting.

export const LEVELS = [
  {
    name: 'Yard 1 — First Shift',
    hint: 'Stay out of the yellow cones. Crouch in the bushes — guards cannot see you there.',
    playerStart: { x: 70, y: 640 },
    exit: { x: 1180, y: 40, w: 70, h: 70 },
    door: null,
    key: null,
    walls: [
      { x: 0, y: 0, w: 1280, h: 24 },
      { x: 0, y: 696, w: 1280, h: 24 },
      { x: 0, y: 0, w: 24, h: 720 },
      { x: 1256, y: 0, w: 24, h: 720 },
      { x: 300, y: 120, w: 24, h: 300 },
      { x: 640, y: 300, w: 24, h: 300 },
      { x: 940, y: 100, w: 24, h: 320 },
    ],
    crates: [
      { x: 180, y: 480, w: 64, h: 64 },
      { x: 470, y: 180, w: 64, h: 64 },
      { x: 760, y: 520, w: 64, h: 64 },
      { x: 1060, y: 300, w: 64, h: 64 },
    ],
    bushes: [
      { x: 120, y: 260, w: 110, h: 90 },
      { x: 380, y: 520, w: 120, h: 90 },
      { x: 700, y: 140, w: 120, h: 90 },
      { x: 1000, y: 520, w: 120, h: 90 },
    ],
    loot: [
      { x: 210, y: 300 },
      { x: 540, y: 300 },
      { x: 860, y: 560 },
      { x: 1090, y: 420 },
    ],
    guards: [
      { x: 420, y: 420, waypoints: [{ x: 420, y: 420 }, { x: 420, y: 120 }], speed: 70 },
      { x: 900, y: 200, waypoints: [{ x: 900, y: 200 }, { x: 900, y: 560 }, { x: 1120, y: 560 }, { x: 1120, y: 460 }, { x: 900, y: 460 }], speed: 78 },
    ],
  },
  {
    name: 'Yard 2 — Locked Gate',
    hint: 'The gate is locked. Steal the key first, then slip out — the key glints gold.',
    playerStart: { x: 70, y: 70 },
    exit: { x: 1180, y: 620, w: 70, h: 70 },
    door: { x: 1120, y: 560, w: 24, h: 136 },
    key: { x: 640, y: 640 },
    walls: [
      { x: 0, y: 0, w: 1280, h: 24 },
      { x: 0, y: 696, w: 1280, h: 24 },
      { x: 0, y: 0, w: 24, h: 720 },
      { x: 1256, y: 0, w: 24, h: 720 },
      { x: 1120, y: 420, w: 136, h: 24 },
      { x: 1120, y: 420, w: 24, h: 140 },
      { x: 280, y: 200, w: 24, h: 320 },
      { x: 560, y: 80, w: 24, h: 280 },
      { x: 840, y: 360, w: 24, h: 280 },
    ],
    crates: [
      { x: 150, y: 420, w: 64, h: 64 },
      { x: 400, y: 100, w: 64, h: 64 },
      { x: 700, y: 480, w: 64, h: 64 },
      { x: 980, y: 160, w: 64, h: 64 },
      { x: 980, y: 520, w: 64, h: 64 },
    ],
    bushes: [
      { x: 120, y: 240, w: 120, h: 90 },
      { x: 360, y: 560, w: 120, h: 90 },
      { x: 620, y: 240, w: 120, h: 90 },
      { x: 900, y: 340, w: 110, h: 90 },
      { x: 1080, y: 80, w: 120, h: 90 },
    ],
    loot: [
      { x: 180, y: 540 },
      { x: 430, y: 220 },
      { x: 640, y: 360 },
      { x: 1010, y: 280 },
      { x: 1010, y: 640 },
    ],
    guards: [
      { x: 240, y: 300, waypoints: [{ x: 240, y: 300 }, { x: 240, y: 620 }], speed: 78 },
      { x: 460, y: 480, waypoints: [{ x: 460, y: 480 }, { x: 660, y: 480 }], speed: 85 },
      { x: 940, y: 420, waypoints: [{ x: 940, y: 420 }, { x: 940, y: 120 }, { x: 1120, y: 120 }], speed: 85 },
    ],
  },
  {
    name: 'Yard 3 — Night Watch',
    hint: 'Four guards, tight patrols, one locked door. Move slow, move in shadow.',
    playerStart: { x: 70, y: 640 },
    exit: { x: 1180, y: 40, w: 70, h: 70 },
    door: { x: 1120, y: 24, w: 24, h: 136 },
    key: { x: 180, y: 80 },
    walls: [
      { x: 0, y: 0, w: 1280, h: 24 },
      { x: 0, y: 696, w: 1280, h: 24 },
      { x: 0, y: 0, w: 24, h: 720 },
      { x: 1256, y: 0, w: 24, h: 720 },
      { x: 1120, y: 160, w: 136, h: 24 },
      { x: 300, y: 100, w: 24, h: 340 },
      { x: 580, y: 280, w: 24, h: 340 },
      { x: 880, y: 100, w: 24, h: 300 },
    ],
    crates: [
      { x: 160, y: 300, w: 64, h: 64 },
      { x: 420, y: 560, w: 64, h: 64 },
      { x: 700, y: 140, w: 64, h: 64 },
      { x: 1000, y: 420, w: 64, h: 64 },
      { x: 1120, y: 300, w: 64, h: 64 },
    ],
    bushes: [
      { x: 120, y: 480, w: 120, h: 90 },
      { x: 360, y: 180, w: 120, h: 90 },
      { x: 640, y: 520, w: 120, h: 90 },
      { x: 940, y: 560, w: 120, h: 90 },
      { x: 1080, y: 200, w: 110, h: 90 },
    ],
    loot: [
      { x: 190, y: 420 },
      { x: 390, y: 220 },
      { x: 730, y: 260 },
      { x: 620, y: 560 },
      { x: 970, y: 460 },
      { x: 1180, y: 260 },
    ],
    guards: [
      { x: 250, y: 200, waypoints: [{ x: 250, y: 200 }, { x: 250, y: 560 }], speed: 88 },
      { x: 520, y: 120, waypoints: [{ x: 520, y: 120 }, { x: 520, y: 620 }], speed: 92 },
      { x: 800, y: 480, waypoints: [{ x: 800, y: 480 }, { x: 800, y: 160 }], speed: 92 },
      { x: 1090, y: 260, waypoints: [{ x: 1090, y: 260 }, { x: 1090, y: 480 }], speed: 96 },
    ],
  },
];
