# Hexapod orbital study

[Open the independent preview](https://kyle-annora.github.io/annora-hexapod-orbit/)

[Compare single and layered tracks on the front right leg](https://kyle-annora.github.io/annora-hexapod-orbit/?study=leg-orbit#leg).
**Single** shows the original close-up. **Layered** adds the assembly track
in the background and a short leg arc with three selectable poses. The switch
preserves the camera, playhead and playback state. Select a point on the arc
or its named button below the model to hold Lift (0.625 s), Reach (1.25 s) or
Return (2.5 s). Replay runs the original clip.

This three-chapter, light-stage study uses a single Hexapod model and a single WebGL canvas. The track and its three beads sit in the same 3D space as the assembly. Drag to see the track edge-on. Hovering a bead holds rotation, traces a line to its part and shows the chapter name below the canvas. Tap the bead or the adjacent arc to open its chapter in one gesture. A station behind hardware is hidden and cannot be selected through the model. The Chapters menu lists all three destinations at any viewing angle. Focusing a destination in the overview highlights its station. The camera arrives before the selected 2.5-second action begins. Drag or pinch to take over at any time. Use the playback button to continue or replay and the slider to inspect a particular pose. **Whole model**, Escape and browser Back return to the orbit.

- **Leg motion** samples the prepared front leg’s three joint tracks. The Ember trace follows one vertex on the foot through the illustrated reach. This clip describes an authored pose cycle.
- **Electronics** lifts the upper stiffeners first and then moves the board’s three display surfaces together. The mount and battery stay seated. The separation is an illustration of the stack.
- With reduced motion enabled, the overview starts still and each local action waits for Play. Arrow keys orbit the focused canvas, Shift + arrows pan, and + / − zoom.

## Run and verify

Install the repository dependencies. From the repository root:

```sh
./node_modules/.bin/vite --config vite.orbit.config.js
npm run verify
./node_modules/.bin/vite build --config vite.orbit.config.js
python3 -m http.server 8245 --bind 127.0.0.1 --directory work/site
```

Open `http://127.0.0.1:8245/annora-hexapod-orbit/`. To repeat the chapter, perspective, physical node selection, touch, reduced-motion and idle-render checks, run the following with Playwright and Chrome installed. Set `PLAYWRIGHT_MODULE` to a Playwright entry point if it is installed separately.

```sh
node scripts/qa-orbit-preview.mjs http://127.0.0.1:8245/annora-hexapod-orbit/
```

The independent Pages repository serves only the contents of `work/site/annora-hexapod-orbit/`. The normal Explorer build has its own entry point.

Hexapod hardware by ggldnl and contributors. The published page links the complete bundled notices and the source location for the display adaptation. [Original hardware](https://github.com/ggldnl/Hexapod-Hardware) · [Prepared display geometry, mappings and source files](https://github.com/kyle-annora/annora-duck-showcase/tree/main/examples/hexapod).
