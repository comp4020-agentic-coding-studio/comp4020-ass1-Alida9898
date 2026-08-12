// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import axe from "axe-core";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// CLAUDE.md is explicit that nothing in this repo measures accessibility and that
// wiring a sensor is my work. This is that sensor, and the artefact band is why it
// earns its place: the marker "tabs through it", so a control that cannot be
// reached or named is a mark lost, not a nicety.
//
// Read the green honestly. axe in jsdom sees the markup and the accessibility tree
// but there is no layout, so every rule that needs geometry or real computed
// colour is unavailable. In particular COLOUR CONTRAST IS NOT CHECKED HERE — that
// one needs a browser, and the only way to know is to run axe (or Lighthouse) in
// Chrome against the deployed page. A pass below means the structure is sound, not
// that the page is accessible.

const shipped = readFileSync(resolve("dist/index.html"), "utf8");
document.documentElement.setAttribute("lang", "en-AU");
document.body.innerHTML = new JSDOM(shipped).window.document.body.innerHTML;

/** Rules axe cannot evaluate without layout, listed so the gap is on the record. */
const NEEDS_A_BROWSER = ["color-contrast", "target-size"];

async function violations(): Promise<axe.Result[]> {
  const outcome = await axe.run(document.body, {
    resultTypes: ["violations"],
    rules: Object.fromEntries(NEEDS_A_BROWSER.map((id) => [id, { enabled: false }])),
  });
  return outcome.violations;
}

function describeAll(found: axe.Result[]): string {
  return found
    .map((issue) => {
      const where = issue.nodes.map((node) => node.html.slice(0, 90)).join("\n      ");
      return `\n  [${issue.impact}] ${issue.id}: ${issue.help}\n      ${where}`;
    })
    .join("");
}

describe("the shipped page is reachable without a mouse or a screen", () => {
  it("has no axe violations in its structure", async () => {
    const found = await violations();
    expect(found.length, `axe found ${found.length} violation(s):${describeAll(found)}`).toBe(0);
  }, 30000);

  it("names every control a keyboard user can land on", () => {
    const focusable = [
      ...document.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ];
    expect(focusable.length, "nothing is focusable, so the page cannot be used at all").toBeGreaterThan(3);

    for (const control of focusable) {
      const named =
        control.getAttribute("aria-label")?.trim() ||
        control.textContent?.trim() ||
        (control instanceof HTMLInputElement
          ? control.labels?.[0]?.textContent?.trim()
          : undefined) ||
        "";
      expect(
        named.length,
        `<${control.tagName.toLowerCase()}${control.id ? ` id="${control.id}"` : ""}> can be focused but has no accessible name, so a screen reader announces nothing`,
      ).toBeGreaterThan(0);
    }
  });

  it("keeps the hunting field itself focusable, since it is the core interaction", () => {
    const field = document.querySelector("#field");
    expect(field?.getAttribute("tabindex"), "the field must be reachable by keyboard").toBe("0");
    expect(
      field?.getAttribute("aria-label")?.length ?? 0,
      "the field is a custom control, so it has to say what it is and how to work it",
    ).toBeGreaterThan(20);
  });

  it("announces strike outcomes in a live region", () => {
    const status = document.querySelector("#status");
    expect(
      status?.getAttribute("role"),
      "hit and miss are the whole feedback loop; without a live region a screen reader user never hears the result",
    ).toBe("status");
  });
});
