// 3D art direction for the placeholder office, taken from the Stitch Three.js export
// (design/code/three-js.html). Material colours have no equivalent in DESIGN.md, so they live
// here as the single source for the scene. UI-facing colours (departments, presence, primary)
// are read from the CSS design tokens at runtime instead — see useSceneTokens().
export const sceneTheme = {
  floor: "#0f172a",
  floorGrid: "#1e293b",
  wallTrim: "#334155",
  glass: "#38bdf8",
  desk: "#1e293b",
  monitor: "#0f172a",
  chair: "#0284c7",
  boardTable: "#1e1b4b",
  holo: "#38bdf8",
  holoEmissive: "#0284c7",
  plantPot: "#0f766e",
  plantFoliage: "#10b981",
  avatarHead: "#dfe2ef",
  ambient: "#dcfce7",
  accentCyan: "#06b6d4",
  accentEmerald: "#10b981",
} as const;

/** Camera placement from the Stitch scene: isometric-style orthographic view. */
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
