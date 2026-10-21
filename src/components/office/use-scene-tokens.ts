"use client";

import { useSyncExternalStore } from "react";
import { tokenNames, type SceneTokens } from "./scene/scene-theme";

let cached: SceneTokens | null = null;

function read(): SceneTokens | null {
  if (cached) return cached;
  const style = getComputedStyle(document.documentElement);
  const entries = tokenNames.map((name) => [name, style.getPropertyValue(`--tv-color-${name}`).trim()] as const);
  if (entries.some(([, value]) => !value)) return null;
  cached = Object.fromEntries(entries) as SceneTokens;
  return cached;
}

const noop = () => () => {};

/** Design-token colours for WebGL materials (Three.js can't read CSS variables directly). */
export function useSceneTokens(): SceneTokens | null {
  return useSyncExternalStore(noop, read, () => null);
}
