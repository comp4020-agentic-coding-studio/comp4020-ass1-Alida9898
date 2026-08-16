# COMP4020 prototype

This is your starter repo for a COMP4020 prototype: a static site written in
HTML/CSS/TypeScript that builds to plain HTML/CSS/JS and deploys to GitHub
Pages. The **deployed site is what gets marked** --- not this repo, and not "it
works on my machine". It's marked live in Chrome against the deployed URL at two
viewports --- 1920×1080 (desktop) and 390×844 (phone) --- and both count in
full, so make that artefact good at both and use the checks below to know
whether it is.

What you're building this week — the spec — is published on the course website,
and this repo's name tells you which deliverable it is. Run the course plugin's
**start** skill at the start of each week: it pulls the right spec from the
course API, carries your harness forward from last week, and helps you turn the
spec's checkable lines into tests of your own. Read the spec before you build,
and see `spec/README.md` for how the checks in this repo relate to it.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Before you push, run `pnpm check`. It runs most of what CI runs --- build,
  lint, and the spec --- so you catch those in seconds instead of waiting for
  the pipeline. The links check, the evidence check, the secrets scan, and the
  deploy itself only run in CI; run `pnpm dlx linkinator ./dist --silent`
  locally against a fresh `pnpm build` for the links check without waiting for
  CI.
