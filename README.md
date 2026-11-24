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
- **Weather**: mostly sunny, sometimes hazy or cloudy, now and then a tropical downpour with rain streaks, lower fog and soaked asphalt that mirrors lamps and neon and costs cars grip until it dries. KBAY announces each change.
- **Skills and respect**: driving fast raises Driving (more grip), landing shots raises Shooting (tighter spread), sprinting raises Stamina, and missions, race wins, takedowns and carjackings earn Respect ranks (Nobody → King of Marisol) that raise maximum health. Shown in the pause menu and saved.
- **Seabreeze garage**: stop a car on the yellow pad beside the safehouse to keep it (three slots, saved with the game) and press G on foot to take it out again. Police cars, mission cars and cars with a wanted level are turned away.
- **Phone (P)**: call Lupe for the next job, Manny's Motors to have a Marlin GT dropped at the kerb, lawyer Sal Benedetti to make two stars disappear, or the safehouse to save.
- **Procedural models**: cars with real wheel arches, inset windows and pillars, bumpers, grilles, plates, mirrors, multi-spoke rims and police door livery; people with rounded heads, eyes, eight hairstyles, beards, shades, jackets, shorts and capsule limbs.
- **Post-processing written for the game**: the scene renders into an HDR multisampled target, then a two-level bloom, ACES tone mapping, a split-tone colour grade and a vignette, so neon, headlights and siren bars glow.
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
| P | Phone (1-4 to call a contact) |
| G | Take a car out of the Seabreeze garage |
| Esc | Pause menu |

Scene presets for testing: `?scene=chase`, `?scene=shootout`, `?scene=race`, `?scene=hijack`, `?scene=night`, `?scene=showroom` (every vehicle and a row of locals), `?play=1` (skip the title), `?weather=rain|cloudy|hazy|sunny`, `?post=0` (no post-processing), `?lowfx=1` (no shadows or post-processing).

## Run it

```sh
node serve.ts            # serves game/ on http://localhost:8080, then open it in Chrome
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # writes the entry's output and dossier
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=54ccpm5e&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
