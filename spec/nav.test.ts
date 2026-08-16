// @vitest-environment jsdom

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it } from "vitest";

// The hamburger is the one control on the site that can fail silently and still
// look finished: a button that opens nothing, or — worse — a phone left with no
// nav at all because the panel closed and the breakpoint moved. jsdom has no
// matchMedia, so the breakpoint is stubbed here and driven deliberately.

let onPhone = true;
const listeners: Array<() => void> = [];

const media = {
  get matches() {
    return onPhone;
  },
  media: "(width < 34rem)",
  onchange: null,
  addEventListener: (_type: string, fn: () => void) => void listeners.push(fn),
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
};

window.matchMedia = (() => media) as unknown as typeof window.matchMedia;

const shipped = readFileSync(resolve("dist/how.html"), "utf8");
document.body.innerHTML = new JSDOM(shipped).window.document.body.innerHTML;

await import("../nav");

/** Every built stylesheet, concatenated. */
function builtCss(): string {
  const assets = resolve("dist/assets");
  return readdirSync(assets)
    .filter((name) => name.endsWith(".css"))
    .map((name) => readFileSync(resolve(assets, name), "utf8"))
    .join("");
}

function toggle(): HTMLButtonElement {
  const found = document.querySelector<HTMLButtonElement>("#nav-toggle");
  if (!found) throw new Error("the shipped page has no #nav-toggle");
  return found;
}

function steps(): HTMLElement {
  const found = document.querySelector<HTMLElement>("#nav-steps");
  if (!found) throw new Error("the shipped page has no #nav-steps");
  return found;
}

/** Move the breakpoint the way a rotation or a resize would. */
function setPhone(next: boolean): void {
  onPhone = next;
  for (const fn of listeners) fn();
}

beforeEach(() => {
  setPhone(true);
});

describe("the nav collapses behind a button on a phone", () => {
  it("starts closed, with the button now visible and the list gone", () => {
    expect(toggle().hidden, "nav.ts never revealed the button").toBe(false);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(steps().hidden, "the list should start collapsed on a phone").toBe(true);
  });

  it("opens and closes on click, and says so", () => {
    toggle().click();
    expect(steps().hidden).toBe(false);
    expect(toggle().getAttribute("aria-expanded")).toBe("true");

    toggle().click();
    expect(steps().hidden).toBe(true);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on Escape and puts focus back on the button", () => {
    toggle().click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(
      document.activeElement,
      "Escape closed the panel and left focus inside it",
    ).toBe(toggle());
  });
});

// A phone that was left closed and then rotated past the breakpoint would have
// no nav at all if the wider layout did not restore the list unconditionally.
describe("the wider layout always has its nav back", () => {
  it("restores the list and hides the button, whatever state the phone was in", () => {
    setPhone(true);
    expect(steps().hidden).toBe(true);

    setPhone(false);
    expect(steps().hidden, "widening the viewport left the page with no nav").toBe(false);
    expect(toggle().hidden, "the button is meaningless once the list is inline").toBe(true);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });
});

// `hidden` is display:none in the UA sheet at specificity (0,1,0), so any class
// setting display beats it. This shipped once: the desktop page showed the
// hamburger AND the full list, while every check that read the .hidden PROPERTY
// passed, because the property was set correctly and the CSS ignored it. jsdom
// has no cascade to catch that, so assert the rule exists.
describe("hiding with the attribute actually hides", () => {
  it("pairs every display-setting nav class with its own [hidden] rule", () => {
    const css = builtCss();
    for (const selector of [".steps[hidden]", ".nav-toggle[hidden]"]) {
      expect(
        css.includes(selector),
        `${selector} is missing, so the hidden attribute does nothing on it — the element sets display and wins`,
      ).toBe(true);
    }
  });
});

// nav.ts hard-codes the query and styles.css hard-codes the breakpoint. If they
// drift, the button appears at one width and the panel styling at another.
describe("the script and the stylesheet agree on where a phone starts", () => {
  it("uses the same breakpoint in both", () => {
    const css = builtCss();

    expect(
      css.includes("width<34rem") || css.includes("width < 34rem"),
      "styles.css no longer has the 34rem phone breakpoint nav.ts matches on",
    ).toBe(true);
  });
});
