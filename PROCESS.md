# Process overview

## What I built

An interactive explainer about a barn owl's ears. Its two ear openings point in
different directions — the left aimed down, the right up — and that asymmetry is
the only reason it can place a sound by height and drop on a mouse it cannot see.
You hunt in the dark with the owl's two instruments; after three hits in a row the
page levels your ears without asking, because those are your ears — and you have
never once placed a sound by height by comparing them. The point of view is that
the interesting thing here is not a fact about owls but a missing sense in the
reader.

## The moments that mattered

**Cutting three mechanisms down to one.** The first version of the idea was owls in
general — eyes, neck, ears — which is a museum panel and off-brief. The obvious
move was to build the interesting bits and see what stuck. Instead I wrote the cut
down before writing any code
([`5a2bd0a`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/5a2bd0a)),
including six harness traps found by reading the config rather than hitting them —
`tsconfig.include` silently excluding `src/`, `starter.test.ts` pinning
`data-testid="intro"` into the home page. What told me the plan held was that the
file predicted what actually happened.

**Throwing away a design an hour after building it.** I built aiming as a nulling
task: move your crosshair until two readings match
([`3d40446`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/3d40446)).
It was fun and it taught nothing — you never learn that a loudness difference *is*
a height, you just wiggle until it agrees. The obvious fix was to add an
explanation; instead I deleted the mechanic and rebuilt the gauges as calibrated
readouts aligned to the field's own axes
([`3d40446...6526d42`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/compare/3d40446...6526d42)),
discarding the helpers I had written for nulling an hour earlier. Writing the
inverse then turned up something better than the design I set out to build: the
height coefficient goes to *exactly* zero when the ears are levelled, so the model
returns null rather than a bad number, and the test asserts zero rather than small.

**Being wrong twice, then moving the claim into the harness.** Asked why a human
cannot just tilt their head to the same effect, I gave a confident answer and wrote
it into the page. It was wrong, and this repo's own model contradicted it
([`d0a6e0e`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/d0a6e0e)).
Pushed again — "怎么可能大头转90°呀？那我如果稍微微微偏头25°，不就和他一样吗？" — the
second answer was wrong too. Prose had agreed with me both times. So instead of a
third paragraph I extended the model to represent a rolled head and asserted the
claim: tilted twenty-five degrees, two places ten target widths apart produce
identical timing *and* identical loudness; an owl at the same angle hears them apart
([`f29459e`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/f29459e)).
Being wrong twice about my own subject is the argument for putting claims where
they can fail.

**Building the sensor I kept saying I needed.** I ended many messages with
"unverified — no browser here", which was true and did not have to stay true.
`agent-browser` runs through `pnpm dlx`, and within minutes it showed two defects
82 passing tests could not: the hunt sat below the fold at 1920×1080, and the owl
read as a bat
([`b26a236`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/b26a236)).
The durable part is the `CLAUDE.md` section, not the screenshots — the three things
that cost time on the first run are written down so they cost nothing next week.

## Where the checks are

Beyond the shipped invariants, the tests worth reading assert the page's argument
rather than its implementation — chiefly that levelled ears carry *no* height
information rather than a little. A late accessibility sensor
([`14c7b87`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/14c7b87))
caught a prohibited `aria-label` screen readers had been dropping silently.
