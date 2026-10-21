"use client";

import { useEffect } from "react";

let active = 0;

/**
 * While mounted (and visible), marks the document so phones hide the app's top bar and tab bar
 * (globals.css). Uses an effect rather than a CSS :has() marker because routes you navigate away
 * from stay mounted but hidden (React <Activity>); effects are cleaned up when hidden, markers are not.
 */
export function MobileFullscreen() {
  useEffect(() => {
    active++;
    document.documentElement.setAttribute("data-mobile-fullscreen", "");
    return () => {
      if (--active === 0) document.documentElement.removeAttribute("data-mobile-fullscreen");
    };
  }, []);
  return null;
}
