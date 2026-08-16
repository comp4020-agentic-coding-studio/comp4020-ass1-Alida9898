// Rendering and input for the hunt. All the arithmetic lives in acoustics.ts,
// which is pure so spec/hunt.test.ts can hold it to account; this file only turns
// numbers into pixels and events into numbers.
//
// The two gauges share the field's own axes — one along the bottom for how far
// across, one up the side for how high — and each shows a ring where the ears say
// the sound is, plus a dot where the aim currently is. That is a deliberate
// change from an earlier version where the visitor moved their aim until two
// readings matched: matching worked as a game but taught nothing, because you
// never learn that a loudness difference IS a height, you just wiggle until it
// agrees. An owl does not wiggle. It hears the sound once and drops.
//
// Positions are kept in normalised -1..1 coordinates and converted to pixels only
// at paint time, which is what makes a resize mid-strike a non-event.

import {
  EAR_MODES,
  type EarMode,
  type Point,
  clampToField,
  distance,
  ild,
  infer,
  type Inference,
  isHit,
  itdMicroseconds,
  EAR_JITTER_DECIBELS,
  earsWithOffset,
  heightUncertainty,
  HIT_RADIUS,
  randomPrey,
  stereoCue,
} from "./acoustics";
import { canListen, play } from "./listen";

/**
 * A required element. Throwing is deliberate: if the markup and this file drift
 * apart, a loud failure in the console beats a page that silently half-works.
 */
function need<T extends HTMLElement>(id: string): T {
  const found = document.querySelector<T>(`#${id}`);
  if (!found) {
    throw new Error(`main.ts expects #${id}, which index.html does not provide`);
  }
  return found;
}

const field = need("field");
const fieldAim = need("field-aim");
const fieldPrey = need("field-prey");
const fieldMarks = need("field-marks");
const rig = need("rig");
const reveal = need("reveal");
const curtain = need<HTMLDialogElement>("curtain");
const curtainDismiss = need("curtain-dismiss");
const gaugeV = need("gauge-v");
const soundV = need("v-sound");
const aimV = need("v-aim");
const soundH = need("h-sound");
const aimH = need("h-aim");
const readTiming = need("read-timing");
const readLoudness = need("read-loudness");
const figureTiming = need("figure-timing");
const figureLoudness = need("figure-loudness");
const loudnessKind = need("loudness-kind");
const bearing = need("bearing");
const strikeButton = need<HTMLButtonElement>("strike");
const listenButton = need<HTMLButtonElement>("listen");
const listenNote = need("listen-note");
const offsetSlider = need<HTMLInputElement>("offset");
const offsetBand = need("offset-band");
const offsetRead = need("offset-read");
const earLeft = need("offset-left");
const earRight = need("offset-right");
const status = need("status");

const scoreCells: Record<EarMode, { hits: HTMLElement; strikes: HTMLElement; rate: HTMLElement }> = {
  uneven: { hits: need("uneven-hits"), strikes: need("uneven-strikes"), rate: need("uneven-rate") },
  level: { hits: need("level-hits"), strikes: need("level-strikes"), rate: need("level-rate") },
};

/** How far one arrow-key press moves the aim. */
const KEY_STEP = 0.04;

/** How long the prey stays visible after a strike, in milliseconds. */
const REVEAL_MS = 1400;

/**
 * How long the readings stay up after the mouse rustles, in milliseconds.
 *
 * The page argues that prey under snow makes one short noise and does not repeat
 * it — and until now the gauges sat there indefinitely while you took your time,
 * which quietly contradicted the whole thing. One listen per mouse, then you aim
 * from what you remember. It also settles the tilt objection by construction:
 * there is nothing left to turn your head towards.
 */
const RUSTLE_MS = 1800;

/**
 * Hits in a row with an owl's ears before the page levels them for you.
 *
 * A run rather than a running total, because the turn should land the moment you
 * feel reliable — and three lucky hits scattered through a dozen misses is not
 * that. A miss puts you back to zero.
 *
 * The toggle was always there, but a control you choose to flip is not a
 * surprise, and the point lands harder when it happens TO you. Only fires if you
 * have not already found the toggle yourself; once you have, the surprise is
 * spent.
 */
const STREAK_BEFORE_LEVELLING = 3;

/** Marks kept on the field. Enough to see the pattern, not enough to smother it. */
const MAX_MARKS = 60;

