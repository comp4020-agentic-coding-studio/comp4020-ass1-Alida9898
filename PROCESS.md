# Process overview

## What I built

**The Owl's Uneven Ears** — an interactive explainer about why a barn owl's two
ear openings point in different directions. You hunt a mouse you cannot see using
two gauges. After three hits in a row the page levels your ears without asking —
*Difficulty: human.* — and the gauge for height goes blank, because a level pair
has no height to read.

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

## Where to look

- `CLAUDE.md` — the harness, grown as I hit things. Each rule traces to something
  that happened: plan before building, collapse the nav on a phone, and five
  stack facts that each cost a run.
- `acoustics.ts` — pure, no DOM, so `spec/hunt.test.ts` holds the physics to
  account independently of anything drawn.
- `spec/` — 115 tests. The ones that matter are the contracts a person would
  otherwise have to remember: no diagram draws a tilted head, the mouse rustles
  once, labels stay off the plates, the nav works before its script does.
