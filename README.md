# Solara Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/m1651/makefun-gta6-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/m1651/makefun-gta6-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01). You are a newcomer in
Solara Bay, a sun-soaked coastal city. Steal cars, outrun the police, and run
five jobs for the fixer Mara Voss — from a first stolen car to the Marina Job —
then keep the city as your free-roam playground.

## How to play

```sh
node serve.ts
# open http://localhost:8080
```

- **WASD / arrows** — move on foot, drive in a car
- **Shift** — run
- **E** — enter / exit a car
- **F** — punch
- **Space** — handbrake while driving
- **H** — horn
- **P** — pause, **M** — mute, **Enter** — start / restart

## What is in the game

- A drivable city: avenues, streets, a beach, a marina, parks, traffic and
  pedestrians, all generated from a seed (`?seed=N` fixes the city)
- A wanted system: stealing cars, hitting pedestrians and assault raise your
  stars; police interceptors chase you, and the heat only dies when you stay
  out of sight
- Five story missions with a briefing, a timer where it matters, and cash
  rewards: First Wheels, Courier Run, Hot Pursuit, Tool Run, The Marina Job
- A HUD with cash, wanted stars, health, a live minimap, mission tracker and
  speedometer, plus synthesized WebAudio sound (engine, sirens, cash, music)
- Your best cash is saved in the browser; the story ends with a win screen
  once all five jobs are done

## Structure

- `game/index.html` — the page, one canvas
- `game/src/main.js` — boot, the fixed-step loop, screens
- `game/src/world.js` — player, traffic, police, wanted, missions
- `game/src/city.js` — the generated city: roads, buildings, parks, beach
- `game/src/render.js` — canvas painting, HUD, minimap, menus
- `game/src/autopilot.js` — the driver that play-tests the game and stages shots
- `game/src/shots.js` — the four screenshot scenes
- `game/src/config.js` — tuning, places, mission definitions
- `game/src/random.js` — seeded random source
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesized WebAudio sound, no audio files

Everything is original: the city, the characters, the story and the art are
my own. Nothing is taken from any commercial game. MIT licensed.