const LOUDNESS_KIND: Record<EarMode, string> = {
  uneven: "from which ear hears it louder — the gauge up the side",
  level: "both ears now point the same way, so this gauge has nothing to show",
};

interface Tally {
  hits: number;
  strikes: number;
}

const tally: Record<EarMode, Tally> = {
  uneven: { hits: 0, strikes: 0 },
  level: { hits: 0, strikes: 0 },
};

let mode: EarMode = "uneven";
let prey: Point = randomPrey(Math.random);
let aim: Point = { x: 0, y: 0 };
let revealing = false;
let dragging = false;
let hearing = false;
let heardThisRound = false;
let chosenByVisitor = false;
let levelledForYou = false;
let streak = 0;

interface Mark {
  readonly at: Point;
  readonly hit: boolean;
}

const marks: Record<EarMode, Mark[]> = { uneven: [], level: [] };

function leftPercent(value: number): string {
  return `${((value + 1) / 2) * 100}%`;
}

function topPercent(value: number): string {
  return `${((1 - value) / 2) * 100}%`;
}

function describe(point: Point): string {
  const vertical = point.y > 0.25 ? "high" : point.y < -0.25 ? "low" : "level with you";
  const lateral =
    point.x > 0.25 ? "to your right" : point.x < -0.25 ? "to your left" : "straight ahead";
  return `${vertical}, ${lateral}`;
}

/**
 * Where the sound sits relative to the aim, in words.
 *
 * The gauges are aria-hidden decoration and the cue readouts only describe the
 * sound, so without this a keyboard user can tab to the field, hear what it is,
 * and still have no way to know which direction to move. Announced per keypress,
 * which is one update per deliberate action rather than chatter.
 */
function bearingText(heard: Inference): string {
  const step = 0.05;
  const across =
    heard.across - aim.x > step ? "right" : aim.x - heard.across > step ? "left" : null;

  if (heard.high === null) {
    const lateral = across === null ? "lined up left to right" : `${across} of your aim`;
    return `Sound ${lateral}. Height unknown with level ears.`;
  }

  const high = heard.high - aim.y > step ? "above" : aim.y - heard.high > step ? "below" : null;
  if (across === null && high === null) return "Aim is on the sound.";
  const parts = [high, across].filter((part) => part !== null);
  return `Sound ${parts.join(" and ")} your aim.`;
}

function render(): void {
  const ears = EAR_MODES[mode];
  const heard = infer(prey, ears);

  fieldAim.style.left = leftPercent(aim.x);
  fieldAim.style.top = topPercent(aim.y);

  fieldPrey.hidden = !revealing;
  fieldPrey.style.left = leftPercent(prey.x);
  fieldPrey.style.top = topPercent(prey.y);

  // Your own aim is always on the gauges; the sound is only there while it lasts.
  aimH.style.left = leftPercent(aim.x);
  aimV.style.top = topPercent(aim.y);

  rig.dataset.hearing = String(hearing);

  const height = heard.high;
  soundH.hidden = !hearing;
  soundV.hidden = !hearing || height === null;
  if (hearing) {
    soundH.style.left = leftPercent(heard.across);
    if (height !== null) {
      soundV.style.top = topPercent(height);
    }
  }
  gaugeV.dataset.blind = String(hearing && height === null);

  if (!hearing) {
    readTiming.textContent = heardThisRound
      ? "Gone. Strike from what you heard."
      : "Nothing yet. Press Listen.";
    readLoudness.textContent = readTiming.textContent;
    figureTiming.textContent = "";
    figureLoudness.textContent = "";
    delete readLoudness.dataset.blind;
    bearing.textContent = heardThisRound ? "The sound has gone." : "";
    renderScore();
    return;
  }

  const microseconds = itdMicroseconds(prey);
  const sooner = Math.abs(microseconds);
  readTiming.textContent =
    sooner < 4
      ? "Both ears at once — it is straight ahead."
      : `${microseconds > 0 ? "Right" : "Left"} ear hears it ${sooner.toFixed(0)} µs sooner.`;
  figureTiming.textContent = "The head start gives the direction.";

  const decibels = ild(prey, ears);
  const gap = Math.abs(decibels);
  const louder = decibels > 0 ? "Right" : "Left";
  const reading =
    gap < 0.3 ? "Both ears equally loud" : `${louder} ear hears it ${gap.toFixed(1)} dB louder`;

  loudnessKind.textContent = LOUDNESS_KIND[mode];
  if (height === null) {
    // The measurement is real; the inference is not. That distinction is the
    // whole page, so the readout has to make it rather than going blank.
    readLoudness.textContent = `${reading} — and that is not a height at all.`;
    figureLoudness.textContent = "Level ears: the difference no longer varies with height.";
    readLoudness.dataset.blind = "true";
  } else {
    readLoudness.textContent = `${reading}.`;
    figureLoudness.textContent = "The right ear points up, so the difference gives the height.";
    delete readLoudness.dataset.blind;
  }

  bearing.textContent = bearingText(heard);
  renderScore();
}

