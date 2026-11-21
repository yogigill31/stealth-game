// SHADOWLINE — the hand-in program (Node 22, standard library only). The game is
// this directory's game/ folder: plain static files a desktop browser loads
// offline (game/index.html and its ES modules, no library, no network request).
// This program copies game/ and screenshots/ from beside this file to /output and
// writes /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library. Before copying it walks both folders and refuses an entry
// the scorer would refuse: a screenshot over 256 KiB, more than 4 of them, or a
// game/ tree over 993 files / 48 MiB. It prints a small manifest of what it
// handed in, so a failed run says exactly what it found.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's own caps (from the kit's competition.yaml): the dossier text is
// capped at 163,840 bytes by buildDossier; the rest refuse an entry outright.
const CAPS = {
  textMaxBytes: 163840,
  screenshotsMax: 4,
  screenshotMaxBytes: 262144,
  gameMaxFiles: 993,
  gameMaxBytes: 50331648,
  gamePathMaxBytes: 1000,
};

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

/** Every file under `dir`, as paths relative to it, in sorted order. */
function listFiles(dir, base = dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listFiles(path, base));
    else if (entry.isFile()) found.push(relative(base, path));
  }
  return found;
}

function fail(message) {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

// --- Validate the game tree before anything is copied. ---
const gameFiles = listFiles(gameDir);
if (gameFiles.length > CAPS.gameMaxFiles) fail(`game/ holds ${gameFiles.length} files, over the ${CAPS.gameMaxFiles} cap`);
let gameBytes = 0;
for (const file of gameFiles) {
  if (Buffer.byteLength(file, 'utf8') > CAPS.gamePathMaxBytes) fail(`game/ path too long: ${file}`);
  gameBytes += statSync(join(gameDir, file)).size;
}
if (gameBytes > CAPS.gameMaxBytes) fail(`game/ is ${gameBytes} bytes, over the ${CAPS.gameMaxBytes} cap`);
if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');

// --- Validate the screenshots: 3 or 4, each a JPEG/PNG under 256 KiB. ---
const shots = existsSync(shotsDir) ? listFiles(shotsDir) : [];
if (shots.length < 3 || shots.length > CAPS.screenshotsMax) {
  fail(`screenshots/ holds ${shots.length} images, need 3 or 4`);
}
for (const file of shots) {
  const size = statSync(join(shotsDir, file)).size;
  if (size > CAPS.screenshotMaxBytes) fail(`screenshot ${file} is ${size} bytes, over the ${CAPS.screenshotMaxBytes} cap`);
  if (!/\.(png|jpe?g)$/i.test(file)) fail(`screenshot ${file} is not a PNG or JPEG`);
}

// --- Copy and write the dossier. ---
mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: CAPS.textMaxBytes,
    screenshots: { max: CAPS.screenshotsMax, max_bytes: CAPS.screenshotMaxBytes },
    game_max_files: CAPS.gameMaxFiles,
    game_max_bytes: CAPS.gameMaxBytes,
    game_path_max_bytes: CAPS.gamePathMaxBytes,
  }),
);

// --- The manifest: what this run handed in. ---
const dossierBytes = statSync(join(out, 'dossier.json')).size;
console.log(`SHADOWLINE handed in: ${gameFiles.length} game files (${gameBytes} bytes), ${shots.length} screenshots, dossier ${dossierBytes} bytes`);
for (const file of shots) console.log(`  shot ${file} (${statSync(join(shotsDir, file)).size} bytes)`);
