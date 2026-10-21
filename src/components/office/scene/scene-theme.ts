// 3D art direction for the placeholder office, taken from the Stitch Three.js export
// (design/code/three-js.html). Material colours have no equivalent in DESIGN.md, so they live
// here as the single source for the scene. UI-facing colours (departments, presence, primary)
// are read from the CSS design tokens at runtime instead — see useSceneTokens().
export const sceneTheme = {
  // Warm modern office (art direction from the product owner's reference render, 2026-10-21).
  floor: "#4a453f",
  floorEdge: "#1b1916",
  roomFloor: "#5d564d",
  backWall: "#24221f",
  glass: "#d8e6e3",
  glassFrame: "#17191d",
  ledWarm: "#e39a4c",
  hoverRing: "#f8fafc",
  ambient: "#ffe9cc",
  keyLight: "#fff1dc",
  fillLight: "#a9c7ff",
  roomLight: "#ffcf91",
  // Legacy (Stitch) values still used by the 2D plan / tokens fallback.
  floorGrid: "#1e293b",
  accentCyan: "#06b6d4",
  accentEmerald: "#10b981",
} as const;

/** Camera placement from the Stitch scene: isometric-style orthographic view (camera at +X/+Z). */
export const cameraPosition: [number, number, number] = [24, 28, 24];

export const tokenNames = [
  "primary",
  "primary-container",
  "on-surface",
  "presence-online",
  "presence-busy",
  "presence-away",
  "presence-dnd",
  "dept-development",
  "dept-design",
  "dept-marketing",
  "dept-project-management",
  "dept-meeting-room",
] as const;

export type SceneTokens = Record<(typeof tokenNames)[number], string>;
