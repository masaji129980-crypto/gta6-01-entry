[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/masaji129980-crypto/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/masaji129980-crypto/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# SOLMAR HEAT

An open-world crime game that plays offline in a desktop browser from its own
static files. Built for the make.fun gta6-01 bounty.

You are Dante Cole, back in the fictional sun-soaked city of **Solmar** with
$250 and a debt. Six story missions take you from stealing your first car to
running the whole city — with traffic, pedestrians, police chases, taxi jobs,
hidden cash and a day/night cycle in between.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

- **WASD / arrows** — walk and drive, **Shift** — run
- **E** — enter / steal a car, exit a car
- **Space** — handbrake (driving) / punch (on foot)
- **Mouse + click** — aim and shoot on foot
- **T** — taxi job while driving a cab
- **Enter** — start the next story mission, **P** — pause, **M** — mute

Progress (cash and story) saves automatically in the browser.

## What is in the game

- A 3,200 × 3,200 open city: nine districts, a park, a beach and a marina
- Traffic that follows the road grid, pedestrians on the sidewalks
- A wanted system (0–5 stars) with police interceptors and cops on foot
- 6 story missions with timers, chases and a bank job
- Taxi fares, hidden cash bundles, a spray shop that clears your wanted level
- HUD with cash, health, ammo, wanted stars, mission objective and a live minimap
- Day/night cycle with headlights and street lamps
- Synthesised WebAudio sound: engine, sirens, gunshots, cash, music

## Layout

- `game/` — the playable game (plain HTML + ES modules, no build step, no network)
  - `game/src/config.js` — constants, city layout, mission chain
  - `game/src/city.js` — city generation and collision
  - `game/src/world.js` — game state and the update loop
  - `game/src/vehicles.js` — traffic, player car physics, police cars
  - `game/src/people.js` — pedestrians, cops, gang members
  - `game/src/police.js` — the wanted system
  - `game/src/missions.js` — the story mission chain
  - `game/src/render.js` — canvas drawing, HUD, minimap, screens
  - `game/src/audio.js` — synthesised sound
  - `game/src/shots.js` — the staged screenshot scenes
  - `game/src/main.js` — entry point
- `main.ts` — the program that hands the entry in (copies `game/` and
  `screenshots/` to `/output` and writes `dossier.json`)
- `screenshots/` — 4 real renders of the game

Everything in Solmar — the city, characters, vehicles, names and story — is
original fiction, invented for this game.

## License

MIT — see `LICENSE`.

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
