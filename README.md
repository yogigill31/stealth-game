# SHADOWLINE

[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/yogigill31/stealth-game/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/yogigill31/stealth-game/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

An original top-down stealth game for the **Make the best stealth game** bounty on
[make.fun](https://make.fun/bounty/best-stealth-game-20261121-1759). You are a night
courier crossing a guarded freight yard — slip past the patrols, grab the loot, and
reach the green exit without being seen.

## How to play

- **Move**: WASD or arrow keys. Hold **Shift** to sneak (slower, quieter, harder to spot).
- **Guards**: patrol set routes with visible vision cones. Walls and crates cut the
  cone; bushes hide you completely. A guard that spots you raises the alarm and gives
  chase — break line of sight to cool the suspicion meter back down.
- **Objective**: collect the loot, find the key for the locked exit door on later
  levels, and reach the green exit unseen. Three hand-designed levels, escalating
  patrols, a minimap, and a timer.
- **Controls**: Space / Enter / click to confirm, **P** or Esc to pause, **M** to mute.
  Procedural WebAudio sound: footsteps, alert sting, pickup blips, win jingle.

## Run it

Static files only, no build step, no network:

```
node serve.ts
```

then open http://localhost:8080. Or open `game/index.html` from any static server.
`main.ts` (Node 22) hands the game in: it copies `game/` and `screenshots/` and
writes `dossier.json` with the kit's `vendor/makefun-game.ts`.

## Screenshots

`1-start.jpg` title screen, `2-play.jpg` mid-level stealth, `3-alert.jpg` spotted
and chased, `4-end.jpg` the clean getaway.
