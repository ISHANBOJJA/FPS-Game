# STEEL SURGE — Arena FPS

A wave-survival first-person shooter that runs entirely in the browser. No build
step, no installs — just open `index.html` in Chrome or Edge (an internet
connection is needed once to load Three.js from its CDN).

## Controls

| Input | Action |
|---|---|
| WASD | Move |
| Mouse | Aim |
| Left click | Fire |
| Right click (hold) | Aim down sights |
| Shift | Sprint |
| Space | Jump (you can jump onto crates) |
| C / Ctrl | Crouch (tighter spread) |
| R | Reload |
| 1 / 2 / 3 or scroll wheel | Switch weapon |
| Esc | Pause |

## Weapons

- **AR-77 VANDAL** — full-auto rifle. Balanced damage, controllable recoil.
- **P9 HAVOC** — semi-auto pistol. Hard-hitting, precise, deep reserves.
- **S8 BREACHER** — pump shotgun. 8 pellets, devastating up close, falls off with range.

Headshots deal double damage. Spread blooms as you fire and while moving —
crouch or aim down sights to tighten it.

## Enemies

- **RAIDER** — standard melee chaser.
- **STALKER** — small and fast, appears from wave 2.
- **SENTRY** — keeps its distance and fires plasma bolts, appears from wave 3.
- **JUGGERNAUT** — slow, huge, and very hard to kill, appears from wave 4.

Enemies scale in health and speed every wave. Kills can drop health packs and
ammo crates; clearing a wave heals you and awards bonus score.

## Files

- `index.html` / `style.css` — page shell and HUD
- `js/audio.js` — procedurally synthesized sound effects (WebAudio)
- `js/world.js` — arena geometry, colliders, particle effects
- `js/player.js` — movement controller (sprint, jump, crouch, collision)
- `js/weapons.js` — weapon definitions, viewmodels, recoil, ADS
- `js/enemies.js` — enemy AI, wave director, projectiles, pickups
- `js/main.js` — bootstrap, input, HUD, game states
