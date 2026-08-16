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
//
// Scope is index.html — the hunt. Since the explainer became three pages, the
// cross-page structure and the diagram contracts live in pages.test.ts, and the
// offset exhibit (why.html) in exhibit.test.ts, because each needs a document
// this file's main.ts import would refuse to run against.

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
  it("tells the visitor what to do before anything has happened", () => {
    expect(
      text("status"),
      "render() did not run, or the opening instruction does not point at Listen",
    ).toMatch(/Listen/i);
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

// jsdom has no Web Audio, which makes it a free stand-in for the case that
// actually matters: a marking room with the sound off, or a browser that refuses
// to start an AudioContext. The page has to lose nothing but the sound.
describe("audio is an addition and never a dependency", () => {
  it("keeps Listen working when the browser cannot play a sound", () => {
    const listen = document.querySelector<HTMLButtonElement>("#listen");
    expect(listen, "no Listen control in the shipped page").toBeTruthy();
    expect(
      listen?.disabled,
      "Listen is the round's control now, not an optional extra — without audio it must still reveal the reading",
    ).toBe(false);
    expect(
      document.querySelector("#listen-note")?.textContent ?? "",
      "the note has to say the page still argues its case with the sound off",
    ).toMatch(/gauges/i);
  });

  it("leaves the core interaction completely usable", () => {
    const before = Number(text("uneven-strikes"));
    chooseEars("uneven");
    click("strike");
    settle();
    expect(
      Number(text("uneven-strikes")),
      "with audio unavailable the hunt still has to work end to end",
    ).toBeGreaterThan(before);
  });
});

// The page's case rests on prey that makes one short noise and does not repeat it.
// An always-on reading would quietly contradict that, so the sound has to be
// something you spend rather than something you consult.
describe("the mouse rustles once", () => {
  function ring(id: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(`#${id}`);
  }

  it("shows nothing until you listen", () => {
    chooseEars("uneven");
    settle();
    expect(
      ring("h-sound")?.hidden,
      "the reading was on the gauge before the mouse had made a sound",
    ).toBe(true);
    expect(text("read-timing"), "an empty gauge should read as empty").toBe("—");
    expect(text("status"), "the prompt belongs in the status line, once").toMatch(/Listen/i);
  });

  it("puts the reading up when you do", () => {
    click("listen");
    expect(ring("h-sound")?.hidden, "listening produced no reading").toBe(false);
    expect(text("read-timing")).toMatch(/µs|at once/);
  });

  it("takes it away again, and will not repeat for the same mouse", () => {
    settle();
    expect(ring("h-sound")?.hidden, "the sound stayed up; there is no urgency then").toBe(true);
    expect(
      document.querySelector<HTMLButtonElement>("#listen")?.disabled,
      "a second listen at the same mouse is exactly what the page says prey does not allow",
    ).toBe(true);
    expect(text("read-timing")).toBe("Gone.");
    expect(text("status")).toMatch(/from what you heard/i);
  });

  it("gives you a fresh one next round", () => {
    click("strike");
    settle();
    expect(
      document.querySelector<HTMLButtonElement>("#listen")?.disabled,
      "a new mouse has to be listenable, or the hunt ends after one round",
    ).toBe(false);
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
