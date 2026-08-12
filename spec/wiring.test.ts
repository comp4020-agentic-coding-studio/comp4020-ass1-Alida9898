// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The invariants parse the built html without ever running a script, and
// hunt.test.ts holds the pure model to account. Between them sits the layer that
// actually breaks in practice: the wiring. A renamed id or a dropped element
// leaves a page that builds, lints, passes every other test, and does nothing.
//
// So this file loads the SHIPPED markup, executes main.ts against it, and
// drives the core interaction the way a visitor would.

vi.useFakeTimers();

const shipped = readFileSync(resolve("dist/index.html"), "utf8");
document.body.innerHTML = new JSDOM(shipped).window.document.body.innerHTML;

// main.ts throws on a missing element, so a wiring break surfaces here.
await import("../main");

function text(id: string): string {
  return document.querySelector(`#${id}`)?.textContent?.trim() ?? "";
}

function click(id: string): void {
  document.querySelector<HTMLElement>(`#${id}`)?.click();
}

/** Finish the post-strike reveal so the next round can start. */
function settle(): void {
  vi.advanceTimersByTime(2000);
}

function chooseEars(mode: "uneven" | "level"): void {
  const input = document.querySelector<HTMLInputElement>(`#ears-${mode}`);
  if (!input) throw new Error(`no #ears-${mode} in the shipped page`);
  input.checked = true;
  input.dispatchEvent(new Event("change"));
}

beforeEach(() => {
  settle();
});

describe("the page wires itself up", () => {
  it("puts a reading in both cue meters before the first strike", () => {
    expect(
      text("read-timing"),
      "the left-right readout is still the placeholder; render() did not run",
    ).not.toBe("—");
    expect(text("read-loudness")).not.toBe("—");
  });

  it("places the aim inside the field rather than leaving it unpositioned", () => {
    const aim = document.querySelector<HTMLElement>("#field-aim");
    expect(aim?.style.left).toMatch(/%$/);
    expect(aim?.style.top).toMatch(/%$/);
  });

  it("keeps the prey hidden until a strike resolves", () => {
    const preyMark = document.querySelector<HTMLElement>("#field-prey");
    expect(preyMark?.hidden, "the prey must not be visible while aiming").toBe(true);
  });
});

describe("striking is the core interaction", () => {
  it("records the strike, reveals the prey, and blocks a double strike", () => {
    const before = Number(text("uneven-strikes"));

    click("strike");

    expect(Number(text("uneven-strikes"))).toBe(before + 1);
    expect(
      document.querySelector<HTMLElement>("#field-prey")?.hidden,
      "a resolved strike should show where the prey actually was",
    ).toBe(false);
    expect(
      document.querySelector<HTMLButtonElement>("#strike")?.disabled,
      "the strike button must be inert while the round is resolving",
    ).toBe(true);

    settle();

    expect(document.querySelector<HTMLButtonElement>("#strike")?.disabled).toBe(false);
    expect(document.querySelector<HTMLElement>("#field-prey")?.hidden).toBe(true);
  });

  it("reports the outcome somewhere a screen reader will announce it", () => {
    click("strike");
    const status = document.querySelector("#status");
    expect(status?.getAttribute("role")).toBe("status");
    expect(status?.textContent ?? "").toMatch(/Hit|Missed/);
  });
});

// The page's argument is that the visitor's own hit rate collapses when the ears
// are levelled. That only works if the two runs are counted apart.
describe("the scoreboard keeps the two pairs of ears separate", () => {
  it("counts a levelled strike without touching the uneven tally", () => {
    chooseEars("uneven");
    click("strike");
    settle();
    const unevenAfterFirst = Number(text("uneven-strikes"));

    chooseEars("level");
    click("strike");
    settle();

    expect(Number(text("level-strikes"))).toBeGreaterThan(0);
    expect(
      Number(text("uneven-strikes")),
      "levelling the ears must not disturb the tally it is being compared against",
    ).toBe(unevenAfterFirst);
  });

  it("shows a rate once a pair of ears has been struck with", () => {
    chooseEars("uneven");
    click("strike");
    settle();
    expect(text("uneven-rate")).toMatch(/^\d+%$/);
  });
});

// The marks left on the field are the argument drawn rather than claimed: under
// your own ears the hits collapse into a band and the misses fill in the rest.
// That picture only exists if the two pairs of ears are kept apart.
describe("the field keeps a record of where the mouse was", () => {
  function markCount(): number {
    return document.querySelectorAll("#field-marks .field-mark").length;
  }

  it("leaves one mark per strike, labelled with the outcome", () => {
    chooseEars("uneven");
    const before = markCount();
    click("strike");
    settle();
    expect(markCount(), "a strike left no mark on the field").toBe(before + 1);

    const marks = [...document.querySelectorAll<HTMLElement>("#field-marks .field-mark")];
    for (const mark of marks) {
      expect(
        mark.dataset.hit,
        "every mark must say whether it was a hit; an unlabelled mark draws no argument",
      ).toMatch(/^(true|false)$/);
      expect(mark.style.left).toMatch(/%$/);
      expect(mark.style.top).toMatch(/%$/);
    }
  });

  it("keeps each pair of ears' marks to itself", () => {
    chooseEars("uneven");
    click("strike");
    settle();
    const ownedByOwl = markCount();

    chooseEars("level");
    const ownedByYou = markCount();
    click("strike");
    settle();
    expect(markCount(), "a strike under your own ears did not add to your own record").toBe(
      ownedByYou + 1,
    );

    chooseEars("uneven");
    expect(
      markCount(),
      "switching ears changed the owl's record; mixing the two would destroy the comparison the page is making",
    ).toBe(ownedByOwl);
  });
});
