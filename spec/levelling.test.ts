// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

// The page levels your ears for you once you have got the hang of it, and that is
// the one dramatic moment it has. A moment that silently fails to fire is worse
// than no moment, and it is invisible to every other check here: the build is
// fine, the types are fine, the model is fine, and the page just never turns.
//
// This lives in its own file on purpose. The levelling fires once per page and
// only while the visitor has not touched the toggle themselves, so it needs a
// module instance nobody else has poked — which is exactly what a separate test
// file gets from vitest.

vi.useFakeTimers();

const shipped = readFileSync(resolve("dist/index.html"), "utf8");
document.body.innerHTML = new JSDOM(shipped).window.document.body.innerHTML;

await import("../main");

/** Matches KEY_STEP in main.ts. */
const KEY_STEP = 0.04;

function element(id: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`#${id}`);
  if (!found) throw new Error(`the shipped page has no #${id}`);
  return found;
}

/** Read a marker's position back out of its inline style, in field coordinates. */
function positionOf(id: string, axis: "left" | "top"): number {
  const percent = Number.parseFloat(element(id).style[axis] || "50%");
  return axis === "left" ? percent / 50 - 1 : 1 - percent / 50;
}

function press(key: string, times: number): void {
  for (let i = 0; i < times; i += 1) {
    element("field").dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  }
}

/**
 * Do what a visitor does: read both gauges, move the aim to where they cross.
 * With an owl's ears the gauges point exactly at the mouse, so this should hit.
 */
function aimWhereTheEarsSay(): void {
  const stepsAcross = Math.round((positionOf("h-sound", "left") - positionOf("field-aim", "left")) / KEY_STEP);
  const stepsHigh = Math.round((positionOf("v-sound", "top") - positionOf("field-aim", "top")) / KEY_STEP);
  press(stepsAcross > 0 ? "ArrowRight" : "ArrowLeft", Math.abs(stepsAcross));
  press(stepsHigh > 0 ? "ArrowUp" : "ArrowDown", Math.abs(stepsHigh));
}

function strikeAndSettle(): void {
  element("strike").click();
  vi.advanceTimersByTime(2000);
}

describe("reading both gauges is enough to hit", () => {
  it("connects every time with an owl's ears", () => {
    aimWhereTheEarsSay();
    strikeAndSettle();
    expect(
      Number(element("uneven-hits").textContent),
      "aiming where both gauges pointed still missed; with uneven ears a read-off aim must land",
    ).toBe(1);
  });
});

describe("the page levels your ears once you have the hang of it", () => {
  it("stays out of the way until then", () => {
    expect(element("reveal").hidden, "the reveal fired before it was earned").toBe(true);
    expect(
      document.querySelector<HTMLInputElement>("#ears-uneven")?.checked,
      "the hunt should open with an owl's ears",
    ).toBe(true);
  });

  it("switches the ears itself, unprompted, and says so", () => {
    // One hit is already banked by the test above.
    for (let round = 0; round < 4; round += 1) {
      aimWhereTheEarsSay();
      strikeAndSettle();
    }

    expect(
      Number(element("uneven-hits").textContent),
      "the run should have banked five hits with an owl's ears",
    ).toBe(5);

    expect(
      element("reveal").hidden,
      "five hits in and the page never told the visitor their ears had been levelled",
    ).toBe(false);

    expect(
      document.querySelector<HTMLInputElement>("#ears-level")?.checked,
      "the reveal fired but the toggle still shows an owl's ears; the page and its own control disagree",
    ).toBe(true);
  });

  it("does not fire twice", () => {
    const before = element("reveal").hidden;
    for (let round = 0; round < 3; round += 1) {
      strikeAndSettle();
    }
    expect(element("reveal").hidden).toBe(before);
    expect(document.querySelector<HTMLInputElement>("#ears-level")?.checked).toBe(true);
  });
});
