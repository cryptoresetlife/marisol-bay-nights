# marisol-bay-nights

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/cryptoresetlife/marisol-bay-nights/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/cryptoresetlife/marisol-bay-nights/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Sundown Syndicate** is an original open-world crime game that runs in desktop Chrome from plain static files: no build step, no network requests, three.js vendored, every texture drawn in code and every sound synthesised with WebAudio.

Dez walks out of county lockup into **Marisol Bay**, a sun-soaked seaside city that developer Sterling Vance is buying block by block with the Coral Kings gang as his muscle. With his old friend Lupe, who runs Tiki Taco on the Ocean Strip, Dez puts a crew back together across eight story chapters.

### What's in the city

- **A whole city to explore** on foot and by car: Palm Heights, Midtown, Downtown, Flamingo Park, the Dockyards, Southside, the Ocean Strip along Tidewater Drive, Sunset Beach and The Pier with its Ferris wheel. Every street has a name, and the HUD shows "Street · District".
- **Traffic and pedestrians**: cars keep to their lane, stop at red lights and turn at intersections; people walk the sidewalks, cross at the zebras and scatter from gunfire.
- **Nine vehicles** (Marlin GT, Stingray Coupe, Bayline Sedan, Marisol Cab, Gator Pickup, Pelican Van, Riptide Roadster, MBPD Interceptor, MBPD Tactical), each with its own speed and handling. Arcade physics with handbrake drifts, crashes, smoke, fire and explosions. Press F to take a parked car or drag a driver out of a moving one.
- **Wanted level from one to five stars**: cruisers with sirens and light bars chase you through the grid and ram you, officers fight on foot, roadblocks go up from three stars, a helicopter with a searchlight joins at four and tactical units at five. Break line of sight and the stars flash, then fade. A Fresh Coat respray clears them for cash.
- **Combat**: fists, the Viper 9 pistol, Hornet SMG, Breaker 12 shotgun and Longshot AR, with over-the-shoulder aiming, tracers, armour and health. Buy guns, ammo and armour at Iron Pelican Arms.
- **Story**: eight chapters (Homecoming, Borrowed Time, Quiet Shadow, Reef Cleanup, Hot Ice, Tail Lights, Bank Holiday, Sundown) with subtitled dialogue, objectives, map markers and light beams: pick-ups, a car theft, tailing a van, a gang shootout, a timed delivery, a car chase, a bank job and a final showdown.
- **Side activities**: the Tidewater Sprint street race against three rivals, taxi fares in a Marisol Cab, and twenty hidden Lucky Gecko statuettes.
- **HUD and menus**: rotating radar with blips and a red-blue flashing frame when wanted, full map with street and district names (M), speedometer, radio station, money, weapon and ammo, mission panel, dispatch feed, title screen, pause menu, settings and localStorage saves at the Seabreeze safehouse.
- **Day and night**: the sun crosses the sky and casts shadows; at night windows light up, neon signs glow and street lamps come on. Three original radio stations play procedurally sequenced music.

### Controls

| Key | Action |
| --- | --- |
| W A S D | Walk / drive |
| Mouse | Look (click the game to capture the mouse) |
| Shift | Sprint |
| Space | Jump / handbrake |
| F | Enter, exit or steal a car |
| Left click / right click | Fire or punch / aim |
| Q / E or wheel, 1-5 | Switch weapon |
| R | Reload on foot, change radio station in a car |
| H | Horn |
| T | Taxi duty in a Marisol Cab |
| M | Map |
| Esc | Pause menu |

Scene presets for testing: `?scene=chase`, `?scene=shootout`, `?scene=race`, `?scene=hijack`, `?scene=night`, `?play=1` (skip the title).

## Run it

```sh
node serve.ts            # serves game/ on http://localhost:8080, then open it in Chrome
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # writes the entry's output and dossier
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=54ccpm5e&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
