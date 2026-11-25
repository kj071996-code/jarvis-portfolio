# JARVIS — Interactive 3D Portfolio

A dark, cinematic, JARVIS-style portfolio world built with Three.js, WebGL
shaders, UnrealBloom and GSAP. One continuous scene, no page reloads.

## The journey

1. **Intro** — a pulsing ring of thousands of vertical bars (orange/red →
   blue/purple → white/gray spikes) on black, with a JARVIS-style typewriter
   caption streaming in beneath it. When the caption finishes, the ring
   collapses to a point and the camera drops into the world.
2. **The world** — a night plain of ~200k glowing points (50k on mobile)
   that undulates and ripples around your avatar, a huge warm light blooming
   on the horizon, thin vertical beams rising like data rain, and a small
   human silhouette as your avatar. Each project is a glowing beacon pillar.
3. **Project screens** — walk to a beacon, press Enter, and the world
   crossfades into a full dark-mode dashboard. "Back to the world" returns
   you to the exact spot you left.
4. **Outro** — "Leave" dives the camera into a white spiral vortex of two
   interlocking arms that tightens into a starburst.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve the production build
```

Requires Node 18+.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Walk (desktop) |
| Virtual joystick (bottom-left) | Walk (touch) |
| Tap the ground | Walk there (touch) |
| Enter (or tap the prompt) | Open the nearest beacon |
| Back to the world (top-right) | Return to the exact spot you left |
| Leave (top-right) | Fullscreen + vortex outro |
| Esc (hold) | Exit fullscreen |

The camera is a slow, floaty third-person follow with a slight orbital
drift. Motion respects `prefers-reduced-motion` (slower ring, no camera
sway, gentler waves). Particle count adapts to the device (~200k desktop,
~50k mobile) and the pixel ratio steps down automatically if the frame rate
sags.

## Swap in your own work — `src/config.js`

Everything editable lives in **one file: `src/config.js`**. Nothing in the
scene code needs to change.

- `meta` — page title and brand text.
- `colors` — every colour in the site.
- `intro.lines` — the typewriter caption, one string per line.
- `intro.ring` — bar counts, radii, colour bands, rotation/pulse speed.
- `world` — terrain size/point counts, horizon light, beam count, avatar
  speed/start, camera distance/height, walk bounds, Enter distance.
- `projects` — **add a project here and a beacon appears in the world.**
  Each project needs an `id`, a `label` (shown on the beacon), a `screen`
  (`'trading'` or `'speaking'`), a `beaconColor`, a `position` `[x, z]`,
  and a `dashboard` object with all of the screen's copy and data.
  The two sample projects (`trading-bots`, `speaking-coach`) show the full
  shape of each dashboard's data.
- `outro` — the vortex hint text, strand count, spiral turns.
- `controls` — hint text, prompt and button labels.

## Tech

- **Three.js** — `Points` + custom GLSL shaders for the terrain (value-noise
  undulation, avatar ripple), `InstancedMesh` for the intro ring,
  `LineSegments` for the beams and the vortex.
- **EffectComposer + UnrealBloomPass** — the horizon bloom and beacon glow.
- **GSAP** — ring collapse, camera drops, overlay crossfades, vortex dive.
- **Vite** — single `index.html` entry, plain HTML/CSS overlays for the
  project dashboards (no framework needed).

## File layout

```
index.html
vite.config.js
package.json
src/
  main.js            # renderer, composer, state machine, input, camera
  config.js          # ALL copy, projects, colours — edit this
  styles.css         # HUD + dashboard styling
  scenes/
    intro.js         # ring + typewriter
    world.js         # terrain, horizon light, beams, avatar, beacons
    outro.js         # spiral vortex + starburst
  ui/
    projects.js      # trading + speaking dashboard renderers
```

## Notes

- The sample dashboards are real, working UIs: the Trading Bots "Start
  paper trading" button toggles a live paper balance ticker; the Speaking
  Coach tabs switch content and the Drill tab runs a 30-second drill timer.
  All values are sample data in `config.js` — replace them with your own.
- The vortex "Leave" action requests fullscreen; browsers (notably iOS
  Safari) may refuse the request, in which case the vortex still plays and
  the on-screen hint explains how to exit fullscreen.
