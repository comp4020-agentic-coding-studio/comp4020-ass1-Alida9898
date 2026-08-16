# Process overview

## What I built

**The Owl's Uneven Ears** — an interactive explainer about why a barn owl's two
ear openings point in different directions, in three pages.

**Hunt** is the landing page: a mouse you cannot see, found by reading two
gauges — one for how far across, one for how high — with real stereo audio, a
scoreboard kept separately per pair of ears, and a field that keeps every strike
as a mark. You can switch between an owl's ears and your own at any time, and
after three hits in a row the page switches them *for* you without asking
(*Difficulty: human.*), at which point the height gauge becomes a wide band
instead of a point. **How it works** carries the mechanism and the two skull
diagrams, owl against human. **Why so lopsided** answers two objections, with a
draggable exhibit for what one decibel of error costs at a given ear offset.

## The moments that mattered

### I deleted a mechanic that worked

The first playable version had you move your aim until two readings cancelled.
It was a decent game you could win without learning anything — you wiggle until
the numbers agree. The obvious fix was a paragraph explaining what nulling meant;
I threw the mechanic out instead, because if the interaction needs a paragraph to
mean something then the paragraph is doing the work. Checked by rebuilding it so
it could be measured without me: 100.0% hit rate with an owl's ears, 10.1% with
level ones, driven in `spec/levelling.test.ts`.

[`3d40446...6526d42`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/compare/3d40446...6526d42)

### I was told the same wrong thing three times

Twice I pushed back on a confident explanation of why an owl cannot just tilt its
head, because it did not match what two ears feel like. Rather than fix the
sentence again I put the distinction into the model, so the page could be held to
it. That mattered: it came back a third time as a *drawing* — ear markers at
different heights, which is a tilted head — and I caught it by eye in a
screenshot. Prose I can argue with; a picture I could only see. So it became a
test that runs on every diagram on every page.

[`f29459e`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/f29459e)
· [`4ccfcab`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/4ccfcab)

### I gave the agent eyes

I was the only sensor for anything visual, so fixes were aimed at my description
of a problem rather than the problem. Wiring `agent-browser` found the dialog
overflowing the 390px marking viewport and the hunt sitting below the fold at
1080 — both invisible to every check in the repo, both on the marked artefact.

[`b26a236`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/b26a236)
· [`66e230a`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/66e230a)

### A label no checker could see

I said the diagram labels were hard to read. Measured: 1.77:1, against WCAG's
4.5 — and `axe` passed the page with zero violations, because it does not measure
SVG `<text>` at all. I moved the labels onto the dark ground (8.60:1) instead of
darkening them, which also made the two diagrams agree, then turned my own eye
into a rule: a label may not sit inside a plate. Verified by moving one back.

[`b29d189`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/b29d189)

### The mouse should only rustle once

My idea, and it settled something that had been quietly wrong: the page argues
that prey under snow makes one short noise and does not repeat it, while the
gauges sat there indefinitely so you could take all the time you liked. The
interaction was contradicting the text. One listen per mouse, then you aim from
memory — which also answers the tilt objection by construction, since there is
nothing left to turn your head towards. Four tests in `spec/wiring.test.ts` hold
it: nothing before you listen, a reading when you do, gone after, and no repeat
for the same mouse.

[`2ec0f55`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/2ec0f55)

### I asked for the human comparison, then cut it back

Comparing an owl's ears to ours was my suggestion and it became the page's angle.
Later I decided that was wrong: the subject is the owl's ears themselves, and the
comparison is a way of seeing them, not the point. So it went back to a small
section while the hunt kept both modes — and, separately, level ears now report a
*band* rather than nothing, because a human hearing no height at all is not what
happens.

[`8d0b739`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/8d0b739) · [`4efe23f`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Alida9898/commit/4efe23f)

## Where to look

- `CLAUDE.md` — the harness, grown as I hit things. Each rule traces to something
  that happened: plan before building, collapse the nav on a phone, and five
  stack facts that each cost a run.
- `acoustics.ts` — pure, no DOM, so `spec/hunt.test.ts` holds the physics to
  account independently of anything drawn.
- `spec/` — 115 tests. The ones that matter are the contracts a person would
  otherwise have to remember: no diagram draws a tilted head, the mouse rustles
  once, labels stay off the plates, the nav works before its script does.
