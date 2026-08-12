// Rendering and input for the hunt. All the arithmetic lives in acoustics.ts,
// which is pure so spec/hunt.test.ts can hold it to account; this file only
// turns numbers into pixels and events into numbers.
//
// Each gauge shows two things: what the owl is HEARING (the target) and what it
// WOULD hear from where it is currently aiming (the needle). The task is to line
// them up, which needs no units and no arithmetic — and is what a barn owl is
// doing when it turns its head towards a sound. Note that reading the aim's cues
// took no new model code: itd() and ild() were always functions of an arbitrary
// point, so the pure split paid for itself here.
//
// Positions are kept in normalised -1..1 coordinates and converted to pixels
// only at paint time, which is what makes a resize mid-strike a non-event.

import {
  EAR_MODES,
  type EarMode,
  type Point,
  clampToField,
  distance,
  ild,
  isHit,
  itdMicroseconds,
  loudnessAgrees,
  loudnessReading,
  randomPrey,
  timingAgrees,
  timingReading,
} from "./acoustics";

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
const targetTiming = need("target-timing");
const needleTiming = need("needle-timing");
const targetLoudness = need("target-loudness");
const needleLoudness = need("needle-loudness");
const readTiming = need("read-timing");
const readLoudness = need("read-loudness");
const figureTiming = need("figure-timing");
const figureLoudness = need("figure-loudness");
const loudnessKind = need("loudness-kind");
const lockLine = need("lock");
const strikeButton = need<HTMLButtonElement>("strike");
const status = need("status");

const scoreCells: Record<EarMode, { hits: HTMLElement; strikes: HTMLElement; rate: HTMLElement }> = {
  uneven: { hits: need("uneven-hits"), strikes: need("uneven-strikes"), rate: need("uneven-rate") },
  level: { hits: need("level-hits"), strikes: need("level-strikes"), rate: need("level-rate") },
};

/** How far from centre a gauge marker can travel, in percent. */
const GAUGE_SPAN = 42;

/** How far one arrow-key press moves the aim. */
const KEY_STEP = 0.05;

/** How long the prey stays visible after a strike, in milliseconds. */
const REVEAL_MS = 1400;

// Each mode's readings are normalised against its own full scale, so the loudness
// gauge fills its rail either way. Levelled ears swing over a smaller range in dB,
// and that autoscaling is what keeps the meter looking every bit as alive as it
// did before — which is the point being made. Flagged in the page footer.