function renderScore(): void {
  for (const key of ["uneven", "level"] as const) {
    const { hits, strikes } = tally[key];
    const cells = scoreCells[key];
    cells.hits.textContent = String(hits);
    cells.strikes.textContent = String(strikes);
    cells.rate.textContent = strikes === 0 ? "—" : `${Math.round((hits / strikes) * 100)}%`;
  }
}

/** One rustle: the readings appear, the sound plays, and then it is over. */
function rustle(): void {
  if (heardThisRound || revealing) return;
  heardThisRound = true;
  hearing = true;
  listenButton.disabled = true;
  play(stereoCue(prey, EAR_MODES[mode]));
  render();

  window.setTimeout(() => {
    hearing = false;
    render();
  }, RUSTLE_MS);
}

/**
 * Redraw the strike history. Deliberately separate from render(): render() runs on
 * every pointermove, and marks only change on a strike.
 *
 * Only the current pair of ears is shown. Mixing them would destroy the picture,
 * and the picture is the argument — under level ears the green marks collapse into
 * a band at whatever height you kept guessing, with red filling in the rest.
 */
function renderMarks(): void {
  fieldMarks.replaceChildren();
  for (const mark of marks[mode]) {
    const dot = document.createElement("span");
    dot.className = "field-mark";
    dot.dataset.hit = String(mark.hit);
    dot.style.left = leftPercent(mark.at.x);
    dot.style.top = topPercent(mark.at.y);
    fieldMarks.append(dot);
  }
}

// jsdom implements HTMLDialogElement but not showModal/close, so both paths fall
// back to the open attribute. Chrome gets the real thing: backdrop, focus trap,
// Esc to dismiss.

function raiseCurtain(): void {
  if (typeof curtain.showModal === "function") {
    curtain.showModal();
  } else {
    curtain.setAttribute("open", "");
  }
}

function dropCurtain(): void {
  if (typeof curtain.close === "function") {
    curtain.close();
  } else {
    curtain.removeAttribute("open");
  }
  field.focus();
}

/** Switch ears, from the radio or from the page's own hand. */
function setEars(next: EarMode): void {
  mode = next;
  streak = 0;
  const input = document.querySelector<HTMLInputElement>(`#ears-${next}`);
  if (input) {
    input.checked = true;
  }
  renderMarks();
  nextRound();
}

function nextRound(): void {
  prey = randomPrey(Math.random);
  revealing = false;
  hearing = false;
  heardThisRound = false;
  listenButton.disabled = false;
  render();
}

function strike(): void {
  if (revealing) return;

  const hit = isHit(aim, prey);
  const current = tally[mode];
  current.strikes += 1;
  if (hit) {
    current.hits += 1;
  }
  streak = hit ? streak + 1 : 0;

  marks[mode].push({ at: prey, hit });
  if (marks[mode].length > MAX_MARKS) {
    marks[mode].shift();
  }

  revealing = true;
  strikeButton.disabled = true;
  render();
  renderMarks();

  const where = describe(prey);
  if (hit) {
    status.textContent = `Hit. It was ${where}.`;
  } else if (mode === "level" && Math.abs(aim.x - prey.x) < 0.15) {
    // Right column, wrong row: name it, because that is the lesson.
    status.textContent = `Missed high or low. It was ${where} — your ears never told you which.`;
  } else {
    status.textContent = `Missed by ${distance(aim, prey).toFixed(2)}. It was ${where}.`;
  }

  window.setTimeout(() => {
    strikeButton.disabled = false;
    status.textContent = "Aim, then strike.";

    const readyToLevel =
      mode === "uneven" &&
      !chosenByVisitor &&
      !levelledForYou &&
      streak >= STREAK_BEFORE_LEVELLING;

    if (readyToLevel) {
      levelledForYou = true;
      reveal.hidden = false;
      setEars("level");
      raiseCurtain();
      return;
    }

    nextRound();
  }, REVEAL_MS);
}

