"use client";

import { useSyncExternalStore } from "react";

function subscribeMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
}

let webgl: boolean | null = null;

function detectWebGL(): boolean {
  if (webgl !== null) return webgl;
  try {
    const canvas = document.createElement("canvas");
    webgl = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    webgl = false;
  }
  return webgl;
}

const noop = () => () => {};

/** null during SSR/hydration, then whether WebGL is usable. */
export function useWebGLSupport(): boolean | null {
  return useSyncExternalStore(noop, detectWebGL, () => null);
}

/** Heuristic default for performance mode on modest hardware. */
export function prefersLowPower(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
}
