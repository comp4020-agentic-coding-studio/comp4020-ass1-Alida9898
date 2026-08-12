// Rendering and input for the hunt. All the arithmetic lives in acoustics.ts,
// which is pure so spec/hunt.test.ts can hold it to account; this file only
// turns numbers into pixels and events into numbers.
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
  randomPrey,
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
const pulseLeft = need("pulse-left");
const pulseRight = need("pulse-right");
const barLeft = need("bar-left");
const barRight = need("bar-right");
const readTiming = need("read-timing");
const readLoudness = need("read-loudness");
const strikeButton = need<HTMLButtonElement>("strike");
const status = need("status");

const scoreCells: Record<EarMode, { hits: HTMLElement; strikes: HTMLElement; rate: HTMLElement }> = {
  uneven: { hits: need("uneven-hits"), strikes: need("uneven-strikes"), rate: need("uneven-rate") },
  level: { hits: need("level-hits"), strikes: need("level-strikes"), rate: need("level-rate") },
};

/** Full-scale readings, so the meters can be drawn as fractions of themselves. */
const FULL_SCALE_TIMING = Math.abs(itdMicroseconds({ x: 1, y: 0 }));
const FULL_SCALE_LOUDNESS = Math.abs(ild({ x: 1, y: 1 }, EAR_MODES.uneven));

/** How far one arrow-key press moves the aim. */
const KEY_STEP = 0.06;

/** How long the prey stays visible after a strike, in milliseconds. */
const REVEAL_MS = 1200;

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

function renderAim(): void {
  fieldAim.style.left = leftPercent(aim.x);
  fieldAim.style.top = topPercent(aim.y);
}

function renderPrey(): void {
  fieldPrey.hidden = !revealing;
  fieldPrey.style.left = leftPercent(prey.x);
  fieldPrey.style.top = topPercent(prey.y);
}

function renderTiming(): void {
  const microseconds = itdMicroseconds(prey);
  const spread = (microseconds / FULL_SCALE_TIMING) * 34;

  // Whichever ear hears it first sits earlier on the track, which is leftward.
  pulseLeft.style.left = `${50 + spread}%`;
  pulseRight.style.left = `${50 - spread}%`;

  const gap = Math.abs(microseconds);
  if (gap < 4) {
    readTiming.textContent = "Both ears at once — straight ahead.";
    return;
  }
  const first = microseconds > 0 ? "Right" : "Left";
  const side = microseconds > 0 ? "right" : "left";
  readTiming.textContent = `${first} ear first, by ${gap.toFixed(0)} µs — it is off to the ${side}.`;
}

function renderLoudness(): void {
  const decibels = ild(prey, EAR_MODES[mode]);
  const lean = (decibels / FULL_SCALE_LOUDNESS) * 40;

  barLeft.style.width = `${Math.min(95, Math.max(5, 50 - lean))}%`;
  barRight.style.width = `${Math.min(95, Math.max(5, 50 + lean))}%`;

  const gap = Math.abs(decibels);
  const louder = decibels > 0 ? "Right" : "Left";
  const reading = gap < 0.3 ? "Both ears equally loud" : `${louder} ear louder by ${gap.toFixed(1)} dB`;

  if (mode === "level") {
    readLoudness.textContent = `${reading} — and it says nothing about height.`;
    readLoudness.dataset.blind = "true";
    return;
  }
  const height = decibels > 0 ? "above" : "below";
  readLoudness.textContent = `${reading} — it is ${height} you.`;
  delete readLoudness.dataset.blind;
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

function render(): void {
  renderAim();
  renderPrey();
  renderTiming();
  renderLoudness();
  renderScore();
}

function nextRound(): void {
  prey = randomPrey(Math.random);
  revealing = false;
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

  revealing = true;
  strikeButton.disabled = true;
  render();

  const where = describe(prey);
  status.textContent = hit
    ? `Hit. It was ${where}.`
    : `Missed by ${distance(aim, prey).toFixed(2)}. It was ${where}.`;

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
  renderAim();
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
    renderAim();
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