const LOUDNESS_KIND: Record<EarMode, string> = {
  uneven: "each ear is deafest away from where it points",
  level: "both ears now point the same way",
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
let lastLockLine = "";

function leftPercent(value: number): string {
  return `${((value + 1) / 2) * 100}%`;
}

function topPercent(value: number): string {
  return `${((1 - value) / 2) * 100}%`;
}

/** Where a normalised cue reading sits on its gauge, in percent across the rail. */
function gaugeAt(reading: number): number {
  return 50 + clampToField(reading) * GAUGE_SPAN;
}

function timingGauge(point: Point): number {
  return gaugeAt(timingReading(point));
}

function loudnessGauge(point: Point): number {
  return gaugeAt(loudnessReading(point, EAR_MODES[mode]));
}

/** Which way to move so the needle closes on the target. */
function nudgeToward(agreed: boolean, target: number, needle: number, low: string, high: string): string {
  if (agreed) return "Matched.";
  return target > needle ? `Aim further ${high}.` : `Aim further ${low}.`;
}

function describe(point: Point): string {
  const vertical = point.y > 0.25 ? "high" : point.y < -0.25 ? "low" : "level with you";
  const lateral =
    point.x > 0.25 ? "to your right" : point.x < -0.25 ? "to your left" : "straight ahead";
  return `${vertical}, ${lateral}`;
}

function matched(): { timing: boolean; loudness: boolean } {
  return {
    timing: timingAgrees(aim, prey),
    loudness: loudnessAgrees(aim, prey, EAR_MODES[mode]),
  };
}

function render(): void {
  fieldAim.style.left = leftPercent(aim.x);
  fieldAim.style.top = topPercent(aim.y);

  fieldPrey.hidden = !revealing;
  fieldPrey.style.left = leftPercent(prey.x);
  fieldPrey.style.top = topPercent(prey.y);

  const timingTargetAt = timingGauge(prey);
  const timingNeedleAt = timingGauge(aim);
  targetTiming.style.left = `${timingTargetAt}%`;
  needleTiming.style.left = `${timingNeedleAt}%`;

  const loudnessTargetAt = loudnessGauge(prey);
  const loudnessNeedleAt = loudnessGauge(aim);
  targetLoudness.style.left = `${loudnessTargetAt}%`;
  needleLoudness.style.left = `${loudnessNeedleAt}%`;

  const lock = matched();

  readTiming.textContent = nudgeToward(
    lock.timing,
    timingTargetAt,
    timingNeedleAt,
    "left",
    "right",
  );
  figureTiming.textContent = `${Math.abs(itdMicroseconds(prey)).toFixed(0)} µs between your ears`;

  loudnessKind.textContent = LOUDNESS_KIND[mode];
  if (mode === "level") {
    const move = nudgeToward(lock.loudness, loudnessTargetAt, loudnessNeedleAt, "left", "right");
    readLoudness.textContent =
      move === "Matched." ? "Matched." : `${move.slice(0, -1)} — which the timing already told you.`;
    readLoudness.dataset.blind = "true";
  } else {
    readLoudness.textContent = nudgeToward(
      lock.loudness,
      loudnessTargetAt,
      loudnessNeedleAt,
      "lower",
      "higher",
    );
    delete readLoudness.dataset.blind;
  }
  const loudnessGap = Math.abs(ild(prey, EAR_MODES[mode]));
  figureLoudness.textContent = `${loudnessGap.toFixed(1)} dB between your ears`;

  const both = lock.timing && lock.loudness;
  lockLine.dataset.locked = String(both);
  const line = both
    ? "Both readings matched — strike."
    : lock.timing
      ? "Left–right matched. The other reading is still off."
      : lock.loudness
        ? "One reading matched. Left–right is still off."
        : "Both readings still off.";
  if (line !== lastLockLine) {
    lockLine.textContent = line;
    lastLockLine = line;
  }

  for (const key of ["uneven", "level"] as const) {
    const { hits, strikes } = tally[key];
    const cells = scoreCells[key];
    cells.hits.textContent = String(hits);
    cells.strikes.textContent = String(strikes);
    cells.rate.textContent = strikes === 0 ? "—" : `${Math.round((hits / strikes) * 100)}%`;
  }
}

function nextRound(): void {
  prey = randomPrey(Math.random);
  revealing = false;
  render();
}

function strike(): void {
  if (revealing) return;

  const lock = matched();
  const wasLocked = lock.timing && lock.loudness;
  const hit = isHit(aim, prey);
  const current = tally[mode];
  current.strikes += 1;
  if (hit) {
    current.hits += 1;
  }

  revealing = true;
  strikeButton.disabled = true;
  render();

  const where = describe(prey);
  if (hit) {
    status.textContent = `Hit. It was ${where}.`;
  } else if (wasLocked && mode === "level") {
    // The whole argument, delivered at the moment it costs something.
    status.textContent = `Missed. It was ${where}. Your instruments agreed — they just could not see height.`;
  } else {
    status.textContent = `Missed by ${distance(aim, prey).toFixed(2)}. It was ${where}.`;
  }

  window.setTimeout(() => {
    strikeButton.disabled = false;
    status.textContent = "Aim, then strike.";
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
    mode = input.value === "level" ? "level" : "uneven";
    nextRound();
  }
}

field.addEventListener("pointerdown", onPointerDown);
field.addEventListener("pointermove", onPointerMove);
field.addEventListener("pointerup", onPointerUp);
field.addEventListener("pointercancel", onPointerUp);
field.addEventListener("keydown", onKeyDown);
strikeButton.addEventListener("click", strike);

for (const input of document.querySelectorAll<HTMLInputElement>('input[name="ears"]')) {
  input.addEventListener("change", onEarsChange);
}

render();
