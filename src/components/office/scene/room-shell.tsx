"use client";

import type { Room, Seat, sceneBounds } from "@/features/office/model";
import { sceneTheme } from "./scene-theme";

const WALL_HEIGHT = 2.4;
const WALL_THICKNESS = 0.12;

/** Tinted floor and low glass partitions for one department room (its label is a DOM overlay). */
/** Label anchor above the front wall (nearest the camera) so each label clearly belongs to its room. */
export function roomLabelAnchor(room: Room): [number, number, number] {
  return [room.x, WALL_HEIGHT + 0.4, room.z + room.depth / 2];
}

export function RoomShell({ room, color, dimmed, performance }: { room: Room; color: string; dimmed: boolean; performance: boolean }) {
  const { x, z, width, depth } = room;
  const walls: Array<[number, number, number, number]> = [
    // [centerX, centerZ, lengthX, lengthZ]
    [x, z - depth / 2, width, WALL_THICKNESS],
    [x, z + depth / 2, width, WALL_THICKNESS],
    [x - width / 2, z, WALL_THICKNESS, depth],
    [x + width / 2, z, WALL_THICKNESS, depth],
  ];

  return (
    <group>
      <mesh position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={!performance}>
        <planeGeometry args={[width - 0.2, depth - 0.2]} />
        <meshStandardMaterial color={color} transparent opacity={dimmed ? 0.03 : 0.09} />
      </mesh>
      {walls.map(([cx, cz, lx, lz], i) => (
        <mesh key={i} position={[cx, WALL_HEIGHT / 2, cz]}>
          <boxGeometry args={[lx, WALL_HEIGHT, lz]} />
          <meshStandardMaterial color={sceneTheme.glass} transparent opacity={dimmed ? 0.06 : 0.16} roughness={0.1} depthWrite={false} />
        </mesh>
      ))}
      {/* Base trim along the two back walls, as in the Stitch scene. */}
      <mesh position={[x, 0.2, z - depth / 2]}>
        <boxGeometry args={[width, 0.4, WALL_THICKNESS * 2]} />
        <meshStandardMaterial color={sceneTheme.wallTrim} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Round boardroom table with the holographic display from the Stitch scene; chairs sit at the seats. */
export function MeetingTable({ room, seats }: { room: Room; seats: Seat[] }) {
  const radius = Math.min(room.width, room.depth) * 0.22;
  return (
    <group>
      <mesh position={[room.x, 0.4, room.z]} castShadow>
        <cylinderGeometry args={[radius, radius, 0.8, 40]} />
        <meshStandardMaterial color={sceneTheme.boardTable} roughness={0.3} />
      </mesh>
      <mesh position={[room.x, 1.6, room.z]}>
        <cylinderGeometry args={[radius * 0.45, radius * 0.45, 1.6, 24]} />
        <meshStandardMaterial color={sceneTheme.holo} transparent opacity={0.35} emissive={sceneTheme.holoEmissive} emissiveIntensity={0.8} />
      </mesh>
      {seats.map((seat) => (
        <mesh key={seat.id} position={[seat.position.x, 0.55, seat.position.z]} rotation={[0, (seat.position.rotation * Math.PI) / 180, 0]} castShadow>
          <boxGeometry args={[0.9, 1.1, 0.9]} />
          <meshStandardMaterial color={sceneTheme.chair} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

export function Plants({ bounds }: { bounds: ReturnType<typeof sceneBounds> }) {
  const spots: Array<[number, number]> = [
    [bounds.minX - 0.6, bounds.minZ - 0.6],
    [bounds.maxX + 0.6, bounds.minZ - 0.6],
    [bounds.minX - 0.6, bounds.maxZ + 0.6],
    [bounds.maxX + 0.6, bounds.maxZ + 0.6],
  ];
  return (
    <group>
      {spots.map(([x, z]) => (
        <group key={`${x}:${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.7, 0.5, 1.2, 16]} />
            <meshStandardMaterial color={sceneTheme.plantPot} roughness={0.3} />
          </mesh>
          <mesh position={[0, 1.7, 0]}>
            <dodecahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={sceneTheme.plantFoliage} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
