// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

// The page levels your ears for you once you can hit reliably, and that is the one
// dramatic moment it has. A moment that silently fails to fire is worse than no
// moment, and it is invisible to every other check here: the build is fine, the
// types are fine, the model is fine, and the page just never turns.
//
// This lives in its own file on purpose. The levelling fires once per page and
// only while the visitor has not touched the toggle themselves, so it needs a
// module instance nobody else has poked — which is exactly what a separate test
// file gets from vitest. The `it` blocks below are one continuous run, in order.

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
  const across = Math.round(
    (positionOf("h-sound", "left") - positionOf("field-aim", "left")) / KEY_STEP,
  );
  const high = Math.round((positionOf("v-sound", "top") - positionOf("field-aim", "top")) / KEY_STEP);
  press(across > 0 ? "ArrowRight" : "ArrowLeft", Math.abs(across));
  press(high > 0 ? "ArrowUp" : "ArrowDown", Math.abs(high));
}

/** Aim at the far edge from the mouse, so the strike is certain to miss. */
function aimNowhereNear(): void {
  press(positionOf("v-sound", "top") > 0 ? "ArrowDown" : "ArrowUp", 60);
}

function strikeAndSettle(): void {
  element("strike").click();
  vi.advanceTimersByTime(2000);
}

function curtainIsUp(): boolean {
  return element("curtain").hasAttribute("open");
}

function hits(): number {
  return Number(element("uneven-hits").textContent);
}

describe("reading both gauges is enough to hit", () => {
  it("connects with an owl's ears", () => {
    aimWhereTheEarsSay();
    strikeAndSettle();
    expect(
      hits(),
      "aiming where both gauges pointed still missed; with uneven ears a read-off aim must land",
    ).toBe(1);
  });
});

describe("the page levels your ears once you can do it reliably", () => {
  it("stays out of the way while you are still finding your feet", () => {
    aimWhereTheEarsSay();
    strikeAndSettle();

    expect(hits()).toBe(2);
    expect(element("reveal").hidden, "the reveal fired before it was earned").toBe(true);
    expect(
      curtainIsUp(),
      "the page interrupted the visitor two hits in, before the run was established",
    ).toBe(false);
    expect(
      document.querySelector<HTMLInputElement>("#ears-uneven")?.checked,
      "the hunt should open with an owl's ears",
    ).toBe(true);
  });

  // The contract is a RUN of three, not three in total. Three lucky hits spread
  // through a dozen misses is not the moment of feeling reliable, and turning on
  // the visitor then would land as arbitrary rather than as a reveal.
  it("puts you back to zero when you miss", () => {
    aimNowhereNear();
    strikeAndSettle();
    expect(hits(), "the deliberate miss landed anyway; the rest of this run proves nothing").toBe(2);

    aimWhereTheEarsSay();
    strikeAndSettle();
    aimWhereTheEarsSay();
    strikeAndSettle();

    expect(hits()).toBe(4);
    expect(
      curtainIsUp(),
      "four hits banked and only two of them consecutive, yet the page turned; the trigger is counting a total rather than a run",
    ).toBe(false);
  });

  it("turns on the third hit in a row, unprompted, and says so", () => {
    aimWhereTheEarsSay();
    strikeAndSettle();

    expect(hits()).toBe(5);
    expect(
      element("reveal").hidden,
      "three in a row and the page never told the visitor their ears had been levelled",
    ).toBe(false);
    expect(
      document.querySelector<HTMLInputElement>("#ears-level")?.checked,
      "the reveal fired but the toggle still shows an owl's ears; the page and its own control disagree",
    ).toBe(true);
  });

  // An inline banner under the controls is too easy to play straight past, and
  // this is the only turn the page has. It has to interrupt.
  it("interrupts with a dialog rather than a line of text", () => {
    expect(
      curtainIsUp(),
      "the ears were levelled without stopping the visitor to say so",
    ).toBe(true);
    expect(element("curtain-heading").textContent).toContain("human");
  });

  it("gets out of the way again when dismissed", () => {
    element("curtain-dismiss").click();
    expect(
      curtainIsUp(),
      "the dialog would not close, so the hunt is unreachable behind it",
    ).toBe(false);
    expect(
      element("reveal").hidden,
      "the lingering note should stay after the dialog goes, as the record of what changed",
    ).toBe(false);
  });

  it("does not fire twice", () => {
    for (let round = 0; round < 4; round += 1) {
      aimWhereTheEarsSay();
      strikeAndSettle();
    }
    expect(curtainIsUp(), "the page turned on the visitor a second time").toBe(false);
    expect(document.querySelector<HTMLInputElement>("#ears-level")?.checked).toBe(true);
  });
});
