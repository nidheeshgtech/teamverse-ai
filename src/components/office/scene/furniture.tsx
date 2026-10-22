"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { AnimationMixer, Color, MeshBasicMaterial, type Object3D } from "three";
import type { Occupant, Room, Seat } from "@/features/office/model";
import { FURNITURE_SCALE, useCharacter, useFurniture, useFurnitureSize, type CharacterName, type FurnitureName } from "./assets";
import { sceneTheme } from "./scene-theme";

const rad = (deg: number) => (deg * Math.PI) / 180;

// Model-facing corrections (Kenney models face different axes). In the seat frame the desk is at
// the origin, the person sits at +Z and looks toward -Z (where the monitor is).
const DESK_YAW = 0;
const CHAIR_YAW = Math.PI;
const MONITOR_YAW = Math.PI;
const PERSON_YAW = Math.PI;
const CHAIR_OFFSET = 0.95;
export const SEATED_HEAD_HEIGHT = 1.55;

/** A world position in a seat's local frame. */
export function seatPoint(seat: Seat, localZ: number, y: number): [number, number, number] {
  const r = rad(seat.position.rotation);
  return [seat.position.x + Math.sin(r) * localZ, y, seat.position.z + Math.cos(r) * localZ];
}

function Placed({ name, position, rotationY = 0, scale = 1 }: { name: FurnitureName; position: [number, number, number]; rotationY?: number; scale?: number }) {
  const object = useFurniture(name);
  // Always from the constant base scale: deriving it from object.scale would compound on every render.
  return <primitive object={object} position={position} rotation={[0, rotationY, 0]} scale={FURNITURE_SCALE * scale} />;
}

/** Desk, office chair, monitor (with a soft department-coloured glow) and keyboard for one seat. */
export function Workstation({ seat, glow }: { seat: Seat; glow: string }) {
  const desk = useFurnitureSize("desk");
  const yaw = rad(seat.position.rotation);
  const top = desk.y;
  const screenGlow = useMemo(() => new MeshBasicMaterial({ color: new Color(glow), transparent: true, opacity: 0.85, toneMapped: false }), [glow]);
  return (
    <group>
      <Placed name="desk" position={seatPoint(seat, 0, 0)} rotationY={yaw + DESK_YAW} />
      <Placed name="monitor" position={seatPoint(seat, -desk.z * 0.22, top)} rotationY={yaw + MONITOR_YAW} />
      <mesh position={seatPoint(seat, -desk.z * 0.22 + 0.05, top + 0.32)} rotation={[0, yaw, 0]} material={screenGlow}>
        <planeGeometry args={[0.66, 0.36]} />
      </mesh>
      <Placed name="keyboard" position={seatPoint(seat, desk.z * 0.15, top)} rotationY={yaw + MONITOR_YAW} />
      <Placed name="chair" position={seatPoint(seat, CHAIR_OFFSET, 0)} rotationY={yaw + CHAIR_YAW} />
    </group>
  );
}

/** Long table with cushioned chairs at each meeting seat. */
export function MeetingSet({ room, seats }: { room: Room; seats: Seat[] }) {
  const longSide = room.depth > room.width;
  return (
    <group>
      <Placed name="meetingTable" position={[room.x, 0, room.z]} rotationY={longSide ? Math.PI / 2 : 0} scale={1.6} />
      {seats.map((seat) => (
        <Placed key={seat.id} name="meetingChair" position={[seat.position.x, 0, seat.position.z]} rotationY={rad(seat.position.rotation) + CHAIR_YAW} />
      ))}
    </group>
  );
}