- To see what the page actually looks like rather than what you assume it looks
  like, open it in a browser (the `agent-browser` CLI, documented on
  [the course site](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/backpressure/#agent-browser-the-rendered-page-as-ground-truth),
  works well for this). The rendered page is the truth; your mental model of it
  isn't.
- When a check fails, read its output before changing anything. Each check below
  names what it measures, and the failure message is the instruction: it tells
  you the file, the line, or the contract. Treat a red check as authoritative
  --- the page is wrong until the check is green, not until you decide it should
  be.
- Commit when the checks pass. Never commit a red state.

## The checks (your sensors)

CI runs these on every push once your repo is public. GitHub's checks UI shows
two jobs, `check` and `deploy` --- not one status per sensor below --- and
within `check` the steps run in sequence (`pnpm check` chains typecheck, build,
lint, and the spec with `&&`), so an early failure like a broken build stops the
later sensors from running for that push; fix it and push again to see the rest.
While the repo is private (all week, until you ship) the CI jobs stay skipped
--- `pnpm check` is the same roster on your machine, and it's the faster loop
anyway. They aren't hoops. Each is a different way of finding out something true
about the site that you can't reliably see by looking at it.

They also carry a mark at a crit: the sweep runs fifteen minutes after your
cutoff, and green checks there are worth half that week's shipped mark. Still
running counts as not green, so ship with time for CI to finish.

- **typecheck** --- `tsc --noEmit` runs first in `pnpm check`, so a type error
  stops the roster before the build even starts. The types are extra
  backpressure: a red here is the compiler telling you a claim in the code is
  false.
- **build** --- the site must build (`pnpm build`). A build failure means the
  deployed site is broken or stale, so nothing else matters until this is green.
- **deploy / online** --- the live GitHub Pages URL must load and return the
  page you expect. An asset that 404s on the deployed URL counts as broken even
  if it loads locally.
- **spec** --- `spec/invariants.test.ts` asserts what's true of any good
  website, whatever the week's brief asks; the tests you write for the week's
  own spec run alongside it (any `spec/*.test.ts`). A failure names the contract
  you haven't met yet.
- **lint** --- `stylelint` for CSS, `oxlint` for TypeScript. Flags code that's
  wrong, fragile, or non-idiomatic. Read the rule it names.
- **tests** --- any other tests you write, wherever you put them (co-located
  with your source is fine, not just `spec/`), must pass. Vitest picks up both
  this and the spec suite in one `vitest run`, the last step of `pnpm check`. A
  failing test is a claim about the site that's no longer true.
- **evidence** (`pnpm check:evidence`) --- checks your process evidence:
  `PROCESS.md`'s citations resolve to real commits, the current deliverable's
  exact reflection is in `reflections/` (worked out from this repo's name
  against the public course API), and your `CLAUDE.md` is present. Evidence
  gates the deploy --- `deploy` needs `check` to pass, so failing evidence
  blocks the deploy alongside everything else. See
  [Your process is part of the mark](#your-process-is-part-of-the-mark) below,
  and the course website's
  [assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
  for what counts as evidence.
- **links** --- internal links must resolve. A broken link is a dead end you
  didn't mean to ship.
- **secrets** --- the repo is scanned for committed credentials. Never put a
  key, token, or password in a tracked file. If one leaks, rotate it. A local
  pre-commit hook (`.githooks/pre-commit`, installed by `pnpm install`) also
  blocks any commit containing something shaped like an API key --- by the time
  CI sees a key it's already pushed, so the hook is the sensor that matters.

Nothing here measures **accessibility** or **performance** --- wiring those
sensors (`axe-core`, Lighthouse, or whatever you choose) is your work, and later
in the course the spec will ask you to show how you tested both. When you do,
read a green performance result honestly: it's a lab estimate from one run on a
CI machine, not proof the site is fast for real users.

## The stack is swappable

Out of the box this is plain HTML/CSS/TypeScript on Vite, and every `.html` file
in the repo is a page: add pages, link them, and the build picks them up with no
config. That's a default, not a rule (unless the week's spec says otherwise).
You can swap in Astro or any other static generator, because nothing in CI names
a tool --- the whole contract is:

- `pnpm build` emits the complete site into `dist/`
- the `package.json` scripts (`check`, `check:evidence`, `build`) keep working
- whatever lands in `dist/` still passes the invariants in `spec/`

Two things bite in a swap. The deployed site lives under a path
(`…github.io/<repo>/`), so configure your generator's base path --- this
template's Vite config uses relative asset URLs to sidestep that, but most
generators (Astro included) need `base` set explicitly, and getting it wrong
looks fine locally while every asset 404s on the live URL. And commit the
updated `pnpm-lock.yaml`: CI installs with `--frozen-lockfile`.

## Your process is part of the mark

The deployed page is only half of it. How you got there is marked too: your
commit history, your agent files, and the decisions visible across them. The
checks above can't see any of that, so a person reads it directly --- which
means building legibly is part of building well.

- **Commit as you go.** Small, frequent commits are the record of how the work
  came together, and that record is read, not just the final state. A trail that
  grew alongside the code is the strongest evidence of your process; a single
  dump the night before is the weakest.
- **Keep a process overview** (`PROCESS.md`). A short reading-guide, not an
  essay: what you built, the moments that mattered --- each pointing at a
  commit, a `CLAUDE.md` change, or a prompt and the commit it produced --- and
  where to look in the history. It points a marker at the evidence; it doesn't
  stand in for it, and claims the history doesn't back don't count. The
  `PROCESS.md` in this repo is a template showing the shape and the citation
  format (link text the commit hash or range, target the commit or compare URL);
  `pnpm check:evidence` verifies your citations resolve to real commits before
  you ship. Markers follow those citations and don't trawl the repo for evidence
  you didn't cite.
- **Write your reflection in `reflections/`** --- a short markdown file in this
  repo, named for the deliverable it answers, so the number in the filename is
  the number in this repo's name (`crit-1.md` in `comp4020-crit1-<you>`,
  `assignment-1.md` in `comp4020-ass1-<you>`); `reflections/README.md` has the
  full rule. `pnpm check:evidence` checks the exact current name against the
  course API, not merely the presence of any well-named file. It answers the two
  standing prompts: the breakthrough that moved the work forward, and what this
  work changed about the developer you want to be. It stays out of the deployed
  site. It's due at the cutoff, and if it isn't in the repo by then the week
  doesn't count as shipped, however good the prototype is.
- **This file is process evidence.** The harness you build to direct the agent,
  this `CLAUDE.md` and any `AGENTS.md`, is itself read as part of how you
  worked. Keep it honest and current (see below).

You don't need a name, a student number, or any identity file in the repo: we
know whose repo it is. Spend the effort on the work.

## This file is yours

This CLAUDE.md is a starting point, not a fixed rulebook. As you learn what your
prototype needs --- a convention to hold the agent to, a sensor that keeps
catching you out, a fact about the stack the agent keeps getting wrong --- write
it down here. Growing this file is the work of harness engineering, and the gap
between this boilerplate and your own version is part of what your prototype
says about the developer you're becoming.

## Plan before building, when the ask is more than one thing

Phase 1 of the hunt was built as a complete, working mechanic --- you moved your
aim until two readings cancelled out --- reviewed, and then thrown away whole.
The scoping plan existed and was good (`PLAN.md`, cut the explainer down to ear
asymmetry alone). What was missing was a plan for the *interaction*, so the first
design that got imagined was the first design that got built, and the question
underneath it --- how does the page show that the owl works the height out in
advance? --- never got asked until there was working code to argue with.

So: when a request is more than one task, or when the shape of the thing is not
obvious yet, write the plan first and get it agreed before building. `PLAN.md`
for anything that outlives the session; a short numbered list in the conversation
for anything smaller. A plan is cheap to disagree with. A finished mechanic is
expensive, because disagreeing with it means someone has to accept the work was
wasted --- which is pressure to keep a bad design rather than admit it.

## Commit as each piece of work finishes, not at the end of a session

Crit 1 nearly shipped with nothing real behind it: a whole Windows 98 re-skin
was built, checked with `pnpm check`, and confirmed in the browser across many
turns of back-and-forth --- but never once committed. Because the last real
commit predated all of it, `git status -sb` showed the local branch level with
`origin/main`, which reads as "everything's pushed" even though what was
pushed was a bare stub. A tutor's automated nudge is what caught it, not a
local check.

So: after any turn that leaves the working tree passing `pnpm check` with a
real, reviewed change in it, commit before moving to the next request --- don't
wait for a natural stopping point, because "the session's about to end" isn't
a signal available until the deadline is already close. Before treating a
session as wrapped, run `git status -sb` and `git log --oneline @{upstream}..HEAD`
and confirm there's nothing sitting uncommitted, not just that the working
tree is clean.

## Looking at the page: agent-browser

The rendered page is the ground truth, and this project has no browser on the
PATH. `agent-browser` is not installed globally --- run it through pnpm:

```sh
ab() { pnpm dlx agent-browser@0.34.0 "$@"; }   # zsh: a function, NOT a variable
ab open http://localhost:5177/
ab set viewport 1920 1080     # `viewport` lives under `set`, not at top level
ab reload && ab screenshot /tmp/desktop.png
ab set viewport 390 844 && ab reload && ab screenshot /tmp/phone.png
ab a11y                       # axe-core in real Chrome
ab errors                     # page errors
ab close --all
```

Three things that cost time the first run:

- **zsh does not word-split unquoted parameters.** `AB="pnpm dlx ..."` then
  `$AB open` fails with `command not found` because the whole string is treated
  as one command name. Use a shell function.
- **`viewport` is a subcommand of `set`**, so bare `agent-browser viewport ...`
  answers `Unknown command`. Same for `device` and `media`.
- **`set viewport` needs a `reload`** before the screenshot, or you photograph
  the old layout.
- **`ab click <selector>` has silently done nothing** where
  `ab eval "document.querySelector('…').click()"` worked. A no-op click looks
  exactly like a page that ignored the click, so it is worth reaching for `eval`
  before concluding the page is broken --- prefer it when a click is load-bearing
  evidence.

Two checks only a real browser can do, so they do not belong in `pnpm check`:

- **Colour contrast.** `spec/accessibility.test.ts` runs axe in jsdom, which has
  no layout, so every geometric rule is skipped --- contrast included. `ab a11y`
  runs the same axe in Chrome and does evaluate it. Note that axe cannot measure
  SVG `<text>` at all and reports those as *incomplete*, so nothing automatic
  covers them --- a hand-check goes stale the moment the background moves, which
  is how amber labels ended up on a cream plate at 1.77:1 after being measured at
  8.6:1 on the dark. Where the geometry allows it, make the rule positional
  instead: `spec/pages.test.ts` forbids a label inside a plate's rect.
- **Both marking viewports.** 1920x1080 and 390x844 each count in full. Check
  that the hunt is reachable without a scroll at 1080 --- an interactive
  explainer whose interaction is below the fold has buried its own point.

## Navigation: collapse it on a phone, and make the collapse survive no JS

Three pages means a nav of three links plus the title. At 390px that fitted on
one line --- 358px of 390 --- so nothing looked broken. That is exactly why it
was worth changing: it was spending a whole row of vertical space on the viewport
that has the least of it, directly above the fold, on the page whose interaction
has to be reachable without scrolling.

So: more than two or three destinations in a horizontal nav, collapse them behind
a button below the phone breakpoint. Two traps, both of which look completely
finished while broken:

- **Ship the button with `hidden` and let the script remove it.** A hamburger
  that assumes its script ran leaves a button that opens nothing when it did
  not --- and that failure is invisible, because a dead button looks like a live
  one. The plain list is the correct no-script state.
- **Restore the list unconditionally above the breakpoint.** A phone left closed
  and then rotated past the breakpoint otherwise has no nav at all: the collapsed
  state is stale and nothing on screen says so. This is found by users, not by
  you, because you never rotate your own test device mid-session.

Both are pinned in `spec/nav.test.ts` and `spec/pages.test.ts`.

## Facts about this stack that have each cost a run

- **`tsconfig.include` is `["*.ts", "spec"]`.** Modules under `src/` are never
  typechecked. Entry modules live at the repo root --- that is why `main.ts`,
  `nav.ts` and `exhibit.ts` are where they are, and moving one "somewhere tidier"
  silently turns off its types.
- **jsdom: `document.textContent` is `null`** on a Document node, per the DOM
  spec. Use `document.body.textContent`. A test that reads the former does not
  error, it just matches nothing --- so it passes while asserting nothing.
- **jsdom has neither `matchMedia` nor `<dialog>`'s `showModal`/`close`.** Stub
  what you need *before* importing the module under test, since a module that
  reads them at load time has already run by the time your `beforeEach` fires.
- **`[hidden]` loses to any class that sets `display`.** The UA rule is
  `display: none` at specificity (0,1,0), so `.steps { display: flex }` beats it
  and the attribute does nothing at all. Pair every attribute-driven hide with
  its own `.thing[hidden] { display: none }`.
- **`filter: invert()` only works on line art.** A tonal drawing inverted is a
  photographic negative: the darkest thing in it --- eye sockets, holes --- comes
  out brightest, and no global tone curve fixes it. Print it positive instead.
  Related: never back a lossy image with a rect in a "matching" colour. The paper
  survives compression a few levels off and seams against it at a hard edge; bake
  the margin into the image so there is only one surface.
