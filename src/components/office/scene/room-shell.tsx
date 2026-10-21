"use client";

import type { Room } from "@/features/office/model";
import { sceneTheme } from "./scene-theme";

const WALL_HEIGHT = 2.6;
const FRAME = 0.05;

/** Label anchor at floor level just outside the front glass, like signage at the door. */
export function roomLabelAnchor(room: Room): [number, number, number] {
  return [room.x, 0.05, room.z + room.depth / 2 + 0.9];
}

/**
 * One department room: warm floor, a solid back wall (far from the camera), glass on the near
 * sides with thin dark frames and a warm LED strip along the top, like the reference render.
 * The camera sits at +X/+Z, so the -Z and -X walls are the "back".
 */
export function RoomShell({ room, dimmed, performance }: { room: Room; dimmed: boolean; performance: boolean }) {
  const { x, z, width, depth } = room;
  const glassOpacity = dimmed ? 0.05 : 0.14;
  const sides: Array<{ cx: number; cz: number; lx: number; lz: number; solid: boolean }> = [
    { cx: x, cz: z - depth / 2, lx: width, lz: 0.12, solid: true },
    { cx: x - width / 2, cz: z, lx: 0.12, lz: depth, solid: true },
    { cx: x, cz: z + depth / 2, lx: width, lz: 0.04, solid: false },
    { cx: x + width / 2, cz: z, lx: 0.04, lz: depth, solid: false },
  ];

  return (
    <group>
      <mesh position={[x, 0.015, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={!performance}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={sceneTheme.roomFloor} roughness={0.45} metalness={0.05} transparent={dimmed} opacity={dimmed ? 0.5 : 1} />
      </mesh>

      {sides.map((side, i) =>
        side.solid ? (
          <mesh key={i} position={[side.cx, WALL_HEIGHT / 2, side.cz]} castShadow={!performance} receiveShadow={!performance}>
            <boxGeometry args={[side.lx, WALL_HEIGHT, side.lz]} />
            <meshStandardMaterial color={sceneTheme.backWall} roughness={0.7} transparent={dimmed} opacity={dimmed ? 0.35 : 1} />
          </mesh>
        ) : (
          <group key={i}>
            <mesh position={[side.cx, WALL_HEIGHT / 2, side.cz]}>
              <boxGeometry args={[side.lx, WALL_HEIGHT, side.lz]} />
              <meshStandardMaterial color={sceneTheme.glass} transparent opacity={glassOpacity} roughness={0.05} metalness={0.1} depthWrite={false} />
            </mesh>
            {/* Top frame with a warm LED strip, bottom frame. */}
            <mesh position={[side.cx, WALL_HEIGHT, side.cz]}>
              <boxGeometry args={[side.lx + FRAME, FRAME * 1.5, side.lz + FRAME]} />
              <meshStandardMaterial color={sceneTheme.ledWarm} emissive={sceneTheme.ledWarm} emissiveIntensity={dimmed ? 0.15 : 0.7} />
            </mesh>
            <mesh position={[side.cx, FRAME / 2, side.cz]}>
              <boxGeometry args={[side.lx + FRAME, FRAME, side.lz + FRAME]} />
              <meshStandardMaterial color={sceneTheme.glassFrame} roughness={0.4} metalness={0.6} />
            </mesh>
          </group>
        ),
      )}

      {/* Warm ceiling light pooling on the floor (no shadows: cheap). */}
      {!performance ? <pointLight position={[x, WALL_HEIGHT + 0.4, z]} color={sceneTheme.roomLight} intensity={dimmed ? 3 : 14} distance={Math.max(width, depth) * 1.1} decay={1.6} /> : null}
    </group>
  );
}