/** Plants, bookcases and lamps along each room's back wall, so rooms feel furnished. */
export function RoomDecor({ room }: { room: Room }) {
  const back = room.z - room.depth / 2 + 0.6;
  const left = room.x - room.width / 2 + 0.7;
  const right = room.x + room.width / 2 - 0.7;
  return (
    <group>
      <Placed name="plantLarge" position={[left, 0, back]} />
      <Placed name="bookcaseLow" position={[room.x + room.width * 0.18, 0, back - 0.1]} />
      <Placed name="floorLamp" position={[right, 0, back]} />
      <Placed name="plantSmall2" position={[right, 0, room.z + room.depth / 2 - 0.6]} />
    </group>
  );
}

/** A lounge (sofa, coffee table, rug, plants) at a free spot on the floor. */
export function Lounge({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Placed name="rug" position={[0, 0.01, 0]} scale={1.4} />
      <Placed name="sofa" position={[0, 0, -1.1]} />
      <Placed name="coffeeTable" position={[0, 0, 0.2]} />
      <Placed name="plantLarge" position={[2.2, 0, -1.2]} scale={1.1} />
      <Placed name="plantSmall1" position={[-2, 0, -1.1]} />
    </group>
  );
}

export function CornerPlants({ points }: { points: Array<[number, number]> }) {
  return (
    <group>
      {points.map(([x, z], i) => (
        <Placed key={`${x}:${z}`} name={i % 2 ? "plantLarge" : "plantSmall3"} position={[x, 0, z]} scale={i % 2 ? 1.2 : 1.1} />
      ))}
    </group>
  );
}

type PersonProps = {
  occupant: Occupant;
  character: CharacterName;
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
  ringColor: string;
  onHover: (userId: string | null) => void;
  onSelect: (userId: string) => void;
};

/**
 * A seated person (PLACEHOLDER character until commissioned assets arrive). Shown only while the
 * person is connected; an empty chair means "not connected", never a guess at where they are.
 */
export function SeatedPerson({ occupant, character, selected, hovered, dimmed, ringColor, onHover, onSelect }: PersonProps) {
  const { root, animations } = useCharacter(character);
  const invalidate = useThree((s) => s.invalidate);
  const seat = occupant.seat!;

  // Hold the "sit" pose (a single evaluated frame; nothing animates continuously).
  useEffect(() => {
    const clip = animations.find((a) => a.name === "sit") ?? animations.find((a) => a.name === "idle");
    if (!clip) return;
    const mixer = new AnimationMixer(root);
    mixer.clipAction(clip).play();
    mixer.setTime(clip.duration * 0.98);
    invalidate();
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
    };
  }, [animations, root, invalidate]);

  useEffect(() => {
    root.traverse((node: Object3D) => {
      const mesh = node as Object3D & { material?: { transparent: boolean; opacity: number } };
      if (mesh.material) {
        mesh.material.transparent = dimmed;
        mesh.material.opacity = dimmed ? 0.25 : 1;
      }
    });
    invalidate();
  }, [dimmed, root, invalidate]);

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

  const [x, , z] = seatPoint(seat, CHAIR_OFFSET, 0);
  return (
    <group position={[x, 0, z]} rotation={[0, rad(seat.position.rotation) + PERSON_YAW, 0]} onClick={handleClick} onPointerOver={handleOver} onPointerOut={handleOut} name={`avatar-${occupant.userId}`}>
      {selected || hovered ? (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.72, 40]} />
          <meshBasicMaterial color={selected ? ringColor : sceneTheme.hoverRing} transparent opacity={0.9} toneMapped={false} />
        </mesh>
      ) : null}
      <primitive object={root} scale={CHARACTER_SCALE} position={[0, SEAT_HEIGHT, 0]} />
    </group>
  );
}

/** Mini Characters are ~1 unit tall standing; scaled to ~1.75m. Seat height of the desk chair. */
const CHARACTER_SCALE = 2.1;
const SEAT_HEIGHT = 0.42;

/** Where a person's name tag floats (above the head). */
export function personTagAnchor(occupant: Occupant): [number, number, number] {
  return seatPoint(occupant.seat!, CHAIR_OFFSET, SEATED_HEAD_HEIGHT + 0.55);
}
