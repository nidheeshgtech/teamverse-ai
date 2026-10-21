"use client";

import type { ThreeEvent } from "@react-three/fiber";
import type { Occupant } from "@/features/office/model";
import type { PresenceStatus } from "@/ui/presence";
import { sceneTheme, type SceneTokens } from "./scene-theme";
import { seatLocal } from "./workstations";

const statusToken: Record<PresenceStatus, keyof SceneTokens> = {
  online: "presence-online",
  busy: "presence-busy",
  away: "presence-away",
  dnd: "presence-dnd",
  offline: "presence-away",
};

type Props = {
  occupant: Occupant;
  tokens: SceneTokens;
  selected: boolean;
  dimmed: boolean;
  performance: boolean;
  hovered: boolean;
  onHover: (userId: string | null) => void;
  onSelect: (userId: string) => void;
};

/** Where the name chip floats, above the avatar's head. */
export function avatarLabelAnchor(occupant: Occupant): [number, number, number] {
  const [x, , z] = seatLocal(occupant.seat!, 1.2, 0.8);
  return [x, 3.4, z];
}

/**
 * PLACEHOLDER avatar (capsule body + head + presence ring) matching the Stitch primitives until
 * final character assets arrive. DESIGN DEVIATION: body uses the department colour instead of a
 * single blue so departments are distinguishable; offline people are rendered translucent.
 */
export function AvatarFigure({ occupant, tokens, selected, dimmed, performance, hovered, onHover, onSelect }: Props) {
  const seat = occupant.seat!;
  const position = seatLocal(seat, 1.2, 0.8);
  const offline = occupant.status === "offline";
  const bodyColor = tokens[`dept-${occupant.departmentSlug}` as keyof SceneTokens] ?? tokens.primary;
  const opacity = dimmed ? 0.2 : offline ? 0.4 : 1;

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(occupant.userId);
  };
  const handleOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onHover(occupant.userId);
    document.body.style.cursor = "pointer";
  };
  const handleOut = () => {
    onHover(null);
    document.body.style.cursor = "";
  };

  return (
    <group position={position} onClick={handleClick} onPointerOver={handleOver} onPointerOut={handleOut} name={`avatar-${occupant.userId}`}>
      {selected ? (
        <mesh position={[0, -0.78, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.7, 0.95, 40]} />
          <meshBasicMaterial color={tokens.primary} transparent opacity={0.9} toneMapped={false} />
        </mesh>
      ) : null}
      <mesh position={[0, 0.6, 0]} castShadow={!performance}>
        <cylinderGeometry args={[0.45, 0.45, 1.2, 20]} />
        <meshStandardMaterial
          color={bodyColor}
          roughness={0.4}
          transparent={opacity < 1}
          opacity={opacity}
          emissive={bodyColor}
          emissiveIntensity={hovered || selected ? 0.35 : 0.05}
        />
      </mesh>
      <mesh position={[0, 1.5, 0]} castShadow={!performance}>
        <sphereGeometry args={[0.38, 20, 20]} />
        <meshStandardMaterial color={sceneTheme.avatarHead} roughness={0.5} transparent={opacity < 1} opacity={opacity} />
      </mesh>
      {!offline ? (
        <mesh position={[0, 2.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.65, 0.08, 12, 32]} />
          <meshBasicMaterial color={tokens[statusToken[occupant.status]]} transparent={dimmed} opacity={dimmed ? 0.3 : 1} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}
