// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// The offset exhibit moved to why.html when the explainer became three pages, and
// exhibit.ts refuses to load against a document that does not provide its
// elements. So it gets its own file: a fresh module registry and a document that
// is why.html rather than the hunt.
//
// What it has to prove is that the exhibit makes its point in the direction the
// prose claims — a smaller offset is WORSE — and that zero is reported as an
// absence rather than as a very large number, which would contradict the rest of
// the page.

const shipped = readFileSync(resolve("dist/why.html"), "utf8");
document.body.innerHTML = new JSDOM(shipped).window.document.body.innerHTML;

await import("../exhibit");

function text(id: string): string {
  return document.querySelector(`#${id}`)?.textContent?.trim() ?? "";
}

function setOffset(degrees: number): void {
  const slider = document.querySelector<HTMLInputElement>("#offset");
  if (!slider) throw new Error("no offset slider in the shipped page");
  slider.value = String(degrees);
  slider.dispatchEvent(new Event("input"));
}

describe("the offset exhibit answers why so lopsided", () => {
  it("gets worse as the offset shrinks", () => {
    setOffset(20);
    const wide = text("offset-read");
    setOffset(4);
    const narrow = text("offset-read");

    const widthOf = (reading: string) => Number(/([\d.]+) target widths/.exec(reading)?.[1] ?? "0");
    expect(widthOf(wide), "no error figure in the readout").toBeGreaterThan(0);
    expect(
      widthOf(narrow),
      "shrinking the offset must make the height worse, or the exhibit is not making its point",
    ).toBeGreaterThan(widthOf(wide));
  });

  it("says there is no height at all at zero, rather than quoting a huge number", () => {
    setOffset(0);
    expect(
      text("offset-read"),
      "at zero offset the height is absent, not merely imprecise; a number here would contradict the rest of the page",
    ).toMatch(/no height/i);
  });

  it("labels the slider for anyone not looking at it", () => {
    const slider = document.querySelector<HTMLInputElement>("#offset");
    expect(slider?.labels?.[0]?.textContent?.trim().length ?? 0).toBeGreaterThan(5);
    expect(slider?.getAttribute("aria-describedby")).toBe("offset-read");
  });

  // The cones turn; the ear markers must not. Same contract pages.test.ts holds
  // the static diagrams to, but here it has to survive the slider being dragged.
  it("turns only the cones, never the ear positions", () => {
    const left = document.querySelector("#offset-left .diagram-ear");
    const right = document.querySelector("#offset-right .diagram-ear");

    for (const degrees of [0, 12, 25]) {
      setOffset(degrees);
      expect(
        left?.getAttribute("cy"),
        `at ${degrees}° the exhibit moved an ear marker; only the cones may turn, or it is drawing a tilted head`,
      ).toBe(right?.getAttribute("cy"));
    }
  });
});
