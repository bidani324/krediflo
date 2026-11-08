/**
 * @fileoverview Responsive mobile-detection hook for Krediflo.
 *
 * Uses the `window.matchMedia` API (with a `change` event listener) rather
 * than polling `window.innerWidth` on every render.  The listener is torn down
 * on unmount to avoid memory leaks.
 */

import * as React from "react";
import { BREAKPOINTS } from "@/config/constants";

/**
 * @description Returns `true` when the viewport is narrower than the mobile
 *   breakpoint (`BREAKPOINTS.MOBILE` = 768 px) and `false` otherwise.
 *
 * Implementation detail: the initial value is `undefined` during SSR or before
 * the first `matchMedia` evaluation; the hook immediately resolves to a boolean
 * on the first client-side render and then reacts to subsequent resize events.
 * The exported value is always a `boolean` (the `!!` coercion collapses
 * `undefined → false`).
 *
 * @returns {boolean} `true` → mobile layout active; `false` → tablet/desktop.
 *
 * @example
 *   function Navbar() {
 *     const isMobile = useIsMobile();
 *     return isMobile ? <HamburgerMenu /> : <DesktopNav />;
 *   }
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    // Subscribe to media-query change events — more efficient than resize listeners
    const mql = window.matchMedia(`(max-width: ${BREAKPOINTS.MOBILE - 1}px)`);

    const onChange = () => {
      setIsMobile(window.innerWidth < BREAKPOINTS.MOBILE);
    };

    mql.addEventListener("change", onChange);

    // Set the initial value synchronously so the first render reflects reality
    setIsMobile(window.innerWidth < BREAKPOINTS.MOBILE);

    // Teardown: remove the listener when the component using this hook unmounts
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Collapse `undefined` (pre-mount) to `false` — callers receive a plain boolean
  return !!isMobile;
}
