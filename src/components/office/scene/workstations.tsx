"use client";

import { Instance, Instances } from "@react-three/drei";
import type { Seat } from "@/features/office/model";
import { sceneTheme, type SceneTokens } from "./scene-theme";

const toRadians = (deg: number) => (deg * Math.PI) / 180;

/** Offsets a point in the seat's local frame (desk faces -Z at rotation 0). */
export function seatLocal(seat: Seat, forward: number, up: number): [number, number, number] {
  const r = toRadians(seat.position.rotation);
  return [seat.position.x + Math.sin(r) * forward, up, seat.position.z + Math.cos(r) * forward];
}

/**
 * Desks, monitors, glowing screens and chairs for every desk seat, drawn with GPU instancing
 * (one draw call per part regardless of headcount). Meeting-room seats are chairs only.
 */
export function Workstations({ seats, tokens, performance }: { seats: Seat[]; tokens: SceneTokens; performance: boolean }) {
  const desks = seats.filter((s) => s.departmentSlug !== "meeting-room");
  const screenColor = (seat: Seat) => tokens[`dept-${seat.departmentSlug}` as keyof SceneTokens] ?? tokens.primary;

  return (
    <group>
      <Instances limit={Math.max(desks.length, 1)} castShadow={!performance} receiveShadow={!performance}>
        <boxGeometry args={[1.8, 0.9, 1.0]} />
        <meshStandardMaterial color={sceneTheme.desk} roughness={0.4} />
        {desks.map((s) => (
          <Instance key={s.id} position={seatLocal(s, 0, 0.45)} rotation={[0, toRadians(s.position.rotation), 0]} />
        ))}
      </Instances>

      <Instances limit={Math.max(desks.length, 1)}>
        <boxGeometry args={[1.1, 0.7, 0.08]} />
        <meshStandardMaterial color={sceneTheme.monitor} roughness={0.2} />
        {desks.map((s) => (
          <Instance key={s.id} position={seatLocal(s, -0.25, 1.3)} rotation={[0, toRadians(s.position.rotation), 0]} />
        ))}
      </Instances>

      <Instances limit={Math.max(desks.length, 1)}>
        <planeGeometry args={[1.0, 0.6]} />
        <meshBasicMaterial toneMapped={false} />
        {desks.map((s) => (
          <Instance
            key={s.id}
            color={screenColor(s)}
            position={seatLocal(s, -0.2, 1.3)}
            rotation={[0, toRadians(s.position.rotation), 0]}
          />
        ))}
      </Instances>

      <Instances limit={Math.max(desks.length, 1)} castShadow={!performance}>
        <boxGeometry args={[0.7, 0.9, 0.7]} />
        <meshStandardMaterial color={sceneTheme.chair} roughness={0.5} />
        {desks.map((s) => (
          <Instance key={s.id} position={seatLocal(s, 1.0, 0.45)} rotation={[0, toRadians(s.position.rotation), 0]} />
        ))}
      </Instances>
    </group>
  );
}
