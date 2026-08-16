// The offset exhibit: what one decibel of slop costs at a given ear offset.
//
// Split out of main.ts when the explainer became three pages. It lives on
// why.html, where the hunt does not, and main.ts deliberately throws when an
// element it expects is missing — so a single module covering both pages would
// have meant either weakening that check or loading dead code. Two small modules
// keep the loud failure and cost nothing.
//
// All the arithmetic is in acoustics.ts. This file turns a slider into a rotation
// and a number into a bar.

import {
  EAR_JITTER_DECIBELS,
  earsWithOffset,
  heightUncertainty,
  HIT_RADIUS,
} from "./acoustics";

/** Same contract as main.ts: a missing element is a bug, not a degraded mode. */
function need<T extends HTMLElement>(id: string): T {
  const found = document.querySelector<T>(`#${id}`);
  if (!found) {
    throw new Error(`exhibit.ts expects #${id}, which why.html does not provide`);
  }
  return found;
}

const offsetSlider = need<HTMLInputElement>("offset");
const offsetBand = need("offset-band");
const offsetRead = need("offset-read");
const earLeft = need("offset-left");
const earRight = need("offset-right");

/**
 * Error is quoted in target widths because that is the unit the visitor has just
 * spent the hunt learning. A decibel is meaningless to most people; "you would
 * miss by three mice" is not.
 */
function renderOffset(): void {
  const degrees = Number(offsetSlider.value);

  // Only the cones turn. The ear markers stay level with each other on opposite
  // sides of the skull, because moving them apart vertically would draw a tilted
  // head — which is the one thing this whole section exists to distinguish an owl
  // from. Jiayi caught that being drawn wrong; a test now forbids it.
  earLeft.setAttribute("transform", `rotate(${-degrees} 67 55)`);
  earRight.setAttribute("transform", `rotate(${-degrees} 133 55)`);

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
