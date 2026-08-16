// The three-page nav, collapsed behind a button on a phone.
//
// Progressive enhancement rather than a CSS-only checkbox trick, for one reason:
// the button ships with the `hidden` attribute set and THIS file is what removes
// it. So a visitor whose script never runs gets the plain list of three links,
// which works, instead of a button that does nothing — the usual failure mode of
// a hamburger, and a silent one.
//
// The cost is a frame: on a phone the list paints before the module runs and then
// collapses. That is the honest trade for the no-script case, and it is one frame
// on a page whose own hero animation runs for twelve hundred milliseconds.

/** Matches the phone breakpoint in styles.css. Kept in sync by nav.test.ts. */
const PHONE = "(width < 34rem)";

const toggle = document.querySelector<HTMLButtonElement>("#nav-toggle");
const steps = document.querySelector<HTMLElement>("#nav-steps");

if (toggle && steps) {
  const phone = window.matchMedia(PHONE);

  function open(): boolean {
    return toggle?.getAttribute("aria-expanded") === "true";
  }

  function setOpen(next: boolean): void {
    if (!toggle || !steps) return;
    toggle.setAttribute("aria-expanded", String(next));
    steps.hidden = !next;
  }

  /**
   * A phone gets the button and a collapsed list; anything wider gets the list
   * back unconditionally. Re-run on every breakpoint change, because a rotated
   * phone that was left closed would otherwise have no nav at all.
   */
  function apply(): void {
    if (!toggle || !steps) return;
    if (phone.matches) {
      toggle.hidden = false;
      setOpen(false);
    } else {
      toggle.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      steps.hidden = false;
    }
  }

  toggle.addEventListener("click", () => setOpen(!open()));

  // Escape is the one shortcut people try on an open menu, and leaving focus
  // stranded in a panel that just closed is worse than not closing it.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && open()) {
      setOpen(false);
      toggle.focus();
    }
  });

  // Every link here leaves the page, so this only matters for the one that does
  // not: the link to the page you are already on.
  for (const link of steps.querySelectorAll("a")) {
    link.addEventListener("click", () => {
      if (phone.matches) setOpen(false);
    });
  }

  phone.addEventListener("change", apply);
  apply();
}
