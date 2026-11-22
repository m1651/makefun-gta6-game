[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/m1651/makefun-gta6-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/m1651/makefun-gta6-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solara Bay — an open-world crime game

Lucia Vega comes home to Solara Bay and works off a debt to the crew. A wholly
original top-down open-world crime game in the spirit of GTA 6: a drivable
sun-soaked city, traffic and pedestrians, cars to steal, a wanted level with
police who respond, five story missions, combat, a HUD with minimap, and a
save that keeps your money and progress. Runs offline from its own static
files in a desktop browser — no network requests, no libraries.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

- **WASD / arrows** — move on foot, drive when in a car
- **E** — enter a car, interact, collect, grab cash
- **F** — punch
- **Space** — handbrake
- **P** — pause · **M** — mute

## The story

1. **Wheels** — steal a car and bring it to Rico's Garage ($400)
2. **The Delivery** — drive a package to the Marina in 90 seconds ($600)
3. **Debt Collection** — collect from three debtors on foot ($800)
4. **Lose the Heat** — three stars; break line of sight and reach the safehouse ($1,000)
5. **The Big Score** — rob Solara National Bank, hold the lobby, escape ($5,000)

Wanted stars rise when you steal, punch or hit pedestrians, and fall when the
police lose sight of you. The Fixer (south of the city) clears your wanted
level for $200. Busted or wasted, you wake up at St. Marisol Hospital minus a
cut of your cash.

## Structure

- `game/index.html` — canvas page
- `game/src/config.js` — tuning, palette, places, mission text
- `game/src/city.js` — seeded city generation, roads, buildings, collision
- `game/src/world.js` — player, traffic, pedestrians, police, wanted level
- `game/src/missions.js` — story mission flow and payouts
- `game/src/render.js` — city, entities, HUD, minimap, menus
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesized WebAudio sound and radio music
- `game/src/autopilot.js` — self-play driver for headless verification
- `game/src/main.js` — state machine, loop, save/load, screenshot presets

## Entry

Built for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01)
(`gta6-01`). `main.ts` copies `game/` and `screenshots/` to `/output` and
writes `dossier.json` with the kit's `buildDossier`. MIT licensed.
