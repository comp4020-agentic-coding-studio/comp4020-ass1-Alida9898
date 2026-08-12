# PLAN — Assignment 1

## Context

Assignment 1 asks for an **interactive explainer of something more people should
understand**, deployed to GitHub Pages by noon Mon 17 Aug 2026. Worth 20% of the
course, marked on process legibility (45%), working deployed artefact (20%) and
response to the brief (35%). The brief's discipline is the hard part: _one strong
idea, one dataset or mechanic, and nothing else_, and the visitor has to **do**
something, not only read.

This plan exists because the first version of the idea was over-scoped, and
writing down the cut is cheaper than building it twice.

## The idea

**Barn owls have vertically offset ears** — the left ear opening is aimed
downward, the right upward. That asymmetry is why an owl can localise prey in the
_vertical_ plane, not just left–right, and strike a mouse it has never seen under
a layer of snow.

The obvious version of this page is "owls are amazing: eyes, neck, ears" — three
mechanisms, a museum panel, and off-brief. **The cut: only the ears.** Eyes
(low-light vision) and neck (270° rotation) are deliberately thrown away; they
are the interesting-but-different explainers.

### The core interaction, in one sentence

> You are the owl in the dark: you aim by reading two acoustic cues, you strike,
> and a toggle that makes the ears symmetric destroys the vertical cue and
> collapses your hit rate.

That sentence is the testable contract, and it drives the spec tests below.

**The scoreboard is the argument.** The page keeps hit rate per ear mode side by
side, so the claim "asymmetry is the whole trick" is not asserted by prose — the
visitor generates the evidence against themselves.

## The model (honest, and the load-bearing part)

Two cues, matching the real biology rather than a convenient fiction:

| Cue                                    | Encodes             | Why                                                                              |
| -------------------------------------- | ------------------- | -------------------------------------------------------------------------------- |
| **ITD** — interaural _time_ difference | azimuth (left–right) | path-length difference to the two ears; `ITD = (headWidth / c) · sin(azimuth)`   |
| **ILD** — interaural _level_ difference | elevation (up–down) | each ear is most sensitive along its **aim direction**; the aims differ in elevation |

The ILD must come from **directional gain, not distance**. Distance-based falloff
would make ILD a smear of both axes and the toggle would degrade rather than
collapse. So each ear gets an aim direction and a gain that falls off with
angular distance from that aim:

- **Asymmetric ears (real barn owl)** — left ear aims elevation `−θ`, right `+θ`.
  ILD is monotonic in elevation. Both cues together pin down a point.
- **Symmetric ears** — both aim elevation `0`. ILD now depends only on azimuth,
  which ITD already told you. **Vertical information is exactly zero** — not
  noisy, _absent_ — so the visitor can only guess the vertical, and misses.

Prey position and aim live in **normalised coordinates** (`-1…1` on both axes),
converted to pixels only at render time. This is what makes "resize
mid-interaction" correct by construction rather than by patching — an explicit
item in the artefact HD band.

## Architecture

The harness forces a clean split, and it happens to be the right one anyway.

`spec/invariants.test.ts` parses built HTML with jsdom and **never executes
scripts**, so no test in this repo can observe the rendered interaction. The only
way to get real backpressure on the mechanic is to keep the model **pure and
importable**:

```
acoustics.ts     pure math, exported, zero DOM      ← the contract lives here
main.ts          DOM wiring: render, input, score   ← rewritten from the starter
index.html       the explainer (one page)
styles.css       rewritten
spec/hunt.test.ts   asserts acoustics.ts            ← the week's spec tests
spec/starter.test.ts   DELETED (see below)
```

**DOM + CSS, not canvas.** The field is a `<div>`, the crosshair is one
absolutely-positioned element, the cue meters are bars with percentage widths.
This is less code than canvas, gets responsive layout for free, needs no DPR or
`getContext` null handling, and is keyboard-accessible — and the marker
explicitly "tabs through it".

### Input

- **Pointer** — `pointerdown` / `pointermove` on the field (covers mouse and
  touch in one path).
- **Keyboard** — the field is `tabindex="0"` with an `aria-label`; arrow keys
  nudge the crosshair, Enter/Space strikes. A visible **扑击** button keeps a
  non-arcade path available.

