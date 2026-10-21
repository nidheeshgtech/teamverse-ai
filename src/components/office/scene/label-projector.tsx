"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, type RefObject } from "react";
import { Vector3 } from "three";

export type LabelAnchor = { id: string; position: [number, number, number] };

/**
 * Positions plain DOM labels (children of `layer` with matching `data-anchor`) over 3D points.
 * Runs only on rendered frames (the canvas uses frameloop="demand"), writing transforms directly
 * so camera movement never re-renders React. Replaces drei <Html>, which creates one React root
 * per label and intermittently failed to render under React 19.
 */
export function LabelProjector({ anchors, layer }: { anchors: LabelAnchor[]; layer: RefObject<HTMLDivElement | null> }) {
  const invalidate = useThree((s) => s.invalidate);
  const points = useMemo(() => anchors.map((a) => ({ id: a.id, vector: new Vector3(...a.position) })), [anchors]);
  const scratch = useMemo(() => new Vector3(), []);

  // Labels can mount after the last frame (e.g. a hover chip); request one more.
  useEffect(() => invalidate(), [anchors, invalidate]);

  useFrame(({ camera, size }) => {
    const root = layer.current;
    if (!root) return;
    for (const point of points) {
      const element = root.querySelector<HTMLElement>(`[data-anchor="${point.id}"]`);
      if (!element) continue;
      scratch.copy(point.vector).project(camera);
      const visible = scratch.z > -1 && scratch.z < 1;
      const x = ((scratch.x + 1) / 2) * size.width;
      const y = ((1 - scratch.y) / 2) * size.height;
      // Physical translate: screen-space projection of a 3D point, not a layout direction.
      element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
      element.style.visibility = visible ? "visible" : "hidden";
    }
  });

  return null;
}
