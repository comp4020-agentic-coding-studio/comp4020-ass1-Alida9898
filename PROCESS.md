# Process overview

## What I built

**The Owl's Uneven Ears** — an interactive explainer about why a barn owl's two
ear openings point in different directions, in three pages. **Hunt** is the
landing page: a mouse you cannot see, found by reading two gauges — how far
across, how high — with stereo audio, a scoreboard per pair of ears, and a field
that keeps every strike as a mark. You can switch between an owl's ears and your
own, and after three hits in a row the page switches them *for* you without
asking (*Difficulty: human.*), at which point the height gauge degrades to a
band. **How it works** carries the mechanism and two skull diagrams, owl against
human. **Why so lopsided** answers two objections, with a draggable exhibit for
what one decibel of error costs.

## The moments that mattered

### I deleted a mechanic that worked

The first playable version had you move your aim until two readings cancelled — a
decent game you could win without learning anything, since you wiggle until the
numbers agree. The obvious fix was a paragraph explaining what nulling meant; I
threw the mechanic out instead, because if an interaction needs a paragraph to
mean something, the paragraph is doing the work. I knew the rebuild was better
because it could be measured without me: 100.0% hit rate with an owl's ears
against 10.1% with level ones, driven in `spec/levelling.test.ts`.

[`3d40446...6526d42`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/compare/3d40446...6526d42)

### I was told the same wrong thing three times

Twice I pushed back on a confident explanation of why an owl cannot just tilt its
head — it did not match what having two ears feels like. Rather than correct the
sentence a third time, I had the distinction put into the model, so the page
could be *held* to it. It came back anyway, as a *drawing*: ear markers at
different heights, which is a tilted head. Prose I can argue with; a picture I
could only see. So it became a test that runs on every diagram on every page.

[`f29459e`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/f29459e)
· [`4ccfcab`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/4ccfcab)

### I gave the agent eyes

I was the only sensor for anything visual, so fixes were aimed at my description
of a problem rather than the problem. Wiring `agent-browser` caught the dialog
overflowing the 390px marking viewport and the hunt sitting below the fold at
1080 — both invisible to every check in the repo, both on the marked artefact.
It also taught me not to trust a tool's happy path: `ab click` silently did
nothing where `ab eval` worked. That went into `CLAUDE.md`, so it costs me the
time once.

[`b26a236`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/b26a236)
· [`66e230a`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/66e230a)

### The mouse should only rustle once

My idea, and it settled something quietly wrong: the page argues that prey under
snow makes one noise and does not repeat it, while the gauges sat up
indefinitely so you could take your time. The interaction contradicted the text. One listen per mouse, then you aim from memory — which
also answers the head-tilt objection by construction, since there is nothing left
to turn towards. Four tests hold it.

[`2ec0f55`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/2ec0f55)

## Where to look

- `CLAUDE.md` — the harness, grown as I hit things; every rule traces to
  something that happened.
- `acoustics.ts` — pure, no DOM, so `spec/hunt.test.ts` holds the physics to
  account independently of anything drawn.
- `spec/` — 115 tests. The useful ones are contracts a person would otherwise
  have to remember: no diagram draws a tilted head, the mouse rustles once, the
  nav works before its script does.
