import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// The explainer is three pages, read in order: hunt, then how it works, then the
// objections. That order is the argument — you do the thing before you are told
// why it worked — and splitting one long scroll into three is exactly the edit
// that can quietly drop a page out of the chain, strand it with no way back, or
// leave a nav that lies about where you are.
//
// These parse the BUILT pages without executing anything, so they hold every page
// to the same contract rather than only the one a script happens to load.

const DIST = resolve("dist");

const pages = readdirSync(DIST)
  .filter((name) => name.endsWith(".html"))
  .map((name) => ({
    name,
    doc: new JSDOM(readFileSync(resolve(DIST, name), "utf8")).window.document,
  }));

/** The sequence, in reading order: each page and the one it must hand on to. */
const SEQUENCE = [
  { name: "index.html", next: "./how.html" },
  { name: "how.html", next: "./why.html" },
  { name: "why.html", next: "./" },
];

function pageNamed(name: string) {
  const found = pages.find((page) => page.name === name);
  if (!found) throw new Error(`the build produced no ${name}`);
  return found.doc;
}

describe("the three pages form a chain a visitor can walk", () => {
  it("builds every page in the sequence", () => {
    for (const { name } of SEQUENCE) {
      expect(
        pages.map((page) => page.name),
        `${name} is part of the reading order but the build did not emit it`,
      ).toContain(name);
    }
  });

  it("hands each page on to the next without going back to the nav", () => {
    for (const { name, next } of SEQUENCE) {
      const onward = pageNamed(name).querySelector(".onward a");
      expect(onward, `${name} has no onward link, so the sequence dead-ends there`).toBeTruthy();
      expect(
        onward?.getAttribute("href"),
        `${name} should hand on to ${next}`,
      ).toBe(next);
    }
  });

  // A nav that renders the same on every page tells the visitor nothing about
  // where they are, and aria-current is the only part of it a screen reader can
  // use. Getting this wrong is invisible by eye if the styling happens to match.
  it("marks exactly one nav link as the page you are on", () => {
    for (const { name, doc } of pages) {
      const links = [...doc.querySelectorAll('nav[aria-label="Primary"] .steps a')];
      expect(
        links.length,
        `${name} should carry the full three-step nav, not a subset`,
      ).toBe(SEQUENCE.length);

      const current = links.filter((link) => link.getAttribute("aria-current") === "page");
      expect(
        current.length,
        `${name} marks ${current.length} nav links as current; exactly one is the contract`,
      ).toBe(1);
    }
  });
});

// An interactive explainer that explains first is a page with a toy at the bottom.
// The hunt is the landing page on purpose, and the theory is a page you choose to
// go on to — a decision invisible to every other check and trivially lost in an
// edit that "tidies up" the structure.
describe("the hunt is what you land on", () => {
  it("puts the interaction on the home page and the theory behind a link", () => {
    const home = pageNamed("index.html");
    expect(
      home.querySelector("#field"),
      "the home page has no hunting field; the interaction has to be the hook, not the reward",
    ).toBeTruthy();
    expect(
      home.querySelector("#offset"),
      "the offset exhibit is a footnote and belongs on the objections page, not in front of the hunt",
    ).toBeNull();

    // Document nodes have null textContent per the DOM spec — it has to be body.
    const explanation = pageNamed("how.html").body?.textContent ?? "";
    expect(
      /two facts about a sound/i.test(explanation),
      "how.html should carry the mechanism",
    ).toBe(true);
  });

  it("still lands the personal payoff with the marks it refers to", () => {
    // "Look at the marks on the field" only works while the field is on screen,
    // so this section cannot drift onto a page of its own.
    const home = pageNamed("index.html");
    const payoff = [...home.querySelectorAll("h2")].some((heading) =>
      /what about you/i.test(heading.textContent ?? ""),
    );
    expect(payoff, "the payoff left the page that holds the field it points at").toBe(true);
  });
});

// The page's whole distinction is that an owl moves where its ears AIM without
// moving where they SIT — move the positions and you have drawn a tilted head,
// which is the thing being ruled out. That went wrong in the owl diagram and was
// caught by eye rather than by anything here, three separate corrections into the
// same confusion. So it stops being a matter of remembering.
describe("no diagram draws a tilted head", () => {
  it("keeps every pair of ear markers level with each other", () => {
    let checked = 0;

    for (const { name, doc } of pages) {
      for (const diagram of doc.querySelectorAll("svg")) {
        const ears = [...diagram.querySelectorAll(".diagram-ear")];
        if (ears.length < 2) continue;
        checked += 1;

        const heights = ears.map((ear) => Number(ear.getAttribute("cy")));
        const spread = Math.max(...heights) - Math.min(...heights);
        expect(
          spread,
          `a diagram in ${name} puts its ear markers at ${heights.join(" and ")} — different heights is a tilted head, and a tilt turns the timing cue with it. Only the cones may differ.`,
        ).toBe(0);
      }
    }

    expect(checked, "no diagram with a pair of ears was found to check").toBeGreaterThan(0);
  });
});

// The invariants give every <img> an alt check, and inline SVG slips straight past
// it — so the diagrams need their own, on whichever page they ended up.
describe("the diagrams are legible to a screen reader", () => {
  it("gives each one a real accessible name", () => {
    let named = 0;

    for (const { name, doc } of pages) {
      for (const diagram of doc.querySelectorAll('svg[role="img"]')) {
        named += 1;
        const labelId = diagram.getAttribute("aria-labelledby");
        expect(
          labelId,
          `an inline svg with role=img but no aria-labelledby in ${name} is an unlabelled image`,
        ).toBeTruthy();

        const label = labelId === null ? null : doc.getElementById(labelId);
        const described = label?.textContent?.trim() ?? "";
        expect(
          described.length,
          `a diagram's <title> in ${name} is missing or too thin to describe it: "${described}"`,
        ).toBeGreaterThan(40);
      }
    }

    expect(
      named,
      "expected at least the owl and human diagrams plus the offset exhibit; the count is incidental, the naming above is the contract",
    ).toBeGreaterThanOrEqual(3);
  });
});

// Amber on the page's dark ground is 8.6:1; amber on the skull plates' cream is
// 1.77:1, which is not a label, it is a rumour. Jiayi caught it by eye — axe
// cannot, because axe does not measure SVG <text> at all. So the rule is
// positional and checkable: a label may not sit over a plate.
describe("diagram labels stay off the skull plates", () => {
  it("keeps every label on the dark ground, where it has contrast", () => {
    let checked = 0;

    for (const { name, doc } of pages) {
      for (const diagram of doc.querySelectorAll("svg")) {
        const plate = diagram.querySelector("image.diagram-skull");
        if (!plate) continue;

        const num = (el: Element, attr: string) => Number(el.getAttribute(attr) ?? "0");
        const [px, py, pw, ph] = ["x", "y", "width", "height"].map((a) => num(plate, a));

        for (const label of diagram.querySelectorAll("text.diagram-label")) {
          checked += 1;
          const lx = num(label, "x");
          const ly = num(label, "y");
          const over = lx >= px && lx <= px + pw && ly >= py && ly <= py + ph;
          expect(
            over,
            `"${label.textContent?.trim()}" in ${name} sits at (${lx}, ${ly}), inside the plate at (${px}, ${py}) ${pw}x${ph}. Amber on cream is 1.77:1.`,
          ).toBe(false);
        }
      }
    }

    expect(checked, "no diagram labels were found to check").toBeGreaterThan(0);
  });
});