## Harness constraints found before writing code

These come from reading the config, not from guessing, and each one is a trap
that looks fine locally:

1. **`tsconfig.include` is `["*.ts", "spec"]`.** A module under `src/` is *not
   typechecked* — esbuild strips its types and errors ship silently. Hence
   `acoustics.ts` and `main.ts` sit at the **repo root**.
2. **`lib` stops at ES2022.** `toSorted`, `findLast`, `Object.groupBy` are type
   errors. Use `[...a].sort()`.
3. **jsdom doesn't run scripts**, so `lang`, `<title>`, `meta[name=viewport]`, a
   real `<nav>` element and **exactly one** `<h1>` must be in the HTML source.
4. **`spec/starter.test.ts` pins `data-testid="intro"` into `dist/index.html`.**
   Replacing the home page turns it red; `spec/README.md` says the fix is to
   delete it, *not* to re-add the attribute to make it pass.
5. **stylelint-config-standard** — kebab-case class names only (BEM `__`/`--`
   fails), `rgb(0 0 0 / 50%)` not `rgba(…)`, `@media (width >= 48rem)` not
   `min-width`, and watch `no-descending-specificity`.
6. **oxlint runs `correctness` only**, but `no-invalid-remove-event-listener`
   is a live risk with pointer/resize handlers — keep named handler references.

## The spec tests

`spec/hunt.test.ts` imports `acoustics.ts` directly (node env, pure functions)
and asserts the *contract*, not the implementation:

- `itd` is **monotonic in azimuth** and (to first order) **independent of
  elevation** — the left–right cue means left–right.
- With **asymmetric** ears, `ild` is **strictly monotonic in elevation** at fixed
  azimuth — the vertical cue carries vertical information.
- With **symmetric** ears, `ild` is **invariant in elevation** at fixed azimuth —
  the vertical cue carries *none*. This is the assignment's central claim,
  asserted mechanically.
- A strike within `hitRadius` of the prey scores a hit; outside it, a miss.
- Cue values stay finite and in range across the whole field, including corners.

The third one is the test worth having: if a refactor ever makes symmetric ears
_slightly_ informative, the argument of the page quietly breaks, and this goes
red.

## Phases

**Phase 1 — rough and playable (tonight).** All the files above, ugly but real:
you can aim, strike, see hits, and flip the toggle. No audio. The point is to
**play it rather than imagine it** — if the toggle's drop isn't dramatic, the
mechanic is wrong and switching now costs nothing.

**Phase 2 — tune the feel.** The hard part isn't the code, it's the constants:
cue exaggeration, `hitRadius`, field size, how many practice strikes before the
toggle unlocks. Expect several passes. Each "too hard → changed k from X to Y"
is a PROCESS.md moment.

**Phase 3 — ship it.** `/ship` to go public early so CI and Pages have time to
fail visibly. Then both viewports (1920×1080 and 390×844), keyboard path,
resize mid-strike.

**Phase 4 — stretch, only if Phase 3 is green.** Real binaural audio via Web
Audio. **Audio is an addition, never a dependency**: browsers need a user
gesture to start it and the marking room may be silent, so the visual cue
readout stays authoritative.

**Phase 5 — evidence.** `PROCESS.md` (400–600 words, three or four moments) and
`reflections/assignment-1.md`. The reflection is also the week 4 retro talk —
written once.

## Verification

```sh
pnpm dev                              # play it; the rendered page is the truth
pnpm check                            # typecheck → build → oxlint → stylelint → vitest
pnpm check:evidence                   # PROCESS.md citations, reflections/assignment-1.md
pnpm build && pnpm dlx linkinator ./dist --silent
```

Then, before calling anything done: open the deployed URL in Chrome at both
1920×1080 and 390×844, use the core interaction for a minute, resize mid-strike,
and tab through it — that is exactly what the marker does.

## Known open questions

- Whether the toggle's collapse *feels* as sharp as the model says. Phase 1
  exists to answer this by playing, not arguing.
- Whether the vertical axis reads as "up–down" or "near–far" from the owl's
  perch. Both are honest; the framing that survives playtest wins.
- Whether practice strikes should be forced before the toggle unlocks, or the
  toggle offered immediately.
