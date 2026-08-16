# Process overview

## What I built

**The Owl's Uneven Ears** — an interactive explainer about why a barn owl's two
ear openings point in different directions. You hunt a mouse you cannot see,
reading two gauges: one for how far across, one for how high. After three hits in
a row the page levels your ears without asking — *Difficulty: human.* — and the
gauge for height goes blank, because with a level pair there is no height to
read. The argument is the thing you just did, not the paragraph underneath it.

## The moments that mattered

### I deleted a mechanic that worked

The first playable version had you move your aim until the two readings cancelled
out. It was a decent little game and I built it properly. But I played it and
realised you could win it without ever learning anything: you wiggle until the
numbers agree, and you never find out that a loudness difference *is* a height.

The obvious fix was to add a paragraph explaining what the nulling meant. I threw
the mechanic away instead and rebuilt the gauges as calibrated axes you read a
position off — because if the interaction needs a paragraph to mean something,
the paragraph is doing the work and the interaction is decoration. An owl does
not wiggle. It hears the sound once and drops.

How I knew: the rebuilt version can be checked without me. Reading both gauges and
aiming where they cross hits **100.0%** of the time with an owl's ears and
**10.1%** with level ones, and `spec/levelling.test.ts` drives the page like a
visitor to prove it.

[`3d40446...6526d42`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/compare/3d40446...6526d42)

### I was told the same wrong thing three times, so I stopped relying on being told

I asked why an owl does not simply tilt its head, and got a confident answer that
did not match what having two ears actually feels like. I pushed back. The second
answer used a 90° strawman, which made it sound like a question of *how much* you
tilt — but if I tilt 25°, that is exactly the offset an owl has, so what is
different? The real answer is *what moves*: a tilt carries the ear **positions**
round with it, and positions set the timing axis, so both cues turn together. An
owl moves only where each ear **aims**.

Rather than fix the sentence, I put the distinction into the model —
`itdRolled()` and `earsRolled()` — so the page can be *held* to it instead of
merely asserting it. That turned out to matter: the same confusion came back a
third time as a **drawing**, where the owl diagram had its ear markers at
different heights, which is a tilted head. I caught that by eye in a screenshot.
Prose I can argue with; a picture I could only see.

So it became a test. `spec/pages.test.ts` now fails if any diagram on any page
puts a pair of ear markers at different `cy` values.

[`f29459e`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/f29459e)
· [`4ccfcab`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/4ccfcab)

### I gave the agent eyes, because I was the only one who could see

For a long stretch I was the only sensor for anything visual. I would describe
what looked wrong and get a fix aimed at my description of the problem rather
than at the problem. So I had `agent-browser` wired in — not because the unit
asked for it, but because the loop was too slow.

It paid for itself immediately: it found the dialog overflowing the 390px marking
viewport and the hunt sitting below the fold at 1080. Both were invisible to
every check in the repo, and both were on the marked artefact.

It also taught me not to trust a tool's happy path — `ab click` silently did
nothing where `ab eval "…click()"` worked, and I nearly reported a working
control as broken. That went into `CLAUDE.md` so it costs me the time once.

[`b26a236`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/b26a236)
· [`66e230a`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/66e230a)

### A label I could not read, that no checker could see

Late on, I said the *up* and *down* labels on the owl diagram were not clear
against the cream of the skull plate. Measured: amber on that cream is
**1.77:1**, against the 4.5:1 WCAG asks for. It was not tight, it was
unreadable — and `axe` passed the page with zero violations, because axe does not
measure SVG `<text>` at all.

The obvious fix was to darken the text. Instead I moved the labels off the
plates onto the page's dark ground, where the same amber is **8.60:1** — which
also made the two diagrams agree with each other, since the human one already had
its labels outside. Then I turned my own eye into a check: a label may not sit
inside a plate's rectangle. I verified the test fails by moving a label back.

[`b29d189`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/b29d189)

## Where to look

- `CLAUDE.md` — the harness, grown as I hit things: the commit-as-you-go rule
  carried forward from crit 2, and the agent-browser section with the gotchas
  that each cost me a first run.
- `acoustics.ts` — pure, no DOM, so `spec/hunt.test.ts` can hold the physics to
  account independently of anything drawn.
- `spec/` — 115 tests. The ones I care about are the contracts a person would
  otherwise have to remember: no diagram draws a tilted head, the mouse rustles
  once, labels stay off the plates, the nav works before its script does.