function aimFromPointer(event: PointerEvent): void {
  const bounds = field.getBoundingClientRect();
  aim = {
    x: clampToField(((event.clientX - bounds.left) / bounds.width) * 2 - 1),
    y: clampToField(1 - ((event.clientY - bounds.top) / bounds.height) * 2),
  };
  render();
}

function onPointerDown(event: PointerEvent): void {
  dragging = true;
  field.setPointerCapture(event.pointerId);
  field.focus();
  aimFromPointer(event);
}

function onPointerMove(event: PointerEvent): void {
  if (dragging) {
    aimFromPointer(event);
  }
}

function onPointerUp(): void {
  dragging = false;
}

function onKeyDown(event: KeyboardEvent): void {
  const nudges: Record<string, Point> = {
    ArrowLeft: { x: -KEY_STEP, y: 0 },
    ArrowRight: { x: KEY_STEP, y: 0 },
    ArrowUp: { x: 0, y: KEY_STEP },
    ArrowDown: { x: 0, y: -KEY_STEP },
  };

  const nudge = nudges[event.key];
  if (nudge) {
    event.preventDefault();
    aim = { x: clampToField(aim.x + nudge.x), y: clampToField(aim.y + nudge.y) };
    render();
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    strike();
  }
}

function onEarsChange(event: Event): void {
  const input = event.currentTarget;
  if (input instanceof HTMLInputElement && input.checked) {
    chosenByVisitor = true;
    setEars(input.value === "level" ? "level" : "uneven");
  }
}

/**
 * The supporting exhibit: what a decibel of slop costs at a given offset.
 *
 * Deliberately separate from the hunt, and deliberately not a replacement for the
 * two-way toggle — the owl-versus-you comparison is the page's argument, and this
 * is a footnote to it about magnitude. Error is quoted in target widths because
 * that is the unit the visitor has just spent ten minutes learning.
 */
function renderOffset(): void {
  const degrees = Number(offsetSlider.value);

  // Only the cones turn. The ear markers stay level with each other on opposite
  // sides of the skull, because moving them apart vertically would draw a tilted
  // head — which is the one thing this whole section exists to distinguish an owl
  // from. Jiayi caught that being drawn wrong; the test below now forbids it.
  earLeft.setAttribute("transform", `rotate(${-degrees} 61.5 48)`);
  earRight.setAttribute("transform", `rotate(${-degrees} 137 48)`);

  const spread = heightUncertainty(earsWithOffset(degrees), EAR_JITTER_DECIBELS);

  if (!Number.isFinite(spread)) {
    offsetBand.style.width = "100%";
    offsetRead.textContent =
      "Level. There is no height to be out by — the division has nothing to divide by.";
    return;
  }

  const targets = spread / HIT_RADIUS;
  // The bar is the error as a share of the field's full height, capped at the rail.
  offsetBand.style.width = `${Math.min(100, (spread / 2) * 100)}%`;
  const verdict =
    targets < 2
      ? "Sharp enough to strike with."
      : targets < 6
        ? "You would miss more than you hit."
        : "Not a measurement any more.";
  offsetRead.textContent = `${degrees}° offset: one decibel of slop puts the height out by ${targets.toFixed(1)} target widths. ${verdict}`;
}

offsetSlider.addEventListener("input", renderOffset);
renderOffset();

field.addEventListener("pointerdown", onPointerDown);
field.addEventListener("pointermove", onPointerMove);
field.addEventListener("pointerup", onPointerUp);
field.addEventListener("pointercancel", onPointerUp);
field.addEventListener("keydown", onKeyDown);
strikeButton.addEventListener("click", strike);

listenButton.addEventListener("click", rustle);

// Audio is still an addition and never a dependency: without it, Listen does
// everything except make a noise — the readings appear and fade exactly the same.
if (!canListen()) {
  listenNote.textContent =
    "This browser has no Web Audio, so Listen shows the reading without playing it. The gauges carry the whole argument either way.";
}
curtainDismiss.addEventListener("click", dropCurtain);
curtain.addEventListener("close", () => field.focus());

for (const input of document.querySelectorAll<HTMLInputElement>('input[name="ears"]')) {
  input.addEventListener("change", onEarsChange);
}

render();
renderMarks();
