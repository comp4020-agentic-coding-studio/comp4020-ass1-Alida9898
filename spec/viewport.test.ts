import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Marking happens in Chrome at exactly 1920x1080 and 390x844, and both count in
// full. Neither is something a test can look at — but two of the ways the narrow
// one breaks are visible in the stylesheet, and both were real: a dialog wider
// than the phone, and a field that stops accepting drags.
//
// These read the BUILT css, so they check what ships.

const built = resolve("dist/assets");

function shippedCss(): string {
  const sheets = readdirSync(built).filter((name) => name.endsWith(".css"));
  expect(sheets.length, `no stylesheet in ${built}; run pnpm build first`).toBeGreaterThan(0);
  return sheets.map((name) => readFileSync(resolve(built, name), "utf8")).join("\n");
}

/** The narrower marking viewport, in px. */
const PHONE_WIDTH = 390;

describe("the shipped css survives the narrow marking viewport", () => {
  const css = shippedCss();

  it("does not give the dialog a fixed width wider than the phone", () => {
    const rule = /\.curtain\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(rule, "no .curtain rule in the shipped css").not.toBe("");

    const fixed = /max-width:\s*([\d.]+)rem/.exec(rule);
    if (fixed) {
      const px = Number.parseFloat(fixed[1]) * 16;
      expect(
        px,
        `.curtain caps at a flat ${fixed[1]}rem (${px}px), which overflows a ${PHONE_WIDTH}px screen; it needs a viewport-relative bound`,
      ).toBeLessThanOrEqual(PHONE_WIDTH - 32);
    } else {
      expect(
        /max-width:\s*min\(/.test(rule),
        ".curtain needs a viewport-relative max-width so it cannot overflow the phone",
      ).toBe(true);
    }
  });

  it("keeps the field claiming touch gestures", () => {
    const rule = /\.field\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(
      /touch-action:\s*none/.test(rule),
      "the field must set touch-action: none, or a drag on a phone scrolls the page instead of aiming and the core interaction is unreachable at the 390px viewport",
    ).toBe(true);
  });

  it("gives the narrow viewport its own layout, not just the wide one shrunk", () => {
    expect(
      /@media\s*\(width\s*<\s*[\d.]+rem\)/.test(css),
      "no narrow-viewport rules at all; 390x844 carries the same weight as 1920x1080",
    ).toBe(true);
  });
});
