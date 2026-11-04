# Hexapod orbital presentation

[Open the presentation](https://kyle-annora.github.io/annora-explorer/?model=hexapod&presentation=1) · [Open free exploration](https://kyle-annora.github.io/annora-explorer/?model=hexapod)

Start with **Whole model**. The three solid points belong to a dashed track in
the same space as the hardware. Hovering a detail point reveals the chapter
name and a finer line to its part. Choose a point, use **Chapters**, or follow
the next button through the presentation:

1. **Whole model** — rotate the assembly to see the track pass behind the legs.
2. **[Leg motion](https://kyle-annora.github.io/annora-explorer/?model=hexapod&presentation=1#leg)** — three joints move one foot. The orange trace follows the tip of the actual displayed foot through its 2.5-second authored pose cycle.
3. **[Electronics](https://kyle-annora.github.io/annora-explorer/?model=hexapod&presentation=1#electronics)** — the braces lift first, then the board rises from its mount. The battery stays seated.

Pause, replay or scrub either action. Drag to take control of the camera.
With reduced motion enabled the model starts still and each action waits for
Play. **Explore freely** restores the inspection view and its component tree.
Browser Back and Forward revisit the chapters and modes in order. Escape closes
the chapter menu first, then returns from a detail to the whole model, then to
free exploration.

## Integration and verification

The top-level Explorer opens the guide from its usual **Play presentation**
button or from the link above. The guide uses the current WebGL canvas, loaded
model geometry, studio environment and frame loop. Its own camera and pose
hierarchy keep inspection state separate. The demo module loads on entry and
releases its materials, guides, controls and event listeners on exit. No
second viewer, model request or external frame is needed.

The presentation registry pins this guide to the reviewed Hexapod package.
Free exploration, embedded hosts and other models keep their existing controls.
The [film's original timeline](https://kyle-annora.github.io/annora-explorer/?model=hexapod&presentation=1&guide=timeline)
remains available. These are illustrative actions, not a simulation of gait
or a disassembly procedure.

Run `npm run verify`, serve the built site at its repository subpath, then run
the browser walkthrough with Chrome and Playwright installed:

```sh
node scripts/review/hexapod-orbit.mjs https://kyle-annora.github.io/annora-explorer/ work/orbit-review
```

`PLAYWRIGHT_MODULE` can point to a separately installed Playwright entry point.
The walkthrough exercises actual 3D station clicks and touches, movement and
playback, returning to a previously selected part, history, direct links and
the embedded tour. Phone checks use browser touch emulation.
